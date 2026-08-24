"""E2 — « Acteurs historiques » d'un appel (V1 structurelle, GO 2026-08-22).

La question : pour cet appel, quels acteurs ont historiquement participé
à des projets comparables, et POURQUOI apparaissent-ils ?

Hiérarchie de preuve, jamais mélangée (conception E2, instruite sur la
prod) — un seul niveau par réponse, le plus fort qui passe le seuil :

1. `exact`             — le code d'appel de ce topic porte déjà des
   projets financés (le pont posé par E1 : `call_topics.call_id`) ;
2. `identifier_family` — la famille STRUCTURELLE de l'identifiant
   (années → Y, numéros de queue retirés), par REMONTÉE D'ANCÊTRES :
   l'ancêtre le plus profond ayant un historique gagne
   (HORIZON-CL4-2027-SPACE-03-12 → HORIZON-CL4-Y-SPACE ;
   HORIZON-JU-CLEAN-AVIATION-2026-04-FTA-05 → …-Y-04-FTA sans
   historique, puis …-CLEAN-AVIATION-Y qui en a — c'est lui). GARDE
   TRANSVERSAL, côté TOPIC : si le topic déclare lui-même une
   destination NOMMÉE (jeton alphabétique) SOUS l'ancêtre atteint
   (…-SPACE-… au-dessus du seul HORIZON-CL4-Y historique), matcher là
   mélangerait sa destination avec ses sœurs — refusé, la remontée
   s'arrête. Des jetons numériques sous l'ancêtre ne sont que de la
   numérotation. Mieux vaut rien qu'une liste trompeuse ;
3. `code_family`       — la famille du code d'appel (années → Y),
   fallback quand l'identifiant ne trouve rien : admis seulement si sa
   forme réduite DIFFÈRE de la famille d'identifiant sans en être un
   préfixe strict (cas EIC : ACCELERATORCHALLENGES côté identifiant,
   ACCELERATOR côté code — le code est la vraie identité de l'appel).

Unité de comptage : organisation × projet DISTINCT (une organisation
répétée sur un projet — cas connu du dédoublonnage — compte UN projet) ;
la coordination se compte au niveau projet ; les organisations sont les
canoniques du dédoublonnage existant (aucune résolution parallèle). Le
montant est la somme des CONTRIBUTIONS attribuées à l'organisation
(`participations.amount_eur`) — jamais le budget des projets répété par
participant. Wording strictement historique : rien ici ne prédit.

Sans historique au seuil (MIN_PROJECTS) : réponse vide, raison dite.
Aucun embedding, aucun LLM, aucun score — tout est reconstruisible en
SQL depuis les tables existantes.
"""

import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.search.service import _cached_bounded

MIN_PROJECTS = 3
MAX_ACTORS = 8
ACTORS_CACHE_MAX = 256

# Les mêmes normalisations en SQL et en Python — testées face à face.
SQL_NORM_YEAR = "regexp_replace(upper({col}), '20[0-9]{{2}}', 'Y', 'g')"
SQL_STRIP_TAIL = (
    "regexp_replace(regexp_replace(upper({col}), '20[0-9]{{2}}', 'Y', 'g'), '(-[0-9]+)+$', '')"
)


def norm_year(value: str) -> str:
    return re.sub(r"20\d{2}", "Y", value.upper())


def strip_family(value: str) -> str:
    return re.sub(r"(-\d+)+$", "", norm_year(value))


_LEVELS: dict[str, str] = {
    "exact": "SELECT :call_id AS id",
    "identifier_family": (
        "SELECT c.id FROM calls c WHERE " + SQL_STRIP_TAIL.format(col="c.code") + " = :family"
    ),
    "code_family": (
        "SELECT c.id FROM calls c WHERE " + SQL_NORM_YEAR.format(col="c.code") + " = :family"
    ),
}


def _level_stats(session: Session, level: str, params: dict[str, Any]) -> tuple[int, int]:
    row = session.execute(
        text(
            f"WITH matched AS ({_LEVELS[level]}) "
            "SELECT count(DISTINCT p.call_id), count(DISTINCT p.id) "
            "FROM projects p JOIN matched m ON p.call_id = m.id"
        ),
        params,
    ).one()
    return int(row[0] or 0), int(row[1] or 0)


def _actors(session: Session, level: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            f"""
            WITH RECURSIVE matched AS ({_LEVELS[level]}),
            mp AS (
              SELECT p.id AS project_id, p.programme_id, p.start_date
              FROM projects p JOIN matched m ON p.call_id = m.id
            ),
            walk AS (
              SELECT pr.id AS leaf, pr.id, pr.parent_id, pr.code
              FROM programmes pr
              WHERE pr.id IN (SELECT DISTINCT programme_id FROM mp WHERE programme_id IS NOT NULL)
              UNION ALL
              SELECT w.leaf, pr.id, pr.parent_id, pr.code
              FROM walk w JOIN programmes pr ON pr.id = w.parent_id
            ),
            root AS (
              SELECT leaf, min(code) AS code FROM walk WHERE parent_id IS NULL GROUP BY leaf
            )
            SELECT o.id, o.name, o.country_code,
                   count(DISTINCT pa.project_id) AS projects,
                   count(DISTINCT pa.project_id)
                     FILTER (WHERE pa.role = 'coordinator') AS coordinations,
                   min(extract(year FROM mp.start_date))::int AS from_year,
                   max(extract(year FROM mp.start_date))::int AS to_year,
                   sum(pa.amount_eur) AS contributions_eur,
                   array_remove(array_agg(DISTINCT r.code), NULL) AS programmes
            FROM mp
            JOIN participations pa ON pa.project_id = mp.project_id
            JOIN organisations o ON o.id = pa.organisation_id
            LEFT JOIN root r ON r.leaf = mp.programme_id
            GROUP BY o.id, o.name, o.country_code
            ORDER BY projects DESC, contributions_eur DESC NULLS LAST, o.name
            LIMIT {MAX_ACTORS}
            """
        ),
        params,
    ).all()
    return [
        {
            "organisation_id": row.id,
            "name": row.name,
            "country": row.country_code,
            "projects": int(row.projects),
            "coordinations": int(row.coordinations),
            "period": {"from": row.from_year, "to": row.to_year},
            "programmes": list(row.programmes or [])[:3],
            # Contributions ATTRIBUÉES à l'organisation — jamais le
            # budget projet répété par participant.
            "contributions_eur": float(row.contributions_eur)
            if row.contributions_eur is not None
            else None,
        }
        for row in rows
    ]


def _historical_families(session: Session) -> set[str]:
    """Les familles réduites (années → Y, queues numériques retirées) de
    TOUS les appels historiques porteurs de projets — la carte sur
    laquelle la remontée d'ancêtres marche. Une requête, cachée."""
    rows = session.execute(
        text(
            "SELECT DISTINCT "
            + SQL_STRIP_TAIL.format(col="c.code")
            + " FROM calls c WHERE EXISTS (SELECT 1 FROM projects p WHERE p.call_id = c.id)"
        )
    ).all()
    return {row[0] for row in rows if row[0]}


def resolve_identifier_family(
    identifier_family: str, families: set[str]
) -> tuple[str | None, bool]:
    """La remontée d'ancêtres : (famille retenue, refus-transversal).
    Du plus profond au plus court, le premier ancêtre AVEC historique
    gagne — SAUF si le topic déclare lui-même une destination NOMMÉE
    (jeton alphabétique) SOUS cet ancêtre : matcher là mélangerait sa
    destination avec ses sœurs (le piège CL4 : un topic …-SPACE-… ne se
    compare jamais au niveau HORIZON-CL4-Y). Des jetons NUMÉRIQUES sous
    l'ancêtre ne sont que de la numérotation d'appel — admis (constat
    réel : Clean Aviation …-Y-04-FTA se résout à …-CLEAN-AVIATION-Y ;
    et l'existence de sous-familles historiques plus profondes, comme
    SPACE-PARTNERSHIP sous SPACE, ne disqualifie pas un ancêtre — le
    premier garde, côté historique, refusait ces cas à tort)."""
    tokens = identifier_family.split("-")
    for depth in range(len(tokens), 1, -1):
        ancestor = "-".join(tokens[:depth])
        if ancestor in families:
            below = tokens[depth:]
            if below and any(ch.isalpha() for ch in below[0]):
                return None, True
            return ancestor, False
    return None, False


def historical_actors(session: Session, topic_id: int) -> dict[str, Any]:
    def build() -> dict[str, Any]:
        topic = session.execute(
            text(
                "SELECT identifier, call_code, call_id FROM call_topics "
                "WHERE id = :id AND source = 'ft-portal'"
            ),
            {"id": topic_id},
        ).first()
        if topic is None:
            return {"error": "not_found"}
        identifier, call_code, call_id = topic
        identifier_family = strip_family(identifier)
        families = _cached_bounded(
            session,
            "callactors:families",
            lambda: _historical_families(session),
            prefix="callactors:",
            cap=ACTORS_CACHE_MAX,
        )
        resolved_family, mixer_refused = resolve_identifier_family(identifier_family, families)

        code_family = norm_year(call_code) if call_code else None
        code_stripped = strip_family(call_code) if call_code else None
        # Le fallback code : jamais quand il est un préfixe STRICT de la
        # famille d'identifiant (strictement plus large — piège CL4),
        # inutile quand il lui est égal (sous-ensemble du niveau 2).
        code_family_broader = bool(
            code_stripped and identifier_family.startswith(code_stripped + "-")
        )
        code_family_useful = bool(
            code_family and not code_family_broader and code_stripped != identifier_family
        )

        candidates: list[tuple[str, str | None, dict[str, Any]]] = []
        if call_id is not None:
            candidates.append(("exact", None, {"call_id": call_id}))
        if resolved_family:
            candidates.append(("identifier_family", resolved_family, {"family": resolved_family}))
        if code_family_useful:
            candidates.append(("code_family", code_family, {"family": code_family}))

        best_below: int = 0
        for level, family, params in candidates:
            calls_count, projects_count = _level_stats(session, level, params)
            if projects_count >= MIN_PROJECTS:
                return {
                    "level": level,
                    "family": family,
                    "historical": {"calls": calls_count, "projects": projects_count},
                    "actors": _actors(session, level, params),
                    "meta": _method_meta(),
                }
            best_below = max(best_below, projects_count)

        if best_below > 0:
            reason = "below_threshold"
        elif mixer_refused:
            # La remontée a TROUVÉ une famille historique et l'a refusée
            # (transversale) — c'est le piège, et on le dit. Un simple
            # code « plus large » sans historique n'est pas un piège :
            # c'est une absence d'historique, dite comme telle.
            reason = "family_too_transversal"
        else:
            reason = "no_comparable_history"
        return {
            "level": None,
            "family": None,
            "historical": {"calls": 0, "projects": best_below},
            "actors": [],
            "reason": reason,
            "meta": _method_meta(),
        }

    return _cached_bounded(
        session, f"callactors:{topic_id}", build, prefix="callactors:", cap=ACTORS_CACHE_MAX
    )


def _method_meta() -> dict[str, Any]:
    return {
        "min_projects": MIN_PROJECTS,
        "unit": "organisation × projet distinct ; coordination comptée au niveau projet",
        "amounts": "contributions attribuées à l'organisation (participations),"
        " jamais le budget projet répété",
        "corpus": "historique des appels du corpus Orion (CORDIS : FP7, H2020,"
        " Horizon Europe) — les programmes hors corpus n'ont pas d'historique"
        " comparable",
        "wording": "constats historiques observés — aucune prédiction",
    }
