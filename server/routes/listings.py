"""Listing and access request management endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session, joinedload

from ..dependencies import db_session
from ..db import models
from ..security import rbac
from .auth import SessionUser, require_roles


router = APIRouter(prefix="/listings", tags=["listings"])


class ListingBase(BaseModel):
    deal_id: UUID
    title: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=120, pattern="^[a-z0-9-]+$")
    summary: Optional[str] = None
    status: str = Field(default="draft", max_length=32)
    hero_image_url: Optional[str] = None
    requires_nda: bool = False
    metadata: dict = Field(default_factory=dict)


class ListingCreateRequest(ListingBase):
    pass


class ListingUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    slug: Optional[str] = Field(default=None, max_length=120, pattern="^[a-z0-9-]+$")
    summary: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=32)
    hero_image_url: Optional[str] = None
    requires_nda: Optional[bool] = None
    metadata: Optional[dict] = None
    published_at: Optional[str] = None


class ListingResponse(BaseModel):
    id: UUID
    deal_id: UUID
    title: str
    slug: str
    summary: Optional[str]
    status: str
    hero_image_url: Optional[str]
    requires_nda: bool
    metadata: dict = Field(alias="metadata_json")
    published_at: Optional[str]
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AccessRequestBase(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    email: str = Field(..., max_length=320)
    company: Optional[str] = Field(default=None, max_length=255)
    message: Optional[str] = None


class AccessRequestCreate(AccessRequestBase):
    pass


class AccessRequestUpdate(BaseModel):
    status: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = None


class AccessRequestResponse(BaseModel):
    id: UUID
    listing_id: UUID
    full_name: Optional[str]
    email: str
    company: Optional[str]
    message: Optional[str]
    status: str
    notes: Optional[str]
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


def _normalize_slug(raw: str) -> str:
    return raw.strip().lower()


def _get_listing(db: Session, listing_id: UUID) -> models.Listing:
    listing = (
        db.query(models.Listing)
        .options(joinedload(models.Listing.deal))
        .filter(models.Listing.id == listing_id)
        .one_or_none()
    )
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return listing


def _get_listing_for_user(db: Session, listing_id: UUID, user: SessionUser) -> models.Listing:
    listing = _get_listing(db, listing_id)
    rbac.ensure_deal_access(db, user, listing.deal_id)
    return listing


def _assert_unique_slug(db: Session, slug: str, exclude_id: Optional[UUID] = None) -> None:
    query = db.query(models.Listing).filter(models.Listing.slug == slug)
    if exclude_id is not None:
        query = query.filter(models.Listing.id != exclude_id)
    if db.query(query.exists()).scalar():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already in use")


@router.get("/", response_model=List[ListingResponse])
async def list_listings(
    status_filter: Optional[str] = None,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[ListingResponse]:
    query = db.query(models.Listing).join(models.Deal)
    if current_user.role != "admin":
        team_ids = rbac.user_team_ids(db, current_user.id)
        query = query.filter(
            (models.Deal.owner_id == current_user.id) | (models.Deal.team_id.in_(team_ids))
        )
    if status_filter:
        query = query.filter(models.Listing.status == status_filter)
    listings = query.order_by(models.Listing.created_at.desc()).all()
    return [ListingResponse.model_validate(listing) for listing in listings]


@router.post("/", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreateRequest,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> ListingResponse:
    deal = rbac.ensure_deal_access(db, current_user, payload.deal_id)
    slug = _normalize_slug(payload.slug)
    _assert_unique_slug(db, slug)

    listing = models.Listing(
        deal_id=deal.id,
        title=payload.title.strip(),
        slug=slug,
        summary=payload.summary,
        status=payload.status or "draft",
        hero_image_url=payload.hero_image_url,
        requires_nda=payload.requires_nda,
        metadata_json=payload.metadata or {},
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> ListingResponse:
    listing = _get_listing_for_user(db, listing_id, current_user)
    return ListingResponse.model_validate(listing)


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: UUID,
    payload: ListingUpdateRequest,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> ListingResponse:
    listing = _get_listing_for_user(db, listing_id, current_user)

    if payload.title is not None:
        listing.title = payload.title.strip()
    if payload.slug is not None:
        new_slug = _normalize_slug(payload.slug)
        _assert_unique_slug(db, new_slug, exclude_id=listing.id)
        listing.slug = new_slug
    if payload.summary is not None:
        listing.summary = payload.summary
    if payload.status is not None:
        listing.status = payload.status
    if payload.hero_image_url is not None:
        listing.hero_image_url = payload.hero_image_url
    if payload.requires_nda is not None:
        listing.requires_nda = payload.requires_nda
    if payload.metadata is not None:
        listing.metadata_json = payload.metadata
    if payload.published_at is not None:
        listing.published_at = payload.published_at  # Expect ISO string; DB adapter will coerce

    db.commit()
    db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.get(
    "/{listing_id}/access-requests",
    response_model=List[AccessRequestResponse],
)
async def list_access_requests(
    listing_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[AccessRequestResponse]:
    listing = _get_listing_for_user(db, listing_id, current_user)
    requests = (
        db.query(models.ListingAccessRequest)
        .filter(models.ListingAccessRequest.listing_id == listing.id)
        .order_by(models.ListingAccessRequest.created_at.desc())
        .all()
    )
    return [AccessRequestResponse.model_validate(req) for req in requests]


@router.post(
    "/{listing_id}/access-requests",
    response_model=AccessRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_access_request(
    listing_id: UUID,
    payload: AccessRequestCreate,
    db: Session = Depends(db_session),
) -> AccessRequestResponse:
    listing = _get_listing(db, listing_id)
    request_record = models.ListingAccessRequest(
        listing_id=listing.id,
        full_name=payload.full_name.strip() if payload.full_name else None,
        email=payload.email.strip().lower(),
        company=payload.company.strip() if payload.company else None,
        message=payload.message,
        status="pending",
    )
    db.add(request_record)
    db.commit()
    db.refresh(request_record)
    return AccessRequestResponse.model_validate(request_record)


@router.patch(
    "/{listing_id}/access-requests/{request_id}",
    response_model=AccessRequestResponse,
)
async def update_access_request(
    listing_id: UUID,
    request_id: UUID,
    payload: AccessRequestUpdate,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> AccessRequestResponse:
    listing = _get_listing_for_user(db, listing_id, current_user)
    record = (
        db.query(models.ListingAccessRequest)
        .filter(
            models.ListingAccessRequest.id == request_id,
            models.ListingAccessRequest.listing_id == listing.id,
        )
        .one_or_none()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")

    if payload.status is not None:
        record.status = payload.status
        record.reviewed_by = current_user.id
        record.reviewed_at = datetime.utcnow()
    if payload.notes is not None:
        record.notes = payload.notes

    db.commit()
    db.refresh(record)
    return AccessRequestResponse.model_validate(record)

