"""Artifact listing and download endpoints."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from server.core.config import ARTIFACT_URL_EXPIRY_SECONDS

from ..adapters.storage import StorageBackend
from ..dependencies import db_session, get_storage
from ..db import models
from ..security import rbac
from .auth import SessionUser, require_roles


router = APIRouter(tags=["artifacts"])


class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    kind: str
    path: str
    meta: dict
    created_at: datetime


@router.get("/runs/{run_id}/artifacts", response_model=List[ArtifactResponse])
async def list_artifacts_by_run(
    run_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[ArtifactResponse]:
    rbac.ensure_run_access(db, current_user, run_id)
    artifacts = (
        db.query(models.Artifact)
        .filter(models.Artifact.run_id == run_id)
        .order_by(models.Artifact.created_at.asc())
        .all()
    )
    if not artifacts:
        run = db.get(models.Run, run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return [ArtifactResponse.model_validate(artifact) for artifact in artifacts]


@router.get("/deals/{deal_id}/runs/{run_id}/artifacts", response_model=List[ArtifactResponse])
async def list_artifacts(
    deal_id: UUID,
    run_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[ArtifactResponse]:
    run = rbac.ensure_run_access(db, current_user, run_id)
    if run.deal_id != deal_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    artifacts = (
        db.query(models.Artifact)
        .filter(models.Artifact.run_id == run.id)
        .order_by(models.Artifact.created_at.asc())
        .all()
    )
    return [ArtifactResponse.model_validate(artifact) for artifact in artifacts]


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(
    artifact_id: UUID,
    db: Session = Depends(db_session),
    storage: StorageBackend = Depends(get_storage),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
):
    artifact = db.get(models.Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    run = artifact.run
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact run not found")

    rbac.ensure_run_access(db, current_user, run.id)

    storage_key = _storage_key(str(run.deal_id), artifact.path)

    signed_url = storage.generate_signed_url(storage_key, ARTIFACT_URL_EXPIRY_SECONDS)
    if signed_url:
        return RedirectResponse(url=signed_url, status_code=status.HTTP_302_FOUND)

    tmp_file = NamedTemporaryFile(delete=False)
    tmp_path = Path(tmp_file.name)
    tmp_file.close()

    try:
        await run_in_threadpool(storage.download_to_path, storage_key, tmp_path)
    except Exception as exc:  # pragma: no cover - backend failure
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unable to fetch artifact: {exc}")

    filename = Path(artifact.path).name
    return FileResponse(
        str(tmp_path),
        filename=filename,
        background=BackgroundTask(_cleanup_temp_file, tmp_path),
    )


def _storage_key(deal_id: str, relative_path: str) -> str:
    clean = relative_path.lstrip("/")
    return f"projects/{deal_id}/{clean}"


def _cleanup_temp_file(path: Path) -> None:  # pragma: no cover - background cleanup
    try:
        path.unlink()
    except FileNotFoundError:
        pass

