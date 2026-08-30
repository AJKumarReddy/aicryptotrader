"""Uniform, non-leaky error responses.

Client errors carry a short reason. Server errors never do: an unhandled
exception returns a generic message plus the request id, and the detail goes
to the log instead of to the caller.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.error")


def _problem(request: Request, code: int, message: str) -> JSONResponse:
    body: dict[str, Any] = {"error": message}
    request_id = request.scope.get("state", {}).get("request_id")
    if request_id:
        body["request_id"] = request_id
    headers = {}
    if code == status.HTTP_401_UNAUTHORIZED:
        headers["WWW-Authenticate"] = "Bearer"
    return JSONResponse(status_code=code, content=body, headers=headers)


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def bad_gateway(detail: str = "upstream data provider is unavailable") -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


def install_exception_handlers(app: FastAPI) -> None:
    # Registered against Starlette's class so that framework-raised errors
    # - an unmatched route, a rejected method - use the same body shape as
    # the ones our own code raises.
    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        response = _problem(request, exc.status_code, str(exc.detail))
        for key, value in (exc.headers or {}).items():
            response.headers[key] = value
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Report which fields failed, not the raw input that failed - the
        # input can contain user data we would rather not echo back.
        fields = sorted({".".join(str(p) for p in e["loc"][1:]) for e in exc.errors()})
        return _problem(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"invalid request parameters: {', '.join(fields)}" if fields else "invalid request",
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled error on %s %s", request.method, request.url.path
        )
        return _problem(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal server error",
        )
