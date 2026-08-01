"""Aggregates behind the home hero and the country/programme hubs (template G4).

Everything here is cached by ingestion stamp — these numbers only change when
data changes.
"""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.search.service import _cached, _cached_bounded, _programme_roots

PARTNERS_CACHE_MAX = 256


def global_stats(session: Session) -> dict[str, Any]:
    def build() -> dict[str, Any]:
        totals = session.execute(
            text("""
            SELECT (SELECT count(*) FROM projects) AS projects,
                   (SELECT count(*) FROM organisations) AS organisations,
                   (SELECT count(*) FROM participations) AS participations,
                   (SELECT sum(funding_amount_eur) FROM projects) AS funding_eur,
                   (SELECT count(DISTINCT country_code) FROM participations
                    WHERE country_code IS NOT NULL) AS countries
            """)
        ).one()
        by_year = session.execute(
            text("""
            SELECT extract(year FROM start_date)::int AS y, sum(funding_amount_eur) AS amount
            FROM projects
            WHERE start_date IS NOT NULL
              AND extract(year FROM start_date) BETWEEN 2000 AND 2035
            GROUP BY y ORDER BY y
            """)
        ).all()
        return {
            "totals": {
                "projects": totals.projects,
                "organisations": totals.organisations,
                "participations": totals.participations,
                "funding_eur": float(totals.funding_eur or 0),
                "countries": totals.countries,
            },
            "funding_by_year": [{"year": y, "amount_eur": float(a or 0)} for y, a in by_year],
        }

    return _cached(session, "global_stats", build)


def countries_index(session: Session) -> list[dict[str, Any]]:
    def build() -> list[dict[str, Any]]:
        rows = session.execute(
            text("""
            SELECT pa.country_code AS code, c.name_en, c.eu_member,
                   count(DISTINCT pa.project_id) AS projects,
                   sum(pa.amount_eur) AS funding
            FROM participations pa JOIN countries c ON c.code = pa.country_code
            GROUP BY pa.country_code, c.name_en, c.eu_member
            ORDER BY funding DESC NULLS LAST
            """)
        ).all()
        return [
            {
                "code": r.code,
                "name": r.name_en,
                "eu_member": r.eu_member,
                "projects_count": r.projects,
                "funding_eur": float(r.funding or 0),
            }
            for r in rows
        ]

    return _cached(session, "countries_index", build)


def country_hub(session: Session, code: str) -> dict[str, Any] | None:
    code = code.upper()
    base = session.execute(
        text("SELECT code, name_en, eu_member FROM countries WHERE code = :c"), {"c": code}
    ).first()
    if base is None:
        return None

    def build() -> dict[str, Any]:
        kpis = session.execute(
            text("""
            SELECT count(DISTINCT pa.project_id) AS projects,
                   count(DISTINCT pa.organisation_id) AS organisations,
                   sum(pa.amount_eur) AS funding,
                   count(*) FILTER (WHERE pa.role = 'coordinator') AS coordinations
            FROM participations pa WHERE pa.country_code = :c
            """),
            {"c": code},
        ).one()
        by_year = session.execute(
            text("""
            SELECT extract(year FROM p.start_date)::int AS y, sum(pa.amount_eur) AS amount
            FROM participations pa JOIN projects p ON p.id = pa.project_id
            WHERE pa.country_code = :c AND p.start_date IS NOT NULL
              AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035
            GROUP BY y ORDER BY y
            """),
            {"c": code},
        ).all()
        top_orgs = session.execute(
            text("""
            SELECT o.id, o.name, os.projects_count, os.total_funding_eur
            FROM organisation_stats os JOIN organisations o ON o.id = os.organisation_id
            WHERE o.country_code = :c
            ORDER BY os.total_funding_eur DESC NULLS LAST LIMIT 8
            """),
            {"c": code},
        ).all()
        top_projects = session.execute(
            text("""
            SELECT DISTINCT p.id, p.acronym, p.title, p.funding_amount_eur,
                   extract(year FROM p.start_date)::int AS start_year
            FROM projects p JOIN participations pa ON pa.project_id = p.id
            WHERE pa.country_code = :c
            ORDER BY p.funding_amount_eur DESC NULLS LAST LIMIT 8
            """),
            {"c": code},
        ).all()
        return {
            "code": code,
            "name": base.name_en,
            "eu_member": base.eu_member,
            "kpis": {
                "projects_count": kpis.projects or 0,
                "organisations_count": kpis.organisations or 0,
                "funding_eur": float(kpis.funding or 0),
                "coordinator_count": kpis.coordinations or 0,
            },
            "funding_by_year": [{"year": y, "amount_eur": float(a or 0)} for y, a in by_year],
            "top_organisations": [
                {
                    "id": r.id,
                    "name": r.name,
                    "projects_count": r.projects_count,
                    "funding_eur": float(r.total_funding_eur or 0),
                }
                for r in top_orgs
            ],
            "top_projects": [
                {
                    "id": r.id,
                    "acronym": r.acronym,
                    "title": r.title,
                    "funding_eur": float(r.funding_amount_eur or 0)
                    if r.funding_amount_eur is not None
                    else None,
                    "start_year": r.start_year,
                }
                for r in top_projects
            ],
        }

    return _cached(session, f"country_hub:{code}", build)


def programmes_index(session: Session) -> list[dict[str, Any]]:
    def build() -> list[dict[str, Any]]:
        to_root, roots = _programme_roots(session)
        rows = session.execute(
            text("""
            SELECT p.programme_id, f.code AS funder_code, f.name AS funder_name,
                   count(*) AS n, sum(p.funding_amount_eur) AS funding
            FROM projects p JOIN funders f ON f.id = p.funder_id
            GROUP BY p.programme_id, f.code, f.name
            """)
        ).all()
        acc: dict[int, dict[str, Any]] = {}
        for programme_id, funder_code, funder_name, n, funding in rows:
            root = to_root.get(programme_id)
            if root is None:
                continue
            entry = acc.setdefault(
                root,
                {
                    "id": root,
                    "code": roots[root]["code"],
                    "label": roots[root]["label"],
                    "funder_code": funder_code,
                    "funder_name": funder_name,
                    "projects_count": 0,
                    "funding_eur": 0.0,
                },
            )
            entry["projects_count"] += n
            entry["funding_eur"] += float(funding or 0)
        return sorted(acc.values(), key=lambda e: -e["funding_eur"])

    return _cached(session, "programmes_index", build)


def programme_hub(session: Session, programme_id: int) -> dict[str, Any] | None:
    to_root, roots = _programme_roots(session)
    if programme_id not in to_root:
        return None
    members = [pid for pid, root in to_root.items() if root == to_root[programme_id]]
    root = to_root[programme_id]

    def build() -> dict[str, Any]:
        kpis = session.execute(
            text("""
            SELECT count(*) AS projects, sum(funding_amount_eur) AS funding,
                   min(extract(year FROM start_date))::int AS first_year,
                   max(extract(year FROM start_date))::int AS last_year
            FROM projects WHERE programme_id = ANY(:ids)
            """),
            {"ids": members},
        ).one()
        by_year = session.execute(
            text("""
            SELECT extract(year FROM start_date)::int AS y, sum(funding_amount_eur) AS amount
            FROM projects
            WHERE programme_id = ANY(:ids) AND start_date IS NOT NULL
              AND extract(year FROM start_date) BETWEEN 2000 AND 2035
            GROUP BY y ORDER BY y
            """),
            {"ids": members},
        ).all()
        beneficiaries = session.execute(
            text("""
            SELECT o.id, o.name, o.country_code,
                   count(DISTINCT pa.project_id) AS projects, sum(pa.amount_eur) AS funding
            FROM participations pa
            JOIN projects p ON p.id = pa.project_id AND p.programme_id = ANY(:ids)
            JOIN organisations o ON o.id = pa.organisation_id
            GROUP BY o.id, o.name, o.country_code
            ORDER BY funding DESC NULLS LAST LIMIT 8
            """),
            {"ids": members},
        ).all()
        top_projects = session.execute(
            text("""
            SELECT id, acronym, title, funding_amount_eur,
                   extract(year FROM start_date)::int AS start_year
            FROM projects WHERE programme_id = ANY(:ids)
            ORDER BY funding_amount_eur DESC NULLS LAST LIMIT 8
            """),
            {"ids": members},
        ).all()
        return {
            "id": root,
            "code": roots[root]["code"],
            "label": roots[root]["label"],
            "kpis": {
                "projects_count": kpis.projects or 0,
                "funding_eur": float(kpis.funding or 0),
                "first_year": kpis.first_year,
                "last_year": kpis.last_year,
            },
            "funding_by_year": [{"year": y, "amount_eur": float(a or 0)} for y, a in by_year],
            "top_beneficiaries": [
                {
                    "id": r.id,
                    "name": r.name,
                    "country": r.country_code,
                    "projects_count": r.projects,
                    "funding_eur": float(r.funding or 0),
                }
                for r in beneficiaries
            ],
            "top_projects": [
                {
                    "id": r.id,
                    "acronym": r.acronym,
                    "title": r.title,
                    "funding_eur": float(r.funding_amount_eur or 0)
                    if r.funding_amount_eur is not None
                    else None,
                    "start_year": r.start_year,
                }
                for r in top_projects
            ],
        }

    return _cached(session, f"programme_hub:{root}", build)


def organisation_partners(session: Session, organisation_id: int, limit: int = 10) -> list[dict]:
    """Recurring partners: organisations sharing projects with this one,
    ranked by shared projects then by the partner's share on those projects."""

    def build() -> list[dict[str, Any]]:
        rows = session.execute(
            text("""
            SELECT pb.organisation_id AS id, max(o.name) AS name,
                   max(o.country_code) AS country, max(o.org_type) AS org_type,
                   count(DISTINCT pa.project_id) AS shared_projects,
                   sum(pb.amount_eur) AS partner_amount_eur
            FROM participations pa
            JOIN participations pb
              ON pb.project_id = pa.project_id
             AND pb.organisation_id <> pa.organisation_id
            JOIN organisations o ON o.id = pb.organisation_id
            WHERE pa.organisation_id = :org
            GROUP BY pb.organisation_id
            ORDER BY shared_projects DESC, partner_amount_eur DESC NULLS LAST
            LIMIT :limit
            """),
            {"org": organisation_id, "limit": limit},
        ).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "country": r.country,
                "org_type": r.org_type,
                "shared_projects": r.shared_projects,
                "partner_amount_eur": float(r.partner_amount_eur)
                if r.partner_amount_eur is not None
                else None,
            }
            for r in rows
        ]

    return _cached_bounded(
        session,
        f"partners:{organisation_id}:{limit}",
        build,
        prefix="partners:",
        cap=PARTNERS_CACHE_MAX,
    )


def country_flows(session: Session, limit: int = 60) -> list[dict]:
    """Cross-border collaboration flows: for each country pair, the shared
    projects and both sides' participation amounts. Feeds the phase-3 map."""

    def build() -> list[dict[str, Any]]:
        rows = session.execute(
            text("""
            WITH pc AS (
                SELECT project_id, country_code,
                       sum(amount_eur) AS amount
                FROM participations
                WHERE country_code IS NOT NULL
                GROUP BY project_id, country_code
            )
            SELECT a.country_code AS a, b.country_code AS b,
                   count(*) AS projects,
                   sum(coalesce(a.amount, 0) + coalesce(b.amount, 0)) AS amount_eur
            FROM pc a
            JOIN pc b ON b.project_id = a.project_id AND a.country_code < b.country_code
            GROUP BY a.country_code, b.country_code
            ORDER BY projects DESC
            LIMIT :limit
            """),
            {"limit": limit},
        ).all()
        return [
            {
                "a": r.a,
                "b": r.b,
                "projects": r.projects,
                "amount_eur": float(r.amount_eur or 0),
            }
            for r in rows
        ]

    return _cached(session, f"country_flows:{limit}", build)
