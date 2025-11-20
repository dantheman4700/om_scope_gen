"""SQLAlchemy ORM models matching the vectordb schema used by the OM generator."""

from __future__ import annotations

from datetime import datetime, date
from uuid import UUID as UUID_t, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    ForeignKey,
    LargeBinary,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .session import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    deal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deal_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    documents: Mapped[list["Document"]] = relationship("Document", back_populates="deal", cascade="all, delete-orphan")
    embeddings: Mapped[list["Embedding"]] = relationship(
        "Embedding", back_populates="deal", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    file_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    converted_formats: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    text_extracted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    embeddings_created: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_chunks_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    google_doc_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    converted_pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    converted_text_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gemini_processing_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n8n_execution_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    workflow_step_completed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    deal: Mapped[Deal] = relationship("Deal", back_populates="documents")
    embeddings: Mapped[list["Embedding"]] = relationship(
        "Embedding", back_populates="document", cascade="all, delete-orphan"
    )


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[UUID_t] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_overlap: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False, default="text")
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False, default="text-embedding-3-small")
    embedding_dimensions: Mapped[int] = mapped_column(Integer, nullable=False, default=1536)
    openai_tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    openai_request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content_quality_score: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    semantic_density: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    n8n_execution_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    deal: Mapped[Deal] = relationship("Deal", back_populates="embeddings")
    document: Mapped[Document] = relationship("Document", back_populates="embeddings")


class ProcessingLog(Base):
    __tablename__ = "processing_logs"

    id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id: Mapped[UUID_t | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    deal_id: Mapped[UUID_t | None] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"))
    processing_step: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    text_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunks_created: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n8n_execution_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    n8n_node_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workflow_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    openai_request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    google_api_quota_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped[Document | None] = relationship("Document")
    deal: Mapped[Deal | None] = relationship("Deal")


class ProcessingStat(Base):
    __tablename__ = "processing_stats"

    id: Mapped[UUID_t] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    date_period: Mapped[date] = mapped_column(Date, nullable=False)
    hour_period: Mapped[int | None] = mapped_column(Integer, nullable=True)
    files_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_file_size_mb: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_chunks_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pdfs_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    images_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    documents_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    spreadsheets_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_openai_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_google_api_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_files: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    estimated_openai_cost_usd: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    estimated_google_api_cost_usd: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

