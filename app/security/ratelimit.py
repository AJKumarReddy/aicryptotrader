"""In-process rate limiting.

A token bucket per identity: the verified user id when the caller is signed
in, otherwise the peer address. Buckets refill continuously, so a client that
stays under its rate never sees a 429 while a burst is still absorbed.

Scope: this is per process. Behind several workers the effective limit is
`workers x limit`. That is fine as an abuse brake; if you need an exact global
limit, back `_BUCKETS` with Redis and keep the same interface.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import Lock

from fastapi import HTTPException, Request, status

from app.observability.metrics import rate_limit_rejections_total


@dataclass
class _Bucket:
    tokens: float
    updated_at: float
    capacity: float
    refill_per_second: float

    def consume(self, now: float) -> tuple[bool, float]:
        elapsed = max(0.0, now - self.updated_at)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_second)
        self.updated_at = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True, 0.0
        deficit = 1.0 - self.tokens
        return False, deficit / self.refill_per_second


@dataclass
class RateLimiter:
    _buckets: dict[tuple[str, str], _Bucket] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)
    _last_sweep: float = 0.0

    def check(self, scope: str, identity: str, per_minute: int) -> tuple[bool, float]:
        now = time.monotonic()
        capacity = float(per_minute)
        refill = per_minute / 60.0
        key = (scope, identity)

        with self._lock:
            self._sweep(now)
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(capacity, now, capacity, refill)
                self._buckets[key] = bucket
            else:
                bucket.capacity = capacity
                bucket.refill_per_second = refill
            return bucket.consume(now)

    def _sweep(self, now: float) -> None:
        # Drop buckets that have been full (i.e. idle) for a while so the map
        # cannot grow without bound from one-off client addresses.
        if now - self._last_sweep < 300.0:
            return
        self._last_sweep = now
        for key, bucket in list(self._buckets.items()):
            if now - bucket.updated_at > 900.0:
                del self._buckets[key]


def client_identity(request: Request) -> tuple[str, str]:
    """Return (kind, identity) for the caller.

    A verified user id is preferred over an address: it survives NAT and
    cannot be spoofed, whereas a forwarded header can be. `X-Forwarded-For`
    is only consulted when the deployment explicitly trusts a proxy.
    """
    principal = getattr(request.state, "principal", None)
    if principal is not None:
        return "user", principal.subject

    if request.app.state.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return "ip", forwarded.split(",")[0].strip()

    client = request.client
    return "ip", client.host if client else "unknown"


def enforce(request: Request, scope: str, per_minute: int) -> None:
    limiter: RateLimiter = request.app.state.rate_limiter
    kind, identity = client_identity(request)
    allowed, retry_after = limiter.check(scope, f"{kind}:{identity}", per_minute)
    if not allowed:
        rate_limit_rejections_total.labels(scope).inc()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate limit exceeded",
            headers={"Retry-After": str(max(1, int(retry_after) + 1))},
        )
