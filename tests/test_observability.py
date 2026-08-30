"""Tests for logging and metrics."""

from __future__ import annotations

import io
import json
import logging

import pytest

from app.observability.logging import (
    JsonFormatter,
    RedactionFilter,
    redact,
    request_id_var,
)
from app.observability.metrics import REGISTRY, provider_of
from tests.conftest import auth


def sample(metric: str, **labels) -> float:
    """Current value of a metric sample, or 0 when it has no series yet."""
    value = REGISTRY.get_sample_value(metric, labels)
    return value if value is not None else 0.0


# --- The scrape endpoint -------------------------------------------------


def test_metrics_endpoint_exposes_prometheus_text(client):
    client.get("/api/market/global")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "http_requests_total" in response.text
    assert "upstream_request_duration_seconds" in response.text
    assert "cache_events_total" in response.text


def test_metrics_can_be_disabled(settings, transport):
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings.model_copy(update={"metrics_enabled": False}))
    app.state.http_transport = transport
    with TestClient(app) as no_metrics:
        assert no_metrics.get("/metrics").status_code == 404


def test_metrics_require_the_token_when_one_is_configured(settings, transport):
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings.model_copy(update={"metrics_token": "s3cret-scrape"}))
    app.state.http_transport = transport
    with TestClient(app) as guarded:
        assert guarded.get("/metrics").status_code == 401
        assert guarded.get("/metrics", headers=auth("wrong")).status_code == 401
        assert guarded.get("/metrics", headers=auth("s3cret-scrape")).status_code == 200


# --- Label hygiene -------------------------------------------------------


def test_http_metrics_are_labelled_by_route_template_not_raw_path(client):
    """A scan over many symbols must not create a time series per symbol."""
    before = sample(
        "http_requests_total",
        method="GET",
        route="/api/market/chart/{symbol}",
        status="200",
    )
    for symbol in ("BTC", "ETH", "SOL"):
        client.get(f"/api/market/chart/{symbol}?days=7")
    after = sample(
        "http_requests_total",
        method="GET",
        route="/api/market/chart/{symbol}",
        status="200",
    )
    assert after == before + 3

    # And the raw paths are absent from the exposition.
    body = client.get("/metrics").text
    assert 'route="/api/market/chart/{symbol}"' in body
    assert "/api/market/chart/BTC" not in body


def test_provider_labels_are_bounded():
    assert provider_of("api.coingecko.com") == "coingecko"
    assert provider_of("api.exchange.coinbase.com") == "coinbase"
    assert provider_of("sunny-mammal-12.clerk.accounts.dev") == "clerk"
    assert provider_of("db.test.local") == "supabase"
    assert provider_of("whatever.example.com") == "other"


# --- What the metrics actually record ------------------------------------


def test_upstream_calls_are_counted_per_provider(client):
    before = sample("upstream_requests_total", provider="coingecko", outcome="success")
    client.get("/api/market/coins?limit=5")
    after = sample("upstream_requests_total", provider="coingecko", outcome="success")
    assert after > before


def test_upstream_failures_are_counted_separately(client):
    client.app.state.settings.coinbase_base_url = "https://offline.test.local"
    before = sample("upstream_requests_total", provider="other", outcome="http_error")
    client.get("/api/market/chart/BTC?days=30")
    after = sample("upstream_requests_total", provider="other", outcome="http_error")
    assert after > before


def test_cache_hits_and_misses_are_recorded(client):
    miss_before = sample("cache_events_total", name="market:global", result="miss")
    hit_before = sample("cache_events_total", name="market:global", result="hit")

    for _ in range(3):
        client.get("/api/market/global")

    assert sample("cache_events_total", name="market:global", result="miss") == (
        miss_before + 1
    )
    assert sample("cache_events_total", name="market:global", result="hit") == (
        hit_before + 2
    )


def test_auth_failures_are_counted_with_a_bounded_reason(client, make_token):
    before = sample("auth_failures_total", reason="expired")
    client.get("/api/me", headers=auth(make_token(expires_in=-60)))
    assert sample("auth_failures_total", reason="expired") == before + 1

    before_missing = sample("auth_failures_total", reason="missing_header")
    client.get("/api/me")
    assert sample("auth_failures_total", reason="missing_header") == before_missing + 1


def test_rate_limit_rejections_are_counted(client, settings):
    before = sample("rate_limit_rejections_total", scope="market")
    for _ in range(settings.rate_limit_public_per_minute + 3):
        client.get("/api/market/global")
    assert sample("rate_limit_rejections_total", scope="market") > before


# --- Correlation ---------------------------------------------------------


def test_every_response_carries_a_request_id(client):
    assert client.get("/healthz").headers["x-request-id"]


def test_an_inbound_request_id_is_echoed_for_tracing(client):
    response = client.get("/healthz", headers={"X-Request-ID": "trace-abc-123"})
    assert response.headers["x-request-id"] == "trace-abc-123"


def test_an_injected_request_id_is_sanitised_before_it_reaches_logs(client):
    response = client.get(
        "/healthz", headers={"X-Request-ID": "bad id\nInjected: line"}
    )
    echoed = response.headers["x-request-id"]
    assert "\n" not in echoed and " " not in echoed
    assert echoed == "badidInjected:line"[: len(echoed)] or echoed.isprintable()


def test_error_responses_carry_the_same_request_id_as_the_header(client):
    response = client.get("/api/me")
    assert response.json()["request_id"] == response.headers["x-request-id"]


def test_request_context_is_reset_between_requests(client):
    client.get("/healthz")
    assert request_id_var.get() is None


def test_the_access_log_records_the_verified_user(client, make_token, caplog):
    with caplog.at_level(logging.INFO, logger="app.access"):
        client.get("/api/me", headers=auth(make_token("user_alice")))
    record = next(r for r in caplog.records if r.name == "app.access")
    assert record.user_id == "user_alice"
    assert record.route == "/api/me"
    assert record.status == 200
    assert record.duration_ms >= 0


# --- Redaction -----------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig",
        "token=eyJhbGciOiJSUzI1NiJ9.payload.sig",
        'api_key: "cqt_abcdef123456"',
        "the secret=hunter2 was used",
    ],
)
def test_credentials_are_redacted_from_log_text(text):
    scrubbed = redact(text)
    assert "eyJhbGciOiJSUzI1NiJ9" not in scrubbed
    assert "cqt_abcdef123456" not in scrubbed
    assert "hunter2" not in scrubbed


def test_the_redaction_filter_scrubs_message_arguments():
    record = logging.LogRecord(
        "test", logging.INFO, __file__, 1,
        "calling with %s", ("Bearer eyJhbGciOiJIUzI1NiJ9.abc.def",), None,
    )
    RedactionFilter().filter(record)
    assert "eyJhbGciOiJIUzI1NiJ9" not in record.getMessage()
    assert "[redacted]" in record.getMessage()


def test_a_token_in_an_exception_never_reaches_the_configured_log():
    """Redaction covers exception text, not just the message."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactionFilter())

    logger = logging.getLogger("test.redaction")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.ERROR)

    try:
        raise RuntimeError("failed with Bearer eyJhbGciOiJSUzI1NiJ9.secret.sig")
    except RuntimeError:
        logger.exception("upstream blew up")

    written = stream.getvalue()
    assert "eyJhbGciOiJSUzI1NiJ9" not in written
    assert "[redacted" in written
    assert json.loads(written)["message"] == "upstream blew up"


def test_the_access_log_never_contains_the_callers_token(client, make_token, caplog):
    token = make_token("user_alice")
    with caplog.at_level(logging.INFO, logger="app.access"):
        client.get("/api/me", headers=auth(token))
    assert token not in caplog.text
    assert "Bearer" not in caplog.text


# --- Log format ----------------------------------------------------------


def test_json_formatter_emits_one_parseable_object_per_record():
    record = logging.LogRecord(
        "app.access", logging.INFO, __file__, 1, "handled %s", ("GET",), None
    )
    record.request_id = "abc123"
    record.user_id = "user_alice"
    record.status = 200
    record.duration_ms = 12.5

    payload = json.loads(JsonFormatter().format(record))
    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.access"
    assert payload["message"] == "handled GET"
    assert payload["request_id"] == "abc123"
    assert payload["user_id"] == "user_alice"
    assert payload["status"] == 200
    assert payload["duration_ms"] == 12.5


def test_json_logs_are_chosen_by_environment(settings):
    assert settings.model_copy(update={"environment": "production"}).json_logs is True
    assert settings.model_copy(update={"environment": "development"}).json_logs is False
    assert (
        settings.model_copy(
            update={"environment": "development", "log_format": "json"}
        ).json_logs
        is True
    )
