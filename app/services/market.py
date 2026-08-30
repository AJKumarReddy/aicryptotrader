"""Market data, fetched server-side and cached.

Provider choice is deliberate and was checked against the live endpoints:
Binance answers HTTP 451 from restricted regions, so candles come from
Coinbase Exchange with Kraken as a fallback. CoinGecko is used for the
catalogue and the aggregate numbers it is uniquely good at.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import Settings
from app.security.errors import bad_gateway
from app.services.cache import TTLCache
from app.services.upstream import get_json

SYMBOL_RE = re.compile(r"^[A-Z0-9]{2,12}$")

# Coinbase accepts a fixed set of granularities and caps a response at 300
# candles, so each window is paired with the coarsest granularity that covers
# it without truncation.
_GRANULARITY_BY_DAYS: list[tuple[int, int]] = [
    (1, 300),
    (7, 3600),
    (30, 21600),
    (365, 86400),
]

# Kraken denominates bitcoin as XBT.
_KRAKEN_ALIASES = {"BTC": "XBT"}


def normalise_symbol(symbol: str) -> str:
    """Validate a caller-supplied ticker before it reaches a URL path."""
    candidate = symbol.strip().upper()
    if not SYMBOL_RE.match(candidate):
        raise ValueError("symbol must be 2-12 alphanumeric characters")
    return candidate


def _granularity_for(days: int) -> int:
    for max_days, granularity in _GRANULARITY_BY_DAYS:
        if days <= max_days:
            return granularity
    return 86400


class MarketService:
    def __init__(
        self, settings: Settings, client: httpx.AsyncClient, cache: TTLCache
    ) -> None:
        self._settings = settings
        self._client = client
        self._cache = cache

    @property
    def _coingecko_headers(self) -> dict[str, str]:
        key = self._settings.coingecko_demo_api_key
        return {"x-cg-demo-api-key": key} if key else {}

    async def global_stats(self) -> dict[str, Any]:
        async def fetch() -> dict[str, Any]:
            payload = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/global",
                headers=self._coingecko_headers,
            )
            data = payload.get("data", {})
            return {
                "active_cryptocurrencies": data.get("active_cryptocurrencies"),
                "markets": data.get("markets"),
                "total_market_cap_usd": data.get("total_market_cap", {}).get("usd"),
                "total_volume_usd": data.get("total_volume", {}).get("usd"),
                "market_cap_percentage": data.get("market_cap_percentage", {}),
                "market_cap_change_percentage_24h_usd": data.get(
                    "market_cap_change_percentage_24h_usd"
                ),
            }

        return await self._cache.get_or_fetch("market:global", 120, fetch)

    async def coins(self, limit: int, page: int) -> list[dict[str, Any]]:
        async def fetch() -> list[dict[str, Any]]:
            payload = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/coins/markets",
                params={
                    "vs_currency": "usd",
                    "order": "market_cap_desc",
                    "per_page": limit,
                    "page": page,
                    "sparkline": "false",
                    "price_change_percentage": "1h,24h,7d",
                },
                headers=self._coingecko_headers,
            )
            if not isinstance(payload, list):
                raise bad_gateway()
            return [
                {
                    "id": coin.get("id"),
                    "symbol": (coin.get("symbol") or "").upper(),
                    "name": coin.get("name"),
                    "image": coin.get("image"),
                    "current_price": coin.get("current_price"),
                    "market_cap": coin.get("market_cap"),
                    "market_cap_rank": coin.get("market_cap_rank"),
                    "total_volume": coin.get("total_volume"),
                    "price_change_percentage_1h": coin.get(
                        "price_change_percentage_1h_in_currency"
                    ),
                    "price_change_percentage_24h": coin.get(
                        "price_change_percentage_24h_in_currency"
                    ),
                    "price_change_percentage_7d": coin.get(
                        "price_change_percentage_7d_in_currency"
                    ),
                }
                for coin in payload
            ]

        return await self._cache.get_or_fetch(f"market:coins:{limit}:{page}", 60, fetch)

    async def trending(self) -> list[dict[str, Any]]:
        async def fetch() -> list[dict[str, Any]]:
            payload = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/search/trending",
                headers=self._coingecko_headers,
            )
            return [
                {
                    "id": entry.get("item", {}).get("id"),
                    "symbol": (entry.get("item", {}).get("symbol") or "").upper(),
                    "name": entry.get("item", {}).get("name"),
                    "thumb": entry.get("item", {}).get("thumb"),
                    "market_cap_rank": entry.get("item", {}).get("market_cap_rank"),
                }
                for entry in payload.get("coins", [])
            ]

        return await self._cache.get_or_fetch("market:trending", 300, fetch)

    async def resolve_symbol(self, symbol: str) -> dict[str, Any] | None:
        """Map a ticker to its CoinGecko id, display name and spot price.

        Doing this on the server keeps the lookup cached and off the free-tier
        quota. The old client-side path fell back to `/coins/list`, a 1.2 MB
        download, on every miss.
        """
        symbol = normalise_symbol(symbol)

        async def fetch() -> dict[str, Any] | None:
            # The top of the market covers almost every real lookup and is
            # already cached for the coin table.
            for coin in await self.coins(250, 1):
                if coin["symbol"] == symbol:
                    return {
                        "coin_id": coin["id"],
                        "symbol": coin["symbol"],
                        "name": coin["name"],
                        "current_price": coin["current_price"],
                    }

            # Otherwise ask the search index, then price the best match.
            search = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/search",
                params={"query": symbol},
                headers=self._coingecko_headers,
            )
            match = next(
                (
                    c
                    for c in search.get("coins", [])
                    if (c.get("symbol") or "").upper() == symbol
                ),
                None,
            )
            if match is None:
                return None

            coin_id = match["id"]
            prices = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/simple/price",
                params={"ids": coin_id, "vs_currencies": "usd"},
                headers=self._coingecko_headers,
            )
            return {
                "coin_id": coin_id,
                "symbol": symbol,
                "name": match.get("name") or symbol,
                "current_price": prices.get(coin_id, {}).get("usd"),
            }

        return await self._cache.get_or_fetch(f"market:resolve:{symbol}", 300, fetch)

    async def candles(self, symbol: str, days: int) -> dict[str, Any]:
        symbol = normalise_symbol(symbol)
        granularity = _granularity_for(days)

        async def fetch() -> dict[str, Any]:
            try:
                rows = await self._coinbase_candles(symbol, granularity)
                source = "coinbase"
            except Exception:
                rows = await self._kraken_candles(symbol, granularity)
                source = "kraken"
            expected = (days * 86400) // granularity
            return {
                "symbol": symbol,
                "days": days,
                "granularity_seconds": granularity,
                "source": source,
                "candles": rows[-expected:] if expected else rows,
            }

        return await self._cache.get_or_fetch(
            f"market:candles:{symbol}:{days}", 60, fetch
        )

    async def _coinbase_candles(
        self, symbol: str, granularity: int
    ) -> list[dict[str, Any]]:
        payload = await get_json(
            self._client,
            f"{self._settings.coinbase_base_url}/products/{symbol}-USD/candles",
            params={"granularity": granularity},
        )
        if not isinstance(payload, list):
            raise bad_gateway()
        # Coinbase returns [time, low, high, open, close, volume], newest first.
        rows = [
            {
                "time": int(row[0]),
                "low": float(row[1]),
                "high": float(row[2]),
                "open": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
            for row in payload
            if isinstance(row, list) and len(row) >= 6
        ]
        if not rows:
            raise bad_gateway()
        return sorted(rows, key=lambda r: r["time"])

    async def _kraken_candles(
        self, symbol: str, granularity: int
    ) -> list[dict[str, Any]]:
        pair = f"{_KRAKEN_ALIASES.get(symbol, symbol)}USD"
        payload = await get_json(
            self._client,
            f"{self._settings.kraken_base_url}/OHLC",
            params={"pair": pair, "interval": max(1, granularity // 60)},
        )
        if payload.get("error"):
            raise bad_gateway()
        result = payload.get("result", {})
        series = next((v for k, v in result.items() if k != "last"), [])
        # Kraken returns [time, open, high, low, close, vwap, volume, count].
        rows = [
            {
                "time": int(row[0]),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[6]),
            }
            for row in series
            if isinstance(row, list) and len(row) >= 7
        ]
        if not rows:
            raise bad_gateway()
        return sorted(rows, key=lambda r: r["time"])
