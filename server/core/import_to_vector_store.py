"""Legacy vector-store import CLI (disabled)."""

from __future__ import annotations

from pathlib import Path
from typing import Optional
from uuid import UUID


class LegacyImportDisabled(RuntimeError):
    """Raised when attempting to use the removed CLI helpers."""


def import_legacy_scope(
    input_path: Path,
    *,
    embedding_model: Optional[str] = None,
    dry_run: bool = False,
) -> Optional[UUID]:
    raise LegacyImportDisabled(
        "The legacy vector-store import CLI has been removed. Use the FastAPI ingestion endpoints instead."
    )


def import_directory_to_vector_store(*args, **kwargs) -> None:
    raise LegacyImportDisabled(
        "The legacy vector-store import CLI has been removed. Use the FastAPI ingestion endpoints instead."
    )


def main() -> None:  # pragma: no cover - CLI guard
    raise LegacyImportDisabled(
        "The legacy vector-store import CLI has been removed. Use the FastAPI ingestion endpoints instead."
    )

