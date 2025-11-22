"""Role-based access helpers shared across routers."""

from __future__ import annotations

from typing import Iterable, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from server.db import models
from server.routes.auth import SessionUser


def user_team_ids(db: Session, user_id: UUID) -> List[UUID]:
    rows = (
        db.query(models.TeamMember.team_id)
        .filter(models.TeamMember.user_id == user_id)
        .all()
    )
    return [row.team_id for row in rows]


def can_access_deal(
    *,
    user: SessionUser,
    deal: models.Deal,
    team_ids: Optional[Iterable[UUID]] = None,
) -> bool:
    if user.role == "admin":
        return True
    if deal.owner_id == user.id:
        return True
    if deal.team_id is not None:
        teams = set(team_ids or [])
        if deal.team_id in teams:
            return True
    return False


def ensure_deal_access(db: Session, user: SessionUser, deal_id: UUID) -> models.Deal:
    deal = db.get(models.Deal, deal_id)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    if not can_access_deal(user=user, deal=deal, team_ids=user_team_ids(db, user.id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this deal")
    return deal


def ensure_run_access(db: Session, user: SessionUser, run_id: UUID) -> models.Run:
    run = (
        db.query(models.Run)
        .options(joinedload(models.Run.deal))
        .filter(models.Run.id == run_id)
        .one_or_none()
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    deal = run.deal or db.get(models.Deal, run.deal_id)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent deal not found")
    if not can_access_deal(user=user, deal=deal, team_ids=user_team_ids(db, user.id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this run")
    return run

