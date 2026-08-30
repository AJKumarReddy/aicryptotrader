"""Transport-level hardening and per-request observability."""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Iterable
from typing import Any

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp

from app.observability.logging import request_id_var, user_id_var
from app.observability.metrics import (
    http_request_duration_seconds,
    http_requests_in_flight,
    http_requests_total,
)

logger = logging.getLogger("app.access")

# This is a JSON API: it renders nothing and should never be framed. The CSP
# is correspondingly restrictive - it exists to neuter any content that does
# get reflected, not to support a page.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
}


class SecurityHeadersMiddleware:
    """Stamp the standard hardening headers onto every response."""

    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self._hsts = hsts

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for header, value in SECURITY_HEADERS.items():
                    if header not in headers:
                        headers[header] = value
                if self._hsts and "Strict-Transport-Security" not in headers:
                    headers["Strict-Transport-Security"] = (
                        "max-age=31536000; includeSubDomains"
                    )
            await send(message)

        await self.app(scope, receive, send_wrapper)


def build_route_index(routers: Iterable[Any]) -> list[tuple[re.Pattern[str], str]]:
    """Index the route patterns we register, for labelling.

    Built from our own `APIRouter`s rather than by walking `app.routes`:
    FastAPI wraps an included router in a private node that exposes neither
    a path nor its children, so the app-level view cannot see the templates.
    Reading `path_regex` off the routes we defined is both stable and exact.
    """
    index: list[tuple[re.Pattern[str], str]] = []
    for router in routers:
        for route in getattr(router, "routes", []):
            pattern = getattr(route, "path_regex", None)
            template = getattr(route, "path_format", None) or getattr(
                route, "path", None
            )
            if pattern is not None and template:
                index.append((pattern, template))
    return index


def route_template(request: Request) -> str:
    """The matched route pattern, e.g. `/api/market/chart/{symbol}`.

    Metrics and logs must never be labelled with the raw path: a scan over
    many symbols would otherwise create one time series per symbol.
    """
    index = getattr(request.app.state, "route_index", None) or []
    path = request.scope.get("path", "")
    for pattern, template in index:
        if pattern.match(path):
            return template
    return "unmatched"


class RequestContextMiddleware:
    """Correlate, time, count and log every request.

    Written as raw ASGI rather than `BaseHTTPMiddleware` on purpose.
    `BaseHTTPMiddleware` runs the rest of the application in a separate task,
    and a context variable set down in a dependency - such as the verified
    user id - does not propagate back out to the parent task. Staying in the
    same task is what lets every log line written anywhere under this request
    carry its id and user.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        incoming = request.headers.get("x-request-id") or ""
        # An inbound id is echoed for tracing, but it lands in logs and
        # headers, so strip anything that could forge a line or a header.
        cleaned = "".join(c for c in incoming if c.isalnum() or c in "-_")[:64]
        request_id = cleaned or uuid.uuid4().hex[:16]

        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id
        id_token = request_id_var.set(request_id)
        user_token = user_id_var.set(None)

        route = route_template(request)
        started = time.perf_counter()
        http_requests_in_flight.inc()
        status_code = 500

        async def send_wrapper(message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - started
            http_requests_in_flight.dec()
            http_requests_total.labels(request.method, route, str(status_code)).inc()
            http_request_duration_seconds.labels(request.method, route).observe(
                duration
            )
            # Read the subject before the context is torn down. The token
            # itself is never logged.
            user_id = user_id_var.get()
            logger.info(
                "%s %s -> %s in %.1fms",
                request.method,
                request.url.path,
                status_code,
                duration * 1000,
                extra={
                    "http_method": request.method,
                    "route": route,
                    "path": request.url.path,
                    "status": status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "request_id": request_id,
                    "user_id": user_id,
                },
            )
            request_id_var.reset(id_token)
            user_id_var.reset(user_token)


class BodySizeLimitMiddleware:
    """Reject oversized bodies before they are buffered or parsed."""

    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app = app
        self._max_bytes = max_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        declared = request.headers.get("content-length")
        if declared is not None:
            try:
                too_big = int(declared) > self._max_bytes
            except ValueError:
                await self._reject(
                    scope,
                    receive,
                    send,
                    status.HTTP_400_BAD_REQUEST,
                    "invalid Content-Length header",
                )
                return
            if too_big:
                await self._reject(
                    scope,
                    receive,
                    send,
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "request body too large",
                )
                return

        await self.app(scope, receive, send)

    async def _reject(self, scope, receive, send, code: int, message: str) -> None:
        body = {"error": message}
        request_id = scope.get("state", {}).get("request_id")
        if request_id:
            body["request_id"] = request_id
        await JSONResponse(status_code=code, content=body)(scope, receive, send)


def install_middleware(app: FastAPI, *, hsts: bool, max_request_bytes: int) -> None:
    # Starlette runs middleware in reverse registration order, so the request
    # context (and therefore the request id) is established first.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=max_request_bytes)
    app.add_middleware(SecurityHeadersMiddleware, hsts=hsts)
    app.add_middleware(RequestContextMiddleware)
