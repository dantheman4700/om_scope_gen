"""API routers exposed by the OM generator backend."""

from .artifacts import router as artifacts_router
from .auth import router as auth_router
from .embeddings import router as embeddings_router
from .files import router as files_router
from .om import router as om_router
from .projects import router as projects_router
from .runs import router as project_runs_router, run_router as runs_router
from .system import router as system_router
from .teams import router as teams_router

__all__ = [
    "artifacts_router",
    "auth_router",
    "embeddings_router",
    "files_router",
    "om_router",
    "projects_router",
    "project_runs_router",
    "runs_router",
    "system_router",
    "teams_router",
]

