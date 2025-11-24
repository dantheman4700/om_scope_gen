"""Gemini-powered variable extraction utilities."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

from .config import MAX_TOKENS, TEMPERATURE


class VariableExtractionError(RuntimeError):
    """Raised when Gemini cannot produce structured variables."""


def _render_json(data: Any) -> str:
    try:
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception:
        return str(data)


class GeminiExtractor:
    """Extract structured variables using the Gemini API."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
    ) -> None:
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise VariableExtractionError(
                "GEMINI_API_KEY is not configured. Set it to enable variable extraction."
            )

        genai.configure(api_key=key)

        self.model_name = model or os.getenv("GEMINI_MODEL", "models/gemini-2.5-pro")
        self.temperature = temperature if temperature is not None else TEMPERATURE
        self.max_output_tokens = max_output_tokens or MAX_TOKENS
        self._model = genai.GenerativeModel(self.model_name)

    # --------------------------------------------------------------------- helpers
    @staticmethod
    def _parse_json(text: str) -> Dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            return json.loads(cleaned)
        if "```" in cleaned:
            start = cleaned.find("```json")
            if start != -1:
                end = cleaned.find("```", start + 7)
                if end != -1:
                    return json.loads(cleaned[start + 7 : end].strip())
            # Fall back to first/last braces
        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            return json.loads(cleaned[brace_start : brace_end + 1])
        raise ValueError("No JSON object found in Gemini response")

    def _summarise_attachments(self, attachments: Optional[List[Dict[str, Any]]]) -> str:
        if not attachments:
            return ""
        lines = ["Attachments: "]
        for idx, attachment in enumerate(attachments, 1):
            media_type = attachment.get("source", {}).get("media_type", "application/octet-stream")
            lines.append(f"  - Attachment {idx}: {media_type} (binary data omitted)")
        return "\n".join(lines)

    def _prompt_header(
        self,
        variables_schema: Dict[str, Any],
        variables_guide: Dict[str, Any],
        file_context: Optional[Dict[str, Any]],
        attachments: Optional[List[Dict[str, Any]]],
        use_web_search: bool,
    ) -> str:
        header = [
            "You are an expert solutions architect preparing an automation scope.",
            "Extract variables strictly following the provided schema and guidance.",
            "",
            "Schema (full JSON schema to follow exactly):",
            _render_json(variables_schema),
            "",
            "Variable guidance (examples, hints, enumerations):",
            _render_json(variables_guide),
        ]
        if file_context:
            header.append("")
            header.append("Per-file notes or overrides:")
            header.append(_render_json(file_context))
        if attachments:
            header.append("")
            header.append(self._summarise_attachments(attachments))
        if use_web_search:
            header.append("")
            header.append(
                "Note: Web search is not currently enabled. Ignore any instructions referencing it."
            )
        header.append("")
        header.append(
            "Return ONLY valid JSON that matches the schema. Do not add prose or explanations."
        )
        return "\n".join(header)

    def _generate(self, prompt: str) -> Tuple[Dict[str, Any], str]:
        try:
            response = self._model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_output_tokens,
                ),
            )
        except GoogleAPIError as exc:  # pragma: no cover - network failures
            raise VariableExtractionError(f"Gemini API error: {exc}") from exc

        if not response or not response.text:
            raise VariableExtractionError("Gemini returned an empty response")

        raw_text = response.text.strip()
        try:
            parsed = self._parse_json(raw_text)
        except Exception as parse_exc:
            raise VariableExtractionError(f"Failed to parse Gemini response: {parse_exc}") from parse_exc
        return parsed, raw_text

    # --------------------------------------------------------------------- public API
    def extract_variables(
        self,
        compact_input: str,
        variables_schema: Dict[str, Any],
        variables_guide: Dict[str, Any],
        *,
        file_context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        use_web_search: bool = False,
    ) -> Dict[str, Any]:
        prompt = self._prompt_header(
            variables_schema,
            variables_guide,
            file_context,
            attachments,
            use_web_search,
        )
        prompt = f"{prompt}\n\nCONTEXT:\n{compact_input}"
        parsed, _ = self._generate(prompt)
        return parsed

    def extract_variables_with_raw(
        self,
        compact_input: str,
        variables_schema: Dict[str, Any],
        variables_guide: Dict[str, Any],
        *,
        file_context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        use_web_search: bool = False,
    ) -> Tuple[Dict[str, Any], str]:
        prompt = self._prompt_header(
            variables_schema,
            variables_guide,
            file_context,
            attachments,
            use_web_search,
        )
        prompt = f"{prompt}\n\nCONTEXT:\n{compact_input}"
        return self._generate(prompt)

    def refine_variable(
        self,
        variable_name: str,
        current_value: Any,
        instructions: str,
        variables_guide: Dict[str, Any],
    ) -> Any:
        guide = variables_guide.get(variable_name) if isinstance(variables_guide, dict) else None
        prompt_parts = [
            f"You previously generated the following value for '{variable_name}':",
            _render_json(current_value),
            "",
            "Instructions for refinement:",
            instructions.strip() or "(no additional detail provided)",
            "",
        ]
        if guide:
            prompt_parts.extend(
                [
                    "Relevant guidance or examples for this variable:",
                    _render_json(guide),
                    "",
                ]
            )
        prompt_parts.append(
            "Return ONLY valid JSON containing the updated value for the variable. Example:\n"
            f'{{ "{variable_name}": <new value> }}'
        )
        prompt = "\n".join(prompt_parts)
        parsed, _ = self._generate(prompt)
        if isinstance(parsed, dict) and variable_name in parsed:
            return parsed[variable_name]
        return parsed


