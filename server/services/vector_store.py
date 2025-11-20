"""Postgres + pgvector backed vector store helper."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence
from uuid import UUID, uuid4

import psycopg
from pgvector.psycopg import Vector, register_vector
from psycopg.rows import dict_row


logger = logging.getLogger(__name__)


class VectorStoreError(RuntimeError):
    """Raised when vector store operations fail."""


@dataclass
class RetrievalResult:
    id: UUID
    deal_id: UUID
    document_id: UUID
    score: float
    content: str
    file_name: str
    chunk_index: int
    file_type: str
    section_title: Optional[str]


class VectorStore:
    """Thin wrapper around pgvector operations targeting the embeddings table."""

    def __init__(self, dsn: str, *, embedding_dim: int = 1536) -> None:
        if not dsn:
            raise ValueError("VectorStore requires a valid DATABASE_DSN")
        self.dsn = dsn
        self.embedding_dim = embedding_dim

    def _connect(self):
        conn = psycopg.connect(self.dsn, row_factory=dict_row)
        register_vector(conn)
        return conn

    def ensure_schema(self) -> None:
        """Ensure the pgvector extension exists; the tables are managed externally."""

        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
                conn.commit()
            except Exception as exc:
                conn.rollback()
                raise VectorStoreError(f"Failed to ensure pgvector extension: {exc}") from exc

    # ------------------------------------------------------------------
    # Insert / delete helpers
    # ------------------------------------------------------------------
    def insert_embedding(
        self,
        *,
        deal_id: UUID,
        document_id: UUID,
        content: str,
        embedding: Sequence[float],
        company_name: str,
        file_name: str,
        file_type: str,
        chunk_index: int,
        chunk_size: int,
        content_type: str = "text",
        chunk_overlap: int = 0,
        embedding_model: str = "text-embedding-3-small",
        embedding_dimensions: int | None = None,
        content_hash: Optional[str] = None,
        page_number: Optional[int] = None,
        section_title: Optional[str] = None,
    ) -> UUID:
        embedding_dimensions = embedding_dimensions or len(embedding)
        embedding_id = uuid4()

        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO embeddings (
                        id,
                        deal_id,
                        document_id,
                        content,
                        content_hash,
                        embedding,
                        company_name,
                        file_name,
                        file_type,
                        chunk_index,
                        chunk_size,
                        chunk_overlap,
                        content_type,
                        page_number,
                        section_title,
                        embedding_model,
                        embedding_dimensions
                    )
                    VALUES (
                        %(id)s,
                        %(deal_id)s,
                        %(document_id)s,
                        %(content)s,
                        %(content_hash)s,
                        %(embedding)s,
                        %(company_name)s,
                        %(file_name)s,
                        %(file_type)s,
                        %(chunk_index)s,
                        %(chunk_size)s,
                        %(chunk_overlap)s,
                        %(content_type)s,
                        %(page_number)s,
                        %(section_title)s,
                        %(embedding_model)s,
                        %(embedding_dimensions)s
                    )
                    """,
                    {
                        "id": embedding_id,
                        "deal_id": deal_id,
                        "document_id": document_id,
                        "content": content,
                        "content_hash": content_hash,
                        "embedding": Vector(list(embedding)),
                        "company_name": company_name,
                        "file_name": file_name,
                        "file_type": file_type,
                        "chunk_index": chunk_index,
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                        "content_type": content_type,
                        "page_number": page_number,
                        "section_title": section_title,
                        "embedding_model": embedding_model,
                        "embedding_dimensions": embedding_dimensions,
                    },
                )
                conn.commit()
            except Exception as exc:
                conn.rollback()
                raise VectorStoreError(f"Failed to insert embedding: {exc}") from exc

        return embedding_id

    def delete_embeddings(self, document_id: UUID) -> int:
        """Delete embeddings tied to a document (used on reupload)."""

        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute("DELETE FROM embeddings WHERE document_id = %s", (document_id,))
                deleted = cur.rowcount
                conn.commit()
                return deleted
            except Exception as exc:
                conn.rollback()
                raise VectorStoreError(f"Failed to delete embeddings: {exc}") from exc

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------
    def similarity_search(
        self,
        embedding: Sequence[float],
        *,
        top_k: int = 12,
        deal_id: Optional[UUID] = None,
        document_ids: Optional[Iterable[UUID]] = None,
    ) -> list[RetrievalResult]:
        """Return nearest neighbours using cosine distance, filtered by deal/doc ids."""

        where_clauses = []
        params: list = [Vector(list(embedding))]

        if deal_id:
            where_clauses.append("deal_id = %s")
            params.append(deal_id)

        if document_ids:
            where_clauses.append("document_id = ANY(%s)")
            params.append(list(document_ids))

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        sql = f"""
        SELECT
            id,
            deal_id,
            document_id,
            content,
            file_name,
            file_type,
            chunk_index,
            section_title,
            1 - (embedding <=> %s) AS score
        FROM embeddings
        {where_sql}
        ORDER BY embedding <=> %s ASC
        LIMIT %s
        """

        params.append(Vector(list(embedding)))
        params.append(top_k)

        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute(sql, params)
                rows = cur.fetchall()
            except Exception as exc:
                raise VectorStoreError(f"Similarity search failed: {exc}") from exc

        return [
            RetrievalResult(
                id=row["id"],
                deal_id=row["deal_id"],
                document_id=row["document_id"],
                score=row["score"],
                content=row["content"],
                file_name=row["file_name"],
                chunk_index=row["chunk_index"],
                file_type=row["file_type"],
                section_title=row.get("section_title"),
            )
            for row in rows
        ]

