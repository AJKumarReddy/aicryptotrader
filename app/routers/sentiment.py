"""Market sentiment routes."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query, Request

from app.security.deps import MaybeUser
from app.security.ratelimit import enforce
from app.services.sentiment import SentimentService

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


@router.get("/fear-greed")
async def fear_greed(
    request: Request,
    principal: MaybeUser,
    limit: Annotated[int, Query(ge=1, le=90)] = 30,
) -> dict[str, Any]:
    settings = request.app.state.settings
    enforce(
        request,
        "sentiment",
        settings.rate_limit_authed_per_minute
        if principal
        else settings.rate_limit_public_per_minute,
    )
    service: SentimentService = request.app.state.sentiment
    return await service.fear_greed(limit)
