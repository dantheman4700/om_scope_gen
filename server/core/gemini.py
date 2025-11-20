"""Lightweight wrapper around the Google Gemini API."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

import google.generativeai as genai
from PIL import Image
from google.api_core.exceptions import GoogleAPIError

from server.core.config import MAX_TOKENS, TEMPERATURE


class GeminiError(RuntimeError):
    """Raised when Gemini interactions fail."""


class GeminiClient:
    """Handles text generation for OM sections."""

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
            raise GeminiError("GEMINI_API_KEY is not configured in the environment")

        genai.configure(api_key=key)

        self.model_name = model or os.getenv("GEMINI_MODEL", "models/gemini-2.5-pro")
        self.temperature = temperature if temperature is not None else TEMPERATURE
        self.max_output_tokens = max_output_tokens or MAX_TOKENS
        self._model = genai.GenerativeModel(self.model_name)

    def generate_section(
        self,
        *,
        section: str,
        previews: List[str],
        base_instruction: str,
        extra_instruction: Optional[str] = None,
    ) -> str:
        """Generate markdown for a section using the provided context previews."""

        compiled_preview = "\n\n".join(previews).strip() or "*No relevant snippets available.*"
        user_prompt = (
            f"Section: {section}\n\n"
            f"Context snippets:\n{compiled_preview}\n\n"
            f"{base_instruction.strip()}\n"
        )
        if extra_instruction:
            user_prompt += f"\nAdditional instruction:\n{extra_instruction.strip()}\n"

        try:
            response = self._model.generate_content(
                user_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_output_tokens,
                ),
            )
        except GoogleAPIError as exc:
            raise GeminiError(f"Gemini API error: {exc}") from exc

        if not response or not response.text:
            raise GeminiError("Gemini returned an empty response")

        return response.text.strip()

    def describe_image(self, path: Path, *, prompt: Optional[str] = None) -> str:
        """Describe an image file using Gemini vision capabilities."""

        try:
            with Image.open(path) as img:
                image = img.convert("RGB")
                return self._describe_pil_image(image, prompt=prompt)
        except GoogleAPIError as exc:
            raise GeminiError(f"Gemini vision error: {exc}") from exc
        except Exception as exc:
            raise GeminiError(f"Unable to open image {path.name}: {exc}") from exc

    def _describe_pil_image(self, image: Image.Image, *, prompt: Optional[str] = None) -> str:
        user_prompt = prompt or (
            "Extract every legible piece of text, label, or data visible in this asset. "
            "Return a concise summary and include bullet points for any numbers, metrics, or captions."
        )

        try:
            response = self._model.generate_content(
                [user_prompt, image],
                generation_config=genai.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=min(1024, self.max_output_tokens),
                ),
            )
        except GoogleAPIError as exc:
            raise GeminiError(f"Gemini vision error: {exc}") from exc

        if not response or not response.text:
            raise GeminiError("Gemini returned an empty response for the visual prompt")

        return response.text.strip()

    def describe_visual(self, image: Image.Image, *, prompt: Optional[str] = None) -> str:
        """Describe a PIL image object (useful for PDF page renders)."""

        return self._describe_pil_image(image, prompt=prompt)

