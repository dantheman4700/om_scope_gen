"""Endpoints for managing vector store embeddings."""

from __future__ import annotations

from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.core.config import get_project_data_dir
from server.core.embeddings import ProfileEmbedder
from ..dependencies import db_session
from ..security import rbac
from .auth import SessionUser, require_roles


router = APIRouter(prefix="/deals/{deal_id}/embeddings", tags=["embeddings"])


class EmbedScopeRequest(BaseModel):
    relative_path: Optional[str] = None
    content: Optional[str] = None
    doc_kind: str = "rendered_scope"
    metadata: Optional[dict] = None
    embedding_id: Optional[UUID] = None

    def validate(self) -> None:
        if not self.relative_path and not self.content:
            raise ValueError("Either relative_path or content must be provided")


class EmbedScopeResponse(BaseModel):
    embedding_id: UUID
    doc_kind: str


def _resolve_document(deal_id: str, relative_path: str) -> Path:
    project_dir = get_project_data_dir(deal_id)
    candidate = project_dir / relative_path
    if not candidate.exists():
        outputs_path = project_dir / "outputs" / relative_path
        if outputs_path.exists():
            return outputs_path
    return candidate


def _load_content(path: Path) -> str:
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Document not found: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def _get_embedder() -> ProfileEmbedder:
    return ProfileEmbedder()


@router.post("/", response_model=EmbedScopeResponse)
async def embed_scope_document(
    deal_id: str,
    payload: EmbedScopeRequest,
    request: Request,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> EmbedScopeResponse:
    try:
        payload.validate()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    store = getattr(request.app.state, "vector_store", None)
    if store is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vector store not configured")

    content = payload.content
    if content is None and payload.relative_path:
        try:
            doc_path = _resolve_document(deal_id, payload.relative_path)
            content = _load_content(doc_path)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No content available to embed")

    try:
        embedder = _get_embedder()
        embedding_vector = embedder.embed(content)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate embedding: {exc}")

    try:
        deal_uuid = UUID(deal_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    rbac.ensure_deal_access(db, current_user, deal_uuid)

    try:
        embedding_id = store.upsert_embedding(
            embedding=embedding_vector,
            project_id=deal_uuid,
            doc_kind=payload.doc_kind,
            metadata=payload.metadata or {"deal_id": deal_id, "source": payload.relative_path},
            embedding_id=payload.embedding_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to store embedding: {exc}")

    return EmbedScopeResponse(embedding_id=embedding_id, doc_kind=payload.doc_kind)

