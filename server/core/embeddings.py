"""Embedding utilities for deal/document embeddings (OpenAI-backed)."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

import hashlib
import os
from openai import OpenAI

from .config import EMBEDDING_MODEL


EMBED_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}


class ProfileEmbedder:
    """Embedding helper backed by OpenAI embedding models."""

    def __init__(self, model_name: Optional[str] = None, api_key: Optional[str] = None) -> None:
        self.model_name = model_name or EMBEDDING_MODEL
        self.dim = EMBED_DIMENSIONS.get(self.model_name)
        self._client: Optional[OpenAI] = None
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self.api_key:
                raise ValueError("OPENAI_API_KEY not set; required for embeddings")
            self._client = OpenAI(api_key=self.api_key)
        return self._client

    def embed(self, text: str) -> Iterable[float]:
        response = self.client.embeddings.create(
            model=self.model_name,
            input=text,
        )
        return response.data[0].embedding


def hash_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


