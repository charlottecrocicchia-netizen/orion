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


@router.get("/compare/organisations")
def compare_organisations(
    db: Annotated[Session, Depends(get_db)],
    ids: Annotated[str, Query(description="tilde-separated organisation ids, 2 to 4")],
) -> list[dict[str, Any]]:
    parsed = [int(i) for i in ids.split("~") if i.isdigit()][:4]
    if len(parsed) < 1:
        raise HTTPException(status_code=400, detail="ids must hold 1 to 4 organisation ids")
    return aggregates.compare_organisations(db, parsed)


@router.get("/countries/flows")
def countries_flows(
    db: Annotated[Session, Depends(get_db)], limit: int = 60
) -> list[dict[str, Any]]:
    return aggregates.country_flows(db, limit=min(max(limit, 1), 200))


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
