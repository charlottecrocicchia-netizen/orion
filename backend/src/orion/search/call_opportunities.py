"""E3 V1 — « Opportunités détectées » d'une organisation (structurel).

La question : où cette organisation peut-elle aller chercher de
l'argent demain ? Réponse V1, entièrement reconstruisible : les appels
OUVERTS ou À VENIR dont la famille (au sens d'E2 : pont exact › famille
par identifiant, mêmes normalisations, mêmes gardes) contient
l'historique de l'organisation.

PAS DE SCORE GLOBAL — c'est un choix, pas un oubli : la pondération
d'un score agrégé est un arbitrage de méthode qui appartient à la
fondatrice ; la V1 montre les COMPOSANTES, chacune sourcée :

- projets historiques de l'organisation dans la famille (organisation ×
  projet DISTINCT, comme partout) ;
- coordinations (comptées au niveau projet) ;
- dernière année d'activité dans la famille ;
- co-participants historiques dans la famille (les organisations qui
  ont déjà signé À SES CÔTÉS dans ces appels) ;
- éligibilité : NON ÉVALUÉE (le portail ne la publie pas en structuré) —
  un critère inconnu n'est jamais traité comme incompatible, et il est
  affiché comme inconnu (règle d'E1/lecons-spec-externe).

Seuils d'honnêteté : un pont EXACT (déjà financé sous ce code d'appel)
vaut dès 1 projet ; une famille par identifiant exige MIN_PROJECTS
(le seuil d'E2). Le tri est déclaré : pont exact d'abord, puis projets
décroissants, puis échéance la plus proche. Wording strictement
historique — jamais une garantie d'éligibilité ni un pronostic.

Le cache est clé par le tampon corpus ET le tampon des moissons
d'appels : la fraîcheur quotidienne des appels doit invalider ce que le
corpus gelé n'invalide pas.
"""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.search.call_actors import (
    MIN_PROJECTS,
    SQL_STRIP_TAIL,
    _historical_families,
    resolve_identifier_family,
    strip_family,
)
from orion.search.service import _cached_bounded

MAX_OPPORTUNITIES = 6
OPPS_CACHE_MAX = 128


def calls_stamp(session: Session) -> str:
    """Le tampon de fraîcheur des appels — la moisson quotidienne doit
    invalider les caches que le corpus gelé n'invalide pas."""
    value = session.execute(
        text(
            "SELECT max(finished_at) FROM ingestion_runs "
            "WHERE source = 'calls' AND status = 'succeeded'"
        )
    ).scalar()
    return value.isoformat() if value else "never"


def _live_topics(session: Session, stamp: str) -> list[dict[str, Any]]:
    """Tous les topics du flux, bruts — la dérivation ouvert/à venir se
    fait à la lecture (orion.callstatus), jamais figée en cache."""

    def build() -> list[dict[str, Any]]:
        rows = session.execute(
            text(
                "SELECT id, identifier, title, call_code, call_id, status_code, "
                "opening_date, deadline_dates FROM call_topics WHERE source = 'ft-portal'"
            )
        ).all()
        return [
            {
                "id": row.id,
                "identifier": row.identifier,
                "title": row.title,
                "call_code": row.call_code,
                "call_id": row.call_id,
                "status_code": row.status_code,
                "opening_date": row.opening_date,
                "deadline_dates": row.deadline_dates,
            }
            for row in rows
        ]

    return _cached_bounded(
        session, f"callopps:topics:{stamp}", build, prefix="callopps:", cap=OPPS_CACHE_MAX
    )


def _org_history(session: Session, organisation_id: int) -> dict[str, Any]:
    """L'empreinte historique de l'organisation, par appel puis par
    famille : projets DISTINCTS, coordinations au niveau projet,
    dernière année d'activité."""
    rows = session.execute(
        text(
            "SELECT c.id AS call_id, "
            + SQL_STRIP_TAIL.format(col="c.code")
            + " AS family, "
            "count(DISTINCT pa.project_id) AS projects, "
            "count(DISTINCT pa.project_id) FILTER (WHERE pa.role = 'coordinator') AS coords, "
            "max(extract(year FROM p.start_date))::int AS last_year "
            "FROM participations pa "
            "JOIN projects p ON p.id = pa.project_id "
            "JOIN calls c ON c.id = p.call_id "
            "WHERE pa.organisation_id = :org "
            "GROUP BY c.id, family"
        ),
        {"org": organisation_id},
    ).all()
    by_call: dict[int, dict[str, Any]] = {}
    by_family: dict[str, dict[str, Any]] = {}
    for row in rows:
        by_call[row.call_id] = {
            "projects": int(row.projects),
            "coords": int(row.coords),
            "last_year": row.last_year,
            "family": row.family,
        }
        fam = by_family.setdefault(
            row.family, {"projects": 0, "coords": 0, "last_year": None, "call_ids": []}
        )
        fam["projects"] += int(row.projects)
        fam["coords"] += int(row.coords)
        fam["last_year"] = max(fam["last_year"] or 0, row.last_year or 0) or None
        fam["call_ids"].append(row.call_id)
    return {"by_call": by_call, "by_family": by_family}


def _co_participants(session: Session, organisation_id: int, call_ids: list[int]) -> int:
    """Combien d'organisations distinctes ont déjà signé AUX CÔTÉS de
    celle-ci dans ces appels — les partenaires historiques de la
    famille, directement dérivables."""
    return int(
        session.execute(
            text(
                "SELECT count(DISTINCT pa2.organisation_id) "
                "FROM participations pa "
                "JOIN projects p ON p.id = pa.project_id AND p.call_id = ANY(:calls) "
                "JOIN participations pa2 ON pa2.project_id = pa.project_id "
                "WHERE pa.organisation_id = :org AND pa2.organisation_id <> :org"
            ),
            {"org": organisation_id, "calls": call_ids},
        ).scalar()
        or 0
    )


def call_opportunities(session: Session, organisation_id: int) -> dict[str, Any]:
    """Les correspondances STRUCTURELLES organisation ↔ appels vivants.
    Retourne les candidates avec leurs dates BRUTES : l'appelant (la
    couche API) applique la dérivation de statut commune et ne garde que
    ouvert/à venir — la règle « jamais un clos » vit à un seul endroit."""
    stamp = calls_stamp(session)

    def build() -> dict[str, Any]:
        history = _org_history(session, organisation_id)
        if not history["by_call"]:
            return {"candidates": [], "meta": _method_meta()}
        families = _cached_bounded(
            session,
            "callactors:families",
            lambda: _historical_families(session),
            prefix="callactors:",
            cap=OPPS_CACHE_MAX,
        )
        candidates: list[dict[str, Any]] = []
        for topic in _live_topics(session, stamp):
            entry: dict[str, Any] | None = None
            if topic["call_id"] is not None and topic["call_id"] in history["by_call"]:
                # Pont EXACT : déjà financée sous CE code d'appel.
                per_call = history["by_call"][topic["call_id"]]
                entry = {
                    "basis": "exact",
                    "family": per_call["family"],
                    "components": {
                        "projects": per_call["projects"],
                        "coordinations": per_call["coords"],
                        "last_active_year": per_call["last_year"],
                    },
                    "call_ids": [topic["call_id"]],
                }
            else:
                resolved, _refused = resolve_identifier_family(
                    strip_family(topic["identifier"]), families
                )
                fam = history["by_family"].get(resolved) if resolved else None
                if fam and fam["projects"] >= MIN_PROJECTS:
                    entry = {
                        "basis": "identifier_family",
                        "family": resolved,
                        "components": {
                            "projects": fam["projects"],
                            "coordinations": fam["coords"],
                            "last_active_year": fam["last_year"],
                        },
                        "call_ids": fam["call_ids"],
                    }
            if entry:
                entry["topic"] = topic
                candidates.append(entry)
        return {"candidates": candidates, "meta": _method_meta()}

    result = _cached_bounded(
        session,
        f"callopps:{organisation_id}:{stamp}",
        build,
        prefix="callopps:",
        cap=OPPS_CACHE_MAX,
    )
    return result


def decorate_partners(
    session: Session, organisation_id: int, kept: list[dict[str, Any]]
) -> None:
    """La composante co-participants, calculée pour les seules retenues
    (une requête par famille distincte, ≤ MAX_OPPORTUNITIES)."""
    cache: dict[tuple[int, ...], int] = {}
    for entry in kept:
        key = tuple(sorted(entry["call_ids"]))
        if key not in cache:
            cache[key] = _co_participants(session, organisation_id, list(key))
        entry["components"]["co_participants"] = cache[key]


def _method_meta() -> dict[str, Any]:
    return {
        "bases": "pont exact (dès 1 projet) · famille par identifiant (seuil "
        f"{MIN_PROJECTS} projets, résolution et gardes d'E2)",
        "unit": "organisation × projet distinct ; coordination comptée au niveau projet",
        "eligibility": "non évaluée — le portail ne la publie pas en structuré ; un critère inconnu n'est jamais traité comme incompatible",
        "ranking": "tri déclaré : pont exact, puis projets historiques, puis échéance la plus proche — aucun score agrégé (pondération = arbitrage de méthode à venir)",
        "wording": "pertinence historique observée dans le corpus Orion — jamais une garantie d'éligibilité ni un pronostic",
    }
