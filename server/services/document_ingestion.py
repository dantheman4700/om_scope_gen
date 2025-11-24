"""Background document ingestion queue that offloads extraction + embeddings."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional
from uuid import UUID

from openai import OpenAI
from PyPDF2 import PdfReader
from sqlalchemy.orm import joinedload

from ..core.config import DATA_ROOT, EMBEDDING_MODEL
from ..core.extraction import extract_text, chunk_text
from ..db import models
from ..db.models import utcnow
from ..db.session import get_session
from ..services.vector_store import VectorStore
from ..storage.projects import ensure_project_structure

LOGGER = logging.getLogger(__name__)


_SUPPORTED_IMG_EXTENSIONS = {
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".webp",
}


class DocumentIngestionService:
    """Minimal background queue that ingests uploaded documents asynchronously."""

    def __init__(self, *, vector_store: VectorStore, max_workers: int = 2) -> None:
        self._vector_store = vector_store
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="doc-ingest")
        self._openai = OpenAI()

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def enqueue(self, deal_id: UUID, document_id: UUID) -> models.DocumentIngestionJob:
        with get_session() as session:
            job = models.DocumentIngestionJob(deal_id=deal_id, document_id=document_id)
            session.add(job)
            session.commit()
            session.refresh(job)
        self._executor.submit(self._process_job, job.id)
        return job

    def _process_job(self, job_id: UUID) -> None:
        with get_session() as session:
            job = (
                session.query(models.DocumentIngestionJob)
                .filter(models.DocumentIngestionJob.id == job_id)
                .options(
                    joinedload(models.DocumentIngestionJob.document).joinedload(models.Document.deal),
                )
                .one_or_none()
            )
            if job is None:
                LOGGER.warning("Skipping ingestion job %s because it no longer exists", job_id)
                return

            job.attempts += 1
            job.status = "processing"
            job.started_at = utcnow()
            document = job.document
            deal = document.deal
            session.flush()

            try:
                self._ingest_document(deal=deal, document=document)
            except Exception as exc:  # pragma: no cover - defensive logging
                LOGGER.exception("Ingestion job %s failed: %s", job_id, exc)
                job.status = "failed"
                job.error = str(exc)
                job.finished_at = utcnow()
                document.processing_status = "failed"
                document.processing_error = str(exc)
                session.commit()
                return

            job.status = "succeeded"
            job.error = None
            job.finished_at = utcnow()
            session.commit()

    def _ingest_document(self, *, deal: models.Deal, document: models.Document) -> None:
        paths = ensure_project_structure(DATA_ROOT, str(deal.id))
        if not document.file_path:
            raise ValueError("Document is missing file path for ingestion")
        source_path = paths.root / document.file_path
        if not source_path.exists():
            raise FileNotFoundError(f"Document source missing on disk: {source_path}")

        suffix = Path(document.file_name).suffix.lower()
        extracted = extract_text(source_path)
        if suffix == ".pdf" and (not extracted or len(extracted.strip()) < 50):
            fallback = _pdf_text_fallback(source_path)
            if fallback:
                extracted = fallback
        if suffix in _SUPPORTED_IMG_EXTENSIONS and not extracted:
            extracted = f"[Image: {document.file_name}]"

        if not extracted:
            document.processing_status = "uploaded"
            document.processing_error = "No text extracted"
            return

        document.extracted_text = extracted
        document.text_extracted = True
        chunks = chunk_text(extracted)
        document.text_chunks_count = len(chunks)

        for idx, chunk in enumerate(chunks):
            try:
                embedding = self._embed_text(chunk)
            except Exception as exc:  # pragma: no cover - best effort embedding
                LOGGER.warning("Embedding failed for chunk %s of %s: %s", idx, document.file_name, exc)
                continue
            self._vector_store.insert_embedding(
                deal_id=deal.id,
                document_id=document.id,
                content=chunk,
                embedding=embedding,
                company_name=deal.company_name,
                file_name=document.file_name,
                file_type=document.file_type or "text",
                chunk_index=idx,
                chunk_size=len(chunk),
            )

        document.embeddings_created = bool(chunks)
        document.processing_status = "completed" if chunks else "processed"
        document.processed_at = utcnow()
        document.processing_error = None

    def _embed_text(self, text: str) -> list[float]:
        response = self._openai.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding


def _pdf_text_fallback(path: Path, max_pages: int = 4) -> str:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        LOGGER.warning("PDF fallback failed for %s: %s", path.name, exc)
        return ""
    texts: list[str] = []
    for index, page in enumerate(reader.pages[:max_pages]):
        try:
            content = page.extract_text() or ""
        except Exception as exc:
            LOGGER.warning("Unable to extract text for %s page %s: %s", path.name, index + 1, exc)
            content = ""
        if content:
            texts.append(content)
    return "\n\n".join(texts).strip()

