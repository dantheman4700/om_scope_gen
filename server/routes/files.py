"""Deal document management endpoints."""

from __future__ import annotations

import hashlib
import json
import io
import logging
import mimetypes
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from PyPDF2 import PdfReader

from ..adapters.storage import StorageBackend
from ..core.config import DATA_ROOT
from ..core.extraction import extract_text
from ..core.ingest import DocumentIngester, MAX_NATIVE_PDF_BYTES, MAX_NATIVE_PDF_PAGES
from ..core.summarizer import FileSummarizer
from ..dependencies import db_session, get_storage
from ..db import models
from ..services.token_counter import (
    TokenCountingError,
    count_tokens_for_blocks,
    make_document_block,
    make_image_block,
    make_text_block,
)
from ..storage.projects import ensure_project_structure
from ..security import rbac
from .auth import SessionUser, require_roles


router = APIRouter(prefix="/deals/{deal_id}/documents", tags=["documents"])

LOGGER = logging.getLogger(__name__)

# Supported document extensions for native uploads
_SUPPORTED_DOC_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
}
# These formats are treated as plain text for ingestion
_TEXT_LIKE_EXTENSIONS = {
    ".txt",
    ".md",
    ".rst",
}
_SUPPORTED_IMG_EXTENSIONS = {
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".webp",
}
SUPPORTED_EXTENSIONS = _SUPPORTED_DOC_EXTENSIONS | _TEXT_LIKE_EXTENSIONS | _SUPPORTED_IMG_EXTENSIONS


_DOCUMENT_INGESTER = DocumentIngester()
_FILE_SUMMARIZER: Optional[FileSummarizer] = None

class DealDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_name: str
    file_size: int
    mime_type: Optional[str]
    checksum: Optional[str]
    created_at: datetime
    file_path: str
    token_count: int
    is_summarized: bool
    summary_text: Optional[str] = None
    is_too_large: bool
    pdf_page_count: Optional[int] = None
    use_summary_for_generation: bool
    native_token_count: int
    summary_token_count: int
    processing_status: str
    processing_error: Optional[str] = None


async def _analyze_uploaded_file(
    *,
    filename: str,
    media_type: Optional[str],
    contents: bytes,
) -> Dict[str, object]:
    normalized_media_type = media_type or ""
    if normalized_media_type.lower() in {"application/octet-stream", "binary/octet-stream"}:
        normalized_media_type = ""

    normalized_media_type = (
        normalized_media_type
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )
    suffix = Path(filename).suffix.lower()

    pdf_page_count = None
    is_pdf = normalized_media_type == "application/pdf" or suffix == ".pdf"
    if is_pdf:
        pdf_page_count = _extract_pdf_page_count(contents)

    size = len(contents)
    is_too_large = size > MAX_NATIVE_PDF_BYTES or (is_pdf and pdf_page_count and pdf_page_count > MAX_NATIVE_PDF_PAGES)

    token_count = 0
    native_token_count = 0
    summary_token_count = 0
    is_summarized = False
    summary_text: Optional[str] = None
    use_summary_for_generation = is_too_large  # Default: use summary only if too large

    # Always calculate native token count first, if possible
    if not is_too_large:
        blocks = _build_token_blocks(
            filename=filename,
            media_type=normalized_media_type,
            contents=contents,
            suffix=suffix,
        )
        if blocks:
            try:
                native_token_count = await count_tokens_for_blocks(blocks)
                token_count = native_token_count  # Initially, token_count = native count
            except TokenCountingError as exc:
                LOGGER.warning("Token counting failed for %s: %s", filename, exc)
                native_token_count = 0
                token_count = 0
        else:
            LOGGER.info("No countable content for %s; defaulting token count to 0", filename)

    # For large files, we still want to know the native token count for context
    if is_too_large:
        blocks = _build_token_blocks(
            filename=filename,
            media_type=normalized_media_type,
            contents=contents,
            suffix=suffix,
        )
        if blocks:
            try:
                native_token_count = await count_tokens_for_blocks(blocks)
            except TokenCountingError as exc:
                LOGGER.warning("Token counting (native) failed for %s: %s", filename, exc)
                native_token_count = 0

    # If the file is too large, it MUST be summarized.
    # The summary token count becomes the main token_count.
    if is_too_large:
        summary_text = await _summarize_file_contents(filename, contents)
        if summary_text:
            is_summarized = True
            try:
                summary_token_count = await count_tokens_for_blocks([make_text_block(summary_text)])
                token_count = summary_token_count
            except TokenCountingError as exc:
                LOGGER.warning("Token counting (summary) failed for %s: %s", filename, exc)
                summary_token_count = max(1, len(summary_text) // 4)
                token_count = summary_token_count
        else:
            LOGGER.warning("Summary unavailable for oversized file %s", filename)
            token_count = 0
            summary_token_count = 0

    return {
        "media_type": normalized_media_type,
        "token_count": token_count,
        "native_token_count": native_token_count,
        "summary_token_count": summary_token_count,
        "is_summarized": is_summarized,
        "summary_text": summary_text,
        "is_too_large": is_too_large,
        "pdf_page_count": pdf_page_count,
        "use_summary_for_generation": use_summary_for_generation,
    }


def _build_token_blocks(
    *,
    filename: str,
    media_type: str,
    contents: bytes,
    suffix: str,
) -> List[Dict[str, object]]:
    if _treat_as_text(media_type, suffix):
        text = _decode_text(contents)
        if not text.strip():
            return []
        return [make_text_block(text)]

    if _treat_as_image(media_type, suffix):
        return [make_image_block(data=contents, media_type=media_type)]

    normalized_media_type = _normalize_document_media_type(media_type, suffix)
    return [make_document_block(data=contents, media_type=normalized_media_type, filename=filename)]


def _treat_as_text(media_type: str, suffix: str) -> bool:
    if media_type.startswith("text/"):
        return True
    if suffix in _TEXT_LIKE_EXTENSIONS:
        return True
    if media_type in {"application/json", "application/xml"}:
        return True
    return False


def _treat_as_image(media_type: str, suffix: str) -> bool:
    if media_type.startswith("image/"):
        return True
    if suffix in _SUPPORTED_IMG_EXTENSIONS:
        return True
    return False


def _normalize_document_media_type(media_type: str, suffix: str) -> str:
    if suffix == ".pdf" or media_type in {"application/pdf", "application/x-pdf"}:
        return "application/pdf"
    return media_type


def _decode_text(contents: bytes) -> str:
    try:
        return contents.decode("utf-8")
    except UnicodeDecodeError:
        return contents.decode("latin-1", errors="ignore")


def _extract_pdf_page_count(contents: bytes) -> Optional[int]:
    try:
        pdf_reader = PdfReader(io.BytesIO(contents))
        return len(pdf_reader.pages)
    except Exception as exc:  # pragma: no cover - best effort metadata extraction
        LOGGER.warning("Unable to read PDF pages: %s", exc)
        return None


def _get_file_summarizer() -> FileSummarizer:
    global _FILE_SUMMARIZER
    if _FILE_SUMMARIZER is None:
        _FILE_SUMMARIZER = FileSummarizer()
    return _FILE_SUMMARIZER


async def _summarize_file_contents(filename: str, contents: bytes) -> Optional[str]:
    text = _extract_text_for_summary(filename, contents)
    if not text:
        return None

    try:
        summarizer = _get_file_summarizer()
    except Exception as exc:  # pragma: no cover - misconfiguration
        LOGGER.error("Unable to initialize file summarizer: %s", exc)
        return None
    try:
        summary = await run_in_threadpool(summarizer.summarize_file, filename, text)
    except Exception as exc:  # pragma: no cover - external API failure
        LOGGER.error("Failed to summarize %s: %s", filename, exc)
        return None

    if not summary or not summary.summary:
        return None

    try:
        return json.dumps(summary.summary, indent=2)
    except (TypeError, ValueError):
        return str(summary.summary)


def _extract_text_for_summary(filename: str, contents: bytes) -> Optional[str]:
    suffix = Path(filename).suffix or ".tmp"
    temp_path: Optional[Path] = None
    try:
        with NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp.flush()
            temp_path = Path(tmp.name)

        document = _DOCUMENT_INGESTER.ingest_file(temp_path)
    except Exception as exc:  # pragma: no cover - best effort extraction
        LOGGER.warning("Unable to ingest %s for summary: %s", filename, exc)
        return None
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

    texts: List[str] = []
    if isinstance(document, list):
        for item in document:
            text = item.get("content") if isinstance(item, dict) else None
            if text:
                texts.append(text)
    elif isinstance(document, dict):
        text = document.get("content")
        if text:
            texts.append(text)

    combined = "\n\n".join(texts).strip()
    return combined or None


@router.get("/", response_model=List[DealDocumentResponse])
async def list_documents(
    deal_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[DealDocumentResponse]:
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    documents = (
        db.query(models.Document)
        .filter(models.Document.deal_id == deal.id)
        .order_by(models.Document.created_at.desc())
        .all()
    )
    return [DealDocumentResponse.model_validate(doc) for doc in documents]


@router.post("/", response_model=List[DealDocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    deal_id: UUID,
    files: List[UploadFile] = File(...),
    request: Request,
    db: Session = Depends(db_session),
    storage: StorageBackend = Depends(get_storage),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> List[DealDocumentResponse]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")

    ingestion_service = _get_ingestion_service(request)

    records: List[models.Document] = []
    storage_keys: List[str] = []
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    deal_paths = ensure_project_structure(DATA_ROOT, str(deal.id))
    uploaded_payloads: List[bytes] = []

    try:
        for upload in files:
            file_ext = Path(upload.filename).suffix.lower()
            if file_ext not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file type for '{upload.filename}'. Supported types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
                )

            contents = await upload.read()
            if not contents:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Uploaded file '{upload.filename}' is empty",
                )
            uploaded_payloads.append(contents)

            filename = Path(upload.filename).name
            relative_path = f"input/{filename}"
            storage_key = _storage_key(str(deal.id), relative_path)

            try:
                await run_in_threadpool(storage.put_bytes, storage_key, contents, upload.content_type)
            except Exception as exc:  # pragma: no cover - backend failure
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to save file '{filename}': {exc}",
                )

            storage_keys.append(storage_key)

            checksum = hashlib.sha256(contents).hexdigest()

            metadata = await _analyze_uploaded_file(
                filename=filename,
                media_type=upload.content_type,
                contents=contents,
            )

            record = models.Document(
                deal_id=deal.id,
                file_name=filename,
                file_path=relative_path,
                file_size=len(contents),
                mime_type=metadata["media_type"],
                checksum=checksum,
                token_count=metadata["token_count"],
                native_token_count=metadata["native_token_count"],
                summary_token_count=metadata["summary_token_count"],
                is_summarized=metadata["is_summarized"],
                summary_text=metadata.get("summary_text"),
                is_too_large=metadata["is_too_large"],
                pdf_page_count=metadata.get("pdf_page_count"),
                use_summary_for_generation=metadata["use_summary_for_generation"],
                file_extension=Path(filename).suffix.lstrip("."),
                file_type=Path(filename).suffix.lstrip("."),
                processing_status="queued",
                processing_error=None,
                embeddings_created=False,
                text_extracted=False,
                text_chunks_count=0,
            )
            db.add(record)
            records.append(record)

        db.commit()
    except HTTPException:
        db.rollback()
        await _cleanup_uploaded_files(storage, storage_keys)
        raise
    except Exception as exc:
        db.rollback()
        await _cleanup_uploaded_files(storage, storage_keys)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload files: {exc}",
        ) from exc

    for record, blob in zip(records, uploaded_payloads):
        local_path = deal_paths.input_dir / record.file_name
        try:
            local_path.write_bytes(blob)
        except Exception:
            # Upload was already consumed; write from storage
            try:
                storage_key = _storage_key(str(deal.id), record.file_path or record.file_name)
                await run_in_threadpool(storage.download_to_path, storage_key, local_path)
            except Exception as exc:
                record.processing_status = "failed"
                record.processing_error = f"Unable to stage file for ingestion: {exc}"
                ingestion_errors.append(record.file_name)
                continue

        ingestion_service.enqueue(deal.id, record.id)

    db.commit()
    for record in records:
        db.refresh(record)

    return [DealDocumentResponse.model_validate(record) for record in records]


@router.post("/{document_id}/summarize", response_model=DealDocumentResponse)
async def summarize_document(
    deal_id: UUID,
    document_id: UUID,
    db: Session = Depends(db_session),
    storage: StorageBackend = Depends(get_storage),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> DealDocumentResponse:
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    record = (
        db.query(models.Document)
        .filter(
            models.Document.deal_id == deal.id,
            models.Document.id == document_id,
        )
        .one_or_none()
    )

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_ext = Path(record.file_name).suffix.lower()
    if file_ext in _SUPPORTED_IMG_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Summarization is not supported for image files.",
        )

    storage_key = _storage_key(str(deal.id), record.file_path or "")

    with TemporaryDirectory() as tmpdir:
        destination = Path(tmpdir) / record.file_name
        try:
            await run_in_threadpool(storage.download_to_path, storage_key, destination)
            contents = destination.read_bytes()
        except Exception as exc:  # pragma: no cover - storage failure
            LOGGER.error("Unable to download file %s for summarization: %s", record.file_name, exc)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to download file")

    summary_text = await _summarize_file_contents(record.file_name, contents)
    if not summary_text:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to summarize file")

    try:
        summary_token_count = await count_tokens_for_blocks([make_text_block(summary_text)])
    except TokenCountingError as exc:
        LOGGER.warning("Token counting (summary) failed for %s: %s", record.file_name, exc)
        summary_token_count = max(1, len(summary_text) // 4)

    # If native_token_count is not set, calculate it from the original content
    if record.native_token_count == 0:
        blocks = _build_token_blocks(
            filename=record.file_name,
            media_type=record.mime_type or "",
            contents=contents,
            suffix=Path(record.file_name).suffix.lower(),
        )
        if blocks:
            try:
                native_tokens = await count_tokens_for_blocks(blocks)
                record.native_token_count = native_tokens
            except TokenCountingError as exc:
                LOGGER.warning("Token counting (native) failed for %s: %s", record.file_name, exc)
                record.native_token_count = 0  # Fallback
        else:
            record.native_token_count = 0

    record.summary_text = summary_text
    record.is_summarized = True
    record.summary_token_count = summary_token_count
    record.token_count = summary_token_count
    record.use_summary_for_generation = True
    db.commit()
    db.refresh(record)

    return DealDocumentResponse.model_validate(record)


@router.patch("/{document_id}/toggle-mode", response_model=DealDocumentResponse)
async def toggle_document_mode(
    deal_id: UUID,
    document_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> DealDocumentResponse:
    """Toggle between using native file or summary for scope generation.
    
    This endpoint switches the use_summary_for_generation flag and updates
    the token_count to reflect the selected mode.
    """
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    record = (
        db.query(models.Document)
        .filter(
            models.Document.deal_id == deal.id,
            models.Document.id == document_id,
        )
        .one_or_none()
    )

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Can't toggle if file is too large and has no summary
    if record.is_too_large and not record.is_summarized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot use native file for oversized file without summary",
        )

    # Can't toggle to summary if no summary exists
    if not record.use_summary_for_generation and not record.is_summarized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot use summary mode: file has not been summarized yet",
        )

    # Toggle the mode
    toggled_to_summary = not record.use_summary_for_generation
    record.use_summary_for_generation = toggled_to_summary

    # Update token_count to reflect the selected mode
    if toggled_to_summary:
        record.token_count = record.summary_token_count
    else:
        # Switching to native mode - restore native token count
        record.token_count = record.native_token_count

    db.commit()
    db.refresh(record)

    return DealDocumentResponse.model_validate(record)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    deal_id: UUID,
    document_id: UUID,
    db: Session = Depends(db_session),
    storage: StorageBackend = Depends(get_storage),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> None:
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    record = (
        db.query(models.Document)
        .filter(models.Document.deal_id == deal.id, models.Document.id == document_id)
        .one_or_none()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    storage_key = _storage_key(str(deal.id), record.file_path or "")
    try:
        await run_in_threadpool(storage.delete, storage_key)
    except Exception as exc:  # pragma: no cover - backend failure
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unable to delete file: {exc}")

    db.delete(record)
    db.commit()


def _storage_key(deal_id: str, relative_path: str) -> str:
    clean = relative_path.lstrip("/")
    return f"projects/{deal_id}/{clean}"


async def _cleanup_uploaded_files(storage: StorageBackend, storage_keys: List[str]) -> None:
    for key in storage_keys:
        try:
            await run_in_threadpool(storage.delete, key)
        except Exception:  # pragma: no cover - best effort cleanup
            pass


def _get_ingestion_service(request: Request):
    service = getattr(request.app.state, "document_ingestion", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document ingestion service unavailable",
        )
    return service

