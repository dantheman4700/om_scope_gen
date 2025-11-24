"""Lightweight token counting heuristics used by the ingestion pipeline."""

from __future__ import annotations

import base64
from typing import Iterable, Mapping


class TokenCountingError(RuntimeError):
    """Raised when a block cannot be processed."""


def make_text_block(text: str) -> Mapping[str, str]:
    """Create a token counting block for plain text."""

    return {"type": "text", "text": text}


def make_document_block(
    *,
    data: bytes,
    media_type: str,
    filename: str | None = None,
) -> Mapping[str, object]:
    """Create a token counting block for a binary document.
    
    Note: The 'name' field is NOT included because the token counting API
    does not accept it (returns 400 error). The filename parameter is kept
    for API compatibility but is not used in the token counting context.
    """

    encoded = base64.b64encode(data).decode("ascii")
    return {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": encoded,
        },
    }


def make_image_block(*, data: bytes, media_type: str) -> Mapping[str, object]:
    """Create a token counting block for an image."""

    encoded = base64.b64encode(data).decode("ascii")
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": encoded,
        },
    }


async def count_tokens_for_blocks(blocks: Iterable[Mapping[str, object]]) -> int:
    """Estimate token counts locally without calling external services."""

    total = 0
    for block in blocks:
        block_type = block.get("type")
        if block_type == "text":
            text = str(block.get("text", ""))
            total += max(1, len(text) // 4)
        elif block_type in {"document", "image"}:
            source = block.get("source") or {}
            data = source.get("data", "")
            try:
                byte_len = len(base64.b64decode(data))
            except Exception as exc:  # pragma: no cover - invalid base64
                raise TokenCountingError(f"Invalid base64 data in block: {exc}") from exc
            total += max(1, byte_len // 6)
        else:
            total += 1
    return total

