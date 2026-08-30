"""Prometheus metrics.

Label choice is deliberate. HTTP metrics are labelled with the *route
template* (`/api/market/chart/{symbol}`), never the raw path, so a scan of
ten thousand symbols produces one time series rather than ten thousand. For
the same reason no label carries a user id, a token, or anything else an
outsider controls.

What each metric is for:
  * `http_*`            - is the API up, fast, and returning what it should
  * `upstream_*`        - is a data provider slow or failing, and which one
  * `cache_events_total`- the hit rate that keeps us inside the free-tier quota
  * `auth_failures_total` / `rate_limit_rejections_total` - abuse signal
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram

REGISTRY = CollectorRegistry()

http_requests_total = Counter(
    "http_requests_total",
    "HTTP requests handled, by route template and status.",
    ["method", "route", "status"],
    registry=REGISTRY,
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "Time to handle a request, by route template.",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

http_requests_in_flight = Gauge(
    "http_requests_in_flight",
    "Requests currently being handled.",
    registry=REGISTRY,
)

upstream_requests_total = Counter(
    "upstream_requests_total",
    "Calls to third-party providers, by provider and outcome.",
    ["provider", "outcome"],
    registry=REGISTRY,
)

upstream_request_duration_seconds = Histogram(
    "upstream_request_duration_seconds",
    "Time spent waiting on a third-party provider.",
    ["provider"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=REGISTRY,
)

cache_events_total = Counter(
    "cache_events_total",
    "Cache lookups, by cache key prefix and result.",
    ["name", "result"],
    registry=REGISTRY,
)

auth_failures_total = Counter(
    "auth_failures_total",
    "Rejected authentication attempts, by reason.",
    ["reason"],
    registry=REGISTRY,
)

rate_limit_rejections_total = Counter(
    "rate_limit_rejections_total",
    "Requests rejected by the rate limiter, by scope.",
    ["scope"],
    registry=REGISTRY,
)


def provider_of(host: str) -> str:
    """Collapse a hostname to a short, bounded provider label."""
    known = {
        "api.coingecko.com": "coingecko",
        "api.exchange.coinbase.com": "coinbase",
        "api.kraken.com": "kraken",
        "api.alternative.me": "alternative_me",
        "coins.llama.fi": "defillama",
        "api.coinpaprika.com": "coinpaprika",
    }
    if host in known:
        return known[host]
    if "clerk" in host:
        return "clerk"
    if "supabase" in host or host.startswith("db."):
        return "supabase"
    return "other"


@contextmanager
def observe_upstream(provider: str) -> Iterator[dict[str, str]]:
    """Time an upstream call and record its outcome.

    The caller sets `outcome` in the yielded dict; an exception records
    "error" automatically.
    """
    result = {"outcome": "success"}
    started = time.perf_counter()
    try:
        yield result
    except Exception:
        # Only fill in a generic outcome if the caller has not already
        # classified the failure more precisely.
        if result["outcome"] == "success":
            result["outcome"] = "error"
        raise
    finally:
        upstream_request_duration_seconds.labels(provider).observe(
            time.perf_counter() - started
        )
        upstream_requests_total.labels(provider, result["outcome"]).inc()


def record_cache(key: str, hit: bool) -> None:
    # Key prefix only: "market:candles:BTC:7" becomes "market:candles".
    name = ":".join(key.split(":")[:2]) or "unknown"
    cache_events_total.labels(name, "hit" if hit else "miss").inc()
