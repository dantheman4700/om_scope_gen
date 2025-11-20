"""FastAPI application factory and global middleware registration."""

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.core.config import CORS_ALLOW_CREDENTIALS, CORS_ALLOW_ORIGINS

from .routes.om import router as om_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="Scope Doc Generator API",
        version="0.1.0",
        description="Backend services for the scope document generator platform.",
    )

    # CORS configuration (placeholder defaults; tighten once frontend origin is known)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_credentials=CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(om_router)

    return app


app = create_app()


@app.get("/health", tags=["system"])
async def healthcheck() -> Dict[str, str]:
    """Simple healthcheck endpoint for orchestration probes."""

    return {"status": "ok"}

