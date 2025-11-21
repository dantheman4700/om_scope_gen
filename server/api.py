"""FastAPI application factory and global middleware registration."""

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.core.config import (
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_ORIGINS,
    HISTORY_EMBEDDING_MODEL,
    VECTOR_STORE_DSN,
)
from server.core.history_profiles import EMBED_DIMENSIONS
from server.routes import (
    artifacts_router,
    auth_router,
    embeddings_router,
    files_router,
    om_router,
    project_runs_router,
    projects_router,
    runs_router,
    system_router,
    teams_router,
)
from server.services import JobRegistry, VectorStore


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

    embedding_dim = EMBED_DIMENSIONS.get(HISTORY_EMBEDDING_MODEL, 1536)
    if not VECTOR_STORE_DSN:
        raise RuntimeError("VECTOR_STORE_DSN is required for the API to start")
    vector_store = VectorStore(VECTOR_STORE_DSN, embedding_dim=embedding_dim)
    vector_store.ensure_schema()
    job_registry = JobRegistry(max_workers=2, vector_store=vector_store)

    app.state.vector_store = vector_store
    app.state.job_registry = job_registry

    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(teams_router)
    app.include_router(files_router)
    app.include_router(project_runs_router)
    app.include_router(runs_router)
    app.include_router(artifacts_router)
    app.include_router(embeddings_router)
    app.include_router(om_router)

    return app


app = create_app()


@app.get("/health", tags=["system"])
async def healthcheck() -> Dict[str, str]:
    """Simple healthcheck endpoint for orchestration probes."""

    return {"status": "ok"}

