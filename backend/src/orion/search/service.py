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


# Which sources actually change the project corpus. The identity layer
# (GLEIF mirror, Wikidata parents, the groups builder) and the exchange
# rates run weekly and touch none of it — before this list, their run
# invalidated every cached facet and the first visitor of the morning
# paid for a refresh that changed nothing (chantier performance, O4).
CORPUS_SOURCES = ("cordis-horizon", "cordis-h2020", "cordis-fp7", "nih", "nsf", "dedup")


def _data_stamp(session: Session) -> str:
    """Changes when a run that TOUCHES THE CORPUS succeeds — the cache
    invalidation key. A source that only feeds the identity layer leaves
    the project caches alone."""
    return str(
        session.execute(
            text(
                "SELECT coalesce(max(finished_at)::text, '0') "
                "FROM ingestion_runs WHERE status = 'succeeded' AND source = ANY(:sources)"
            ),
            {"sources": list(CORPUS_SOURCES)},
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
    # Manager region slug — the URL-borne geographic scope (chantier
    # régions): frames the search to the region's member countries, the
    # list coming from the referential, never from the client.
    scope: str | None = None
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
            or self.scope
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


# The match reads the full texts. A condensed matching view was built,
# measured and withdrawn (migration 0016): ×6 faster in isolation, but
# it adds 1,3 GB competing for the same cache instead of replacing
# anything — the system measured slower with it, and the budget was
# already met without.
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
    # Without statistics the planner estimates this table at random and
    # flips to catastrophic plans — the funders facet measured 8 903 ms
    # without ANALYZE, 1 076 ms with (chantier performance, 2026-08-03).
    session.execute(text("ANALYZE _orion_match"))
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
        # A semi-join on the composite index, not a correlated EXISTS:
        # measured 31 ms against 90 ms on the country scope, and the gap
        # widens with the corpus (chantier performance, 2026-08-03).
        clauses.append(
            "p.id IN (SELECT pa.project_id FROM participations pa "
            "WHERE pa.country_code = ANY(:countries))"
        )
        params["countries"] = f.countries
    if f.scope:
        clauses.append(
            "p.id IN (SELECT pa.project_id FROM participations pa "
            "WHERE pa.country_code IN (SELECT code FROM countries WHERE region = :scope))"
        )
        params["scope"] = f.scope
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
    "relevance": "s.rank DESC NULLS LAST, s.funding_amount_eur DESC NULLS LAST",
    "amount": "s.funding_amount_eur DESC NULLS LAST",
    "date": "s.start_date DESC NULLS LAST",
}


def _materialize_scope(session: Session, f: ProjectFilters, params: dict[str, Any]) -> None:
    """Materialise the candidate set ONCE, with the columns every piece
    needs (chantier performance, découverte ③).

    Before: the total, the four facets and the page each re-scanned the
    465 k projects against the filters — five times the same work, and
    the page sorted 100 k rows to keep 20. Now one pass builds the scope
    (ids + the facet dimensions + the sort keys), gets an index and its
    statistics, and everything downstream reads that."""
    where = _project_where(f, params)
    rank = "m.rank" if f.q else "NULL::double precision"
    join = "JOIN _orion_match m ON m.project_id = p.id" if f.q else ""
    session.execute(text("DROP TABLE IF EXISTS _orion_scope"))
    session.execute(
        text(f"""
        CREATE TEMPORARY TABLE _orion_scope ON COMMIT DROP AS
        SELECT p.id AS project_id, p.funder_id, p.programme_id,
               extract(year FROM p.start_date)::int AS start_year,
               p.funding_amount_eur, p.start_date, {rank} AS rank
        FROM projects p {join} {where}
        """),
        params,
    )
    session.execute(text("CREATE INDEX ON _orion_scope (project_id)"))
    session.execute(text("ANALYZE _orion_scope"))


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

    scoped = bool(f.q or f.has_filters)
    if f.q:
        _materialize_match(session, f.q)
    if scoped:
        _materialize_scope(session, f, params)

    order = (
        _SORTS.get(f.sort, _SORTS["relevance"])
        if f.q
        else (_SORTS["date"] if f.sort == "relevance" else _SORTS.get(f.sort, _SORTS["date"]))
    )

    # The page picks its 20 rows from the scope FIRST (indexed, tiny) and
    # only then reads the project rows by primary key: sorting 100 k rows
    # to keep 20 cost 1 871 ms, this costs a handful of milliseconds.
    page_source = (
        "_orion_scope s"
        if scoped
        else "(SELECT p.id AS project_id, p.funding_amount_eur, p.start_date,"
        " NULL::double precision AS rank FROM projects p) s"
    )
    rows = (
        session.execute(
            text(f"""
            WITH page AS (
                SELECT s.project_id, row_number() OVER (ORDER BY {order}) AS pos
                FROM {page_source}
                ORDER BY {order}
                LIMIT :size OFFSET :offset
            )
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
            FROM page JOIN projects p ON p.id = page.project_id
            ORDER BY page.pos
            """),
            params,
        )
        .mappings()
        .all()
    )

    if scoped:
        total = session.execute(text("SELECT count(*) FROM _orion_scope")).scalar_one()
        # A filter on ONE country and nothing else is a shape the corpus
        # already knows by heart (country_pair_stats) — the facet is read,
        # not recomputed over every participation of the scope.
        lone_country = (
            f.countries[0] if len(f.countries) == 1 and not f.q and not _other_filters(f) else None
        )
        facets = _project_facets(session, params, to_root, roots, lone_country=lone_country)
    else:
        total = _cached(
            session,
            "projects_total",
            lambda: session.execute(text("SELECT count(*) FROM projects")).scalar_one(),
        )
        facets = _cached(
            session,
            "projects_facets_default",
            lambda: _default_facets(session, to_root, roots),
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


def _default_facets(
    session: Session,
    to_root: dict[int, int],
    roots: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """The unfiltered page's facets: the scope IS the whole corpus, so it
    is materialised once here and the shared path does the rest (cached
    until the next ingestion touches projects)."""
    session.execute(text("DROP TABLE IF EXISTS _orion_scope"))
    session.execute(
        text("""
        CREATE TEMPORARY TABLE _orion_scope ON COMMIT DROP AS
        SELECT p.id AS project_id, p.funder_id, p.programme_id,
               extract(year FROM p.start_date)::int AS start_year,
               p.funding_amount_eur, p.start_date, NULL::double precision AS rank
        FROM projects p
        """)
    )
    session.execute(text("CREATE INDEX ON _orion_scope (project_id)"))
    session.execute(text("ANALYZE _orion_scope"))
    return _project_facets(session, {}, to_root, roots)


def _other_filters(f: ProjectFilters) -> bool:
    """Any filter besides the country list."""
    return bool(
        f.funders
        or f.programmes
        or f.year_from is not None
        or f.year_to is not None
        or f.amount_min is not None
        or f.amount_max is not None
    )


def _project_facets(
    session: Session,
    params: dict[str, Any],
    to_root: dict[int, int],
    roots: dict[int, dict[str, Any]],
    lone_country: str | None = None,
) -> dict[str, Any]:
    """Funders, programmes and years in ONE pass over the scope.

    Three GROUP BYs over the same rows cost three scans; GROUPING SETS
    reads once and labels each row's group — measured 629 ms where the
    three separate facets cost ~9,9 s (chantier performance, 2026-08-03).
    The scope already carries funder_id, programme_id and start_year, so
    the projects table is never touched again."""
    grouped = session.execute(
        text("""
        SELECT s.funder_id, s.programme_id, s.start_year, count(*) AS n
        FROM _orion_scope s
        GROUP BY GROUPING SETS ((s.funder_id), (s.programme_id), (s.start_year))
        """)
    ).all()

    funder_counts: dict[int, int] = {}
    by_programme: list[tuple[int | None, int]] = []
    year_counts: list[tuple[int, int]] = []
    for funder_id, programme_id, start_year, n in grouped:
        if funder_id is not None:
            funder_counts[funder_id] = n
        elif programme_id is not None:
            by_programme.append((programme_id, n))
        elif start_year is not None:
            year_counts.append((start_year, n))

    funder_rows = session.execute(
        text("SELECT id, code, name FROM funders WHERE id = ANY(:ids)"),
        {"ids": list(funder_counts) or [-1]},
    ).all()
    funders = sorted(
        ((code, name, funder_counts[fid]) for fid, code, name in funder_rows),
        key=lambda row: -row[2],
    )

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

    # The country facet is the one that still needs participations — it
    # joins the scope directly instead of re-deriving it from projects.
    if lone_country is not None:
        countries = session.execute(
            text("""
            SELECT b AS country_code, projects AS n FROM country_pair_stats
            WHERE a = :code
            UNION ALL
            SELECT :code, projects_count FROM country_stats WHERE code = :code
            ORDER BY n DESC LIMIT 12
            """),
            {"code": lone_country},
        ).all()
    else:
        countries = session.execute(
            text("""
            SELECT country_code, count(*) AS n
            FROM (
                SELECT DISTINCT pa.country_code, pa.project_id
                FROM participations pa JOIN _orion_scope s ON s.project_id = pa.project_id
                WHERE pa.country_code IS NOT NULL
            ) distinct_pairs
            GROUP BY country_code ORDER BY n DESC LIMIT 12
            """)
        ).all()

    return {
        "funders": [{"code": c, "label": n, "count": cnt} for c, n, cnt in funders],
        "programmes": programmes,
        "countries": [{"code": c, "count": n} for c, n in countries],
        "years": [{"year": y, "count": n} for y, n in sorted(year_counts)],
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
        return {"groups": [], "organisations": [], "projects": []}

    def build() -> dict[str, Any]:
        session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
        params: dict[str, Any] = {
            "qnorm": normalize_name(q) or q.lower(),
            "qraw": q,
            "qprefix": f"{q}%",
        }
        # Les groupes d'abord (recette 2026-08-04 : « Safran ressort en
        # tête avec un badge ») — la couche identité devient une porte.
        groups = session.execute(
            text("""
            SELECT g.id, g.name, g.country_code,
                   (SELECT count(*) FROM entity_group_map m WHERE m.group_id = g.id) AS entities
            FROM groups g
            WHERE g.name ILIKE :qprefix OR g.name % :qraw
            ORDER BY GREATEST(similarity(g.name, :qraw),
                              CASE WHEN g.name ILIKE :qprefix THEN 0.9 ELSE 0 END) DESC,
              entities DESC, g.id
            LIMIT 3
            """),
            params,
        ).all()
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
            "groups": [{"id": i, "name": n, "country": c, "entities": e} for i, n, c, e in groups],
            "organisations": [{"id": i, "name": n, "country": c} for i, n, c in organisations],
            "projects": [{"id": i, "acronym": a, "title": t} for i, a, t in projects],
        }

    key = f"suggest:{q.lower()}"
    return _cached_bounded(session, key, build, prefix="suggest:", cap=SUGGEST_CACHE_MAX)
