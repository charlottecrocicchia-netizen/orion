from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.search.service import (
    OrganisationFilters,
    ProjectFilters,
    search_organisations,
    search_projects,
    suggest,
)

router = APIRouter()


@router.get("/search/projects")
def search_projects_endpoint(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = None,
    funder: Annotated[list[str] | None, Query()] = None,
    programme: Annotated[list[str] | None, Query()] = None,
    country: Annotated[list[str] | None, Query()] = None,
    year_from: int | None = None,
    year_to: int | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    sort: str = "relevance",
    page: int = 1,
    size: int = 20,
    lang: str = "en",
) -> dict[str, Any]:
    filters = ProjectFilters(
        q=q or None,
        funders=funder or [],
        programmes=programme or [],
        countries=country or [],
        year_from=year_from,
        year_to=year_to,
        amount_min=amount_min,
        amount_max=amount_max,
        sort=sort,
        page=page,
        size=size,
        lang=lang,
    )
    return search_projects(db, filters)


@router.get("/search/suggest")
def suggest_endpoint(
    db: Annotated[Session, Depends(get_db)],
    q: str = "",
) -> dict[str, Any]:
    """Keystroke suggestions for the command palette — organisations and
    projects; themes and countries are matched client-side."""
    return suggest(db, q)


@router.get("/search/organisations")
def search_organisations_endpoint(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = None,
    country: Annotated[list[str] | None, Query()] = None,
    org_type: Annotated[list[str] | None, Query()] = None,
    sort: str = "relevance",
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    filters = OrganisationFilters(
        q=q or None,
        countries=country or [],
        org_types=org_type or [],
        sort=sort,
        page=page,
        size=size,
    )
    return search_organisations(db, filters)
