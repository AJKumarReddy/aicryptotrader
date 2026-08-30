"""Market sentiment.

The Fear and Greed index updates once a day - the upstream response carries a
`time_until_update` countdown - so it is cached for an hour rather than
refetched on every dashboard mount as the frontend does today.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings
from app.security.errors import bad_gateway
from app.services.cache import TTLCache
from app.services.upstream import get_json


class SentimentService:
    def __init__(
        self, settings: Settings, client: httpx.AsyncClient, cache: TTLCache
    ) -> None:
        self._settings = settings
        self._client = client
        self._cache = cache

    async def fear_greed(self, limit: int) -> dict[str, Any]:
        async def fetch() -> dict[str, Any]:
            payload = await get_json(
                self._client,
                self._settings.fear_greed_url,
                params={"limit": limit},
            )
            entries = payload.get("data")
            if not isinstance(entries, list) or not entries:
                raise bad_gateway()

            history = [
                {
                    "value": int(entry["value"]),
                    "classification": entry.get("value_classification"),
                    "timestamp": int(entry["timestamp"]),
                }
                for entry in entries
                if entry.get("value") is not None
            ]
            latest = history[0]
            return {
                "value": latest["value"],
                "classification": latest["classification"],
                "timestamp": latest["timestamp"],
                "seconds_until_update": _as_int(entries[0].get("time_until_update")),
                "history": history,
            }

        return await self._cache.get_or_fetch(f"sentiment:fng:{limit}", 3600, fetch)


def _as_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
