# AICryptoTrader — backend

FastAPI service behind the React dashboard in `AICryptoTrader/`. It owns the
things a browser must not: upstream API keys, identity verification, and the
authority to decide whose portfolio rows a request may touch.

## Setup

```sh
uv sync --extra dev        # installs into .venv
cp .env.example .env       # then fill in the two required values
uv run main.py             # http://127.0.0.1:8000, docs at /docs
```

Two settings are required for authenticated routes to work:

| Variable | Where to find it |
| --- | --- |
| `CLERK_ISSUER` | Clerk dashboard → API keys → Frontend API URL, e.g. `https://sunny-mammal-12.clerk.accounts.dev`. The backend reads `${CLERK_ISSUER}/.well-known/jwks.json`. |
| `SUPABASE_ANON_KEY` | Supabase → Project settings → API → `anon` key. Not the service-role key — see below. |

Without them the app still starts and serves public market data, but every
authenticated route returns 401 and `/readyz` reports `auth: false`. It fails
closed, never open.

## Endpoints

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /healthz`, `GET /readyz` | — | Liveness; readiness reports config, not internals |
| `GET /api/market/global` | optional | Cached 2 min |
| `GET /api/market/coins?limit=&page=` | optional | Cached 1 min |
| `GET /api/market/trending` | optional | Cached 5 min |
| `GET /api/market/chart/{symbol}?days=` | optional | Coinbase, falling back to Kraken |
| `GET /api/market/coin/{symbol}` | optional | Ticker → id, name, spot price |
| `GET /api/sentiment/fear-greed?limit=` | optional | Cached 1 h; the index updates daily |
| `GET /api/me` | **required** | Echoes the verified identity — a login smoke test |
| `GET /api/portfolio` | **required** | Aggregated holdings with live P&L |
| `POST /api/portfolio/holdings` | **required** | Returns the updated summary |
| `DELETE /api/portfolio/holdings/{id}` | **required** | |
| `GET /metrics` | token | Prometheus exposition; see Observability |

Signing in is not required to read market data, but it raises the rate limit
from 60 to 120 requests a minute.

## The security model

**Identity comes from the token, never from the request.** The frontend
already signs users in with Clerk; this service verifies that JWT against the
issuer's JWKS — pinned to RS256, checked for expiry and issuer, with the
signing key cached and refetched at most once per 30 s on an unknown `kid`.
The `sub` claim is the only user identity the server will act on. No route
accepts a user id, and `AddHoldingRequest` forbids extra fields, so a client
that smuggles `user_id` is rejected rather than obeyed.

This closed a real hole. The frontend used to call
`getPortfolio(user.id, …)`, passing the user id from the browser with nothing
verifying it; that parameter no longer exists.

**Row-level security still runs.** The caller's own token is forwarded to
PostgREST, so the existing RLS policies keyed on the Clerk `sub` apply to
every query — and the backend independently filters by the verified subject.
Both must agree before a row is returned. This is why the service needs only
the `anon` key: a service-role key would bypass RLS and make the application
filter the only thing between two users' data. **Do not add one.**

Also in place: an origin allowlist for CORS (never `*` with credentials),
per-identity token-bucket rate limiting, security headers, a 64 KB body cap
enforced before parsing, bounded and pattern-checked input on every
parameter that reaches a URL or a query, generic 500s with a correlating
`X-Request-ID` so internal detail goes to the log rather than the client, and
docs disabled when `ENVIRONMENT=production`.

Caching is a security control here too, not just a speed one: CoinGecko's
demo tier allows ~30 calls/min for the whole deployment, so concurrent
requests for the same key collapse into a single upstream call.

## Observability

**Logs.** One structured line per request on `app.access` — method, route
template, status, duration, request id, and the verified user. `LOG_FORMAT`
picks JSON or human-readable text; the default follows the environment. Every
line written anywhere under a request carries that request's id, including
from services several layers down, because the context lives in a context
variable rather than being passed around. uvicorn's own logs are routed
through the same handler so everything has one shape.

The id is returned to the caller as `X-Request-ID` and included in every
error body, so a user can quote it and you can grep out that one request. An
inbound `X-Request-ID` is honoured for tracing across services, but stripped
of anything that could forge a log line or a header.

A redaction filter runs over every record, so a stray `logger.debug(headers)`
in future code cannot leak a token. The access log never touches the
`Authorization` header in the first place.

**Metrics.** Prometheus exposition at `/metrics`:

| Metric | Answers |
| --- | --- |
| `http_requests_total`, `http_request_duration_seconds`, `http_requests_in_flight` | Is the API up, fast, and returning what it should? |
| `upstream_requests_total`, `upstream_request_duration_seconds` | Which provider is slow or failing? |
| `cache_events_total` | The hit rate that keeps us inside the free-tier quota |
| `auth_failures_total`, `rate_limit_rejections_total` | Abuse signal, by reason and scope |

HTTP metrics are labelled with the **route template**
(`/api/market/chart/{symbol}`), never the raw path, so a scan over ten
thousand symbols produces one time series rather than ten thousand. No label
carries a user id or anything else an outsider controls.

`/metrics` describes traffic shape and error rates, which is as useful to
someone probing the service as to an operator. Set `METRICS_TOKEN` to require
a bearer token (compared in constant time), or `METRICS_ENABLED=false` to
remove it entirely.

## Tests

```sh
uv run pytest
```

76 tests, fully hermetic — no network, no Clerk instance, no Supabase
project. The suite in `tests/test_security.py` asserts that specific attacks
fail: `alg:none` forgery, HS256-signed-with-the-public-key algorithm
confusion, tokens from another issuer or signed by an unknown key, expired
tokens, cross-user reads and deletes, and client-supplied ownership.

## The frontend

The dashboard now talks only to this service. `AICryptoTrader/src/lib/api.ts`
is the single client; set `VITE_API_URL` in `AICryptoTrader/.env.local`
(default `http://127.0.0.1:8000`) and run the dev server on port 8080, which
is already in the backend's CORS allowlist.

No provider key ships in the bundle any more, and no portfolio call sends a
user id — `getPortfolio(refreshToken)` takes only the token getter, because
the server decides whose rows those are.

One page is deliberately untouched: `Screener` still calls Covalent with the
demo key `ckey_demo`, which now returns 401 — that call is dead, and the
replacement (GoldRush) has no standing free tier, so it needs a credential
decision rather than a code change. `MarketPulse` and `SentimentAnalysis`
still render values generated by `Math.random()`; they were never wired to a
real source, and a genuine one (LunarCrush, Santiment) is a paid dependency.

## Deployment notes

Run `uvicorn app.main:app` behind a TLS-terminating proxy and set
`ENVIRONMENT=production` (which enables HSTS, disables `/docs`, and starts
honouring `X-Forwarded-For` for rate-limit identity — so only set it when a
trusted proxy is actually in front). Rate-limit state is per process: with
several workers the effective limit is `workers × limit`, which is fine as an
abuse brake. For an exact global limit, back `RateLimiter` with Redis; the
interface is a single `check()` call.
