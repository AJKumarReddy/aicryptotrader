"""FastAPI dependencies for authenticating a request."""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import Depends, Request

from app.observability.logging import user_id_var
from app.observability.metrics import auth_failures_total
from app.security.clerk import AuthError, ClerkVerifier, Principal
from app.security.errors import unauthorized


def _reject(reason: str, detail: str):
    """Count a failed authentication under a bounded reason label."""
    auth_failures_total.labels(reason).inc()
    return unauthorized(detail)


def _bearer_token(request: Request) -> str:
    header = request.headers.get("authorization")
    if not header:
        raise _reject("missing_header", "authentication required")

    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _reject(
            "malformed_header",
            "expected an Authorization: Bearer <token> header",
        )
    return token.strip()


def _verifier(request: Request) -> ClerkVerifier:
    verifier: ClerkVerifier | None = getattr(request.app.state, "verifier", None)
    if verifier is None:
        # Fail closed: an unconfigured issuer must never mean "allow anyone".
        raise _reject(
            "not_configured", "authentication is not configured on this server"
        )
    return verifier


def _http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


async def require_user(request: Request) -> Principal:
    """Reject the request unless it carries a valid Clerk token."""
    token = _bearer_token(request)
    verifier = _verifier(request)
    try:
        principal = await verifier.verify(token, _http(request))
    except AuthError as exc:
        raise _reject(_reason_for(exc.detail), exc.detail) from None

    request.state.principal = principal
    # Make the subject available to every log line for the rest of the
    # request, without threading the request object through the services.
    user_id_var.set(principal.subject)
    return principal


async def optional_user(request: Request) -> Principal | None:
    """Identify the caller when possible, but allow anonymous access.

    Used by public market-data routes so that signed-in users get the higher
    rate-limit allowance without making the endpoint private.
    """
    if not request.headers.get("authorization"):
        return None
    try:
        return await require_user(request)
    except Exception:
        return None


# Bounded slugs, so the metric cannot grow a label per distinct message.
_REASONS = {
    "expired": "expired",
    "untrusted party": "bad_issuer",
    "unsupported token algorithm": "bad_algorithm",
    "signing key": "unknown_key",
    "key id": "missing_kid",
    "malformed": "malformed_token",
    "unauthorized origin": "bad_azp",
    "identity provider": "jwks_unreachable",
    "no subject": "no_subject",
}


def _reason_for(detail: str) -> str:
    for needle, slug in _REASONS.items():
        if needle in detail:
            return slug
    return "invalid_token"


CurrentUser = Annotated[Principal, Depends(require_user)]
MaybeUser = Annotated[Principal | None, Depends(optional_user)]
