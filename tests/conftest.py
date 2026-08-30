"""Test harness.

Every outbound call is served by an in-process transport, so the suite is
hermetic: no network, no Clerk instance, no Supabase project. The fake
PostgREST keeps rows per user id and refuses to serve rows whose owner does
not match the filter, which is what lets the isolation tests mean something.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from app.config import Settings
from app.main import create_app

ISSUER = "https://clerk.test.local"
KID = "test-key-1"
OTHER_ISSUER = "https://evil.test.local"


@pytest.fixture(scope="session")
def keypair() -> tuple[Any, Any]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


@pytest.fixture(scope="session")
def jwks(keypair) -> dict[str, Any]:
    _, public_key = keypair
    jwk = json.loads(RSAAlgorithm.to_jwk(public_key))
    jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


@pytest.fixture
def make_token(keypair):
    private_key, _ = keypair

    def _make(
        subject: str = "user_alice",
        *,
        issuer: str = ISSUER,
        expires_in: int = 300,
        kid: str | None = KID,
        algorithm: str = "RS256",
        key: Any = None,
        **extra: Any,
    ) -> str:
        now = int(time.time())
        payload = {
            "sub": subject,
            "iss": issuer,
            "iat": now,
            "exp": now + expires_in,
            "email": f"{subject}@example.com",
            "sid": "sess_" + subject,
            **extra,
        }
        headers = {"kid": kid} if kid else {}
        return jwt.encode(
            payload,
            key if key is not None else private_key,
            algorithm=algorithm,
            headers=headers,
        )

    return _make


class FakePostgrest:
    """A minimal stand-in for the portfolio_holdings table."""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        params = request.url.params
        owner = (params.get("user_id") or "").removeprefix("eq.")

        if request.method == "GET":
            matched = [r for r in self.rows if r["user_id"] == owner]
            return httpx.Response(200, json=matched)

        if request.method == "POST":
            body = json.loads(request.content)
            row = {
                "id": str(uuid.uuid4()),
                "purchase_date": None,
                "notes": None,
                "created_at": "2026-01-01T00:00:00Z",
                **body,
            }
            self.rows.append(row)
            return httpx.Response(201, json=[row])

        if request.method == "DELETE":
            target = (params.get("id") or "").removeprefix("eq.")
            hit = [
                r for r in self.rows if r["id"] == target and r["user_id"] == owner
            ]
            self.rows = [r for r in self.rows if r not in hit]
            return httpx.Response(200, json=hit)

        return httpx.Response(405, json={"message": "not allowed"})


@pytest.fixture
def db() -> FakePostgrest:
    return FakePostgrest()


@pytest.fixture
def upstream_calls() -> dict[str, int]:
    return {}


@pytest.fixture
def transport(jwks, db, upstream_calls) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        host = request.url.host
        path = request.url.path
        upstream_calls[path] = upstream_calls.get(path, 0) + 1

        if url.startswith(f"{ISSUER}/.well-known/jwks.json"):
            return httpx.Response(200, json=jwks)

        if host == "api.coingecko.com":
            if path.endswith("/global"):
                return httpx.Response(
                    200,
                    json={
                        "data": {
                            "active_cryptocurrencies": 17000,
                            "markets": 1200,
                            "total_market_cap": {"usd": 2.5e12},
                            "total_volume": {"usd": 9.9e10},
                            "market_cap_percentage": {"btc": 54.2, "eth": 11.1},
                            "market_cap_change_percentage_24h_usd": 1.23,
                        }
                    },
                )
            if path.endswith("/coins/markets"):
                return httpx.Response(
                    200,
                    json=[
                        {
                            "id": "bitcoin",
                            "symbol": "btc",
                            "name": "Bitcoin",
                            "current_price": 78000.0,
                            "market_cap": 1.5e12,
                            "market_cap_rank": 1,
                            "total_volume": 3.3e10,
                            "image": "https://img.test/btc.png",
                            "price_change_percentage_24h_in_currency": 0.8,
                        }
                    ],
                )
            if path.endswith("/search/trending"):
                return httpx.Response(
                    200,
                    json={
                        "coins": [
                            {
                                "item": {
                                    "id": "solana",
                                    "symbol": "sol",
                                    "name": "Solana",
                                    "thumb": "https://img.test/sol.png",
                                    "market_cap_rank": 5,
                                }
                            }
                        ]
                    },
                )
            if path.endswith("/simple/price"):
                ids = (request.url.params.get("ids") or "").split(",")
                prices = {"bitcoin": 78000.0, "ethereum": 4200.0}
                return httpx.Response(
                    200,
                    json={i: {"usd": prices[i]} for i in ids if i in prices},
                )

        if host == "api.exchange.coinbase.com":
            # [time, low, high, open, close, volume], newest first.
            return httpx.Response(
                200,
                json=[
                    [1788048000, 77000.0, 79000.0, 77500.0, 78500.0, 900.0],
                    [1787961600, 76000.0, 78000.0, 76500.0, 77500.0, 850.0],
                ],
            )

        if host == "api.kraken.com":
            return httpx.Response(
                200,
                json={
                    "error": [],
                    "result": {
                        "XXBTZUSD": [
                            [1787961600, "76500", "78000", "76000", "77500", "0", "850", 10]
                        ],
                        "last": 1787961600,
                    },
                },
            )

        if host == "api.alternative.me":
            return httpx.Response(
                200,
                json={
                    "name": "Fear and Greed Index",
                    "data": [
                        {
                            "value": "69",
                            "value_classification": "Greed",
                            "timestamp": "1788048000",
                            "time_until_update": "45534",
                        },
                        {
                            "value": "68",
                            "value_classification": "Greed",
                            "timestamp": "1787961600",
                        },
                    ],
                },
            )

        if host == "db.test.local":
            return db.handle(request)

        return httpx.Response(404, json={"message": f"unmocked: {url}"})

    return httpx.MockTransport(handler)


@pytest.fixture
def settings() -> Settings:
    # _env_file=None so a developer's local .env cannot change what the suite
    # tests. Every value the tests depend on is set explicitly here.
    return Settings(
        _env_file=None,
        environment="development",
        clerk_issuer=ISSUER,
        supabase_url="https://db.test.local",
        supabase_anon_key="anon-key-for-tests",
        cors_allow_origins=["http://localhost:8080"],
        rate_limit_public_per_minute=60,
        rate_limit_authed_per_minute=120,
        rate_limit_write_per_minute=20,
    )


@pytest.fixture
def client(settings, transport) -> TestClient:
    app = create_app(settings)
    # Install the mock transport before startup so the services built during
    # lifespan are bound to it.
    app.state.http_transport = transport
    # raise_server_exceptions=False so the app's own 500 handler runs, which
    # is what we assert on.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
