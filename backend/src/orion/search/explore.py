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
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.constanteuro import COVERED, FactorSet
from orion.macro import MacroSet
from orion.search.service import (
    _cached_bounded,
    _materialize_match,
    _programme_roots,
    _programme_tree,
    parse_sector,
    valid_sector,
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


def _entity_ref_ids(session: Session, refs: list[str]) -> dict[str, list[tuple[int, float]]]:
    """« 123 » → [(123, 1.0)] ; « g45 » → les organisations ACTIVES du
    groupe 45, chacune avec son POIDS de pacte (pondération JV, doctrine
    2026-08-17 : un 67/33 reste un 67/33, jamais deux fois 100). Le
    benchmark composable parle les deux langues (recette 2026-08-05)."""
    out: dict[str, list[tuple[int, float]]] = {}
    for ref in refs:
        if ref.isdigit():
            out[ref] = [(int(ref), 1.0)]
        elif ref[:1] == "g" and ref[1:].isdigit():
            out[ref] = [
                (row[0], float(row[1]))
                for row in session.execute(
                    text(
                        "SELECT organisation_id, coalesce(share, 100) / 100.0 "
                        "FROM entity_group_map "
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

# Les métriques monétaires — les seules que le mode « euros constants »
# (lot A) transforme ; les comptes sont identiques dans les deux modes.
MONETARY_METRICS = ("funding", "avg")


def _funding_col(participation: bool, weight: str, real: bool) -> str:
    """LA colonne funding, unique point de définition pour les deux modes.

    Nominal : chaîne B de la taxonomie (§ 2.7), texte SQL STRICTEMENT
    identique à l'historique — le chemin nominal ne bouge pas d'un
    octet. Constant : chaîne C — natif × facteur, gardé par la règle A2
    (EUR constant ⊂ périmètre disposant d'un nominal EUR : une ligne
    sans nominal EUR ne produit JAMAIS de constant) ; un facteur absent
    (A1 : année sans indice, devise non couverte) rend NULL, la ligne
    sort de la somme et se compte dans `excluded` — jamais en silence."""
    eur = "pa.amount_eur" if participation else "p.funding_amount_eur"
    if not real:
        return f"sum({eur}{weight})"
    native = "pa.amount" if participation else "p.funding_amount"
    return f"sum(CASE WHEN {eur} IS NOT NULL THEN {native} * fx.factor{weight} END)"


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
    keep_null: bool = False,
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
            {
                "funding": None if keep_null else 0.0,
                "projects": 0,
                "y": getattr(row, "y", None),
                "key": bucket_id,
            },
        )
        # keep_null (mode real) : un bucket dont AUCUNE ligne n'est
        # ajustable reste None — jamais un zéro mensonger à l'écran.
        if keep_null:
            if row.funding is not None:
                bucket["funding"] = (bucket["funding"] or 0.0) + float(row.funding)
        else:
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
    rows: list[Any],
    roots: dict[int, dict[str, Any]],
    to_root: dict[int, int],
    split: bool,
    keep_null: bool = False,
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
            {
                "funding": None if keep_null else 0.0,
                "projects": 0,
                "y": getattr(row, "y", None),
                "key": root,
            },
        )
        if keep_null:
            if row.funding is not None:
                bucket["funding"] = (bucket["funding"] or 0.0) + float(row.funding)
        else:
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


def _value(
    metric: str, row: dict[str, Any], real: bool = False, decimals: int = 2
) -> float | None:
    if metric == "funding":
        # Mode real : une somme NULL signifie « aucune ligne
        # ajustable » — la valeur est ABSENTE, jamais un faux zéro
        # (règle A1 : absence de chiffre constant ≠ zéro).
        if real and row["funding"] is None:
            return None
        # 2 décimales pour les montants (invariance nominal/real à
        # l'octet près) ; 6 pour les intensités % PIB et les €/habitant
        # (lot R3), qui vivent sous 0,01.
        return round(float(row["funding"] or 0), decimals)
    if metric == "projects":
        return row["projects"]
    if metric == "organisations":
        return row["organisations"]
    if metric == "avg":
        if real and row["funding"] is None:
            return None
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
    factor_set: FactorSet | None = None,
    scale: str | None = None,
    macro: MacroSet | None = None,
    usd_rates: dict[int, Decimal] | None = None,
) -> dict[str, Any] | None:
    if (metric, by) not in VALID or (by == "year" and (split or compare)):
        return None
    if sector is not None and not valid_sector(session, sector):
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

    # La vintage entre dans la clé (avec l'année de référence et la
    # devise d'affichage, via factor_set.key) : une nouvelle vintage
    # d'indices invalide d'elle-même tout cache real (jamais de
    # collision nominal/real, § 5 étape 13).
    if scale:
        reference_key = f":{scale}:{macro.key}" + (
            f":{factor_set.key}" if factor_set is not None else ""
        )
    elif factor_set is not None:
        reference_key = f":real:{factor_set.key}"
    else:
        reference_key = ""
    key = (
        f"explore:{metric}:{by}:{split}:{compare}:{year_from}:{year_to}:{q}:{country}:"
        f"{scope}:{limit}:{programme}:{organisation}:{sector}:{subdivision}{reference_key}"
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
            factor_set=factor_set,
            scale=scale,
            macro=macro,
            usd_rates=usd_rates,
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
    factor_set: FactorSet | None = None,
    scale: str | None = None,
    macro: MacroSet | None = None,
    usd_rates: dict[int, Decimal] | None = None,
) -> dict[str, Any]:
    # Le filtre entité force la base participations : l'argent COMPTÉ est
    # celui des participations de l'entité, jamais les totaux projets.
    # ECONOMIC SCALE (lot R3, R0 § D3) : la perspective est FORCÉE par
    # la dimension — financeur sur by=funder (grain PROJET, l'effort ne
    # compte chaque projet qu'une fois), bénéficiaire partout ailleurs
    # (grain PARTICIPATION, l'argent compté est la part reçue — jamais
    # le total du projet, sinon double comptage). L'API a validé la vue.
    scale_perspective = ("funder" if by == "funder" else "recipient") if scale else None
    participation = (
        by in PARTICIPATION_DIMS
        or metric in ("organisations", "coordination")
        or organisation is not None
        or scale_perspective == "recipient"
    )
    # Le mode real ne transforme que l'argent : pour une métrique de
    # comptes, la vue est identique au nominal (seul `meta.reference` s'ajoute).
    real = factor_set is not None and metric in MONETARY_METRICS
    # Toute transformation monétaire (real, gdp, capita) garde le NULL :
    # absence de chiffre ≠ zéro (A1, généralisé R3).
    keep_none = real or scale is not None
    value_decimals = 6 if scale else 2
    params: dict[str, Any] = {}
    dim = _dimension(by, participation, params)
    cmp_entity_refs: dict[str, list[tuple[int, float]]] | None = None
    if by == "organisation" and compare and any(not c.isdigit() for c in compare):
        cmp_entity_refs = _entity_ref_ids(session, compare)
        pairs = [
            (org_id, ref, weight)
            for ref, members in cmp_entity_refs.items()
            for org_id, weight in members
        ] or [(-1, "none", 1.0)]
        values_sql = ", ".join(
            f"(CAST(:cmpo{i} AS integer), CAST(:cmpr{i} AS text), "
            f"CAST(:cmpw{i} AS double precision))"
            for i in range(len(pairs))
        )
        for i, (org_id, ref, weight) in enumerate(pairs):
            params[f"cmpo{i}"] = org_id
            params[f"cmpr{i}"] = ref
            params[f"cmpw{i}"] = weight
        # La dimension devient le REF du benchmark : les organisations
        # d'un groupe se replient en une série, étiquetée plus bas — et
        # chaque participation porte son POIDS de pacte (pondération JV).
        dim = {
            "key": "cmp.ref",
            "joins": (
                f"JOIN (VALUES {values_sql}) AS cmp(org_id, ref, weight) "
                "ON cmp.org_id = pa.organisation_id"
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
    # Le mode « euros constants » (lot A) : la table des facteurs vient
    # de constanteuro.py (source unique) et se joint en VALUES sur
    # (devise NATIVE, année de début) — LEFT JOIN : une ligne sans
    # facteur reste dans la vue, sa somme constante l'ignore, la part
    # exclue la compte. Le chemin nominal n'ajoute RIEN (aucun octet de
    # SQL ne change quand value=nominal).
    fx_join = ""
    if real:
        pairs = sorted(factor_set.factors.items())
        values_sql = ", ".join(
            f"(CAST(:fxc{i} AS text), CAST(:fxy{i} AS int), CAST(:fxf{i} AS numeric))"
            for i in range(len(pairs))
        )
        for i, ((fx_currency, fx_year), fx_factor) in enumerate(pairs):
            params[f"fxc{i}"] = fx_currency
            params[f"fxy{i}"] = fx_year
            params[f"fxf{i}"] = fx_factor
        currency_col = "pa.currency" if participation else "p.funding_currency"
        fx_join = (
            f"LEFT JOIN (VALUES {values_sql}) AS fx(cur, yr, factor) "
            f"ON fx.cur = {currency_col} "
            "AND fx.yr = extract(year FROM p.start_date)::int"
        )
        cols = {**cols, "funding": _funding_col(participation, "", real=True)}
    # ECONOMIC SCALE (lot R3) : le dénominateur macro se joint depuis la
    # TABLE macro_series (dernière vintage par juridiction, sous-requête
    # minuscule) sur (juridiction de la ligne, année de début). % PIB en
    # devise commune USD : numérateur nominal EUR × taux annuel BCE
    # (convention ④ généralisée par le pivot USD), dénominateur PIB
    # courant USD — même devise, mêmes prix courants, ratio pur, aucune
    # déflation. Par-habitant : valeur RÉELLE (facteurs du moteur A,
    # devise d'affichage comprise) / population de l'année — la somme
    # des années est un cumul par habitant, exactement décomposable en
    # série temporelle. Une ligne sans dénominateur rend NULL : elle
    # sort de la somme et se compte dans `excluded`, jamais en silence.
    md_join = ""
    scale_jur = ""
    if scale:
        eur_num = "pa.amount_eur" if participation else "p.funding_amount_eur"
        native_num = "pa.amount" if participation else "p.funding_amount"
        scale_jur = "pa.country_code" if scale_perspective == "recipient" else "f.jurisdiction"
        params["md_concept"] = macro.concept
        md_join = (
            "LEFT JOIN macro_series md ON md.concept = :md_concept "
            f"AND md.jurisdiction_code = {scale_jur} "
            "AND md.year = extract(year FROM p.start_date)::int "
            "AND (md.jurisdiction_code, md.vintage_date) IN "
            "(SELECT jurisdiction_code, max(vintage_date) FROM macro_series "
            " WHERE concept = :md_concept GROUP BY jurisdiction_code)"
        )
        if scale == "gdp":
            rate_values = ", ".join(
                f"(CAST(:usdy{i} AS int), CAST(:usdr{i} AS numeric))"
                for i in range(len(usd_rates))
            )
            for i, (rate_year, rate) in enumerate(sorted(usd_rates.items())):
                params[f"usdy{i}"] = rate_year
                params[f"usdr{i}"] = rate
            md_join += (
                f" LEFT JOIN (VALUES {rate_values}) AS usdr(yr, rate) "
                "ON usdr.yr = extract(year FROM p.start_date)::int"
            )
            cols = {
                **cols,
                "funding": (
                    f"sum(CASE WHEN {eur_num} IS NOT NULL "
                    f"THEN {eur_num} * usdr.rate / md.value * 100 END)"
                ),
            }
        else:  # capita — numérateur réel via les facteurs déjà joints (fx)
            cols = {
                **cols,
                "funding": (
                    f"sum(CASE WHEN {eur_num} IS NOT NULL "
                    f"THEN {native_num} * fx.factor / md.value END)"
                ),
            }
    # Pondération JV : l'ARGENT d'un groupe replié porte le poids de
    # chaque adhésion ; les comptes (projets, organisations, part en
    # coordination) restent entiers — c'est l'argent que le pacte
    # partage, pas les faits. AVANT la construction du SELECT : une
    # surcharge posée après ne serait qu'un dictionnaire mort.
    if cmp_entity_refs is not None:
        cols = {**cols, "funding": _funding_col(True, " * cmp.weight", real)}
    if organisation is not None and organisation.startswith("g"):
        # Vue cadrée sur un GROUPE (organisation=g<id>) : même règle, le
        # poids se lit sur l'adhésion active de chaque participation.
        params["orgf_gid"] = int(organisation[1:])
        weight_sub = (
            "(SELECT coalesce(m.share, 100) / 100.0 FROM entity_group_map m "
            "WHERE m.group_id = :orgf_gid "
            "AND m.organisation_id = pa.organisation_id AND m.status = 'active')"
        )
        cols = {**cols, "funding": _funding_col(True, f" * {weight_sub}", real)}
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
        org_members = _entity_ref_ids(session, [organisation]).get(organisation) or [(-1, 1.0)]
        params["organisation_ids"] = [org_id for org_id, _ in org_members]
        clauses.append("pa.organisation_id = ANY(:organisation_ids)")
    if sector:
        # Une lentille cadre la vue — une LECTURE posée sur le corpus
        # (D3), le tag vit en project_lens_tags depuis M0. `<slug>` =
        # cœur + habilitant (le sens historique de « space », nommé à
        # l'écran depuis l'audit) ; `<slug>-direct` = le cœur seul.
        lens_slug, core_only = parse_sector(sector)
        params["sector_lens"] = lens_slug
        tag_clause = " AND plt.tag = 'core'" if core_only else ""
        clauses.append(
            "p.id IN (SELECT plt.project_id FROM project_lens_tags plt "
            f"WHERE plt.lens = :sector_lens{tag_clause})"
        )
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

    if scale == "gdp":
        # % PIB agrégé = RATIO DES SOMMES (verrou R3, 2026-08-24) :
        # 100 × Σ funding_USD(a) / Σ PIB_USD(a) sur les MÊMES années
        # valides — la moyenne des intensités pondérée par le PIB,
        # jamais une moyenne arithmétique de pourcentages ni une somme
        # de parts. Sur une vue temporelle (groupe par année), la
        # formule se réduit au ratio de l'année. Deux niveaux : l'année
        # d'abord (le PIB d'une juridiction n'y compte qu'une fois),
        # la période ensuite.
        eur_num = "pa.amount_eur" if participation else "p.funding_amount_eur"
        inner = f"""
            SELECT {dim["key"]} AS key, {dim["label"]} AS label,
                   extract(year FROM p.start_date)::int AS yr,
                   sum(CASE WHEN {eur_num} IS NOT NULL AND md.value IS NOT NULL
                            AND usdr.rate IS NOT NULL
                            THEN {eur_num} * usdr.rate END) AS f_usd,
                   max(md.value) AS gdp,
                   {cols["projects"]} AS projects
            {base} {dim["joins"]} {md_join}
            {where}
            GROUP BY {dim["key"]}, extract(year FROM p.start_date)::int
        """
        outer_group = "key, yr" if split else "key"
        y_col = ", yr AS y" if split else ""
        rows = session.execute(
            text(f"""
            SELECT key, max(label) AS label{y_col},
                   sum(f_usd) / NULLIF(sum(gdp), 0) * 100 AS funding,
                   sum(projects) AS projects,
                   NULL AS organisations, NULL AS coordination
            FROM ({inner}) yearly
            WHERE f_usd IS NOT NULL
            GROUP BY {outer_group}
            """),
            params,
        ).all()
    else:
        rows = session.execute(
            text(f"""
            SELECT {select_cols}{split_col}
            {base} {dim["joins"]} {fx_join} {md_join}
            {where}
            GROUP BY key{split_group}
            {having}
            """),
            params,
        ).all()

    # La part exclue du calcul real — MÊME périmètre (mêmes
    # jointures, mêmes clauses), une passe sans GROUP BY : les comptes
    # de projets distincts ne se somment pas à travers les buckets d'une
    # dimension (un projet multi-pays y apparaît plusieurs fois), la
    # passe dédiée les compte exactement. Chiffres calculés depuis le
    # périmètre AFFICHÉ, jamais codés en dur (arbitrage A1).
    excluded = None
    if scale:
        eur_col = "pa.amount_eur" if participation else "p.funding_amount_eur"
        currency_col = "pa.currency" if participation else "p.funding_currency"
        params["fx_covered"] = list(COVERED)
        # Le terme calculable, décomposé en motifs EXCLUSIFS et précis
        # (R0 § D13) — chiffres depuis le périmètre affiché, jamais en dur.
        if scale == "gdp":
            excl = (
                f"{eur_col} IS NOT NULL AND (p.start_date IS NULL OR {scale_jur} IS NULL "
                "OR usdr.rate IS NULL OR md.value IS NULL)"
            )
            motifs = {
                "no_date": "p.start_date IS NULL",
                "no_jurisdiction": f"p.start_date IS NOT NULL AND {scale_jur} IS NULL",
                # Le PIB d'abord : une année 2026-2027 manque des DEUX
                # référentiels — le dénominateur est l'histoire utile.
                "no_gdp_year": (
                    f"p.start_date IS NOT NULL AND {scale_jur} IS NOT NULL "
                    "AND md.value IS NULL"
                ),
                "no_rate_year": (
                    f"p.start_date IS NOT NULL AND {scale_jur} IS NOT NULL "
                    "AND md.value IS NOT NULL AND usdr.rate IS NULL"
                ),
            }
            year_motifs = ("no_rate_year", "no_gdp_year")
        else:  # capita : hérite des motifs real + la population
            excl = (
                f"{eur_col} IS NOT NULL AND (p.start_date IS NULL OR {scale_jur} IS NULL "
                "OR fx.factor IS NULL OR md.value IS NULL)"
            )
            motifs = {
                "no_date": "p.start_date IS NULL",
                "no_jurisdiction": f"p.start_date IS NOT NULL AND {scale_jur} IS NULL",
                "no_currency_index": (
                    f"p.start_date IS NOT NULL AND {scale_jur} IS NOT NULL AND fx.factor IS NULL "
                    f"AND ({currency_col} IS NULL OR NOT ({currency_col} = ANY(:fx_covered)))"
                ),
                "no_index_year": (
                    f"p.start_date IS NOT NULL AND {scale_jur} IS NOT NULL AND fx.factor IS NULL "
                    f"AND {currency_col} = ANY(:fx_covered)"
                ),
                "no_population_year": (
                    f"p.start_date IS NOT NULL AND {scale_jur} IS NOT NULL "
                    "AND fx.factor IS NOT NULL AND md.value IS NULL"
                ),
            }
            year_motifs = ("no_index_year", "no_population_year")
        motif_cols = ", ".join(
            f"count(DISTINCT p.id) FILTER (WHERE {cond}) AS {name}_n, "
            f"sum({eur_col}) FILTER (WHERE {cond}) AS {name}_eur"
            + (
                f", array_agg(DISTINCT extract(year FROM p.start_date)::int)"
                f" FILTER (WHERE {cond}) AS {name}_years"
                if name in year_motifs
                else ""
            )
            for name, cond in motifs.items()
        )
        where_excluded = f"{where} AND {excl}" if where else f"WHERE {excl}"
        excluded_row = session.execute(
            text(f"""
            SELECT count(DISTINCT p.id) FILTER (WHERE {excl}) AS projects,
                   sum({eur_col}) FILTER (WHERE {excl}) AS amount,
                   {motif_cols}
            {base} {dim["joins"]} {fx_join} {md_join}
            {where_excluded}
            """),
            params,
        ).one()
        row_map = excluded_row._mapping
        excluded = {
            "projects": excluded_row.projects or 0,
            "amount_eur_nominal": round(float(excluded_row.amount or 0), 2),
            "reasons": {
                name: {
                    "projects": row_map[f"{name}_n"] or 0,
                    "amount_eur_nominal": round(float(row_map[f"{name}_eur"] or 0), 2),
                    **(
                        {"years": sorted(row_map[f"{name}_years"] or [])}
                        if name in year_motifs
                        else {}
                    ),
                }
                for name in motifs
            },
        }
    elif real:
        eur_col = "pa.amount_eur" if participation else "p.funding_amount_eur"
        currency_col = "pa.currency" if participation else "p.funding_currency"
        params["fx_covered"] = list(COVERED)
        excl = f"{eur_col} IS NOT NULL AND fx.factor IS NULL"
        no_date = f"{excl} AND p.start_date IS NULL"
        no_index = (
            f"{excl} AND p.start_date IS NOT NULL AND {currency_col} = ANY(:fx_covered)"
        )
        no_currency = (
            f"{excl} AND p.start_date IS NOT NULL "
            f"AND ({currency_col} IS NULL OR NOT ({currency_col} = ANY(:fx_covered)))"
        )
        # Le périmètre du scan est BORNÉ à la condition d'exclusion en
        # WHERE (mesure R1 : ~4× plus rapide que le FILTER seul sur le
        # corpus complet) — chaque agrégat FILTER implique déjà `excl`,
        # la restriction ne change aucun chiffre. Mêmes jointures, mêmes
        # clauses que la vue : le périmètre affiché reste la vérité.
        where_excluded = f"{where} AND {excl}" if where else f"WHERE {excl}"
        excluded_row = session.execute(
            text(f"""
            SELECT count(DISTINCT p.id) FILTER (WHERE {excl}) AS projects,
                   sum({eur_col}) FILTER (WHERE {excl}) AS amount,
                   count(DISTINCT p.id) FILTER (WHERE {no_date}) AS nodate_n,
                   sum({eur_col}) FILTER (WHERE {no_date}) AS nodate_eur,
                   count(DISTINCT p.id) FILTER (WHERE {no_index}) AS noidx_n,
                   sum({eur_col}) FILTER (WHERE {no_index}) AS noidx_eur,
                   array_agg(DISTINCT extract(year FROM p.start_date)::int)
                       FILTER (WHERE {no_index}) AS noidx_years,
                   count(DISTINCT p.id) FILTER (WHERE {no_currency}) AS nocur_n,
                   sum({eur_col}) FILTER (WHERE {no_currency}) AS nocur_eur
            {base} {dim["joins"]} {fx_join}
            {where_excluded}
            """),
            params,
        ).one()
        excluded = {
            "projects": excluded_row.projects or 0,
            "amount_eur_nominal": round(float(excluded_row.amount or 0), 2),
            "reasons": {
                "no_index_year": {
                    "projects": excluded_row.noidx_n or 0,
                    "amount_eur_nominal": round(float(excluded_row.noidx_eur or 0), 2),
                    "years": sorted(excluded_row.noidx_years or []),
                },
                "no_date": {
                    "projects": excluded_row.nodate_n or 0,
                    "amount_eur_nominal": round(float(excluded_row.nodate_eur or 0), 2),
                },
                "no_currency_index": {
                    "projects": excluded_row.nocur_n or 0,
                    "amount_eur_nominal": round(float(excluded_row.nocur_eur or 0), 2),
                },
            },
        }

    if by == "programme" and programme is not None:
        folded = _fold_to_children(rows, programme, parents, tree_info, split, keep_null=keep_none)
    elif by == "programme":
        folded = _fold_programme(rows, roots, to_root, split, keep_null=keep_none)
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
            ({"year": r["key"], "value": _value(metric, r, keep_none, value_decimals)} for r in folded),
            key=lambda p: p["year"],
        )
        series = [{"key": "all", "label": None, "points": points}]
        kept_total = None
    elif split:
        totals: dict[Any, float] = {}
        for r in folded:
            value = _value("funding" if metric == "avg" else metric, r, keep_none, value_decimals)
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
            serie["points"].append({"year": r["y"], "value": _value(metric, r, keep_none, value_decimals)})
        for serie in by_key.values():
            serie["points"].sort(key=lambda p: p["year"])
        series = sorted(by_key.values(), key=lambda s: kept.index(s["key"]))
        kept_total = None
    else:
        ranked = sorted(folded, key=lambda r: -(_value(metric, r, keep_none, value_decimals) or 0))
        kept_rows = ranked if compare else ranked[:limit]
        series = [
            {"key": r["key"], "label": r["label"], "value": _value(metric, r, keep_none, value_decimals)}
            for r in kept_rows
        ]
        kept_total = round(sum(_value(metric, r, keep_none, value_decimals) or 0 for r in ranked), 2)

    unit = {"funding": "eur", "avg": "eur", "coordination": "pct"}.get(metric, "count")
    # En real ré-exprimé, l'unité de la réponse dit la devise d'affichage
    # (R0 § D7) : le front ne devine jamais le symbole, il lit l'unité.
    if real and unit == "eur" and factor_set.display_currency != "EUR":
        unit = factor_set.display_currency.lower()
    # ECONOMIC SCALE : l'unité n'est plus un montant — le front lit
    # l'unité, jamais un « € » deviné (gdppct = % du PIB ; eurcap/usdcap
    # = monnaie réelle par habitant).
    if scale == "gdp":
        unit = "gdppct"
    elif scale == "capita":
        unit = "usdcap" if factor_set.display_currency == "USD" else "eurcap"
    out: dict[str, Any] = {
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
    # Modes du Reference Engine : les clés `meta.reference` et `excluded`
    # N'EXISTENT qu'en mode transformé — une réponse nominale reste
    # identique octet pour octet à l'historique (invariant, § 5 étape 16).
    if scale:
        # Une intensité ou un par-habitant ne se SOMME pas à travers les
        # séries : pas de « part du tout » possible.
        out["total"] = None
        out["meta"]["reference"] = {
            "mode": scale,
            "perspective": scale_perspective,
            "denominator": {
                "concept": macro.concept,
                "source": macro.series_source,
                "series_code": macro.series_code,
                "vintage": macro.latest_vintage,
            },
            **(
                {
                    "base": factor_set.reference_year,
                    "cur": factor_set.display_currency,
                    "bases": list(factor_set.bases),
                    "vintages": factor_set.vintages,
                    "series": factor_set.series,
                }
                if factor_set is not None
                else {}
            ),
            "rates_source": "ecb",
        }
        if excluded is not None:
            out["excluded"] = excluded
    elif factor_set is not None:
        out["meta"]["reference"] = {
            "mode": "real",
            "base": factor_set.reference_year,
            "cur": factor_set.display_currency,
            "bases": list(factor_set.bases),
            "vintages": factor_set.vintages,
            "series": factor_set.series,
            "rates_source": "ecb",
        }
        if excluded is not None:
            out["excluded"] = excluded
    return out
