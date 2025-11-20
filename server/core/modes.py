"""Shared enums/constants for the OM generator."""

from __future__ import annotations

from enum import Enum


class ResearchMode(str, Enum):
    """Legacy research mode flag retained for backwards compatibility."""

    NONE = "none"
    QUICK = "quick"
    FULL = "full"

