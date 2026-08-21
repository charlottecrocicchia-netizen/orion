"""Le dossier durable (D5, la capacité du lot 1) : « garder » = POSTer
les items du dossier de session TELS QUELS — le format localStorage
([dossier.ts](../frontend/src/lib/dossier.ts)) EST le schéma serveur.

Pas d'éditeur serveur au lot 1 : un dossier gardé s'ouvre en lecture ;
« reprendre » recharge ses items dans le navigateur, re-garder crée un
NOUVEL objet (verrou 4 : jamais d'écrasement silencieux).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.auth.deps import current_user, require_same_origin
from orion.auth.service import membership_role
from orion.core.db import get_db
from orion.models.accounts import Dossier, User

router = APIRouter()

MAX_ITEMS = 200


class DossierItemBody(BaseModel):
    id: str = Field(max_length=100)
    # La vue EST une URL : les params de l'explorateur, rien d'autre.
    params: str = Field(max_length=2000)
    title: str = Field(max_length=500)
    note: str = Field(default="", max_length=5000)
    addedAt: str = Field(default="", max_length=40)


class KeepBody(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    items: list[DossierItemBody] = Field(min_length=1, max_length=MAX_ITEMS)


def _require_member(db: Session, user: User, workspace_id: int) -> None:
    if membership_role(db, user, workspace_id) is None:
        # 403 sobre : l'URL d'un objet d'équipe refuse l'étranger sans
        # rien décrire de ce qu'elle protège.
        raise HTTPException(status_code=403, detail={"error": "FORBIDDEN"})


@router.post("/workspaces/{workspace_id}/dossiers", status_code=201)
def keep_dossier(
    workspace_id: int,
    body: KeepBody,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict:
    _require_member(db, user, workspace_id)
    dossier = Dossier(
        workspace_id=workspace_id,
        title=body.title.strip(),
        items=[item.model_dump() for item in body.items],
        created_by=user.id,
    )
    db.add(dossier)
    db.commit()
    return {"id": dossier.id}


@router.get("/workspaces/{workspace_id}/dossiers")
def list_dossiers(
    workspace_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    _require_member(db, user, workspace_id)
    rows = db.scalars(
        select(Dossier)
        .where(Dossier.workspace_id == workspace_id)
        .order_by(Dossier.created_at.desc())
    ).all()
    return {
        "dossiers": [
            {
                "id": d.id,
                "title": d.title,
                "created_at": d.created_at.isoformat(),
                "items_count": len(d.items),
            }
            for d in rows
        ]
    }


@router.get("/workspaces/{workspace_id}/dossiers/{dossier_id}")
def get_dossier(
    workspace_id: int,
    dossier_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    _require_member(db, user, workspace_id)
    dossier = db.get(Dossier, dossier_id)
    if dossier is None or dossier.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND"})
    return {
        "id": dossier.id,
        "title": dossier.title,
        "created_at": dossier.created_at.isoformat(),
        "items": dossier.items,
    }


@router.delete("/workspaces/{workspace_id}/dossiers/{dossier_id}", status_code=204)
def delete_dossier(
    workspace_id: int,
    dossier_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> None:
    _require_member(db, user, workspace_id)
    dossier = db.get(Dossier, dossier_id)
    if dossier is None or dossier.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND"})
    db.delete(dossier)
    db.commit()
