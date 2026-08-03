from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.models import IngestionRun, Organisation, Participation, Project

router = APIRouter()


class Totals(BaseModel):
    projects: int
    organisations: int
    participations: int


class SourceStatus(BaseModel):
    source: str
    projects: int
    last_success_at: datetime | None


class SourcesResponse(BaseModel):
    totals: Totals
    sources: list[SourceStatus]


@router.get("/sources", response_model=SourcesResponse)
def sources(db: Annotated[Session, Depends(get_db)]) -> SourcesResponse:
    totals = Totals(
        projects=db.scalar(select(func.count(Project.id))) or 0,
        organisations=db.scalar(select(func.count(Organisation.id))) or 0,
        participations=db.scalar(select(func.count(Participation.id))) or 0,
    )

    projects_by_source = dict(
        db.execute(select(Project.source, func.count(Project.id)).group_by(Project.source)).all()
    )
    last_success = dict(
        db.execute(
            select(IngestionRun.source, func.max(IngestionRun.finished_at))
            .where(IngestionRun.status == "succeeded")
            .group_by(IngestionRun.source)
        ).all()
    )

    # reference and dedup are maintenance passes, not data sources. `anr`
    # is a WITHDRAWN source: its runs stay in the journal — deleting
    # history would be worse — but a source banned by the licence rule
    # must never appear on the page that says where the data comes from
    # (founder rule: a displayed promise stays true the day the data
    # changes; caught in recette after NSF, 2026-08-03).
    codes = sorted((set(projects_by_source) | set(last_success)) - {"reference", "dedup", "anr"})
    return SourcesResponse(
        totals=totals,
        sources=[
            SourceStatus(
                source=code,
                projects=projects_by_source.get(code, 0),
                last_success_at=last_success.get(code),
            )
            for code in codes
        ],
    )
