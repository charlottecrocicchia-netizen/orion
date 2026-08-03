from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.models import Call, Funder, Programme, Project, ProjectText

router = APIRouter()

ATTRIBUTIONS = {
    "cordis": "Contains European Union public data (CORDIS), © European Union, CC BY 4.0.",
    "nih": (
        "Contains data from NIH RePORTER (U.S. Department of Health and Human "
        "Services), public domain. Euro figures converted at ECB annual average rates."
    ),
}


def attribution_for(source: str) -> str | None:
    for prefix, notice in ATTRIBUTIONS.items():
        if source.startswith(prefix):
            return notice
    return None


@router.get("/projects/{project_id}")
def project_detail(project_id: int, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    texts = db.scalars(select(ProjectText).where(ProjectText.project_id == project_id)).all()
    funder = db.get(Funder, project.funder_id)

    programme_chain = []
    programme = db.get(Programme, project.programme_id) if project.programme_id else None
    seen: set[int] = set()
    while programme is not None and programme.id not in seen:
        seen.add(programme.id)
        programme_chain.append(
            {"id": programme.id, "code": programme.code, "label": programme.name}
        )
        programme = db.get(Programme, programme.parent_id) if programme.parent_id else None
    programme_chain.reverse()

    call = db.get(Call, project.call_id) if project.call_id else None

    topics = db.execute(
        text("""
        SELECT t.scheme, t.code, t.label FROM topics t
        JOIN project_topics pt ON pt.topic_id = t.id
        WHERE pt.project_id = :pid ORDER BY t.label
        """),
        {"pid": project_id},
    ).all()

    participants = db.execute(
        text("""
        SELECT pa.organisation_id, o.name, pa.role, pa.country_code, pa.amount_eur,
               pa.order_index
        FROM participations pa JOIN organisations o ON o.id = pa.organisation_id
        WHERE pa.project_id = :pid
        ORDER BY (pa.role = 'coordinator') DESC, pa.amount_eur DESC NULLS LAST
        """),
        {"pid": project_id},
    ).all()

    return {
        "id": project.id,
        "source": project.source,
        "source_id": project.source_id,
        "acronym": project.acronym,
        "title": project.title,
        "title_lang": project.title_lang,
        "status": project.status,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "total_cost_eur": float(project.total_cost) if project.total_cost is not None else None,
        "funding_amount_eur": float(project.funding_amount_eur)
        if project.funding_amount_eur is not None
        else None,
        # Convention ④ of the sources registry: a converted euro NEVER
        # travels mute. When the source paid in another currency, the
        # native amount and the dated ECB rate ride along so the reader
        # sees what was actually awarded and how we turned it into euros.
        "funding_amount_native": float(project.funding_amount)
        if project.funding_amount is not None and project.funding_currency not in (None, "EUR")
        else None,
        "funding_currency": project.funding_currency
        if project.funding_currency not in (None, "EUR")
        else None,
        "conversion": {
            "rate": float(raw["eur_rate"]),
            "year": int(raw["eur_rate_year"]),
            "source": "ecb",
        }
        if (raw := project.raw or {}).get("eur_rate") and raw.get("eur_rate_year")
        else None,
        "url": project.url,
        "funder": {"code": funder.code, "name": funder.name} if funder else None,
        "programme_chain": programme_chain,
        "call": {"code": call.code, "title": call.title} if call else None,
        "texts": [{"lang": t.lang, "title": t.title, "abstract": t.abstract} for t in texts],
        "topics": [{"scheme": s, "code": c, "label": label} for s, c, label in topics],
        "participants": [
            {
                "organisation_id": org_id,
                "name": name,
                "role": role,
                "country": country,
                "amount_eur": float(amount) if amount is not None else None,
            }
            for org_id, name, role, country, amount, _ in participants
        ],
        "attribution": attribution_for(project.source),
    }
