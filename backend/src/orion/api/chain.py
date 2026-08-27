"""La chaîne de l'argent public (lot B1) — le contrat lu par B2.

Chaque nœud est adressé par un identifiant stable (code financeur, id
numérique, code ISO) : URL = vue reproductible, aucun état de
navigation côté serveur. Toute impossibilité a son code d'erreur —
jamais un 200 vide qui ressemble à un zéro.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.search import chain

router = APIRouter()


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="node_not_found")


@router.get("/chain/funder/{code}")
def chain_funder(code: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    try:
        return chain.funder_node(db, code)
    except chain.NodeNotFound as exc:
        raise _not_found() from exc


@router.get("/chain/programme/{programme_id}")
def chain_programme(
    programme_id: int,
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict[str, Any]:
    try:
        return chain.programme_node(db, programme_id, page=page, size=size)
    except chain.NodeNotFound as exc:
        raise _not_found() from exc


@router.get("/chain/call/{call_id}")
def chain_call(
    call_id: int,
    db: Annotated[Session, Depends(get_db)],
    programme: Annotated[int | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict[str, Any]:
    try:
        return chain.call_node(db, call_id, programme_id=programme, page=page, size=size)
    except chain.NodeNotFound as exc:
        raise _not_found() from exc


@router.get("/chain/project/{project_id}")
def chain_project(project_id: int, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    try:
        return chain.project_node(db, project_id)
    except chain.NodeNotFound as exc:
        raise _not_found() from exc


@router.get("/chain/organisation/{organisation_id}")
def chain_organisation(
    organisation_id: int, db: Annotated[Session, Depends(get_db)]
) -> dict[str, Any]:
    try:
        return chain.organisation_node(db, organisation_id)
    except chain.NodeNotFound as exc:
        raise _not_found() from exc


@router.get("/chain/country/{code}")
def chain_country(code: str, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    if len(code) != 2 or not code.isalpha():
        raise HTTPException(status_code=400, detail="country_code_invalid")
    try:
        return chain.country_node(db, code.upper())
    except chain.NodeNotFound as exc:
        raise _not_found() from exc
