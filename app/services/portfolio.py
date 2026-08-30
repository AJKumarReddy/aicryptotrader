"""Portfolio storage and valuation.

Two rules govern everything in this module:

  1. The owner of a row is always the verified `sub` from the caller's token.
     A user id is never read from the request body or the query string, so a
     caller cannot read or write somebody else's holdings by naming them.
  2. The caller's own token is forwarded to PostgREST, which means the
     existing row-level security policies still run. Application-level
     filtering and RLS have to agree before a row is returned; neither alone
     is the only thing standing between two users' data.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import Settings
from app.security.errors import bad_gateway
from app.services.cache import TTLCache
from app.services.upstream import get_json

TABLE = "portfolio_holdings"

_HOLDING_COLUMNS = "id,user_id,symbol,name,coin_id,amount,avg_price,purchase_date,notes,created_at"


class PortfolioRepository:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._client = client

    @property
    def _base(self) -> str:
        return f"{self._settings.supabase_url.rstrip('/')}/rest/v1/{TABLE}"

    def _headers(self, token: str, *, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "apikey": self._settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    async def list_for_user(self, subject: str, token: str) -> list[dict[str, Any]]:
        response = await self._request(
            "GET",
            params={
                "select": _HOLDING_COLUMNS,
                "user_id": f"eq.{subject}",
                "order": "created_at.desc",
            },
            token=token,
        )
        return response if isinstance(response, list) else []

    async def insert(
        self, subject: str, token: str, holding: dict[str, Any]
    ) -> dict[str, Any]:
        # The owner is stamped from the verified token, overriding anything
        # the client may have sent.
        payload = {**holding, "user_id": subject}
        rows = await self._request(
            "POST",
            token=token,
            json=payload,
            extra_headers={
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            params={"select": _HOLDING_COLUMNS},
        )
        if not isinstance(rows, list) or not rows:
            raise bad_gateway("the holding could not be saved")
        return rows[0]

    async def delete(self, subject: str, token: str, holding_id: str) -> bool:
        rows = await self._request(
            "DELETE",
            token=token,
            params={"id": f"eq.{holding_id}", "user_id": f"eq.{subject}"},
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(rows)

    async def _request(
        self,
        method: str,
        *,
        token: str,
        params: dict[str, str] | None = None,
        json: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        try:
            response = await self._client.request(
                method,
                self._base,
                params=params,
                json=json,
                headers=self._headers(token, extra=extra_headers),
            )
            response.raise_for_status()
            if response.status_code == 204 or not response.content:
                return []
            return response.json()
        except httpx.HTTPStatusError as exc:
            # A PostgREST 401/403 means RLS rejected the token. Surface it as
            # an auth failure rather than a generic upstream error.
            if exc.response.status_code in (401, 403):
                raise bad_gateway("the database rejected this session") from None
            raise bad_gateway("the database is unavailable") from None
        except httpx.HTTPError:
            raise bad_gateway("the database is unavailable") from None
        except ValueError:
            raise bad_gateway("the database returned an unreadable response") from None


class InMemoryPortfolioRepository:
    """Development-only storage, for use with the local dev issuer.

    Supabase will not accept a token it did not issue, so a locally minted
    dev token cannot reach the real table - the request fails at PostgREST,
    not in our code. This stands in so the app is usable while signed in as a
    dev user.

    It keeps the rule that matters: rows are keyed by the verified subject
    and every read filters on it, so the isolation behaviour under test is
    the same one that runs in production. Data lives for the life of the
    process and is never written anywhere.
    """

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    async def list_for_user(self, subject: str, token: str) -> list[dict[str, Any]]:
        return [row for row in self._rows if row["user_id"] == subject]

    async def insert(
        self, subject: str, token: str, holding: dict[str, Any]
    ) -> dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "purchase_date": None,
            "notes": None,
            "created_at": datetime.now(tz=UTC).isoformat(),
            **holding,
            # Stamped last: the owner is never taken from the payload.
            "user_id": subject,
        }
        self._rows.append(row)
        return row

    async def delete(self, subject: str, token: str, holding_id: str) -> bool:
        matched = [
            r for r in self._rows if r["id"] == holding_id and r["user_id"] == subject
        ]
        self._rows = [r for r in self._rows if r not in matched]
        return bool(matched)


class PortfolioService:
    def __init__(
        self,
        settings: Settings,
        repository: PortfolioRepository,
        client: httpx.AsyncClient,
        cache: TTLCache,
    ) -> None:
        self._settings = settings
        self._repository = repository
        self._client = client
        self._cache = cache

    async def summary(self, subject: str, token: str) -> dict[str, Any]:
        holdings = await self._repository.list_for_user(subject, token)
        if not holdings:
            return {
                "total_portfolio_value": 0.0,
                "total_invested": 0.0,
                "total_profit_or_loss": 0.0,
                "total_profit_or_loss_percentage": 0.0,
                "holdings": [],
            }

        coin_ids = sorted({h["coin_id"] for h in holdings if h.get("coin_id")})
        prices = await self.prices(coin_ids)
        return self._aggregate(holdings, prices)

    async def add_holding(
        self, subject: str, token: str, holding: dict[str, Any]
    ) -> dict[str, Any]:
        return await self._repository.insert(subject, token, holding)

    async def remove_holding(
        self, subject: str, token: str, holding_id: str
    ) -> bool:
        return await self._repository.delete(subject, token, holding_id)

    async def prices(self, coin_ids: list[str]) -> dict[str, float]:
        """Batch-fetch spot prices, one upstream call for the whole portfolio."""
        if not coin_ids:
            return {}

        key = "price:" + ",".join(coin_ids)

        async def fetch() -> dict[str, float]:
            payload = await get_json(
                self._client,
                f"{self._settings.coingecko_base_url}/simple/price",
                params={"ids": ",".join(coin_ids), "vs_currencies": "usd"},
                headers=(
                    {"x-cg-demo-api-key": self._settings.coingecko_demo_api_key}
                    if self._settings.coingecko_demo_api_key
                    else {}
                ),
            )
            return {
                coin_id: float(entry["usd"])
                for coin_id, entry in payload.items()
                if isinstance(entry, dict) and entry.get("usd") is not None
            }

        return await self._cache.get_or_fetch(key, 60, fetch)

    def _aggregate(
        self, holdings: list[dict[str, Any]], prices: dict[str, float]
    ) -> dict[str, Any]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for holding in holdings:
            grouped[holding["symbol"]].append(holding)

        aggregated: list[dict[str, Any]] = []
        total_value = 0.0
        total_invested = 0.0

        for symbol, entries in grouped.items():
            quantity = sum(float(e["amount"]) for e in entries)
            invested = sum(float(e["amount"]) * float(e["avg_price"]) for e in entries)
            coin_id = entries[0].get("coin_id") or ""
            # Fall back to the average buy price when the provider has no
            # quote, so an unknown coin reads as flat rather than as a
            # total loss.
            average_price = invested / quantity if quantity else 0.0
            current_price = prices.get(coin_id, average_price)
            value = quantity * current_price
            profit = value - invested

            total_value += value
            total_invested += invested

            aggregated.append(
                {
                    "symbol": symbol,
                    "name": entries[0].get("name"),
                    "coin_id": coin_id,
                    "total_quantity": quantity,
                    "average_buy_price": average_price,
                    "total_invested": invested,
                    "current_price": current_price,
                    "current_value": value,
                    "profit_or_loss": profit,
                    "profit_or_loss_percentage": (
                        (profit / invested * 100.0) if invested else 0.0
                    ),
                    "priced": coin_id in prices,
                    "entries": [
                        {
                            "id": e["id"],
                            "symbol": e["symbol"],
                            "quantity": float(e["amount"]),
                            "price_used": float(e["avg_price"]),
                            "total_cost": float(e["amount"]) * float(e["avg_price"]),
                            "purchase_date": e.get("purchase_date"),
                            "notes": e.get("notes"),
                            "name": e.get("name"),
                            "coin_id": e.get("coin_id"),
                        }
                        for e in entries
                    ],
                }
            )

        aggregated.sort(key=lambda h: h["current_value"], reverse=True)
        total_profit = total_value - total_invested
        return {
            "total_portfolio_value": total_value,
            "total_invested": total_invested,
            "total_profit_or_loss": total_profit,
            "total_profit_or_loss_percentage": (
                (total_profit / total_invested * 100.0) if total_invested else 0.0
            ),
            "holdings": aggregated,
        }
