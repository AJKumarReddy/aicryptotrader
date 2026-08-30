"""Shared helper for calling third-party data providers."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.observability.metrics import observe_upstream, provider_of
from app.security.errors import bad_gateway

logger = logging.getLogger("app.upstream")


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    """GET a JSON document, converting any upstream failure into a 502.

    Upstream error bodies are logged but never forwarded: they can echo our
    API keys back in a message, and they are not the caller's business.
    """
    provider = provider_of(httpx.URL(url).host)
    with observe_upstream(provider) as outcome:
        try:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            outcome["outcome"] = "http_error"
            logger.warning(
                "upstream call failed",
                extra={
                    "provider": provider,
                    "status": exc.response.status_code,
                    "upstream_path": exc.request.url.path,
                },
            )
            raise bad_gateway() from None
        except httpx.HTTPError as exc:
            outcome["outcome"] = "transport_error"
            logger.warning(
                "upstream transport error",
                extra={"provider": provider, "error": type(exc).__name__},
            )
            raise bad_gateway() from None
        except ValueError:
            outcome["outcome"] = "bad_payload"
            logger.warning(
                "upstream returned a non-JSON body", extra={"provider": provider}
            )
            raise bad_gateway() from None
