"""The Explorer aggregate: one whitelisted endpoint behind every composed view.

A view is metric × dimension (× yearly split) × filters. Combinations outside
the whitelist return None (the API turns that into a 400). Everything is
cached by ingestion stamp, like the rest of the search layer.

Anti-double-counting rule (see docs/explorateur-conception.md): country,
organisation and org-type views aggregate *participations* (each participant's
share); year, programme and funder views aggregate *projects*. The metrics
"organisations" and "coordination" always need participations.
"""

import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.search.service import (
    _cached_bounded,
    _materialize_match,
    _programme_roots,
    _programme_tree,
)

METRICS = ("funding", "projects", "organisations", "avg", "coordination")

# The manager regions' slugs — the referential is the source of truth.
from orion.ingest.reference import REGIONS as _REGIONS  # noqa: E402

MANAGER_REGIONS: frozenset[str] = frozenset(_REGIONS)
PARTICIPATION_DIMS = {"country", "region", "subdivision", "organisation", "orgtype"}

# (metric, dimension) pairs served in V1. Deliberately absent:
# organisations×programme and coordination×programme/funder — the programme
# rollup happens in Python, and distinct counts / ratios cannot be summed
# across the folded children without over-counting.
VALID: frozenset[tuple[str, str]] = frozenset(
    [
        *(
            (m, d)
            for m in ("funding", "projects", "avg")
            for d in (
                "year",
                "country",
                "region",
                "subdivision",
                "programme",
                "organisation",
                "funder",
                "orgtype",
                "theme",
            )
        ),
        *(
            ("organisations", d)
            for d in ("year", "country", "region", "subdivision", "funder", "orgtype", "theme")
        ),
        *(("coordination", d) for d in ("year", "country", "region", "organisation", "orgtype")),
    ]
)

# Mirror of ORG_TYPE_KEYS in frontend/src/lib/format.ts — keep both in sync
# until the referential itself is normalized (tracked task).
ORG_TYPE_KEYS: dict[str, str] = {
    "REC": "research",
    "Organisme de recherche": "research",
    "Organismes de type EPST": "research",
    "HES": "university",
    "Université": "university",
    "Autre établissement d’enseignement supérieur": "university",
    "PRC": "company",
    "Entreprises Privées": "company",
    "GE (grande entreprise)": "company",
    "ETI (entreprise de taille intermédiaire)": "company",
    "Divers privé": "company",
    "PME (petite et moyenne entreprise)": "sme",
    "PUB": "public",
    "Divers public": "public",
    "Hôpital / Santé": "health",
    "Fondation ou association": "nonprofit",
    "Associations": "nonprofit",
    "OTH": "other",
    "ETRANGER": "other",
}

# 50 covers the full theme dimension (41 euroSciVoc level-2 themes) —
# the themes index reads them all in one call.
LIMIT_MAX = 50
EXPLORE_CACHE_MAX = 128
# A country with three participations and two coordinations is not "a country
# that coordinates": ratio views need a minimum sample.
MIN_COORDINATION_SAMPLE = 100


def _view_coverage(
    session: Session, by: str, series: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """La couverture d'une vue géographique — None ailleurs (une vue par
    thème ou par programme ne parle pas de couverture de pays)."""
    from orion.search import coverage as coverage_mod

    if by == "country":
        codes = [str(serie["key"]) for serie in series if serie.get("key")]
    elif by == "region":
        region_of = {
            row[0]: row[1]
            for row in session.execute(
                text("SELECT code, region FROM countries WHERE region IS NOT NULL")
            )
        }
        wanted = {str(serie["key"]) for serie in series if serie.get("key")}
        codes = [code for code, region in region_of.items() if region in wanted]
    else:
        return None
    if not codes:
        return None
    mix = coverage_mod.coverage_mix(session, codes)
    if not mix["mixed"]:
        return None
    funders = coverage_mod.funders_by_country(session)
    classes = coverage_mod.coverage_map(session)
    # Les bailleurs concrets, dédupliqués : « NIH, NSF » plutôt qu'un
    # vague « partiellement couvert ».
    named = sorted({name for code in codes for name in funders.get(code, [])})
    return {
        "classes": mix["classes"],
        "funders": named,
        "uncovered": sorted({code for code in codes if classes.get(code) != "funders"})[:12],
    }


def _entity_ref_ids(session: Session, refs: list[str]) -> dict[str, list[int]]:
    """« 123 » → [123] ; « g45 » → les organisations ACTIVES du groupe 45.
    Le benchmark composable parle les deux langues (recette 2026-08-05)."""
    out: dict[str, list[int]] = {}
    for ref in refs:
        if ref.isdigit():
            out[ref] = [int(ref)]
        elif ref[:1] == "g" and ref[1:].isdigit():
            out[ref] = [
                row[0]
                for row in session.execute(
                    text(
                        "SELECT organisation_id FROM entity_group_map "
                        "WHERE group_id = :gid AND status = 'active'"
                    ),
                    {"gid": int(ref[1:])},
                )
            ]
    return out


_METRIC_COLS = {
    True: {  # participation-based
        "funding": "sum(pa.amount_eur)",
        "projects": "count(DISTINCT pa.project_id)",
        "organisations": "count(DISTINCT pa.organisation_id)",
        "coordination": (
            "100.0 * count(*) FILTER (WHERE pa.role = 'coordinator') / NULLIF(count(*), 0)"
        ),
    },
    False: {  # project-based
        "funding": "sum(p.funding_amount_eur)",
        "projects": "count(*)",
    },
}


def _org_type_case(params: dict[str, Any]) -> str:
    """CASE folding raw org types to canonical keys, all values bound."""
    parts = []
    for index, (raw, key) in enumerate(ORG_TYPE_KEYS.items()):
        params[f"otr{index}"], params[f"otk{index}"] = raw, key
        parts.append(f"WHEN :otr{index} THEN :otk{index}")
    return f"CASE o.org_type {' '.join(parts)} ELSE 'other' END"


def _dimension(by: str, participation: bool, params: dict[str, Any]) -> dict[str, str]:
    """key expression, joins, label column and mandatory clauses per dimension."""
    if by == "year":
        return {
            "key": "extract(year FROM p.start_date)::int",
            "joins": "",
            "label": "NULL",
            "clause": "p.start_date IS NOT NULL "
            "AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035",
        }
    if by == "country":
        return {
            "key": "pa.country_code",
            "joins": "LEFT JOIN countries c ON c.code = pa.country_code",
            "label": "max(c.name_en)",
            "clause": "pa.country_code IS NOT NULL",
        }
    if by == "subdivision":
        # La maille sous le pays (lot D, 2026-08-17) : le nom vient du
        # référentiel `subdivisions`, jamais d'une liste côté client.
        return {
            "key": "pa.subdivision_code",
            "joins": "JOIN subdivisions sd ON sd.code = pa.subdivision_code",
            "label": "max(sd.name)",
            "clause": "pa.subdivision_code IS NOT NULL",
        }
    if by == "region":
        # The five manager regions (chantier régions, 2026-08-04): the
        # participation's country carries its region from the referential —
        # labels are localized by the frontend (i18n `regions.*`).
        return {
            "key": "c.region",
            "joins": "JOIN countries c ON c.code = pa.country_code",
            "label": "NULL",
            "clause": "c.region IS NOT NULL",
        }
    if by == "organisation":
        return {
            "key": "pa.organisation_id",
            "joins": "JOIN organisations o ON o.id = pa.organisation_id",
            "label": "max(o.name)",
            "clause": "",
        }
    if by == "orgtype":
        return {
            "key": _org_type_case(params),
            "joins": "JOIN organisations o ON o.id = pa.organisation_id",
            "label": "NULL",
            "clause": "o.org_type IS NOT NULL",
        }
    if by == "theme":
        # euroSciVoc codes carry their ancestry (/23/47/305/961); the level-2
        # prefix is the analysis grain (41 themes). DISTINCT per (project,
        # theme) so a project with several leaves under one theme counts once —
        # a project spanning several themes counts in each (documented basis).
        return {
            "key": "tj.tkey",
            "joins": (
                "JOIN (SELECT DISTINCT pt.project_id, "
                "        substring(t.code from '^(/[0-9]+/[0-9]+)') AS tkey "
                "      FROM project_topics pt JOIN topics t ON t.id = pt.topic_id "
                "      WHERE t.scheme = 'euroscivoc') tj ON tj.project_id = p.id "
                "LEFT JOIN topics l2 ON l2.scheme = 'euroscivoc' AND l2.code = tj.tkey"
            ),
            "label": "max(l2.label)",
            "clause": "tj.tkey IS NOT NULL",
        }
    if by == "programme":
        return {"key": "p.programme_id", "joins": "", "label": "NULL", "clause": ""}
    if by == "funder":
        return {
            "key": "f.code",
            "joins": "JOIN funders f ON f.id = p.funder_id",
            "label": "max(f.name)",
            "clause": "",
        }
    raise ValueError(by)


def _filters(
    *,
    participation: bool,
    q: str | None,
    year_from: int | None,
    year_to: int | None,
    country: str | None,
    scope: str | None,
    params: dict[str, Any],
) -> list[str]:
    clauses: list[str] = []
    if scope:
        # The URL-borne geographic scope: a region frames every view. The
        # member list comes from the referential, never from the client.
        params["scope_filter"] = scope
        member = "SELECT code FROM countries WHERE region = :scope_filter"
        if participation:
            clauses.append(f"pa.country_code IN ({member})")
        else:
            clauses.append(
                "EXISTS (SELECT 1 FROM participations px "
                f"WHERE px.project_id = p.id AND px.country_code IN ({member}))"
            )
    if q:
        clauses.append("p.id IN (SELECT project_id FROM _orion_match)")
    if year_from is not None:
        clauses.append("extract(year FROM p.start_date) >= :year_from")
        params["year_from"] = year_from
    if year_to is not None:
        clauses.append("extract(year FROM p.start_date) <= :year_to")
        params["year_to"] = year_to
    if country:
        params["country_filter"] = country.upper()
        if participation:
            clauses.append("pa.country_code = :country_filter")
        else:
            clauses.append(
                "EXISTS (SELECT 1 FROM participations px "
                "WHERE px.project_id = p.id AND px.country_code = :country_filter)"
            )
    return clauses


def _subtree(parent_id: int, parents: dict[int, int | None]) -> list[int]:
    """The parent and every descendant (cycle-safe chain walk)."""
    members = []
    for pid in parents:
        node, seen = pid, set()
        while node is not None and node not in seen:
            if node == parent_id:
                members.append(pid)
                break
            seen.add(node)
            node = parents.get(node)
    return members


def _fold_to_children(
    rows: list[Any],
    parent_id: int,
    parents: dict[int, int | None],
    info: dict[int, dict[str, Any]],
    split: bool,
) -> list[dict[str, Any]]:
    """The drill-down fold: subtree rows roll up to the DIRECT children of
    `parent_id`; projects attached to the parent itself keep the parent as
    their bucket (the frontend labels that slice "directly on the
    programme"). Additive metrics only, like the root fold."""

    def child_of(pid: int) -> int | None:
        prev, node, seen = pid, pid, set()
        while node is not None and node != parent_id and node not in seen:
            seen.add(node)
            prev, node = node, parents.get(node)
        return prev if node == parent_id else None

    acc: dict[Any, dict[str, Any]] = {}
    for row in rows:
        bucket_id = child_of(row.key)
        if bucket_id is None:
            continue
        bucket_key = (bucket_id, row.y) if split else bucket_id
        bucket = acc.setdefault(
            bucket_key,
            {"funding": 0.0, "projects": 0, "y": getattr(row, "y", None), "key": bucket_id},
        )
        bucket["funding"] += float(row.funding or 0)
        bucket["projects"] += row.projects
    return [
        {
            "key": bucket["key"],
            "label": info[bucket["key"]]["label"],
            "y": bucket["y"],
            "funding": bucket["funding"],
            "projects": bucket["projects"],
            "organisations": None,
            "coordination": None,
        }
        for bucket in acc.values()
    ]


def _fold_programme(
    rows: list[Any], roots: dict[int, dict[str, Any]], to_root: dict[int, int], split: bool
) -> list[dict[str, Any]]:
    """Roll programme_id rows up to their root. Only additive metrics reach
    this point (enforced by the whitelist)."""
    acc: dict[Any, dict[str, Any]] = {}
    for row in rows:
        root = to_root.get(row.key)
        if root is None:
            continue
        bucket_key = (root, row.y) if split else root
        bucket = acc.setdefault(
            bucket_key,
            {"funding": 0.0, "projects": 0, "y": getattr(row, "y", None), "key": root},
        )
        bucket["funding"] += float(row.funding or 0)
        bucket["projects"] += row.projects
    out = []
    for bucket in acc.values():
        out.append(
            {
                "key": bucket["key"],
                "label": roots[bucket["key"]]["label"],
                "y": bucket["y"],
                "funding": bucket["funding"],
                "projects": bucket["projects"],
                "organisations": None,
                "coordination": None,
            }
        )
    return out


def _value(metric: str, row: dict[str, Any]) -> float | None:
    if metric == "funding":
        return round(float(row["funding"] or 0), 2)
    if metric == "projects":
        return row["projects"]
    if metric == "organisations":
        return row["organisations"]
    if metric == "avg":
        projects = row["projects"] or 0
        return round(float(row["funding"] or 0) / projects, 2) if projects else None
    if metric == "coordination":
        value = row["coordination"]
        return round(float(value), 1) if value is not None else None
    raise ValueError(metric)


def aggregate(
    session: Session,
    *,
    metric: str,
    by: str,
    split: bool = False,
    compare: list[str] | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    q: str | None = None,
    country: str | None = None,
    scope: str | None = None,
    limit: int = 8,
    programme: int | None = None,
    organisation: str | None = None,
    sector: str | None = None,
    subdivision: str | None = None,
) -> dict[str, Any] | None:
    if (metric, by) not in VALID or (by == "year" and (split or compare)):
        return None
    if sector is not None and sector != "space":
        return None
    # La maille cadre, la dimension distribue : se filtrer sur la maille
    # qu'on distribue n'a pas de sens (même règle que region × scope).
    if subdivision is not None:
        if not re.fullmatch(r"[A-Z]{2}-[A-Z0-9]{1,3}", subdivision):
            return None
        if by == "subdivision":
            return None
    # Le filtre entité : une organisation ou un groupe (« g<id> ») — le
    # benchmark composable s'appuie dessus. Se filtrer sur la dimension
    # qu'on distribue n'a pas de sens (même règle que region×scope).
    if organisation is not None:
        if not re.fullmatch(r"g?\d+", organisation):
            return None
        if by == "organisation":
            return None
    if by == "country" and country:
        return None
    # A scope frames, a dimension distributes: framing the world on ONE
    # region while grouping by region would be a one-slice donut.
    if by == "region" and scope:
        return None
    if scope is not None and scope not in MANAGER_REGIONS:
        return None
    # The drill-down: inside one programme, grouped by its direct children.
    # Additive metrics only (same constraint as the root fold), and compare
    # has no meaning inside a drill.
    if programme is not None:
        if by != "programme" or metric not in ("funding", "projects", "avg"):
            return None
        compare = None
    limit = min(max(limit, 1), LIMIT_MAX)
    compare = [c for c in (compare or []) if c][:6] or None

    key = (
        f"explore:{metric}:{by}:{split}:{compare}:{year_from}:{year_to}:{q}:{country}:"
        f"{scope}:{limit}:{programme}:{organisation}:{sector}:{subdivision}"
    )

    def build() -> dict[str, Any]:
        return _build(
            session,
            metric=metric,
            by=by,
            split=split,
            compare=compare,
            year_from=year_from,
            year_to=year_to,
            q=q,
            country=country,
            scope=scope,
            limit=limit,
            programme=programme,
            organisation=organisation,
            sector=sector,
            subdivision=subdivision,
        )

    if q:
        _materialize_match(session, q)
    return _cached_bounded(session, key, build, prefix="explore:", cap=EXPLORE_CACHE_MAX)


def _build(
    session: Session,
    *,
    metric: str,
    by: str,
    split: bool,
    compare: list[str] | None,
    year_from: int | None,
    year_to: int | None,
    q: str | None,
    country: str | None,
    scope: str | None,
    limit: int,
    programme: int | None = None,
    organisation: str | None = None,
    sector: str | None = None,
    subdivision: str | None = None,
) -> dict[str, Any]:
    # Le filtre entité force la base participations : l'argent COMPTÉ est
    # celui des participations de l'entité, jamais les totaux projets.
    participation = (
        by in PARTICIPATION_DIMS
        or metric in ("organisations", "coordination")
        or organisation is not None
    )
    params: dict[str, Any] = {}
    dim = _dimension(by, participation, params)
    cmp_entity_refs: dict[str, list[int]] | None = None
    if by == "organisation" and compare and any(not c.isdigit() for c in compare):
        cmp_entity_refs = _entity_ref_ids(session, compare)
        pairs = [
            (org_id, ref) for ref, org_ids in cmp_entity_refs.items() for org_id in org_ids
        ] or [(-1, "none")]
        values_sql = ", ".join(
            f"(CAST(:cmpo{i} AS integer), CAST(:cmpr{i} AS text))" for i in range(len(pairs))
        )
        for i, (org_id, ref) in enumerate(pairs):
            params[f"cmpo{i}"] = org_id
            params[f"cmpr{i}"] = ref
        # La dimension devient le REF du benchmark : les organisations
        # d'un groupe se replient en une série, étiquetée plus bas.
        dim = {
            "key": "cmp.ref",
            "joins": (
                f"JOIN (VALUES {values_sql}) AS cmp(org_id, ref) ON cmp.org_id = pa.organisation_id"
            ),
            "label": "NULL",
            "clause": "",
        }
    to_root, roots = _programme_roots(session)
    parents, tree_info = _programme_tree(session) if programme is not None else ({}, {})

    if participation:
        base = "FROM participations pa JOIN projects p ON p.id = pa.project_id"
        cols = _METRIC_COLS[True]
    else:
        base = "FROM projects p"
        cols = _METRIC_COLS[False]
    select_cols = (
        f"{dim['key']} AS key, {dim['label']} AS label, "
        f"{cols['funding']} AS funding, {cols['projects']} AS projects, "
        f"{cols.get('organisations', 'NULL')} AS organisations, "
        f"{cols.get('coordination', 'NULL')} AS coordination"
    )

    clauses = _filters(
        participation=participation,
        q=q,
        year_from=year_from,
        year_to=year_to,
        country=country,
        scope=scope,
        params=params,
    )
    if dim["clause"]:
        clauses.append(dim["clause"])
    if programme is not None:
        params["member_ids"] = _subtree(programme, parents) or [-1]
        clauses.append("p.programme_id = ANY(:member_ids)")
    if organisation is not None:
        org_filter_ids = _entity_ref_ids(session, [organisation]).get(organisation) or [-1]
        params["organisation_ids"] = org_filter_ids
        clauses.append("pa.organisation_id = ANY(:organisation_ids)")
    if sector == "space":
        # La lentille spatiale cadre la vue — le tag vit sur le projet.
        clauses.append("p.space_tag IS NOT NULL")
    if subdivision is not None:
        params["subdivision"] = subdivision
        clauses.append("pa.subdivision_code = :subdivision")
    if split:
        clauses.append(
            "p.start_date IS NOT NULL AND extract(year FROM p.start_date) BETWEEN 2000 AND 2035"
        )

    if compare:
        if by == "programme":
            wanted = {int(c) for c in compare if c.isdigit()}
            params["compare_ids"] = [pid for pid, root in to_root.items() if root in wanted] or [-1]
            clauses.append("p.programme_id = ANY(:compare_ids)")
        elif by == "organisation":
            if cmp_entity_refs is None:
                params["compare_ids"] = [int(c) for c in compare if c.isdigit()] or [-1]
                clauses.append("pa.organisation_id = ANY(:compare_ids)")
            # sinon : la jointure VALUES filtre déjà aux entités comparées.
        elif by in ("orgtype", "funder", "theme", "region"):
            # funder codes are lowercase, orgtype keys canonical, theme keys
            # are the euroSciVoc level-2 prefixes — none of them upper-cased
            params["compare_keys"] = compare
            clauses.append(f"({dim['key']}) = ANY(:compare_keys)")
        else:
            params["compare_keys"] = [c.upper() for c in compare]
            clauses.append(f"{dim['key']} = ANY(:compare_keys)")

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    having = (
        f" HAVING count(*) >= {MIN_COORDINATION_SAMPLE}"
        if metric == "coordination" and by != "year" and not compare
        else ""
    )
    split_col = ", extract(year FROM p.start_date)::int AS y" if split else ""
    split_group = ", y" if split else ""

    rows = session.execute(
        text(f"""
        SELECT {select_cols}{split_col}
        {base} {dim["joins"]}
        {where}
        GROUP BY key{split_group}
        {having}
        """),
        params,
    ).all()

    if by == "programme" and programme is not None:
        folded = _fold_to_children(rows, programme, parents, tree_info, split)
    elif by == "programme":
        folded = _fold_programme(rows, roots, to_root, split)
    else:
        folded = [
            {
                "key": r.key,
                "label": r.label,
                "y": getattr(r, "y", None),
                "funding": r.funding,
                "projects": r.projects,
                "organisations": r.organisations,
                "coordination": r.coordination,
            }
            for r in rows
        ]

    if cmp_entity_refs is not None:
        group_ids = [int(r[1:]) for r in cmp_entity_refs if r.startswith("g")]
        org_ids = [int(r) for r in cmp_entity_refs if r.isdigit()]
        labels: dict[str, str] = {}
        if group_ids:
            for gid, name in session.execute(
                text("SELECT id, name FROM groups WHERE id = ANY(:ids)"), {"ids": group_ids}
            ):
                labels[f"g{gid}"] = name
        if org_ids:
            for oid, name in session.execute(
                text("SELECT id, name FROM organisations WHERE id = ANY(:ids)"),
                {"ids": org_ids},
            ):
                labels[str(oid)] = name
        for row in folded:
            row["label"] = row["label"] or labels.get(row["key"])

    if by == "year":
        points = sorted(
            ({"year": r["key"], "value": _value(metric, r)} for r in folded),
            key=lambda p: p["year"],
        )
        series = [{"key": "all", "label": None, "points": points}]
        kept_total = None
    elif split:
        totals: dict[Any, float] = {}
        for r in folded:
            value = _value("funding" if metric == "avg" else metric, r)
            totals[r["key"]] = totals.get(r["key"], 0) + (value or 0)
        if compare:
            kept = [k for k in totals]
        else:
            kept = [k for k, _ in sorted(totals.items(), key=lambda kv: -kv[1])[:limit]]
        kept_set = set(kept)
        by_key: dict[Any, dict[str, Any]] = {}
        for r in folded:
            if r["key"] not in kept_set:
                continue
            serie = by_key.setdefault(
                r["key"], {"key": r["key"], "label": r["label"], "points": []}
            )
            serie["label"] = serie["label"] or r["label"]
            serie["points"].append({"year": r["y"], "value": _value(metric, r)})
        for serie in by_key.values():
            serie["points"].sort(key=lambda p: p["year"])
        series = sorted(by_key.values(), key=lambda s: kept.index(s["key"]))
        kept_total = None
    else:
        ranked = sorted(folded, key=lambda r: -(_value(metric, r) or 0))
        kept_rows = ranked if compare else ranked[:limit]
        series = [
            {"key": r["key"], "label": r["label"], "value": _value(metric, r)} for r in kept_rows
        ]
        kept_total = round(sum(_value(metric, r) or 0 for r in ranked), 2)

    unit = {"funding": "eur", "avg": "eur", "coordination": "pct"}.get(metric, "count")
    return {
        "metric": metric,
        "by": by,
        "split": split,
        "unit": unit,
        "basis": "participants" if participation else "projects",
        "series": series,
        "total": kept_total,
        "meta": {
            "limit": limit,
            "compare": compare,
            "q": q,
            "country": country,
            "programme": programme,
            "programme_label": (tree_info[programme]["label"] if programme in tree_info else None),
            "organisation": organisation,
            "sector": sector,
            "subdivision": subdivision,
            # La couverture de la VUE (lot E) : quand une vue comparative
            # mélange les classes, la surface compose sa phrase — une vue
            # homogène n'a rien à confesser, et rien ne s'affiche.
            "coverage": _view_coverage(session, by, series),
        },
    }
