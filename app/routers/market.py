"""Public market data.

These routes are readable without signing in - the dashboard's landing view
needs them - but they are rate limited, and the upstream keys they use stay
on the server.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status

from app.security.deps import MaybeUser
from app.security.ratelimit import enforce
from app.services.market import MarketService, normalise_symbol

router = APIRouter(prefix="/api/market", tags=["market"])


def _service(request: Request) -> MarketService:
    return request.app.state.market


def _limit(request: Request, principal: MaybeUser) -> None:
    settings = request.app.state.settings
    enforce(
        request,
        "market",
        settings.rate_limit_authed_per_minute
        if principal
        else settings.rate_limit_public_per_minute,
    )


RateLimited = Annotated[None, Depends(_limit)]


@router.get("/global")
async def global_stats(request: Request, _: RateLimited) -> dict[str, Any]:
    return await _service(request).global_stats()


@router.get("/coins")
async def coins(
    request: Request,
    _: RateLimited,
    limit: Annotated[int, Query(ge=1, le=250)] = 100,
    page: Annotated[int, Query(ge=1, le=20)] = 1,
) -> list[dict[str, Any]]:
    return await _service(request).coins(limit, page)


@router.get("/trending")
async def trending(request: Request, _: RateLimited) -> list[dict[str, Any]]:
    return await _service(request).trending()


@router.get("/coin/{symbol}")
async def resolve_coin(
    request: Request,
    _: RateLimited,
    symbol: Annotated[str, Path(min_length=2, max_length=12)],
) -> dict[str, Any]:
    """Resolve a ticker to its id, name and spot price."""
    try:
        normalise_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None
    resolved = await _service(request).resolve_symbol(symbol)
    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="unknown symbol"
        )
    return resolved


@router.get("/chart/{symbol}")
async def chart(
    request: Request,
    _: RateLimited,
    symbol: Annotated[str, Path(min_length=2, max_length=12)],
    days: Annotated[int, Query(ge=1, le=365)] = 7,
) -> dict[str, Any]:
    try:
        normalise_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from None
    return await _service(request).candles(symbol, days)
