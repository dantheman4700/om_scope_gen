"""Scope Document Generator - AI-powered technical scope document automation."""

__version__ = "0.1.0"

from .ingest import DocumentIngester
from .extractor import GeminiExtractor
from .renderer import TemplateRenderer

__all__ = ['DocumentIngester', 'GeminiExtractor', 'TemplateRenderer']

