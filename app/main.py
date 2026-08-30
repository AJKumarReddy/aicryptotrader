"""Application wiring.

Startup is fail-closed by design. If the Clerk issuer is not configured the
app still starts - so the public market routes keep working and the health
checks stay honest - but no verifier is installed, and every authenticated
route rejects the request rather than falling back to trusting the caller.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.observability.logging import configure_logging
from app.routers import health, market, metrics, portfolio, sentiment
from app.security.clerk import ClerkVerifier
from app.security.errors import install_exception_handlers
from app.security.middleware import build_route_index, install_middleware
from app.security.ratelimit import RateLimiter
from app.services.cache import TTLCache
from app.services.market import MarketService
from app.services.portfolio import (
    InMemoryPortfolioRepository,
    PortfolioRepository,
    PortfolioService,
)
from app.services.sentiment import SentimentService

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings

    # One pooled client for every outbound call, with a timeout on all of
    # them - an upstream that hangs must not hold our workers open.
    # `http_transport` is a seam for tests, which install an in-process
    # transport so the suite never touches the network.
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(settings.upstream_timeout_seconds),
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=10),
        headers={"User-Agent": "AICryptoTrader/0.1 (+backend)"},
        follow_redirects=False,
        transport=getattr(app.state, "http_transport", None),
    ) as client:
        app.state.http = client
        cache = TTLCache()
        app.state.cache = cache
        app.state.rate_limiter = RateLimiter()

        app.state.market = MarketService(settings, client, cache)
        app.state.sentiment = SentimentService(settings, client, cache)

        if settings.auth_configured:
            app.state.verifier = ClerkVerifier(
                settings.clerk_issuer,
                authorized_parties=settings.clerk_authorized_parties,
            )
        else:
            app.state.verifier = None
            logger.warning(
                "CLERK_ISSUER is not set - authenticated routes will reject "
                "every request until it is configured"
            )

        if settings.dev_local_portfolio:
            logger.warning(
                "DEV_LOCAL_PORTFOLIO is on - holdings are kept in memory for "
                "this process only and are not written to Supabase"
            )
            app.state.portfolio = PortfolioService(
                settings, InMemoryPortfolioRepository(), client, cache
            )
        elif settings.db_configured:
            repository = PortfolioRepository(settings, client)
            app.state.portfolio = PortfolioService(
                settings, repository, client, cache
            )
        else:
            app.state.portfolio = None
            logger.warning(
                "SUPABASE_URL / SUPABASE_ANON_KEY are not set - portfolio "
                "routes will report themselves unavailable"
            )

        # One structured line describing how the process came up. No
        # secrets - only whether each dependency is configured.
        logger.info(
            "backend ready",
            extra={
                "environment": settings.environment,
                "auth_configured": settings.auth_configured,
                "database_configured": settings.db_configured,
                "coingecko_key": bool(settings.coingecko_demo_api_key),
                "metrics_enabled": settings.metrics_enabled,
                "metrics_protected": bool(settings.metrics_token),
                "cors_origins": len(settings.cors_allow_origins),
            },
        )

        yield

        logger.info("backend shutting down")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    settings.validate_for_environment()
    configure_logging(settings.log_level, json_output=settings.json_logs)

    is_production = settings.environment == "production"
    app = FastAPI(
        title="AICryptoTrader API",
        version="0.1.0",
        lifespan=lifespan,
        # The interactive docs describe the whole attack surface; keep them
        # off in production.
        docs_url=None if is_production else "/docs",
        redoc_url=None,
        openapi_url=None if is_production else "/openapi.json",
    )
    app.state.settings = settings
    # Only honour X-Forwarded-For when something in front is known to set it.
    app.state.trust_proxy_headers = is_production

    install_middleware(
        app,
        hsts=is_production,
        max_request_bytes=settings.max_request_bytes,
    )
    # An explicit origin allowlist. Never "*" - these routes carry
    # credentials, and a wildcard with credentials is both invalid and the
    # classic way to hand any site the ability to call an API as the user.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )

    install_exception_handlers(app)

    routers = (
        health.router,
        metrics.router,
        market.router,
        sentiment.router,
        portfolio.router,
    )
    for router in routers:
        app.include_router(router)

    # Metrics and access logs are labelled with these patterns, never the
    # raw request path.
    app.state.route_index = build_route_index(routers)

    return app


app = create_app()
