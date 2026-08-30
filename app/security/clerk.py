"""Verification of Clerk-issued JWTs.

The frontend already signs users in with Clerk and mints a JWT (the
`supabase` template). This module is the server-side half that has been
missing: it *verifies* that token instead of taking the caller's word for
who they are.

Design notes:
  * Signature keys are fetched from the issuer's JWKS endpoint and cached.
    An unknown `kid` triggers at most one refetch per cooldown window, so a
    flood of junk tokens cannot be turned into a stampede on Clerk.
  * The accepted algorithms are pinned to Clerk's asymmetric set. Leaving
    the algorithm to the token would allow an attacker to present `alg:none`,
    or to sign an HS256 token using the public key as the shared secret.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWKSet

# Clerk signs with RS256. Pinning this list is a security control, not a
# formality - never derive the algorithm from the token header.
ALLOWED_ALGORITHMS = ["RS256"]

JWKS_CACHE_SECONDS = 600
JWKS_REFETCH_COOLDOWN_SECONDS = 30


class AuthError(Exception):
    """Raised when a token is absent, malformed, expired or untrusted."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


@dataclass(frozen=True)
class Principal:
    """A verified caller. `subject` is the only trustworthy user identity."""

    subject: str
    email: str | None
    session_id: str | None
    claims: dict[str, Any]
    raw_token: str


class ClerkVerifier:
    def __init__(
        self,
        issuer: str,
        *,
        authorized_parties: list[str] | None = None,
        http_client: httpx.AsyncClient | None = None,
        leeway_seconds: int = 10,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._authorized_parties = authorized_parties or []
        self._client = http_client
        self._leeway = leeway_seconds

        self._jwks: PyJWKSet | None = None
        self._jwks_fetched_at: float = 0.0
        self._last_refetch_attempt: float = 0.0

    @property
    def jwks_url(self) -> str:
        return f"{self._issuer}/.well-known/jwks.json"

    async def _fetch_jwks(self, client: httpx.AsyncClient) -> PyJWKSet:
        response = await client.get(self.jwks_url)
        response.raise_for_status()
        jwks = PyJWKSet.from_dict(response.json())
        self._jwks = jwks
        self._jwks_fetched_at = time.monotonic()
        return jwks

    async def _signing_key(self, client: httpx.AsyncClient, kid: str) -> Any:
        now = time.monotonic()
        stale = now - self._jwks_fetched_at > JWKS_CACHE_SECONDS

        if self._jwks is None or stale:
            await self._fetch_jwks(client)

        key = self._lookup(kid)
        if key is not None:
            return key

        # Unknown kid: Clerk may have rotated. Refetch, but at most once per
        # cooldown so bogus kids cannot be used to hammer the JWKS endpoint.
        if now - self._last_refetch_attempt > JWKS_REFETCH_COOLDOWN_SECONDS:
            self._last_refetch_attempt = now
            await self._fetch_jwks(client)
            key = self._lookup(kid)
            if key is not None:
                return key

        raise AuthError("token signing key is not recognised")

    def _lookup(self, kid: str) -> Any:
        if self._jwks is None:
            return None
        for key in self._jwks.keys:
            if key.key_id == kid:
                return key.key
        return None

    async def verify(self, token: str, client: httpx.AsyncClient) -> Principal:
        if not token or token.count(".") != 2:
            raise AuthError("malformed bearer token")

        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise AuthError("malformed bearer token") from None

        if header.get("alg") not in ALLOWED_ALGORITHMS:
            raise AuthError("unsupported token algorithm")

        kid = header.get("kid")
        if not kid:
            raise AuthError("token is missing a key id")

        try:
            key = await self._signing_key(client, kid)
        except httpx.HTTPError:
            raise AuthError("unable to reach the identity provider") from None

        try:
            claims = jwt.decode(
                token,
                key=key,
                algorithms=ALLOWED_ALGORITHMS,
                issuer=self._issuer,
                leeway=self._leeway,
                options={
                    "require": ["exp", "iat", "sub"],
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_signature": True,
                    "verify_iss": True,
                    # Clerk templates do not always set `aud`; the issuer plus
                    # the optional azp check below is what we rely on.
                    "verify_aud": False,
                },
            )
        except jwt.ExpiredSignatureError:
            raise AuthError("token has expired") from None
        except jwt.InvalidIssuerError:
            raise AuthError("token was issued by an untrusted party") from None
        except jwt.PyJWTError:
            raise AuthError("token failed verification") from None

        if self._authorized_parties:
            azp = claims.get("azp")
            if azp and azp not in self._authorized_parties:
                raise AuthError("token was issued to an unauthorized origin")

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise AuthError("token has no subject")

        return Principal(
            subject=subject,
            email=claims.get("email"),
            session_id=claims.get("sid"),
            claims=claims,
            raw_token=token,
        )
