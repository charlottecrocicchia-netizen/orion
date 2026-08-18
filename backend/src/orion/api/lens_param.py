"""Le refus unifié de lentille (M1.2, validé fondatrice 2026-08-18).

Une règle UNIQUE sur toutes les surfaces qui comprennent le paramètre :

- absent                       → vue non cadrée ;
- exactement UNE valeur publiée → vue cadrée ;
- inconnue, draft, retirée, vide ou multiple → refus explicite (400).

Jamais de repli silencieux vers le corpus : un `sector` invalide qui
retomberait sur 700 000 projets serait un lien qui ment sur ce qu'il
montre (U2).

Le corps du refus ne dit JAMAIS pourquoi la lentille est refusée — un
draft est « indisponible », pas « en préparation » — et ne liste jamais
les slugs valides. Seul `reason: multiple_values` est exposé : c'est un
fait de syntaxe, pas un secret du registre.

U5 strict : la validation lit TOUTES les occurrences du paramètre.
`sector=x&sector=y` est refusé, jamais réduit à la première ni à la
dernière valeur — répondre à une seule des deux, c'est répondre à une
autre question que celle du lien.
"""

from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from orion.search.service import valid_sector

LENS_PARAM = "sector"


def _refuse(detail: dict[str, Any]) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": "INVALID_LENS", **detail})


def resolve_lens_param(request: Request, db: Session, value: str | None) -> str | None:
    """La lentille de cette requête, ou une 400 structurée. Ne renvoie
    jamais None pour une valeur refusée — c'est tout le point du lot."""
    occurrences = request.query_params.getlist(LENS_PARAM)
    if not occurrences:
        return None
    if len(occurrences) > 1:
        raise _refuse({"parameter": LENS_PARAM, "reason": "multiple_values"})
    if not value or not valid_sector(db, value):
        raise _refuse({"parameter": LENS_PARAM, "value": value or ""})
    return value
