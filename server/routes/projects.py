"""Deal CRUD endpoints for the admin surface."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session, joinedload

from server.core.config import DATA_ROOT

from ..dependencies import db_session
from ..db import models
from ..storage.projects import ensure_project_structure
from ..security import rbac
from .auth import SessionUser, get_current_user, require_roles


router = APIRouter(prefix="/deals", tags=["deals"])


class DealBase(BaseModel):
    company_name: str = Field(..., max_length=255)
    deal_name: Optional[str] = Field(None, max_length=255)
    deal_description: Optional[str] = None
    status: Optional[str] = Field("active", max_length=50)
    flags: dict = Field(default_factory=dict)
    team_id: Optional[UUID] = None


class DealCreateRequest(DealBase):
    pass


class DealUpdateRequest(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    deal_name: Optional[str] = Field(None, max_length=255)
    deal_description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    flags: Optional[dict] = None
    team_id: Optional[UUID] = None


class UserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str


class DealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    deal_name: Optional[str] = None
    deal_description: Optional[str] = None
    status: str
    flags: dict
    owner: Optional[UserSummaryResponse] = None
    team_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


@router.get("/", response_model=List[DealResponse])
async def list_deals(
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> List[DealResponse]:
    query = db.query(models.Deal).options(joinedload(models.Deal.owner))
    if current_user.role != "admin":
        team_ids = rbac.user_team_ids(db, current_user.id)
        query = query.filter(
            (models.Deal.owner_id == current_user.id)
            | (models.Deal.team_id.in_(team_ids))
        )
    deals = query.order_by(models.Deal.created_at.desc()).all()
    return [DealResponse.model_validate(deal) for deal in deals]


@router.post("/", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: DealCreateRequest,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> DealResponse:
    deal = models.Deal(
        company_name=payload.company_name.strip(),
        deal_name=payload.deal_name.strip() if payload.deal_name else payload.company_name.strip(),
        deal_description=payload.deal_description,
        status=payload.status or "active",
        flags=payload.flags or {},
        owner_id=current_user.id,
        team_id=payload.team_id,
        created_by=str(current_user.id),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    ensure_project_structure(DATA_ROOT, str(deal.id))
    return DealResponse.model_validate(deal)


@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("viewer", "editor", "admin")),
) -> DealResponse:
    deal = rbac.ensure_deal_access(db, current_user, deal_id)
    return DealResponse.model_validate(deal)


@router.patch("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID,
    payload: DealUpdateRequest,
    db: Session = Depends(db_session),
    current_user: SessionUser = Depends(require_roles("editor", "admin")),
) -> DealResponse:
    deal = rbac.ensure_deal_access(db, current_user, deal_id)

    if payload.company_name is not None:
        deal.company_name = payload.company_name.strip()
    if payload.deal_name is not None:
        deal.deal_name = payload.deal_name.strip() if payload.deal_name else None
    if payload.deal_description is not None:
        deal.deal_description = payload.deal_description
    if payload.status is not None:
        deal.status = payload.status
    if payload.flags is not None:
        deal.flags = payload.flags
    if payload.team_id is not None:
        deal.team_id = payload.team_id

    deal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(deal)
    return DealResponse.model_validate(deal)

