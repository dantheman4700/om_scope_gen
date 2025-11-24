"""Per-file summarisation with Gemini (fallback-friendly)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

from .config import MAX_TOKENS, OUTPUT_DIR, TEMPERATURE

LOGGER = logging.getLogger(__name__)


@dataclass
class FileSummary:
    filename: str
    summary: Dict[str, Any]
    cache_path: Optional[Path] = None


class FileSummarizer:
    """Creates structured, decision-oriented summaries with optional Gemini support."""

    def __init__(self, cache_root: Optional[Path] = None) -> None:
        self.cache_root = (cache_root or (OUTPUT_DIR / "artifacts" / "summaries")).resolve()
        self.cache_root.mkdir(parents=True, exist_ok=True)

        key = os.getenv("GEMINI_API_KEY")
        self._model = None
        if key:
            try:
                genai.configure(api_key=key)
                model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-pro")
                self._model = genai.GenerativeModel(model_name)
            except Exception as exc:  # pragma: no cover - configuration errors
                LOGGER.warning("Failed to initialise Gemini for summaries: %s", exc)
                self._model = None
        else:
            LOGGER.info(
                "GEMINI_API_KEY not configured; oversized files will use heuristic summaries."
            )

    # ------------------------------------------------------------------ public API
    def summarize_file(
        self,
        filename: str,
        content: str,
        project_focus: Optional[str] = None,
        file_note: Optional[str] = None,
    ) -> FileSummary:
        doc_stub = {
            "filename": filename,
            "content": content,
            "media_type": "text/plain",
            "upload_via": "text",
            "can_upload": False,
            "content_hash": self._hash_text(content),
        }
        return self.summarize_document(
            document=doc_stub,
            project_focus=project_focus,
            file_note=file_note,
        )

    def summarize_document(
        self,
        document: Dict[str, Any],
        project_focus: Optional[str] = None,
        file_note: Optional[str] = None,
    ) -> FileSummary:
        filename = document.get("filename", "unknown")
        content = document.get("content", "")

        cache_key = self._make_cache_key(
            filename,
            content,
            project_focus,
            file_note,
            document.get("content_hash"),
        )
        cache_path = self.cache_root / f"{self._sanitize_name(filename)}.{cache_key}.json"
        if cache_path.exists():
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return FileSummary(filename=filename, summary=data, cache_path=cache_path)
            except Exception:
                pass

        if not self._model:
            summary = self._minimal_stub(filename)
            return FileSummary(filename=filename, summary=summary, cache_path=None)

        prompt = self._build_prompt(document, project_focus, file_note)
        attempt = 0
        while attempt < 3:
            try:
                response = self._model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=max(0.1, TEMPERATURE),
                        max_output_tokens=min(2048, MAX_TOKENS),
                    ),
                )
                if not response or not response.text:
                    raise ValueError("Gemini returned an empty summary response")
                summary = self._parse_json(response.text)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(summary, f, indent=2)
                return FileSummary(filename=filename, summary=summary, cache_path=cache_path)
            except GoogleAPIError as exc:  # pragma: no cover - external service
                wait = min(20, 5 * (2**attempt))
                LOGGER.warning(
                    "Gemini rate limit while summarising %s. Retrying in %ss (attempt %s)",
                    filename,
                    wait,
                    attempt + 1,
                )
                time.sleep(wait)
                attempt += 1
            except Exception as exc:
                LOGGER.error("Failed to summarise %s: %s", filename, exc)
                break

        LOGGER.error("Falling back to heuristic summary for %s", filename)
        return FileSummary(filename=filename, summary=self._minimal_stub(filename), cache_path=None)

    # ------------------------------------------------------------------ helpers
    def _build_prompt(
        self,
        document: Dict[str, Any],
        project_focus: Optional[str],
        file_note: Optional[str],
    ) -> str:
        filename = document.get("filename", "unknown")
        content = document.get("content", "")
        schema = {
            "filename": "string",
            "purpose": "string",
            "key_entities": ["string"],
            "pain_points": [
                {"description": "string", "severity": "low|medium|high", "evidence_refs": ["int"]}
            ],
            "risks": ["string"],
            "integration_complexity": "string",
            "unknowns": ["string"],
            "effort_multipliers": ["string"],
            "must_read_sections": ["string"],
            "evidence_quotes": [
                {"quote": "string", "rationale": "string", "approx_location": "string"}
            ],
            "importance_score": 0,
        }

        header = []
        if project_focus:
            header.append(f"PROJECT FOCUS: {project_focus}")
        header.append(f"SOURCE FILE: {filename}")
        if file_note:
            header.append(f"FILE NOTE: {file_note}")
        upload_via = document.get("upload_via")
        source_type = document.get("source_type")
        if upload_via and source_type:
            header.append(f"SOURCE TYPE: {source_type}; INGEST METHOD: {upload_via}")
        if document.get("page_count"):
            header.append(f"PAGE COUNT: {document['page_count']}")
        if document.get("can_upload") and upload_via == "attachment":
            header.append("NOTE: Original file provided via native upload in this message.")
        elif upload_via == "ocr":
            header.append("NOTE: Content obtained via OCR from the original file.")
        elif upload_via == "skipped":
            header.append("WARNING: File exceeded upload limits; only placeholder content available.")

        instruction = (
            "\n".join(header)
            + "\n\nGOAL: Create a decision-oriented summary for scope planning.\n"
            + "Focus on: pain points, risks, integration complexity, unknowns, and what increases effort.\n"
            + "Include 3-10 evidence quotes from the content with brief rationale and approximate location.\n"
            + "Return strictly valid JSON matching this schema (and nothing else):\n"
            + json.dumps(schema, indent=2)
            + "\n\nCONTENT:\n"
            + content
        )
        return instruction

    def _parse_json(self, text: str) -> Dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            return json.loads(cleaned)
        if "```" in cleaned:
            start = cleaned.find("```json")
            if start != -1:
                end = cleaned.find("```", start + 7)
                if end != -1:
                    return json.loads(cleaned[start + 7 : end].strip())
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise ValueError("No JSON object found in summary response")

    def _minimal_stub(self, filename: str) -> Dict[str, Any]:
        return {
            "filename": filename,
            "purpose": "Summary unavailable (Gemini disabled).",
            "key_entities": [],
            "pain_points": [],
            "risks": [],
            "integration_complexity": "",
            "unknowns": [],
            "effort_multipliers": [],
            "must_read_sections": [],
            "evidence_quotes": [],
            "importance_score": 0,
        }

    def _make_cache_key(
        self,
        filename: str,
        content: str,
        project_focus: Optional[str],
        file_note: Optional[str],
        content_hash: Optional[str] = None,
    ) -> str:
        import hashlib

        hasher = hashlib.sha256()
        hasher.update(filename.encode("utf-8", errors="ignore"))
        hasher.update(content.encode("utf-8", errors="ignore"))
        if project_focus:
            hasher.update(project_focus.encode("utf-8", errors="ignore"))
        if file_note:
            hasher.update(file_note.encode("utf-8", errors="ignore"))
        if content_hash:
            hasher.update(content_hash.encode("utf-8", errors="ignore"))
        return hasher.hexdigest()[:16]

    def _hash_text(self, text: str) -> str:
        import hashlib

        hasher = hashlib.sha256()
        hasher.update(text.encode("utf-8", errors="ignore"))
        return hasher.hexdigest()

    def _sanitize_name(self, name: str) -> str:
        return "".join(c if c.isalnum() or c in (".", "-", "_") else "_" for c in name)

