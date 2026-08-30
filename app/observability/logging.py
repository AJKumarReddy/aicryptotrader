"""Structured logging with request correlation and credential redaction.

Two things make logs useful here rather than merely present:

  * Every record emitted while handling a request carries that request's id
    and the caller's verified subject, pulled from context variables. You can
    take the `X-Request-ID` a user reports and grep out the whole story,
    including the upstream calls made underneath.
  * A redaction filter runs over every record. The access log is written not
    to include tokens, but a stray `logger.debug(headers)` in future code
    should not be able to leak one either, so redaction is enforced centrally
    rather than trusted to each call site.
"""

from __future__ import annotations

import json
import logging
import re
from contextvars import ContextVar
from typing import Any

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)

# JWTs, bearer headers and anything that looks like an api key.
_REDACTIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bBearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE), "Bearer [redacted]"),
    (re.compile(r"\beyJ[A-Za-z0-9._\-]{10,}"), "[redacted-jwt]"),
    (re.compile(r"(?i)\b(api[_-]?key|apikey|token|secret)([\"'=: ]+)([^\s\"',}]+)"),
     r"\1\2[redacted]"),
]

_STANDARD_ATTRS = set(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
) | {"message", "asctime", "taskName"}


def redact(text: str) -> str:
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


class RedactionFilter(logging.Filter):
    """Scrub credentials from every record, whoever emitted it."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: redact(v) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            else:
                record.args = tuple(
                    redact(a) if isinstance(a, str) else a for a in record.args
                )
        return True


class ContextFilter(logging.Filter):
    """Attach the current request id and user to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.user_id = user_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line, for a log shipper to parse."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if getattr(record, "request_id", None):
            payload["request_id"] = record.request_id
        if getattr(record, "user_id", None):
            payload["user_id"] = record.user_id
        if record.exc_info:
            payload["exception"] = redact(self.formatException(record.exc_info))

        # Anything passed via logger.info(..., extra={...}) rides along.
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and key not in payload:
                if isinstance(value, (str, int, float, bool)) or value is None:
                    payload[key] = value

        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    """Readable single-line output for local development."""

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        request_id = getattr(record, "request_id", None)
        return f"{base} [request_id={request_id}]" if request_id else base


def configure_logging(level: str, *, json_output: bool) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(
        JsonFormatter()
        if json_output
        else TextFormatter("%(asctime)s %(levelname)-8s %(name)s %(message)s")
    )
    handler.addFilter(ContextFilter())
    handler.addFilter(RedactionFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # uvicorn installs its own handlers; route them through ours so every
    # line has the same shape and passes through redaction.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    # httpx logs a line per outbound request at INFO, including full URLs.
    logging.getLogger("httpx").setLevel(logging.WARNING)
