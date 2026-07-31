from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.models import Organisation, OrganisationIdentifier

router = APIRouter()

PORTFOLIO_SORTS = {
    "amount": "pa.amount_eur DESC NULLS LAST",
    "date": "p.start_date DESC NULLS LAST",
}


@router.get("/organisations/{organisation_id}")
def organisation_detail(
    organisation_id: int, db: Annotated[Session, Depends(get_db)]
) -> dict[str, Any]:
    organisation = db.get(Organisation, organisation_id)
    if organisation is None:
        raise HTTPException(status_code=404, detail="Organisation not found")

    identifiers = db.scalars(
        select(OrganisationIdentifier).where(
            OrganisationIdentifier.organisation_id == organisation_id
        )
    ).all()

    kpis = db.execute(
        text("""
        SELECT count(DISTINCT pa.project_id) AS projects_count,
               sum(pa.amount_eur) AS total_funding,
               count(*) FILTER (WHERE pa.role = 'coordinator') AS coordinator_count,
               min(extract(year FROM p.start_date))::int AS first_year,
               max(extract(year FROM p.start_date))::int AS last_year
        FROM participations pa JOIN projects p ON p.id = pa.project_id
        WHERE pa.organisation_id = :oid
        """),
        {"oid": organisation_id},
    ).one()

    by_year = db.execute(
        text("""
        SELECT extract(year FROM p.start_date)::int AS y, sum(pa.amount_eur) AS amount
        FROM participations pa JOIN projects p ON p.id = pa.project_id
        WHERE pa.organisation_id = :oid AND p.start_date IS NOT NULL
        GROUP BY y ORDER BY y
        """),
        {"oid": organisation_id},
    ).all()

    top_programmes = db.execute(
        text("""
        WITH RECURSIVE roots AS (
            SELECT id, parent_id, code, name, id AS root_id FROM programmes WHERE parent_id IS NULL
            UNION ALL
            SELECT pr.id, pr.parent_id, pr.code, pr.name, roots.root_id
            FROM programmes pr JOIN roots ON pr.parent_id = roots.id
        )
        SELECT r2.code, coalesce(r2.name, r2.code) AS label, sum(pa.amount_eur) AS amount
        FROM participations pa
        JOIN projects p ON p.id = pa.project_id
        JOIN roots r ON r.id = p.programme_id
        JOIN programmes r2 ON r2.id = r.root_id
        WHERE pa.organisation_id = :oid
        GROUP BY r2.code, r2.name ORDER BY amount DESC NULLS LAST LIMIT 3
        """),
        {"oid": organisation_id},
    ).all()

    return {
        "id": organisation.id,
        "name": organisation.name,
        "country": organisation.country_code,
        "city": organisation.city,
        "org_type": organisation.org_type,
        "website": organisation.website,
        "identifiers": [{"scheme": i.scheme, "value": i.value} for i in identifiers],
        "kpis": {
            "projects_count": kpis.projects_count or 0,
            "total_funding_eur": float(kpis.total_funding)
            if kpis.total_funding is not None
            else 0.0,
            "coordinator_count": kpis.coordinator_count or 0,
            "first_year": kpis.first_year,
            "last_year": kpis.last_year,
        },
        "funding_by_year": [
            {"year": y, "amount_eur": float(a) if a is not None else 0.0} for y, a in by_year
        ],
        "top_programmes": [
            {"code": code, "label": label, "amount_eur": float(a) if a is not None else 0.0}
            for code, label, a in top_programmes
        ],
    }


@router.get("/organisations/{organisation_id}/projects")
def organisation_projects(
    organisation_id: int,
    db: Annotated[Session, Depends(get_db)],
    sort: str = "amount",
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    if db.get(Organisation, organisation_id) is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    size = min(max(size, 1), 50)
    offset = (max(page, 1) - 1) * size
    order = PORTFOLIO_SORTS.get(sort, PORTFOLIO_SORTS["amount"])

    rows = db.execute(
        text(f"""
        SELECT p.id, p.acronym, p.title, p.source, pa.role, pa.amount_eur,
               extract(year FROM p.start_date)::int AS start_year,
               (SELECT code FROM programmes WHERE id = p.programme_id) AS programme_code
        FROM participations pa JOIN projects p ON p.id = pa.project_id
        WHERE pa.organisation_id = :oid
        ORDER BY {order}
        LIMIT :size OFFSET :offset
        """),
        {"oid": organisation_id, "size": size, "offset": offset},
    ).all()
    total = db.execute(
        text("SELECT count(*) FROM participations WHERE organisation_id = :oid"),
        {"oid": organisation_id},
    ).scalar_one()

    return {
        "total": total,
        "results": [
            {
                "id": r.id,
                "acronym": r.acronym,
                "title": r.title,
                "source": r.source,
                "role": r.role,
                "amount_eur": float(r.amount_eur) if r.amount_eur is not None else None,
                "start_year": r.start_year,
                "programme_code": r.programme_code,
            }
            for r in rows
        ],
    }
