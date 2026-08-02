"""Bilingual project search and organisation search over PostgreSQL FTS.

The query is interpreted in both FTS configurations (orion_en, orion_fr) and
matched against each text row in its own language, so stemming stays correct
per language.

Performance architecture: the FTS match set is computed once per request and
reused by results, total and every facet (instead of re-running the match per
query); global facets and the programme tree are cached in-process, keyed by
the ingestion stamp so any successful ingestion run invalidates them.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.dedup.normalize import normalize_name

PAGE_SIZE_MAX = 50
ORG_RELEVANCE_CANDIDATES = 500

_CACHE: dict[str, tuple[str, Any]] = {}


def _data_stamp(session: Session) -> str:
    """Changes whenever an ingestion run succeeds — the cache invalidation key."""
    return str(
        session.execute(
            text(
                "SELECT coalesce(max(finished_at)::text, '0') "
                "FROM ingestion_runs WHERE status = 'succeeded'"
            )
        ).scalar()
    )


def _cached(session: Session, key: str, build: Callable[[], Any]) -> Any:
    stamp = _data_stamp(session)
    hit = _CACHE.get(key)
    if hit is not None and hit[0] == stamp:
        return hit[1]
    value = build()
    _CACHE[key] = (stamp, value)
    return value


def _cached_bounded(
    session: Session, key: str, build: Callable[[], Any], *, prefix: str, cap: int
) -> Any:
    """_cached with a per-prefix entry cap: unbounded key families (per-query
    matches, per-view aggregates, per-organisation partners) evict their own
    oldest half instead of growing for the process lifetime."""
    if len([k for k in _CACHE if k.startswith(prefix)]) > cap:
        for stale in [k for k in _CACHE if k.startswith(prefix)][: cap // 2]:
            _CACHE.pop(stale, None)
    return _cached(session, key, build)


@dataclass
class ProjectFilters:
    q: str | None = None
    funders: list[str] = field(default_factory=list)
    programmes: list[str] = field(default_factory=list)  # root programme ids (stringified)
    countries: list[str] = field(default_factory=list)
    year_from: int | None = None
    year_to: int | None = None
    amount_min: float | None = None
    amount_max: float | None = None
    sort: str = "relevance"
    page: int = 1
    size: int = 20
    lang: str = "en"

    @property
    def has_filters(self) -> bool:
        return bool(
            self.funders
            or self.programmes
            or self.countries
            or self.year_from is not None
            or self.year_to is not None
            or self.amount_min is not None
            or self.amount_max is not None
        )


def _programme_tree(session: Session) -> tuple[dict[int, int | None], dict[int, dict[str, Any]]]:
    """Every programme's parent and its code/label — the raw tree, for the
    drill-down fold (roots are handled by `_programme_roots`). Cached."""

    def build() -> tuple[dict[int, int | None], dict[int, dict[str, Any]]]:
        rows = session.execute(text("SELECT id, parent_id, code, name FROM programmes")).all()
        return (
            {r.id: r.parent_id for r in rows},
            {r.id: {"code": r.code, "label": r.name or r.code} for r in rows},
        )

    return _cached(session, "programme_tree", build)


def _programme_roots(session: Session) -> tuple[dict[int, int], dict[int, dict[str, Any]]]:
    """Map every programme to its root, and each root to its code/label. Cached."""

    def build() -> tuple[dict[int, int], dict[int, dict[str, Any]]]:
        rows = session.execute(text("SELECT id, parent_id, code, name FROM programmes")).all()
        parents = {r.id: r.parent_id for r in rows}
        info = {r.id: {"code": r.code, "label": r.name or r.code} for r in rows}

        def root_of(pid: int) -> int:
            seen: set[int] = set()
            while parents.get(pid) is not None and pid not in seen:
                seen.add(pid)
                pid = parents[pid]
            return pid

        to_root = {r.id: root_of(r.id) for r in rows}
        roots = {rid: info[rid] for rid in set(to_root.values())}
        return to_root, roots

    return _cached(session, "programme_roots", build)


_MATCH_SQL = """
WITH qs AS (
    SELECT websearch_to_tsquery('orion_en', :q) AS qen,
           websearch_to_tsquery('orion_fr', :q) AS qfr
)
SELECT t.project_id,
       max(ts_rank(t.search_vector,
                   CASE WHEN t.lang = 'fr' THEN qs.qfr ELSE qs.qen END)) AS rank
FROM project_texts t, qs
WHERE (t.lang = 'fr' AND t.search_vector @@ qs.qfr)
   OR (t.lang <> 'fr' AND t.search_vector @@ qs.qen)
GROUP BY t.project_id
"""


MATCH_CACHE_MAX = 64


def _materialize_match(session: Session, q: str) -> int:
    """Materialize the FTS match set in a temp table reused by every query.

    The (ids, ranks) pair is cached per query and ingestion stamp: the common
    flow — same query, refined filters — pays the FTS cost once.
    """
    key = f"match:{q}"

    def build() -> tuple[list[int], list[float]]:
        rows = session.execute(text(_MATCH_SQL), {"q": q}).all()
        return [r[0] for r in rows], [float(r[1]) for r in rows]

    ids, ranks = _cached_bounded(session, key, build, prefix="match:", cap=MATCH_CACHE_MAX)

    session.execute(text("DROP TABLE IF EXISTS _orion_match"))
    session.execute(
        text(
            "CREATE TEMPORARY TABLE _orion_match ON COMMIT DROP AS "
            "SELECT * FROM unnest(CAST(:ids AS integer[]), "
            "CAST(:ranks AS double precision[])) AS t(project_id, rank)"
        ),
        {"ids": ids, "ranks": ranks},
    )
    session.execute(text("CREATE INDEX ON _orion_match (project_id)"))
    return len(ids)


def _project_where(f: ProjectFilters, params: dict[str, Any]) -> str:
    clauses = []
    if f.q:
        clauses.append("p.id IN (SELECT project_id FROM _orion_match)")
    if f.funders:
        clauses.append("p.funder_id IN (SELECT id FROM funders WHERE code = ANY(:funders))")
        params["funders"] = f.funders
    if f.programmes:
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


_SORTS = {
    "relevance": "m.rank DESC NULLS LAST, p.funding_amount_eur DESC NULLS LAST",
    "amount": "p.funding_amount_eur DESC NULLS LAST",
    "date": "p.start_date DESC NULLS LAST",
}


def search_projects(session: Session, f: ProjectFilters) -> dict[str, Any]:
    size = min(max(f.size, 1), PAGE_SIZE_MAX)
    offset = (max(f.page, 1) - 1) * size
    to_root, roots = _programme_roots(session)

    params: dict[str, Any] = {"lang": f.lang, "size": size, "offset": offset}
    if f.programmes:
        wanted = set(f.programmes)
        params["programme_ids"] = [pid for pid, root in to_root.items() if str(root) in wanted] or [
            -1
        ]

    if f.q:
        _materialize_match(session, f.q)

    where = _project_where(f, params)

    if f.q:
        join_match = "JOIN _orion_match m ON m.project_id = p.id"
        order = _SORTS.get(f.sort, _SORTS["relevance"])
    else:
        join_match = ""
        order = _SORTS["date"] if f.sort == "relevance" else _SORTS.get(f.sort, _SORTS["date"])

    rows = (
        session.execute(
            text(f"""
            SELECT p.id, p.acronym, p.source, p.funder_id, p.programme_id,
                   p.funding_amount_eur,
                   extract(year FROM p.start_date)::int AS start_year,
                   extract(year FROM p.end_date)::int AS end_year,
                   coalesce((SELECT title FROM project_texts pt
                             WHERE pt.project_id = p.id AND pt.lang = :lang), p.title) AS title,
                   (SELECT count(*) FROM participations pa WHERE pa.project_id = p.id)
                       AS participations_count,
                   (SELECT array_agg(DISTINCT pa.country_code)
                    FROM participations pa
                    WHERE pa.project_id = p.id AND pa.country_code IS NOT NULL) AS countries
            FROM projects p {join_match}
            {where}
            ORDER BY {order}
            LIMIT :size OFFSET :offset
            """),
            params,
        )
        .mappings()
        .all()
    )

    if f.q or f.has_filters:
        total = session.execute(
            text(f"SELECT count(*) FROM projects p {where}"), params
        ).scalar_one()
        facets = _project_facets(session, params, where, to_root, roots)
    else:
        total = _cached(
            session,
            "projects_total",
            lambda: session.execute(text("SELECT count(*) FROM projects")).scalar_one(),
        )
        facets = _cached(
            session,
            "projects_facets_default",
            lambda: _project_facets(session, {}, "", to_root, roots),
        )

    snippets = _snippets(session, f, [r["id"] for r in rows]) if f.q else {}
    results = [
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
            "programme_root_id": to_root.get(r["programme_id"]),
            "participations_count": r["participations_count"],
            "countries": sorted(r["countries"] or [])[:8],
            "snippet": snippets.get(r["id"]),
        }
        for r in rows
    ]
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
        WHERE t.project_id = ANY(CAST(:ids AS integer[]))
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
    params: dict[str, Any],
    where: str,
    to_root: dict[int, int],
    roots: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    funders = session.execute(
        text(f"""
        SELECT fu.code, fu.name, count(*) AS n
        FROM projects p JOIN funders fu ON fu.id = p.funder_id
        {where}
        GROUP BY fu.code, fu.name ORDER BY n DESC
        """),
        params,
    ).all()

    by_programme = session.execute(
        text(f"SELECT p.programme_id, count(*) AS n FROM projects p {where} GROUP BY 1"),
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


def _organisation_where(f: OrganisationFilters, params: dict[str, Any]) -> tuple[str, str]:
    clauses = []
    rank = "0"
    if f.q:
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
    return where, rank


def search_organisations(session: Session, f: OrganisationFilters) -> dict[str, Any]:
    size = min(max(f.size, 1), PAGE_SIZE_MAX)
    offset = (max(f.page, 1) - 1) * size

    params: dict[str, Any] = {"size": size, "offset": offset}
    if f.q:
        session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
    where, rank = _organisation_where(f, params)

    # Step 1 — pick the page of organisations WITHOUT aggregate joins: the
    # lateral sums over every candidate were the main cost of this search.
    if f.sort in ("funding", "projects"):
        agg_order = "total_funding_eur" if f.sort == "funding" else "projects_count"
        # organisation_stats is refreshed after each dedup pass; slightly stale
        # ordering is fine, displayed numbers below stay live.
        page_rows = session.execute(
            text(f"""
            SELECT os.organisation_id AS id
            FROM organisation_stats os
            WHERE os.organisation_id IN (SELECT o.id FROM organisations o {where})
            ORDER BY os.{agg_order} DESC NULLS LAST
            LIMIT :size OFFSET :offset
            """),
            params,
        ).all()
        page_ids = [r.id for r in page_rows]
        aggregates = {}
    else:
        params["cap"] = ORG_RELEVANCE_CANDIDATES
        page_rows = session.execute(
            text(f"""
            SELECT o.id, {rank} AS rank FROM organisations o
            {where}
            ORDER BY rank DESC, o.id
            LIMIT :cap
            """),
            params,
        ).all()
        page_ids = [r.id for r in page_rows[offset : offset + size]]
        aggregates = {}

    # Step 2 — details and aggregates for the page only.
    detail_rows = (
        session.execute(
            text("""
            SELECT o.id, o.name, o.country_code, o.org_type,
                   (SELECT count(DISTINCT pa.project_id) FROM participations pa
                    WHERE pa.organisation_id = o.id) AS projects_count,
                   (SELECT sum(pa.amount_eur) FROM participations pa
                    WHERE pa.organisation_id = o.id) AS total_funding
            FROM organisations o WHERE o.id = ANY(CAST(:ids AS integer[]))
            """),
            {"ids": page_ids},
        )
        .mappings()
        .all()
        if page_ids
        else []
    )
    by_id = {r["id"]: r for r in detail_rows}
    ordered = [by_id[i] for i in page_ids if i in by_id]

    # Yearly activity for the page only — feeds the sparklines in the list.
    years_by_org: dict[int, list[dict[str, Any]]] = {}
    if page_ids:
        year_rows = session.execute(
            text("""
            SELECT pa.organisation_id AS org_id,
                   extract(year FROM p.start_date)::int AS y,
                   sum(pa.amount_eur) AS amount
            FROM participations pa JOIN projects p ON p.id = pa.project_id
            WHERE pa.organisation_id = ANY(CAST(:ids AS integer[]))
              AND p.start_date IS NOT NULL
              AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035
            GROUP BY 1, 2 ORDER BY 1, 2
            """),
            {"ids": page_ids},
        ).all()
        for org_id, year, amount in year_rows:
            years_by_org.setdefault(org_id, []).append(
                {"year": year, "amount_eur": float(amount or 0)}
            )

    total = session.execute(
        text(f"SELECT count(*) FROM organisations o {where}"), params
    ).scalar_one()

    facet_where_c = where + (" AND " if where else " WHERE ") + "o.country_code IS NOT NULL"
    countries = session.execute(
        text(f"""
        SELECT o.country_code, count(*) AS n FROM organisations o
        {facet_where_c}
        GROUP BY o.country_code ORDER BY n DESC LIMIT 12
        """),
        params,
    ).all()
    facet_where_t = where + (" AND " if where else " WHERE ") + "o.org_type IS NOT NULL"
    org_types = session.execute(
        text(f"""
        SELECT o.org_type, count(*) AS n FROM organisations o
        {facet_where_t}
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
                "projects_count": aggregates.get(r["id"], (r["projects_count"], None))[0] or 0,
                "total_funding_eur": float(r["total_funding"])
                if r["total_funding"] is not None
                else None,
                "funding_by_year": years_by_org.get(r["id"], []),
            }
            for r in ordered
        ],
        "facets": {
            "countries": [{"code": c, "count": n} for c, n in countries],
            "org_types": [{"code": t, "count": n} for t, n in org_types],
        },
    }


SUGGEST_CACHE_MAX = 512


def suggest(session: Session, q: str) -> dict[str, Any]:
    """Keystroke suggestions — lean by design (ids and names only, no
    aggregates): organisations by the same fuzzy rank as the full search,
    projects by acronym prefix. Themes and countries are closed
    vocabularies matched client-side. Bounded cache per normalized query."""
    q = q.strip()
    if len(q) < 2:
        return {"organisations": [], "projects": []}

    def build() -> dict[str, Any]:
        session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
        params: dict[str, Any] = {
            "qnorm": normalize_name(q) or q.lower(),
            "qraw": q,
            "qprefix": f"{q}%",
        }
        organisations = session.execute(
            text("""
            SELECT o.id, o.name, o.country_code
            FROM organisations o
            WHERE o.name ILIKE :qprefix OR o.name_normalized % :qnorm OR o.name % :qraw
            ORDER BY GREATEST(
                similarity(coalesce(o.name_normalized, ''), :qnorm),
                similarity(o.name, :qraw),
                CASE WHEN o.name ILIKE :qprefix THEN 0.9 ELSE 0 END) DESC,
              o.id
            LIMIT 5
            """),
            params,
        ).all()
        projects = session.execute(
            text("""
            SELECT p.id, p.acronym, p.title
            FROM projects p
            WHERE p.acronym ILIKE :qprefix
            ORDER BY p.funding_amount_eur DESC NULLS LAST, p.id
            LIMIT 4
            """),
            params,
        ).all()
        return {
            "organisations": [{"id": i, "name": n, "country": c} for i, n, c in organisations],
            "projects": [{"id": i, "acronym": a, "title": t} for i, a, t in projects],
        }

    key = f"suggest:{q.lower()}"
    return _cached_bounded(session, key, build, prefix="suggest:", cap=SUGGEST_CACHE_MAX)
