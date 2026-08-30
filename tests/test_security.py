"""Tests for the security layer.

These are the ones worth reading: each asserts that a specific attack does
not work, rather than that a happy path does.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization

from tests.conftest import ISSUER, KID, OTHER_ISSUER, auth

PROTECTED = ["/api/me", "/api/portfolio"]


# --- Authentication is required and fails closed -------------------------


@pytest.mark.parametrize("path", PROTECTED)
def test_protected_routes_reject_anonymous_callers(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "header",
    ["", "Bearer", "Bearer ", "Basic abc123", "Token abc123", "bearer not.a.jwt"],
)
def test_malformed_authorization_headers_are_rejected(client, header):
    response = client.get("/api/me", headers={"Authorization": header})
    assert response.status_code == 401


def test_valid_token_is_accepted_and_identity_comes_from_the_token(
    client, make_token
):
    response = client.get("/api/me", headers=auth(make_token("user_alice")))
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "user_alice"
    assert body["email"] == "user_alice@example.com"


# --- Token forgery -------------------------------------------------------


def test_expired_token_is_rejected(client, make_token):
    token = make_token("user_alice", expires_in=-60)
    response = client.get("/api/me", headers=auth(token))
    assert response.status_code == 401
    assert "expired" in response.json()["error"]


def test_token_from_another_issuer_is_rejected(client, make_token):
    token = make_token("user_alice", issuer=OTHER_ISSUER)
    assert client.get("/api/me", headers=auth(token)).status_code == 401


def test_unsigned_alg_none_token_is_rejected(client):
    """The classic forgery: drop the signature and declare alg=none."""
    now = int(time.time())
    token = jwt.encode(
        {"sub": "user_attacker", "iss": ISSUER, "iat": now, "exp": now + 300},
        key=None,
        algorithm="none",
        headers={"kid": KID},
    )
    response = client.get("/api/me", headers=auth(token))
    assert response.status_code == 401
    assert response.json()["error"] == "unsupported token algorithm"


def test_algorithm_confusion_hs256_signed_with_the_public_key_is_rejected(
    client, keypair
):
    """Signing HS256 with the RSA public key must not verify as RS256.

    PyJWT refuses to *sign* this combination, so the token is assembled by
    hand - exactly as an attacker would have to.
    """
    _, public_key = keypair
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    now = int(time.time())

    def b64(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": KID}).encode())
    payload = b64(
        json.dumps(
            {"sub": "user_attacker", "iss": ISSUER, "iat": now, "exp": now + 300}
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    signature = b64(hmac.new(public_pem, signing_input, hashlib.sha256).digest())
    token = f"{header}.{payload}.{signature}"

    response = client.get("/api/me", headers=auth(token))
    assert response.status_code == 401
    assert response.json()["error"] == "unsupported token algorithm"


def test_token_signed_by_an_unknown_key_is_rejected(client, make_token):
    from cryptography.hazmat.primitives.asymmetric import rsa

    attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = make_token("user_attacker", key=attacker_key)
    assert client.get("/api/me", headers=auth(token)).status_code == 401


def test_token_without_a_kid_is_rejected(client, make_token):
    token = make_token("user_alice", kid=None)
    response = client.get("/api/me", headers=auth(token))
    assert response.status_code == 401
    assert "key id" in response.json()["error"]


def test_tampered_payload_is_rejected(client, make_token):
    header, payload, signature = make_token("user_alice").split(".")
    forged = jwt.encode({"sub": "user_root"}, key=None, algorithm="none").split(".")[1]
    assert client.get(
        "/api/me", headers=auth(f"{header}.{forged}.{signature}")
    ).status_code == 401


# --- Fail closed when the issuer is not configured ------------------------


def test_unconfigured_auth_rejects_rather_than_allows(settings, transport, make_token):
    import httpx
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = settings.model_copy(update={"clerk_issuer": ""})
    with TestClient(create_app(settings)) as unconfigured:
        unconfigured.app.state.http = httpx.AsyncClient(transport=transport)
        response = unconfigured.get("/api/me", headers=auth(make_token()))
        assert response.status_code == 401
        assert "not configured" in response.json()["error"]


# --- Tenant isolation ----------------------------------------------------


def test_a_user_cannot_read_another_users_holdings(client, make_token, db):
    db.rows.append(
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "user_id": "user_bob",
            "symbol": "BTC",
            "name": "Bitcoin",
            "coin_id": "bitcoin",
            "amount": 2.0,
            "avg_price": 50000.0,
            "purchase_date": None,
            "notes": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    response = client.get("/api/portfolio", headers=auth(make_token("user_alice")))
    assert response.status_code == 200
    assert response.json()["holdings"] == []


def test_a_user_cannot_delete_another_users_holding(client, make_token, db):
    holding_id = "22222222-2222-2222-2222-222222222222"
    db.rows.append(
        {
            "id": holding_id,
            "user_id": "user_bob",
            "symbol": "ETH",
            "name": "Ethereum",
            "coin_id": "ethereum",
            "amount": 5.0,
            "avg_price": 3000.0,
            "purchase_date": None,
            "notes": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    response = client.delete(
        f"/api/portfolio/holdings/{holding_id}",
        headers=auth(make_token("user_alice")),
    )
    assert response.status_code == 404
    assert len(db.rows) == 1  # Bob's row survives.


def test_ownership_is_taken_from_the_token_not_the_request_body(
    client, make_token, db
):
    """A client that smuggles a user_id must be refused, not obeyed."""
    response = client.post(
        "/api/portfolio/holdings",
        headers=auth(make_token("user_alice")),
        json={
            "symbol": "BTC",
            "name": "Bitcoin",
            "coin_id": "bitcoin",
            "amount": 1.0,
            "avg_price": 60000.0,
            "user_id": "user_bob",
        },
    )
    assert response.status_code == 422
    assert db.rows == []


def test_a_created_holding_is_owned_by_the_verified_subject(client, make_token, db):
    response = client.post(
        "/api/portfolio/holdings",
        headers=auth(make_token("user_alice")),
        json={
            "symbol": "btc",
            "name": "Bitcoin",
            "coin_id": "bitcoin",
            "amount": 1.0,
            "avg_price": 60000.0,
        },
    )
    assert response.status_code == 201
    assert db.rows[0]["user_id"] == "user_alice"
    assert db.rows[0]["symbol"] == "BTC"

    summary = response.json()
    assert summary["holdings"][0]["current_price"] == 78000.0
    assert summary["total_invested"] == 60000.0
    assert summary["total_profit_or_loss"] == 18000.0


def test_the_users_own_token_is_forwarded_to_the_database(client, make_token, db):
    """RLS can only run if the caller's token reaches PostgREST."""
    seen: dict[str, str] = {}
    original = db.handle

    def spy(request):
        seen["authorization"] = request.headers.get("authorization", "")
        seen["apikey"] = request.headers.get("apikey", "")
        return original(request)

    db.handle = spy
    token = make_token("user_alice")
    client.get("/api/portfolio", headers=auth(token))
    assert seen["authorization"] == f"Bearer {token}"
    assert seen["apikey"] == "anon-key-for-tests"


# --- Input validation ----------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        {"symbol": "B", "name": "x", "coin_id": "bitcoin", "amount": 1, "avg_price": 1},
        {"symbol": "../etc", "name": "x", "coin_id": "bitcoin", "amount": 1, "avg_price": 1},
        {"symbol": "BTC", "name": "x", "coin_id": "bitcoin", "amount": 0, "avg_price": 1},
        {"symbol": "BTC", "name": "x", "coin_id": "bitcoin", "amount": -5, "avg_price": 1},
        {"symbol": "BTC", "name": "x", "coin_id": "BAD ID", "amount": 1, "avg_price": 1},
        {"symbol": "BTC", "name": "", "coin_id": "bitcoin", "amount": 1, "avg_price": 1},
        {"symbol": "BTC", "name": "x", "coin_id": "bitcoin", "amount": 1},
    ],
)
def test_invalid_holdings_are_refused(client, make_token, db, payload):
    response = client.post(
        "/api/portfolio/holdings", headers=auth(make_token()), json=payload
    )
    assert response.status_code == 422
    assert db.rows == []


def test_path_traversal_in_a_symbol_is_refused(client):
    response = client.get("/api/market/chart/..%2F..%2Fetc")
    assert response.status_code in (400, 404, 422)


def test_a_non_uuid_holding_id_is_refused(client, make_token):
    response = client.delete(
        "/api/portfolio/holdings/not-a-uuid", headers=auth(make_token())
    )
    assert response.status_code == 422


def test_oversized_bodies_are_rejected_before_parsing(client, make_token):
    response = client.post(
        "/api/portfolio/holdings",
        headers=auth(make_token()),
        content=b"x" * (64 * 1024 + 1),
    )
    assert response.status_code == 413


# --- Transport hardening -------------------------------------------------


def test_security_headers_are_present(client):
    headers = client.get("/healthz").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert headers["x-request-id"]


def test_cors_allows_the_configured_origin(client):
    response = client.get("/healthz", headers={"Origin": "http://localhost:8080"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:8080"


def test_cors_does_not_allow_an_unknown_origin(client):
    response = client.get("/healthz", headers={"Origin": "https://attacker.example"})
    assert "access-control-allow-origin" not in response.headers


def test_rate_limit_returns_429_with_retry_after(client, settings):
    limit = settings.rate_limit_public_per_minute
    codes = [client.get("/api/market/global").status_code for _ in range(limit + 5)]
    assert 429 in codes
    blocked = client.get("/api/market/global")
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) >= 1


def test_internal_errors_do_not_leak_details(client, monkeypatch):
    async def boom(*_args, **_kwargs):
        raise RuntimeError("secret connection string postgres://user:pw@host/db")

    monkeypatch.setattr(client.app.state.market, "global_stats", boom)
    response = client.get("/api/market/global")
    assert response.status_code == 500
    body = response.json()
    assert body["error"] == "internal server error"
    assert "postgres://" not in response.text
    assert body["request_id"]


# --- Development fixtures must stay out of production --------------------


def test_the_in_memory_store_is_refused_in_production(settings):
    """A production app must never silently run on a memory-only store."""
    import pytest

    from app.main import create_app

    unsafe = settings.model_copy(
        update={"environment": "production", "dev_local_portfolio": True}
    )
    with pytest.raises(RuntimeError, match="must not be enabled in production"):
        create_app(unsafe)


def test_the_in_memory_store_still_isolates_users(settings, transport, make_token):
    """The dev fixture keeps the guarantee the real repository provides."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings.model_copy(update={"dev_local_portfolio": True}))
    app.state.http_transport = transport
    with TestClient(app) as dev:
        alice = make_token("user_alice")
        bob = make_token("user_bob")

        created = dev.post(
            "/api/portfolio/holdings",
            headers=auth(alice),
            json={
                "symbol": "BTC",
                "name": "Bitcoin",
                "coin_id": "bitcoin",
                "amount": 1.0,
                "avg_price": 60000.0,
            },
        )
        assert created.status_code == 201

        assert dev.get("/api/portfolio", headers=auth(alice)).json()["holdings"]
        # Bob sees nothing of Alice's.
        assert dev.get("/api/portfolio", headers=auth(bob)).json()["holdings"] == []


def test_the_in_memory_store_ignores_a_client_supplied_owner(
    settings, transport, make_token
):
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings.model_copy(update={"dev_local_portfolio": True}))
    app.state.http_transport = transport
    with TestClient(app) as dev:
        response = dev.post(
            "/api/portfolio/holdings",
            headers=auth(make_token("user_alice")),
            json={
                "symbol": "BTC",
                "name": "Bitcoin",
                "coin_id": "bitcoin",
                "amount": 1.0,
                "avg_price": 60000.0,
                "user_id": "user_bob",
            },
        )
        assert response.status_code == 422
