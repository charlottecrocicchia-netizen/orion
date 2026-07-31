"""Bilingual project search and organisation search over PostgreSQL FTS.

The query is interpreted in both FTS configurations (orion_en, orion_fr) and
matched against each text row in its own language, so stemming stays correct
per language. Facet counts are computed under the current filters.
"""

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.dedup.normalize import normalize_name

PAGE_SIZE_MAX = 50


@dataclass
class ProjectFilters:
    q: str | None = None
    funders: list[str] = field(default_factory=list)
    programmes: list[str] = field(default_factory=list)  # root programme codes
    countries: list[str] = field(default_factory=list)
    year_from: int | None = None
    year_to: int | None = None
    amount_min: float | None = None
    amount_max: float | None = None
    sort: str = "relevance"
    page: int = 1
    size: int = 20
    lang: str = "en"


def _programme_roots(session: Session) -> tuple[dict[int, int], dict[int, dict[str, Any]]]:
    """Map every programme to its root, and each root to its code/label."""
    rows = session.execute(text("SELECT id, parent_id, code, name FROM programmes")).all()
    parents = {r.id: r.parent_id for r in rows}
    info = {r.id: {"code": r.code, "label": r.name or r.code} for r in rows}

    def root_of(pid: int) -> int:
        seen = set()
        while parents.get(pid) is not None and pid not in seen:
            seen.add(pid)
            pid = parents[pid]
        return pid

    to_root = {r.id: root_of(r.id) for r in rows}
    roots = {rid: info[rid] for rid in set(to_root.values())}
    return to_root, roots


def _project_where(f: ProjectFilters, params: dict[str, Any], to_root: dict[int, int]) -> str:
    clauses = []
    if f.q:
        clauses.append("p.id IN (SELECT project_id FROM m)")
    if f.funders:
        clauses.append("p.funder_id IN (SELECT id FROM funders WHERE code = ANY(:funders))")
        params["funders"] = f.funders
    if f.programmes:
        wanted = set(f.programmes)
        ids = [pid for pid, root in to_root.items() if str(root) in wanted or pid == root]
        # Roots are passed as programme ids (stringified) by the API layer.
        ids = [pid for pid, root in to_root.items() if str(root) in wanted]
        params["programme_ids"] = ids or [-1]
        clauses.append("p.programme_id = ANY(:programme_ids)")
    if f.countries:
        clauses.append(
            "EXISTS (SELECT 1 FROM participations pa "
            "WHERE pa.project_id = p.id AND pa.country_code = ANY(:countries))"
        )
        params["countries"] = f.countries
    if f.year_from is not None:
        clauses.append("extract(year FROM p.start_date) >= :year_from")
        params["year_from"] = f.year_from
    if f.year_to is not None:
        clauses.append("extract(year FROM p.start_date) <= :year_to")
        params["year_to"] = f.year_to
    if f.amount_min is not None:
        clauses.append("p.funding_amount_eur >= :amount_min")
        params["amount_min"] = f.amount_min
    if f.amount_max is not None:
        clauses.append("p.funding_amount_eur <= :amount_max")
        params["amount_max"] = f.amount_max
    return (" WHERE " + " AND ".join(clauses)) if clauses else ""


_MATCH_CTE = """
qs AS (
    SELECT websearch_to_tsquery('orion_en', :q) AS qen,
           websearch_to_tsquery('orion_fr', :q) AS qfr
),
m AS (
    SELECT t.project_id,
           max(ts_rank(t.search_vector,
                       CASE WHEN t.lang = 'fr' THEN qs.qfr ELSE qs.qen END)) AS rank
    FROM project_texts t, qs
    WHERE (t.lang = 'fr' AND t.search_vector @@ qs.qfr)
       OR (t.lang <> 'fr' AND t.search_vector @@ qs.qen)
    GROUP BY t.project_id
)
"""

_SORTS = {
    "relevance": "rank DESC NULLS LAST, p.funding_amount_eur DESC NULLS LAST",
    "amount": "p.funding_amount_eur DESC NULLS LAST",
    "date": "p.start_date DESC NULLS LAST",
}


def search_projects(session: Session, f: ProjectFilters) -> dict[str, Any]:
    size = min(max(f.size, 1), PAGE_SIZE_MAX)
    offset = (max(f.page, 1) - 1) * size
    to_root, roots = _programme_roots(session)

    params: dict[str, Any] = {"lang": f.lang, "size": size, "offset": offset}
    with_clause = f"WITH {_MATCH_CTE}" if f.q else ""
    if f.q:
        params["q"] = f.q
    where = _project_where(f, params, to_root)
    rank_sel = "(SELECT rank FROM m WHERE m.project_id = p.id)" if f.q else "NULL"
    order = _SORTS.get(f.sort if f.q or f.sort != "relevance" else "relevance", _SORTS["date"])
    if not f.q and f.sort == "relevance":
        order = _SORTS["date"]

    rows = (
        session.execute(
            text(f"""
        {with_clause}
        SELECT p.id, p.acronym, p.source, p.funder_id, p.programme_id,
               p.funding_amount_eur,
               extract(year FROM p.start_date)::int AS start_year,
               extract(year FROM p.end_date)::int AS end_year,
               coalesce((SELECT title FROM project_texts pt
                         WHERE pt.project_id = p.id AND pt.lang = :lang), p.title) AS title,
               {rank_sel} AS rank,
               (SELECT count(*) FROM participations pa WHERE pa.project_id = p.id)
                   AS participations_count,
               (SELECT array_agg(DISTINCT pa.country_code)
                FROM participations pa
                WHERE pa.project_id = p.id AND pa.country_code IS NOT NULL) AS countries
        FROM projects p
        {where}
        ORDER BY {order}
        LIMIT :size OFFSET :offset
        """),
            params,
        )
        .mappings()
        .all()
    )

    total = session.execute(
        text(f"{with_clause} SELECT count(*) FROM projects p {where}"), params
    ).scalar_one()

    facets = _project_facets(session, f, params, with_clause, where, to_root, roots)

    snippets = _snippets(session, f, [r["id"] for r in rows]) if f.q else {}
    results = []
    for r in rows:
        results.append(
            {
                "id": r["id"],
                "acronym": r["acronym"],
                "title": r["title"],
                "source": r["source"],
                "funding_amount_eur": float(r["funding_amount_eur"])
                if r["funding_amount_eur"] is not None
                else None,
                "start_year": r["start_year"],
                "end_year": r["end_year"],
                "programme_root": roots.get(to_root.get(r["programme_id"], -1), {}).get("code"),
                "participations_count": r["participations_count"],
                "countries": sorted(r["countries"] or [])[:8],
                "snippet": snippets.get(r["id"]),
            }
        )
    return {"total": total, "results": results, "facets": facets}


def _snippets(session: Session, f: ProjectFilters, ids: list[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = session.execute(
        text("""
        WITH qs AS (
            SELECT websearch_to_tsquery('orion_en', :q) AS qen,
                   websearch_to_tsquery('orion_fr', :q) AS qfr
        )
        SELECT DISTINCT ON (t.project_id) t.project_id,
               ts_headline(
                   CASE WHEN t.lang = 'fr' THEN 'orion_fr'::regconfig
                        ELSE 'orion_en'::regconfig END,
                   coalesce(t.abstract, t.title),
                   CASE WHEN t.lang = 'fr' THEN qs.qfr ELSE qs.qen END,
                   'MaxFragments=1, MaxWords=28, MinWords=12') AS snippet
        FROM project_texts t, qs
        WHERE t.project_id = ANY(:ids)
          AND ((t.lang = 'fr' AND t.search_vector @@ qs.qfr)
            OR (t.lang <> 'fr' AND t.search_vector @@ qs.qen))
        ORDER BY t.project_id,
                 (t.lang = :lang) DESC,
                 ts_rank(t.search_vector,
                         CASE WHEN t.lang = 'fr' THEN qs.qfr ELSE qs.qen END) DESC
        """),
        {"q": f.q, "ids": ids, "lang": f.lang},
    ).all()
    return {r.project_id: r.snippet for r in rows}


def _project_facets(
    session: Session,
    f: ProjectFilters,
    params: dict[str, Any],
    with_clause: str,
    where: str,
    to_root: dict[int, int],
    roots: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    funders = session.execute(
        text(f"""
        {with_clause}
        SELECT fu.code, fu.name, count(*) AS n
        FROM projects p JOIN funders fu ON fu.id = p.funder_id
        {where}
        GROUP BY fu.code, fu.name ORDER BY n DESC
        """),
        params,
    ).all()

    by_programme = session.execute(
        text(f"""
        {with_clause}
        SELECT p.programme_id, count(*) AS n FROM projects p
        {where}
        GROUP BY p.programme_id
        """),
        params,
    ).all()
    root_counts: dict[int, int] = {}
    for pid, n in by_programme:
        root = to_root.get(pid)
        if root is not None:
            root_counts[root] = root_counts.get(root, 0) + n
    programmes = sorted(
        (
            {"id": rid, "code": roots[rid]["code"], "label": roots[rid]["label"], "count": n}
            for rid, n in root_counts.items()
        ),
        key=lambda item: -item["count"],
    )

    countries = session.execute(
        text(f"""
        {with_clause}
        SELECT pa.country_code, count(DISTINCT pa.project_id) AS n
        FROM participations pa
        WHERE pa.country_code IS NOT NULL
          AND pa.project_id IN (SELECT p.id FROM projects p {where})
        GROUP BY pa.country_code ORDER BY n DESC LIMIT 12
        """),
        params,
    ).all()

    years = session.execute(
        text(f"""
        {with_clause}
        SELECT extract(year FROM p.start_date)::int AS y, count(*) AS n
        FROM projects p
        {where}
        GROUP BY y ORDER BY y
        """),
        params,
    ).all()

    return {
        "funders": [{"code": c, "label": n, "count": cnt} for c, n, cnt in funders],
        "programmes": programmes,
        "countries": [{"code": c, "count": n} for c, n in countries],
        "years": [{"year": y, "count": n} for y, n in years if y is not None],
    }


@dataclass
class OrganisationFilters:
    q: str | None = None
    countries: list[str] = field(default_factory=list)
    org_types: list[str] = field(default_factory=list)
    sort: str = "relevance"
    page: int = 1
    size: int = 20


def search_organisations(session: Session, f: OrganisationFilters) -> dict[str, Any]:
    size = min(max(f.size, 1), PAGE_SIZE_MAX)
    offset = (max(f.page, 1) - 1) * size

    params: dict[str, Any] = {"size": size, "offset": offset}
    clauses = []
    rank = "0"
    if f.q:
        session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
        params["qnorm"] = normalize_name(f.q) or f.q.lower()
        params["qraw"] = f.q
        params["qprefix"] = f"{f.q}%"
        # name_normalized is filled by the dedup pass; the raw-name trigram
        # keeps organisations searchable between ingestion and that pass.
        clauses.append("(o.name ILIKE :qprefix OR o.name_normalized % :qnorm OR o.name % :qraw)")
        rank = (
            "GREATEST(similarity(coalesce(o.name_normalized, ''), :qnorm), "
            "similarity(o.name, :qraw), "
            "CASE WHEN o.name ILIKE :qprefix THEN 0.9 ELSE 0 END)"
        )
    if f.countries:
        clauses.append("o.country_code = ANY(:countries)")
        params["countries"] = f.countries
    if f.org_types:
        clauses.append("o.org_type = ANY(:org_types)")
        params["org_types"] = f.org_types
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

    order = {
        "relevance": "rank DESC, agg.total_funding DESC NULLS LAST",
        "funding": "agg.total_funding DESC NULLS LAST",
        "projects": "agg.projects_count DESC NULLS LAST",
    }.get(f.sort, "agg.total_funding DESC NULLS LAST")

    rows = (
        session.execute(
            text(f"""
        SELECT o.id, o.name, o.country_code, o.org_type, {rank} AS rank,
               agg.projects_count, agg.total_funding
        FROM organisations o
        LEFT JOIN LATERAL (
            SELECT count(DISTINCT pa.project_id) AS projects_count,
                   sum(pa.amount_eur) AS total_funding
            FROM participations pa WHERE pa.organisation_id = o.id
        ) agg ON true
        {where}
        ORDER BY {order}
        LIMIT :size OFFSET :offset
        """),
            params,
        )
        .mappings()
        .all()
    )

    total = session.execute(
        text(f"SELECT count(*) FROM organisations o {where}"), params
    ).scalar_one()

    countries = session.execute(
        text(f"""
        SELECT o.country_code, count(*) AS n FROM organisations o
        {where + (" AND " if where else " WHERE ") + "o.country_code IS NOT NULL"}
        GROUP BY o.country_code ORDER BY n DESC LIMIT 12
        """),
        params,
    ).all()
    org_types = session.execute(
        text(f"""
        SELECT o.org_type, count(*) AS n FROM organisations o
        {where + (" AND " if where else " WHERE ") + "o.org_type IS NOT NULL"}
        GROUP BY o.org_type ORDER BY n DESC LIMIT 10
        """),
        params,
    ).all()

    return {
        "total": total,
        "results": [
            {
                "id": r["id"],
                "name": r["name"],
                "country": r["country_code"],
                "org_type": r["org_type"],
                "projects_count": r["projects_count"] or 0,
                "total_funding_eur": float(r["total_funding"])
                if r["total_funding"] is not None
                else None,
            }
            for r in rows
        ],
        "facets": {
            "countries": [{"code": c, "count": n} for c, n in countries],
            "org_types": [{"code": t, "count": n} for t, n in org_types],
        },
    }
