"""Les appels (E1) — catalogue et fiche, provenance comprise.

Trois vérités, jamais mêlées (doctrine du chantier) :

- le FAIT source : identifiant, dates, budget, statut du portail —
  colonnes de `call_topics`, attribution CC BY 4.0 affichée ;
- le statut AFFICHÉ : dérivé des dates en UTC (« aucun appel clos
  présenté comme ouvert ») — le code source reste visible à côté ;
- la LECTURE Orion : les tags de lentille structurels, servis dans un
  bloc distinct avec la règle qui a mordu.

Le fuseau officiel de soumission est celui de Bruxelles : l'API sert
des instants UTC, l'affichage les traduit.
"""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.api.lens_param import resolve_lens_param
from orion.core.db import get_db
from orion.models import CallTopic
from orion.search.service import parse_sector

router = APIRouter()

ATTRIBUTION = (
    "Contains data from the EU Funding & Tenders Portal, © European Union, "
    "reused under CC BY 4.0."
)
PAGE_SIZE_MAX = 50
DERIVED_STATUSES = ("open", "upcoming", "closed")


def _instants(values: list | None) -> list[datetime]:
    out = []
    for value in values or []:
        try:
            out.append(datetime.fromisoformat(value))
        except (TypeError, ValueError):
            continue
    return out


def derived_status(
    opening: datetime | None,
    deadlines: list[datetime],
    status_code: str | None,
    now: datetime,
) -> str:
    """Le statut affiché. Les dates priment ; le code source ne tranche
    que lorsqu'elles manquent."""
    if deadlines:
        if any(d > now for d in deadlines):
            if opening and opening > now:
                return "upcoming"
            return "open"
        return "closed"
    if status_code == "31094501":
        return "upcoming"
    if status_code == "31094502":
        # « Open » sans aucune deadline publiée : l'ouverture fait foi.
        return "upcoming" if opening and opening > now else "open"
    return "closed"


def next_deadline(deadlines: list[datetime], now: datetime) -> datetime | None:
    future = [d for d in deadlines if d > now]
    if future:
        return min(future)
    return max(deadlines) if deadlines else None


def _row(topic: CallTopic, lens_tags: list[dict[str, str]], now: datetime) -> dict[str, Any]:
    deadlines = _instants(topic.deadline_dates)
    upcoming = next_deadline(deadlines, now)
    return {
        "id": topic.id,
        "identifier": topic.identifier,
        "title": topic.title,
        "call_code": topic.call_code,
        "framework_programme": {
            "code": topic.framework_programme_code,
            "label": topic.framework_programme_label,
        }
        if topic.framework_programme_code
        else None,
        "status": derived_status(topic.opening_date, deadlines, topic.status_code, now),
        "source_status": {"code": topic.status_code, "label": topic.status_label},
        "opening_date": topic.opening_date.isoformat() if topic.opening_date else None,
        "deadline_dates": [d.isoformat() for d in deadlines],
        "next_deadline": upcoming.isoformat() if upcoming else None,
        "deadline_model": topic.deadline_model,
        "types_of_action": topic.types_of_action,
        "budget_min_eur": float(topic.budget_min_eur)
        if topic.budget_min_eur is not None
        else None,
        "budget_max_eur": float(topic.budget_max_eur)
        if topic.budget_max_eur is not None
        else None,
        "expected_grants": topic.expected_grants,
        "lens_tags": lens_tags,
        "url": topic.url,
    }


def _lens_tags_for(db: Session, topic_ids: list[int]) -> dict[int, list[dict[str, str]]]:
    if not topic_ids:
        return {}
    rows = db.execute(
        text("""
        SELECT ct.call_topic_id, ct.lens, ct.tag, ct.rule
        FROM call_topic_lens_tags ct
        JOIN lenses l ON l.slug = ct.lens AND l.status = 'published'
        WHERE ct.call_topic_id = ANY(:ids)
        ORDER BY l.rank
        """),
        {"ids": topic_ids},
    ).all()
    tags: dict[int, list[dict[str, str]]] = {}
    for topic_id, lens, tag, rule in rows:
        tags.setdefault(topic_id, []).append({"lens": lens, "tag": tag, "rule": rule})
    return tags


def _last_synced_at(db: Session) -> str | None:
    value = db.execute(
        text(
            "SELECT max(finished_at) FROM ingestion_runs "
            "WHERE source = 'calls' AND status = 'succeeded'"
        )
    ).scalar()
    return value.isoformat() if value else None


@router.get("/calls")
def list_calls(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
    programme: str | None = None,
    action: str | None = None,
    q: str | None = None,
    sector: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_MAX,
) -> dict[str, Any]:
    if status is not None and status not in DERIVED_STATUSES:
        raise HTTPException(
            status_code=400, detail={"error": "INVALID_STATUS", "parameter": "status"}
        )
    lens = resolve_lens_param(request, db, sector)

    clauses = ["source = 'ft-portal'"]
    params: dict[str, Any] = {}
    if programme:
        clauses.append("framework_programme_code = :programme")
        params["programme"] = programme
    if action:
        clauses.append(
            "EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(types_of_action, '[]'::jsonb)) a"
            " WHERE unaccent(lower(a)) LIKE '%' || unaccent(lower(:action)) || '%')"
        )
        params["action"] = action
    if q:
        clauses.append(
            "(unaccent(lower(identifier)) LIKE '%' || unaccent(lower(:q)) || '%'"
            " OR unaccent(lower(coalesce(title, ''))) LIKE '%' || unaccent(lower(:q)) || '%'"
            " OR unaccent(lower(coalesce(keywords::text, ''))) LIKE '%' || unaccent(lower(:q)) || '%')"
        )
        params["q"] = q
    if lens:
        slug, core_only = parse_sector(lens)
        tag_clause = " AND clt.tag = 'core'" if core_only else ""
        clauses.append(
            "id IN (SELECT clt.call_topic_id FROM call_topic_lens_tags clt"
            f" WHERE clt.lens = :lens_slug{tag_clause})"
        )
        params["lens_slug"] = slug

    ids = [
        row[0]
        for row in db.execute(
            text(f"SELECT id FROM call_topics WHERE {' AND '.join(clauses)}"), params
        )
    ]
    topics = (
        db.query(CallTopic).filter(CallTopic.id.in_(ids)).all() if ids else []
    )

    now = datetime.now(UTC)
    tags = _lens_tags_for(db, [t.id for t in topics])
    rows = [_row(t, tags.get(t.id, []), now) for t in topics]
    if status:
        rows = [r for r in rows if r["status"] == status]

    # Tri : la prochaine échéance d'abord (ouverts et à venir), la plus
    # récente d'abord pour les clos ; sans deadline, en queue.
    reverse = status == "closed"

    def sort_key(row: dict[str, Any]) -> tuple:
        deadline = row["next_deadline"]
        if deadline is None:
            return (1, "" if not reverse else "0")
        return (0, deadline)

    rows.sort(key=sort_key, reverse=reverse)
    total = len(rows)
    start = (page - 1) * size
    return {
        "total": total,
        "results": rows[start : start + size],
        "meta": {
            "status": status,
            "programme": programme,
            "action": action,
            "q": q,
            "sector": lens,
            "last_synced_at": _last_synced_at(db),
            "attribution": ATTRIBUTION,
        },
    }


@router.get("/calls/programmes")
def call_programmes(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    """Les programmes-cadres présents dans le flux — la matière du filtre."""
    rows = db.execute(
        text("""
        SELECT framework_programme_code, max(framework_programme_label), count(*)
        FROM call_topics
        WHERE source = 'ft-portal' AND framework_programme_code IS NOT NULL
        GROUP BY framework_programme_code
        ORDER BY count(*) DESC
        """)
    ).all()
    return {
        "programmes": [
            {"code": code, "label": label or code, "topics": count}
            for code, label, count in rows
        ]
    }


@router.get("/calls/{call_topic_id}")
def call_detail(
    call_topic_id: int, db: Annotated[Session, Depends(get_db)]
) -> dict[str, Any]:
    topic = db.get(CallTopic, call_topic_id)
    if topic is None or topic.source != "ft-portal":
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND"})
    now = datetime.now(UTC)
    tags = _lens_tags_for(db, [topic.id])
    row = _row(topic, tags.get(topic.id, []), now)
    row.update(
        {
            "keywords": topic.keywords,
            "tags": topic.tags,
            "cross_cutting": topic.cross_cutting,
            "description_html": topic.description_html,
            "conditions_html": topic.conditions_html,
            "budget_overview": topic.budget_overview,
            "last_seen_at": topic.last_seen_at.isoformat() if topic.last_seen_at else None,
        }
    )
    row["meta"] = {"last_synced_at": _last_synced_at(db), "attribution": ATTRIBUTION}
    return row
