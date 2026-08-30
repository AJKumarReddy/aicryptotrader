"""Functional tests for the data routes."""

from __future__ import annotations

from tests.conftest import auth


def test_health_and_readiness(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"auth": True, "database": True}


def test_global_stats_are_flattened_for_the_frontend(client):
    body = client.get("/api/market/global").json()
    assert body["total_market_cap_usd"] == 2.5e12
    assert body["market_cap_percentage"]["btc"] == 54.2


def test_coins_are_normalised(client):
    body = client.get("/api/market/coins?limit=10").json()
    assert body[0]["symbol"] == "BTC"
    assert body[0]["price_change_percentage_24h"] == 0.8


def test_trending_is_flattened(client):
    body = client.get("/api/market/trending").json()
    assert body[0]["id"] == "solana"
    assert body[0]["symbol"] == "SOL"


def test_candles_are_ordered_oldest_first(client):
    body = client.get("/api/market/chart/BTC?days=7").json()
    assert body["source"] == "coinbase"
    assert body["granularity_seconds"] == 3600
    times = [c["time"] for c in body["candles"]]
    assert times == sorted(times)
    # Coinbase orders [time, low, high, open, close, volume]; check the
    # mapping did not silently transpose high and low.
    assert all(c["high"] >= c["low"] for c in body["candles"])
    assert body["candles"][-1]["close"] == 78500.0


def test_chart_falls_back_to_kraken_when_coinbase_fails(client, settings):
    # Point Coinbase at an unmocked host so the primary provider errors.
    client.app.state.settings.coinbase_base_url = "https://offline.test.local"
    body = client.get("/api/market/chart/BTC?days=30").json()
    assert body["source"] == "kraken"
    assert body["candles"][0]["close"] == 77500.0


def test_chart_window_is_bounded(client):
    assert client.get("/api/market/chart/BTC?days=0").status_code == 422
    assert client.get("/api/market/chart/BTC?days=9999").status_code == 422


def test_fear_greed_exposes_the_update_countdown(client):
    body = client.get("/api/sentiment/fear-greed").json()
    assert body["value"] == 69
    assert body["classification"] == "Greed"
    assert body["seconds_until_update"] == 45534
    assert len(body["history"]) == 2


def test_repeated_reads_collapse_into_one_upstream_call(client, upstream_calls):
    """The cache is what keeps a busy dashboard inside the free-tier quota."""
    for _ in range(5):
        assert client.get("/api/market/global").status_code == 200
    assert upstream_calls["/api/v3/global"] == 1


def test_portfolio_aggregates_multiple_lots_of_one_coin(client, make_token, db):
    for amount, price in ((1.0, 50000.0), (1.0, 70000.0)):
        db.rows.append(
            {
                "id": f"lot-{price}",
                "user_id": "user_alice",
                "symbol": "BTC",
                "name": "Bitcoin",
                "coin_id": "bitcoin",
                "amount": amount,
                "avg_price": price,
                "purchase_date": None,
                "notes": None,
                "created_at": "2026-01-01T00:00:00Z",
            }
        )

    body = client.get("/api/portfolio", headers=auth(make_token("user_alice"))).json()
    holding = body["holdings"][0]
    assert holding["total_quantity"] == 2.0
    assert holding["average_buy_price"] == 60000.0
    assert holding["current_price"] == 78000.0
    assert holding["current_value"] == 156000.0
    assert body["total_invested"] == 120000.0
    assert body["total_profit_or_loss"] == 36000.0
    assert body["total_profit_or_loss_percentage"] == 30.0
    assert len(holding["entries"]) == 2


def test_an_unpriced_coin_reads_as_flat_not_as_a_total_loss(client, make_token, db):
    db.rows.append(
        {
            "id": "lot-unknown",
            "user_id": "user_alice",
            "symbol": "WEIRD",
            "name": "Weird Coin",
            "coin_id": "not-listed-anywhere",
            "amount": 10.0,
            "avg_price": 5.0,
            "purchase_date": None,
            "notes": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    body = client.get("/api/portfolio", headers=auth(make_token("user_alice"))).json()
    holding = body["holdings"][0]
    assert holding["priced"] is False
    assert holding["current_price"] == 5.0
    assert holding["profit_or_loss"] == 0.0


def test_an_empty_portfolio_returns_zeroes_not_an_error(client, make_token):
    body = client.get("/api/portfolio", headers=auth(make_token("user_new"))).json()
    assert body["total_portfolio_value"] == 0
    assert body["holdings"] == []


def test_a_holding_can_be_added_then_deleted(client, make_token, db):
    token = make_token("user_alice")
    created = client.post(
        "/api/portfolio/holdings",
        headers=auth(token),
        json={
            "symbol": "ETH",
            "name": "Ethereum",
            "coin_id": "ethereum",
            "amount": 3.0,
            "avg_price": 3000.0,
            "notes": "  laddered in  ",
        },
    )
    assert created.status_code == 201
    assert db.rows[0]["notes"] == "laddered in"

    holding_id = db.rows[0]["id"]
    deleted = client.delete(
        f"/api/portfolio/holdings/{holding_id}", headers=auth(token)
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True}
    assert db.rows == []


def test_portfolio_routes_report_unavailable_when_storage_is_unconfigured(
    settings, transport, make_token
):
    from fastapi.testclient import TestClient

    from app.main import create_app

    unconfigured = settings.model_copy(update={"supabase_url": ""})
    app = create_app(unconfigured)
    app.state.http_transport = transport
    with TestClient(app) as no_db:
        response = no_db.get("/api/portfolio", headers=auth(make_token()))
        assert response.status_code == 503
        assert "not configured" in response.json()["error"]
