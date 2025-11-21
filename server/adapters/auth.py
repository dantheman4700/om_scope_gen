"""Authentication provider abstractions used by FastAPI dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


class AuthError(RuntimeError):
    """Raised when an auth provider cannot satisfy a request."""


@dataclass
class AuthResult:
    """Minimal identity payload returned by auth providers."""

    subject: str
    email: Optional[str] = None
    claims: Optional[dict] = None


class AuthProvider:
    """Base interface for validating bearer tokens from external providers."""

    name: str = "local"

    def validate_token(self, token: Optional[str]) -> Optional[AuthResult]:  # pragma: no cover - interface
        raise NotImplementedError

    def healthcheck(self) -> None:
        """Providers can raise AuthError here to signal misconfiguration."""
        return None


class LocalAuthProvider(AuthProvider):
    """No-op provider that simply echoes the token back as the subject."""

    name = "local"

    def validate_token(self, token: Optional[str]) -> Optional[AuthResult]:
        if not token:
            return None
        return AuthResult(subject=token)


class SupabaseAuthProvider(AuthProvider):
    """Lightweight Supabase token validator placeholder."""

    name = "supabase"

    def __init__(self, *, url: Optional[str], anon_key: Optional[str]) -> None:
        if not url or not anon_key:
            raise AuthError("Supabase auth provider requires SUPABASE_URL and SUPABASE_ANON_KEY")
        self._url = url.rstrip("/")
        self._anon_key = anon_key

    def validate_token(self, token: Optional[str]) -> Optional[AuthResult]:
        # Full JWT verification (audience + signature) is handled by Supabase middleware.
        # For now we simply ensure a token exists; parsing happens in the session layer.
        if not token:
            return None
        return AuthResult(subject=token)

    def healthcheck(self) -> None:
        if not self._url.startswith("http"):
            raise AuthError("Supabase URL appears misconfigured")


__all__ = [
    "AuthError",
    "AuthProvider",
    "AuthResult",
    "LocalAuthProvider",
    "SupabaseAuthProvider",
]

