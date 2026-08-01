from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.search import aggregates, explore

router = APIRouter()


@router.get("/explore/aggregate")
def explore_aggregate(  # noqa: PLR0913 — one whitelisted signature for every composed view
    db: Annotated[Session, Depends(get_db)],
    metric: str = "funding",
    by: str = "country",
    split: bool = False,
    compare: Annotated[str | None, Query(description="tilde-separated keys")] = None,
    year_from: int | None = None,
    year_to: int | None = None,
    q: str | None = None,
    country: str | None = None,
    limit: int = 8,
) -> dict[str, Any]:
    result = explore.aggregate(
        db,
        metric=metric,
        by=by,
        split=split,
        compare=compare.split("~") if compare else None,
        year_from=year_from,
        year_to=year_to,
        q=q or None,
        country=country or None,
        limit=limit,
    )
    if result is None:
        raise HTTPException(status_code=400, detail="Unsupported metric/dimension combination")
    return result


@router.get("/stats")
def stats(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    return aggregates.global_stats(db)


@router.get("/countries")
def countries(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, Any]]:
    return aggregates.countries_index(db)


@router.get("/countries/{code}")
def country(code: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    hub = aggregates.country_hub(db, code)
    if hub is None:
        raise HTTPException(status_code=404, detail="Country not found")
    return hub


@router.get("/programmes")
def programmes(db: Annotated[Session, Depends(get_db)]) -> list[dict[str, Any]]:
    return aggregates.programmes_index(db)


@router.get("/programmes/{programme_id}")
def programme(programme_id: int, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    hub = aggregates.programme_hub(db, programme_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Programme not found")
    return hub
