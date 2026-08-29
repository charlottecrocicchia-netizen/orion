"""Lecture d'un document SEDIA → ligne `call_topics`.

Les métadonnées SEDIA enveloppent presque tout dans des listes (une
valeur = liste d'un élément) ; les lecteurs `_one`/`_many` absorbent les
deux formes. Aucune valeur n'est inventée : un champ absent reste NULL.
"""

import json
from datetime import datetime
from typing import Any
from urllib.parse import unquote

from orion.ingest.ft_calls.sanitize import sanitize_html

SOURCE = "ft-portal"

# Codes de statut SEDIA, vérifiés par la FACET API le 2026-08-22. Le
# libellé accompagne le code en base ; l'affichage produit dérive des
# dates et garde ce fait source visible en provenance.
STATUS_LABELS = {
    "31094501": "Forthcoming",
    "31094502": "Open for submission",
    "31094503": "Closed",
}


def _one(metadata: dict[str, Any], key: str) -> Any:
    value = metadata.get(key)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _many(metadata: dict[str, Any], key: str) -> list[Any] | None:
    value = metadata.get(key)
    if value is None:
        return None
    if isinstance(value, list):
        return value or None
    return [value]


def parse_instant(value: str | None) -> datetime | None:
    """Un instant SEDIA (`2026-09-22T00:00:00.000+0000`) → datetime UTC."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _topic_budget(
    identifier: str, overview: dict[str, Any] | None
) -> tuple[float | None, float | None, int | None]:
    """Contribution min/max et subventions attendues POUR CE TOPIC.

    `budgetTopicActionMap` liste les actions de tout l'appel ; seules
    celles dont le nom commence par l'identifiant du topic le
    concernent. Rien ne matche → NULL, jamais un zéro."""
    if not overview:
        return None, None, None
    mins: list[float] = []
    maxs: list[float] = []
    grants = 0
    prefix = identifier.upper()
    for actions in (overview.get("budgetTopicActionMap") or {}).values():
        for action in actions or []:
            name = str(action.get("action") or "")
            if not name.upper().startswith(prefix):
                continue
            # Un 0 de la source est un « non renseigné », pas une
            # fourchette : seules les contributions positives comptent.
            if (
                isinstance(action.get("minContribution"), int | float)
                and action["minContribution"] > 0
            ):
                mins.append(float(action["minContribution"]))
            if (
                isinstance(action.get("maxContribution"), int | float)
                and action["maxContribution"] > 0
            ):
                maxs.append(float(action["maxContribution"]))
            if isinstance(action.get("expectedGrants"), int):
                grants += action["expectedGrants"]
    return (
        min(mins) if mins else None,
        max(maxs) if maxs else None,
        grants or None,
    )


def parse_topic(result: dict[str, Any]) -> dict[str, Any] | None:
    """Un document SEDIA → dict prêt pour l'upsert, ou None si inutilisable."""
    metadata = result.get("metadata") or {}
    identifier = _one(metadata, "identifier")
    if not identifier:
        return None

    overview = None
    raw_overview = _one(metadata, "budgetOverview")
    if raw_overview:
        try:
            overview = json.loads(raw_overview) if isinstance(raw_overview, str) else raw_overview
        except ValueError:
            overview = None
    budget_min, budget_max, expected_grants = _topic_budget(str(identifier), overview)

    status_code = _one(metadata, "status")
    status_code = str(status_code) if status_code is not None else None

    deadline_dates = [
        instant.isoformat()
        for value in (_many(metadata, "deadlineDate") or [])
        if (instant := parse_instant(value)) is not None
    ]

    return {
        "source": SOURCE,
        "source_id": str(identifier),
        "reference": result.get("reference"),
        "identifier": str(identifier),
        "title": _one(metadata, "title"),
        "call_code": _one(metadata, "callIdentifier"),
        "framework_programme_code": str(_one(metadata, "frameworkProgramme") or "") or None,
        "status_code": status_code,
        "status_label": STATUS_LABELS.get(status_code or ""),
        "opening_date": parse_instant(_one(metadata, "startDate")),
        "deadline_dates": deadline_dates or None,
        "deadline_model": _one(metadata, "deadlineModel"),
        "types_of_action": _many(metadata, "typesOfAction"),
        "keywords": _many(metadata, "keywords"),
        "tags": _many(metadata, "tags"),
        "cross_cutting": _many(metadata, "crossCuttingPriorities"),
        "budget_min_eur": budget_min,
        "budget_max_eur": budget_max,
        "expected_grants": expected_grants,
        "budget_overview": overview,
        "description_html": sanitize_html(_one(metadata, "descriptionByte")),
        "conditions_html": sanitize_html(_one(metadata, "topicConditions")),
        "url": result.get("url") or _one(metadata, "url"),
        "raw": {"metadata": metadata, "reference": result.get("reference")},
    }


def framework_labels(facet_payload: dict[str, Any]) -> dict[str, str]:
    """FACET API → {code de programme-cadre: libellé}."""
    labels: dict[str, str] = {}
    for facet in facet_payload.get("facets") or []:
        if facet.get("rawName") != "frameworkProgramme":
            continue
        for entry in facet.get("values") or []:
            code = str(entry.get("rawValue") or "")
            label = entry.get("value")
            if code and label:
                # La FACET encode ses libellés en URL (« Coal %26 Steel ») —
                # décodés avant d'entrer en base.
                labels[code] = unquote(str(label))
    return labels
