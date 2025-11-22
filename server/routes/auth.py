"""Session-based authentication endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from server.core.config import (
    SESSION_COOKIE_MAX_AGE,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE,
)
from server.db import models
from server.dependencies import db_session
from server.security.passwords import PasswordService
from server.security.sessions import SessionService


router = APIRouter(prefix="/auth", tags=["auth"])

_passwords = PasswordService()
_sessions = SessionService()


class SessionUser(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class UserResponse(SessionUser):
    pass


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)
    role: str = Field(
        default="admin",
        pattern="^(admin|editor|viewer)$",
        description="Role assigned to the created user.",
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


def _normalise_email(email: EmailStr) -> str:
    return email.strip().lower()


def _issue_session(response: Response, user_id: UUID) -> None:
    token = _sessions.create(str(user_id))
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
    )


def _user_to_session_user(user: models.User) -> SessionUser:
    return SessionUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


def _extract_session_token(request: Request) -> Optional[str]:
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(db_session),
) -> SessionUser:
    token = _extract_session_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = _sessions.parse(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session payload")
    try:
        user_uuid = UUID(str(user_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session user") from exc

    user = db.get(models.User, user_uuid)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return _user_to_session_user(user)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(db_session),
) -> UserResponse:
    email = _normalise_email(payload.email)
    existing = db.query(models.User).filter(models.User.email == email).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = models.User(
        email=email,
        full_name=payload.full_name.strip() if payload.full_name else None,
        role=payload.role,
        hashed_password=_passwords.hash(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _issue_session(response, user.id)
    return _user_to_session_user(user)


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(db_session),
) -> UserResponse:
    email = _normalise_email(payload.email)
    user = db.query(models.User).filter(models.User.email == email).one_or_none()
    if not user or not _passwords.verify(user.hashed_password, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")

    user.last_login_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)

    _issue_session(response, user.id)
    return _user_to_session_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
    )
    return None


@router.get("/me", response_model=UserResponse)
def whoami(current_user: SessionUser = Depends(get_current_user)) -> UserResponse:
    return current_user


def require_roles(*roles: str):
    allowed = set(roles) if roles else {"viewer", "editor", "admin"}

    def dependency(current_user: SessionUser = Depends(get_current_user)) -> SessionUser:
        if current_user.role == "admin":
            return current_user
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return current_user

    return dependency

