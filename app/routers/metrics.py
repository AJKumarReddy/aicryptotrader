"""Prometheus scrape endpoint.

Metrics describe traffic shape, error rates and which upstreams are failing.
That is useful to an operator and equally useful to someone probing the
service, so the endpoint can be disabled outright and, when a token is
configured, requires it. The comparison is constant-time.
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Request, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.observability.metrics import REGISTRY

router = APIRouter(tags=["observability"])


@router.get("/metrics", include_in_schema=False)
async def metrics(request: Request) -> Response:
    settings = request.app.state.settings

    if not settings.metrics_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    if settings.metrics_token:
        header = request.headers.get("authorization", "")
        scheme, _, presented = header.partition(" ")
        if scheme.lower() != "bearer" or not secrets.compare_digest(
            presented, settings.metrics_token
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="metrics token required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
