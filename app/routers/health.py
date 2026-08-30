"""Liveness and readiness.

Deliberately terse: a health endpoint that reports versions, configuration
or dependency URLs is a free reconnaissance tool for anyone scanning.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(request: Request) -> dict[str, bool]:
    settings = request.app.state.settings
    return {
        "auth": settings.auth_configured,
        "database": settings.db_configured,
    }
