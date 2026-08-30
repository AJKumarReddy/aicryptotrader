"""A small async TTL cache with single-flight semantics.

The point is not speed, it is protecting the upstream quota: CoinGecko's demo
tier allows roughly 30 calls a minute across the whole deployment, so a
hundred browsers refreshing a dashboard must collapse into one upstream call.
Concurrent misses on the same key wait on one in-flight fetch rather than
each firing their own request.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.observability.metrics import record_cache


@dataclass
class _Entry:
    value: Any
    expires_at: float


@dataclass
class TTLCache:
    _entries: dict[str, _Entry] = field(default_factory=dict)
    _locks: dict[str, asyncio.Lock] = field(default_factory=dict)

    def get(self, key: str) -> Any | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at < time.monotonic():
            self._entries.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        self._entries[key] = _Entry(value, time.monotonic() + ttl_seconds)

    async def get_or_fetch(
        self,
        key: str,
        ttl_seconds: float,
        fetch: Callable[[], Awaitable[Any]],
    ) -> Any:
        cached = self.get(key)
        if cached is not None:
            record_cache(key, hit=True)
            return cached

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # Another coroutine may have populated the key while we waited.
            cached = self.get(key)
            if cached is not None:
                record_cache(key, hit=True)
                return cached
            record_cache(key, hit=False)
            value = await fetch()
            self.set(key, value, ttl_seconds)
            return value
        # NB: locks are intentionally retained; the key space is bounded by
        # the route set, not by user input.

    def clear(self) -> None:
        self._entries.clear()
