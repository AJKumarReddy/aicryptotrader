"""Portfolio routes. Every one of these requires a verified session.

Note what is absent: no route accepts a user id. The owner of every row read
or written here comes from the token, so there is no parameter to tamper
with.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request, status

from app.models import AddHoldingRequest, Deleted, Identity, PortfolioSummary
from app.security.deps import CurrentUser
from app.security.ratelimit import enforce
from app.services.portfolio import PortfolioService

router = APIRouter(prefix="/api", tags=["portfolio"])

UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"


def _service(request: Request) -> PortfolioService:
    service = getattr(request.app.state, "portfolio", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="portfolio storage is not configured on this server",
        )
    return service


@router.get("/me", response_model=Identity)
async def me(request: Request, user: CurrentUser) -> Identity:
    """Echo the verified identity. Useful as a login smoke test."""
    enforce(request, "me", request.app.state.settings.rate_limit_authed_per_minute)
    return Identity(user_id=user.subject, email=user.email, session_id=user.session_id)


@router.get("/portfolio", response_model=PortfolioSummary)
async def get_portfolio(request: Request, user: CurrentUser) -> PortfolioSummary:
    enforce(
        request, "portfolio", request.app.state.settings.rate_limit_authed_per_minute
    )
    summary = await _service(request).summary(user.subject, user.raw_token)
    return PortfolioSummary.model_validate(summary)


@router.post(
    "/portfolio/holdings",
    status_code=status.HTTP_201_CREATED,
    response_model=PortfolioSummary,
)
async def add_holding(
    request: Request, user: CurrentUser, body: AddHoldingRequest
) -> PortfolioSummary:
    enforce(
        request,
        "portfolio-write",
        request.app.state.settings.rate_limit_write_per_minute,
    )
    service = _service(request)
    payload = body.model_dump(exclude_none=True, mode="json")
    await service.add_holding(user.subject, user.raw_token, payload)
    summary = await service.summary(user.subject, user.raw_token)
    return PortfolioSummary.model_validate(summary)


@router.delete("/portfolio/holdings/{holding_id}", response_model=Deleted)
async def delete_holding(
    request: Request,
    user: CurrentUser,
    holding_id: Annotated[str, Path(pattern=UUID_PATTERN)],
) -> Deleted:
    enforce(
        request,
        "portfolio-write",
        request.app.state.settings.rate_limit_write_per_minute,
    )
    service = _service(request)
    deleted = await service.remove_holding(user.subject, user.raw_token, holding_id)
    if not deleted:
        # Indistinguishable from "exists but belongs to someone else", which
        # is deliberate: it leaks nothing about other users' rows.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="holding not found"
        )
    return Deleted(deleted=True)
