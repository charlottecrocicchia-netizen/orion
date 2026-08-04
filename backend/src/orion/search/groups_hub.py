"""The GROUP file's data (recette fondatrice 2026-08-04) — the identity
layer becomes a product surface.

A group is a READING laid over canonical organisations (never a merge):
this hub aggregates the participations of the member entities into one
consolidated view — totals, trajectory, themes — plus the entity list
with each one's share, and the countries where the entities live (the
world map's matter). Sixty entities at most per group: every query here
is small by construction.

Honesty rules carried from the charter: a project shared by two member
entities counts ONCE in the consolidated totals (DISTINCT project);
shares are stated on the group's own total; membership method and
confidence ride along — a curated fact and a name-bridge guess are not
the same thing, and the reader can see which is which.
"""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.groups.homonyms import unattached_summary
from orion.search import aggregates


def group_hub(session: Session, group_id: int) -> dict[str, Any] | None:
    base = session.execute(
        text("SELECT id, name, country_code, lei, source FROM groups WHERE id = :id"),
        {"id": group_id},
    ).first()
    if base is None:
        return None

    entities = session.execute(
        text("""
        SELECT o.id, o.name, o.country_code, c.region,
               m.method, m.confidence, m.is_jv, m.share, m.status,
               count(DISTINCT pa.project_id) AS projects,
               coalesce(sum(pa.amount_eur), 0) AS funding
        FROM entity_group_map m
        JOIN organisations o ON o.id = m.organisation_id
        LEFT JOIN countries c ON c.code = o.country_code
        LEFT JOIN participations pa ON pa.organisation_id = o.id
        WHERE m.group_id = :id
        GROUP BY o.id, o.name, o.country_code, c.region,
                 m.method, m.confidence, m.is_jv, m.share, m.status
        ORDER BY CASE m.status WHEN 'active' THEN 0 WHEN 'announced' THEN 1 ELSE 2 END,
                 funding DESC, o.name
        """),
        {"id": group_id},
    ).all()

    totals = session.execute(
        text("""
        SELECT count(DISTINCT pa.project_id) AS projects,
               coalesce(sum(pa.amount_eur), 0) AS funding
        FROM entity_group_map m
        JOIN participations pa ON pa.organisation_id = m.organisation_id
        WHERE m.group_id = :id AND m.status = 'active'
        """),
        {"id": group_id},
    ).first()

    trajectory = session.execute(
        text("""
        SELECT extract(year FROM p.start_date)::int AS year,
               coalesce(sum(pa.amount_eur), 0) AS funding
        FROM entity_group_map m
        JOIN participations pa ON pa.organisation_id = m.organisation_id
        JOIN projects p ON p.id = pa.project_id
        WHERE m.group_id = :id AND m.status = 'active' AND p.start_date IS NOT NULL
          AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035
        GROUP BY 1 ORDER BY 1
        """),
        {"id": group_id},
    ).all()

    themes = session.execute(
        text("""
        SELECT tj.tkey AS key, max(l2.label) AS label,
               count(DISTINCT tj.project_id) AS projects
        FROM entity_group_map m
        JOIN participations pa ON pa.organisation_id = m.organisation_id
        JOIN (SELECT DISTINCT pt.project_id,
                     substring(t.code from '^(/[0-9]+/[0-9]+)') AS tkey
              FROM project_topics pt JOIN topics t ON t.id = pt.topic_id
              WHERE t.scheme = 'euroscivoc') tj ON tj.project_id = pa.project_id
        LEFT JOIN topics l2 ON l2.scheme = 'euroscivoc' AND l2.code = tj.tkey
        -- Level-1-only codes yield a NULL level-2 key: not a theme, and
        -- it must not consume one of the six slots (seen live: Safran).
        WHERE m.group_id = :id AND m.status = 'active' AND tj.tkey IS NOT NULL
        GROUP BY tj.tkey ORDER BY projects DESC
        LIMIT 6
        """),
        {"id": group_id},
    ).all()

    group_funding = float(totals.funding or 0)
    entity_rows = [
        {
            "id": row.id,
            "name": row.name,
            "country": row.country_code,
            "region": row.region,
            "method": row.method,
            "confidence": float(row.confidence or 0),
            "is_jv": bool(row.is_jv),
            "status": row.status,
            "projects": row.projects,
            "funding_eur": float(row.funding or 0),
            # The share is stated on the group's own consolidated total —
            # sums of shares can EXCEED 100 % when entities co-sign the
            # same project (each holds its own participation): honest,
            # and the page says so.
            "share_pct": round(float(row.funding or 0) / group_funding * 100, 1)
            if group_funding > 0
            else 0.0,
        }
        for row in entities
    ]

    active_rows = [row for row in entity_rows if row["status"] == "active"]
    countries: dict[str, dict[str, Any]] = {}
    for row in active_rows:
        if not row["country"]:
            continue
        bucket = countries.setdefault(
            row["country"],
            {"code": row["country"], "region": row["region"], "entities": 0, "funding_eur": 0.0},
        )
        bucket["entities"] += 1
        bucket["funding_eur"] += row["funding_eur"]

    # La trajectoire ÉCLATÉE par entité (fiche en deck, 2026-08-04) : une
    # série par entité pour les cinq plus financées, le reste consolidé en
    # une série « autres » dite telle quelle — jamais tronqué en silence.
    per_entity_years = session.execute(
        text("""
        SELECT m.organisation_id AS org, extract(year FROM p.start_date)::int AS year,
               coalesce(sum(pa.amount_eur), 0) AS funding
        FROM entity_group_map m
        JOIN participations pa ON pa.organisation_id = m.organisation_id
        JOIN projects p ON p.id = pa.project_id
        WHERE m.group_id = :id AND m.status = 'active' AND p.start_date IS NOT NULL
          AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035
        GROUP BY 1, 2 ORDER BY 1, 2
        """),
        {"id": group_id},
    ).all()
    lead_ids = [row["id"] for row in active_rows[:5]]
    names = {row["id"]: row["name"] for row in entity_rows}
    series: dict[int | None, dict[int, float]] = {}
    for org, year, funding in per_entity_years:
        slot = org if org in lead_ids else None
        series.setdefault(slot, {})[year] = series.setdefault(slot, {}).get(year, 0.0) + float(
            funding or 0
        )
    by_entity = [
        {
            "id": org_id,
            "name": names[org_id],
            "points": [{"year": y, "funding_eur": v} for y, v in sorted(years.items())],
        }
        for org_id in lead_ids
        if (years := series.get(org_id))
    ]
    if series.get(None):
        by_entity.append(
            {
                "id": None,
                "name": None,
                "points": [{"year": y, "funding_eur": v} for y, v in sorted(series[None].items())],
            }
        )

    # La note d'honnêteté (recette fondatrice, 2026-08-04) : le périmètre
    # rattaché ne se fait jamais passer pour le groupe entier — la fiche
    # dit combien d'homonymes du corpus attendent la curation, et leur
    # poids. Même définition que le diagnostic et la fournée.
    coverage = unattached_summary(session, group_id)

    return {
        "id": base.id,
        "name": base.name,
        "country": base.country_code,
        "lei": base.lei,
        "totals": {
            "entities": len(active_rows),
            "projects": totals.projects,
            "funding_eur": group_funding,
            "countries": len(countries),
        },
        "coverage": coverage,
        "trajectory": [{"year": r.year, "funding_eur": float(r.funding or 0)} for r in trajectory],
        "by_entity": by_entity,
        "themes": [{"key": r.key, "label": r.label, "projects": r.projects} for r in themes],
        "entities": entity_rows,
        "countries": sorted(countries.values(), key=lambda c: -c["funding_eur"]),
        "partners": aggregates.group_partners(session, group_id),
    }
