"""Vercel entrypoint: exposes the FastAPI instance as `app`. Local dev uses `app.main:app` directly."""

from app.main import app

__all__ = ["app"]
