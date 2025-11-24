"""Routes for deal ingestion and OM generation."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi import status
from jinja2 import Template
from openai import OpenAI
import fitz
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.core.config import (
    EMBEDDING_MODEL,
    OM_SECTIONS_PATH,
    OM_TEMPLATE_PATH,
    VECTOR_STORE_DSN,
    get_deal_storage_dirs,
)
from server.core.extraction import (
    chunk_text,
    extract_text,
    normalise_filename,
    IMAGE_EXTENSIONS,
)
from server.core.gemini import GeminiClient, GeminiError
from server.core.embeddings import EMBED_DIMENSIONS
from server.db import models
from server.db.session import get_session
from server.services.vector_store import VectorStore


IMAGE_PROMPT = (
    "Extract every legible piece of text from this image. Describe diagrams and note any key values in bullet form."
)
PDF_PROMPT = (
    "Read this PDF page image and output the textual content you can see. If multiple sections exist, separate them."
)

router = APIRouter(prefix="/api", tags=["om"])

with open(OM_SECTIONS_PATH, "r", encoding="utf-8") as fp:
    SECTION_CONFIG = json.load(fp)

SECTION_DEFINITIONS = SECTION_CONFIG.get("sections", [])
TEMPLATE = Template(Path(OM_TEMPLATE_PATH).read_text(encoding="utf-8"))

EMBED_DIM = EMBED_DIMENSIONS.get(EMBEDDING_MODEL, 1536)
if not VECTOR_STORE_DSN:
    raise RuntimeError("VECTOR_STORE_DSN is required for RAG operations")
VECTOR_STORE = VectorStore(VECTOR_STORE_DSN, embedding_dim=EMBED_DIM or 1536)
VECTOR_STORE.ensure_schema()
GEMINI = GeminiClient()
OPENAI_CLIENT = OpenAI()


class DocumentResult(BaseModel):
    document_id: UUID
    file_name: str
    processing_status: str
    chunks: int
    embeddings_created: bool
    error: Optional[str] = None


class DealImportResponse(BaseModel):
    deal_id: UUID
    documents: List[DocumentResult]


class OMGenerateRequest(BaseModel):
    deal_id: UUID
    attach_full_documents: bool = False


class OMGenerateResponse(BaseModel):
    deal_id: UUID
    markdown: str
    output_path: str


@router.post("/deals", response_model=DealImportResponse, status_code=status.HTTP_201_CREATED)
async def import_deal(
    company_name: str = Form(...),
    deal_name: Optional[str] = Form(None),
    deal_description: Optional[str] = Form(None),
    status_value: str = Form("active"),
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
) -> DealImportResponse:
    """Create a deal, persist uploaded files, and embed their contents."""

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    deal = models.Deal(
        company_name=company_name.strip(),
        deal_name=(deal_name or company_name).strip(),
        deal_description=deal_description,
        status=status_value or "active",
        created_by="om-api",
    )
    session.add(deal)
    session.flush()

    _, inputs_dir, _, _, _ = get_deal_storage_dirs(
        str(deal.id),
        company=deal.company_name,
        label=deal.deal_name,
    )

    documents_summary: List[DocumentResult] = []

    for upload in files:
        safe_name = normalise_filename(upload.filename or "upload")
        target_path = inputs_dir / safe_name
        data = await upload.read()
        target_path.write_bytes(data)

        document = models.Document(
            deal_id=deal.id,
            file_name=safe_name,
            file_type=upload.content_type or target_path.suffix.lstrip("."),
            file_size=target_path.stat().st_size,
            mime_type=upload.content_type,
            file_extension=target_path.suffix.lstrip("."),
            file_path=str(target_path),
            processing_status="processing",
        )
        session.add(document)
        session.flush()

        error_message = None

        try:
            suffix = target_path.suffix.lower()
            extracted = extract_text(target_path)

            if extracted and suffix == ".pdf" and len(extracted) < 200:
                supplement = _describe_pdf_file(target_path)
                if supplement:
                    extracted = f"{extracted}\n\n{supplement}".strip()

            if not extracted:
                if _is_image_file(suffix):
                    extracted = _describe_image_file(target_path)
                    if extracted:
                        document.image_description = extracted
                elif suffix == ".pdf":
                    extracted = _describe_pdf_file(target_path)

            if extracted:
                document.extracted_text = extracted
                document.text_extracted = True

                chunks = chunk_text(extracted)
                document.text_chunks_count = len(chunks)

                for idx, chunk in enumerate(chunks):
                    embedding = _embed_text(chunk)
                    VECTOR_STORE.insert_embedding(
                        deal_id=deal.id,
                        document_id=document.id,
                        content=chunk,
                        embedding=embedding,
                        company_name=deal.company_name,
                        file_name=safe_name,
                        file_type=document.file_type or document.file_extension or "text",
                        chunk_index=idx,
                        chunk_size=len(chunk),
                    )

                document.embeddings_created = bool(chunks)
                document.processing_status = "completed"
                document.processed_at = datetime.utcnow()
            else:
                document.processing_status = "uploaded"
        except Exception as exc:  # pragma: no cover - defensive logging
            error_message = str(exc)
            document.processing_status = "failed"
            document.processing_error = error_message

        documents_summary.append(
            DocumentResult(
                document_id=document.id,
                file_name=safe_name,
                processing_status=document.processing_status,
                chunks=document.text_chunks_count or 0,
                embeddings_created=document.embeddings_created,
                error=error_message,
            )
        )

    return DealImportResponse(deal_id=deal.id, documents=documents_summary)


@router.post("/om/generate", response_model=OMGenerateResponse)
def generate_om(
    request: OMGenerateRequest,
    session: Session = Depends(get_session),
) -> OMGenerateResponse:
    """Generate an Offering Memorandum for a given deal."""

    deal = session.get(models.Deal, request.deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    documents = (
        session.query(models.Document)
        .filter(models.Document.deal_id == deal.id, models.Document.processing_status != "failed")
        .all()
    )
    if not documents:
        raise HTTPException(status_code=400, detail="No processed documents available for this deal")

    sections_text: dict[str, str] = {}

    for section in SECTION_DEFINITIONS:
        section_name = section["name"]
        query_text = section["query"]
        previews = _retrieve_section_snippets(deal.id, query_text)

        if request.attach_full_documents:
            previews.extend(_collect_full_documents(documents))

        try:
            generated = GEMINI.generate_section(
                section=section_name,
                previews=previews,
                base_instruction=section["instruction"],
            )
        except GeminiError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        sections_text[section["key"]] = generated

    rendered = TEMPLATE.render(**sections_text)
    _, _, outputs_dir, _, _ = get_deal_storage_dirs(
        str(deal.id),
        company=deal.company_name,
        label=deal.deal_name,
    )
    output_path = outputs_dir / f"offering_memorandum_{deal.id}.md"
    output_path.write_text(rendered, encoding="utf-8")

    return OMGenerateResponse(deal_id=deal.id, markdown=rendered, output_path=str(output_path))


def _embed_text(text: str) -> List[float]:
    response = OPENAI_CLIENT.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def _retrieve_section_snippets(deal_id: UUID, query: str) -> List[str]:
    query_vector = _embed_text(query)
    results = VECTOR_STORE.similarity_search(query_vector, top_k=12, deal_id=deal_id)

    snippets: List[str] = []
    seen = set()
    for record in results:
        content = record.content.strip()
        if not content or content in seen:
            continue
        seen.add(content)
        snippets.append(content)
        if len(snippets) >= 10:
            break

    return snippets


def _collect_full_documents(documents: List[models.Document]) -> List[str]:
    snippets: List[str] = []
    for doc in documents:
        if doc.extracted_text and len(doc.extracted_text) <= 5000:
            snippets.append(f"[[{doc.file_name}]]\n{doc.extracted_text.strip()}")
    return snippets


def _is_image_file(suffix: str) -> bool:
    return suffix.lower() in IMAGE_EXTENSIONS


def _describe_image_file(path: Path) -> str:
    try:
        return GEMINI.describe_image(path, prompt=IMAGE_PROMPT)
    except GeminiError as exc:
        logger.warning("Gemini image description failed for %s: %s", path.name, exc)
        return ""


def _describe_pdf_file(path: Path) -> str:
    descriptions: List[str] = []
    try:
        with fitz.open(path) as doc:
            page_total = min(2, doc.page_count)
            for page_index in range(page_total):
                image = _pdf_page_to_image(doc, page_index)
                if image is None:
                    continue
                try:
                    desc = GEMINI.describe_visual(image, prompt=PDF_PROMPT)
                    if desc:
                        descriptions.append(desc)
                except GeminiError as exc:
                    logger.warning(
                        "Gemini PDF description failed for %s page %s: %s",
                        path.name,
                        page_index + 1,
                        exc,
                    )
    except Exception as exc:
        logger.warning("Unable to render PDF %s for Gemini fallback: %s", path.name, exc)
    return "\n\n".join(descriptions).strip()


def _pdf_page_to_image(doc: fitz.Document, page_index: int) -> Optional[Image.Image]:
    try:
        page = doc.load_page(page_index)
        pix = page.get_pixmap(dpi=144)
        mode = "RGBA" if pix.alpha else "RGB"
        image = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
        return image
    except Exception as exc:
        logger.warning("Failed to rasterize PDF page %s: %s", page_index + 1, exc)
        return None

