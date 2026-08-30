"""Development entrypoint: `python main.py` or `uv run main.py`.

In production run uvicorn (or gunicorn with uvicorn workers) directly against
`app.main:app` and terminate TLS in front of it.
"""

import uvicorn

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
