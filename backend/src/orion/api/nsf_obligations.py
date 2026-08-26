"""Surface dédiée `Share of NSF award obligations` (lot R5B).

Métrique indépendante — PAS un mode du Reference Engine (R5A § 19.3) :
pas de `value=`, pas d'entrée dans « View funding as ». Le contrat URL
(§ 19.4) est étanche : l'axe temporel s'écrit `fy=` (exercice fédéral
d'obligation) et `time=` est REJETÉ ici, jamais réinterprété — comme
`fy=` n'existe sur aucune autre surface. Jamais d'empty 200 qui
ressemble à un zéro : chaque impossibilité a son code.
"""

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.search import nsfobligations

router = APIRouter()

_FY = re.compile(r"^(\d{4})(?:\.\.(\d{4}))?$")

# Paramètres d'autres mondes, rejetés explicitement (contrat § 19.4) —
# la présence de `time=` ou d'un `source` non-NSF est une erreur, pas
# une normalisation silencieuse.
_FOREIGN_PARAMS = ("time", "value", "base", "cur", "perspective")


def _reject_foreign_params(request: Request) -> None:
    for name in _FOREIGN_PARAMS:
        if name in request.query_params:
            raise HTTPException(status_code=400, detail=f"{name}_not_supported_on_this_surface")
    source = request.query_params.get("source")
    if source is not None and source.lower() != "nsf":
        raise HTTPException(status_code=400, detail="nsf_only_surface")


def _parse_fy(raw: str) -> list[int]:
    match = _FY.match(raw)
    if not match:
        raise HTTPException(status_code=400, detail="fy_invalid")
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else start
    if not (2000 <= start <= 2100 and start <= end <= 2100):
        raise HTTPException(status_code=400, detail="fy_invalid")
    return list(range(start, end + 1))


@router.get("/nsf-obligations/meta")
def nsf_obligations_meta(
    request: Request, db: Annotated[Session, Depends(get_db)]
) -> dict[str, Any]:
    """Les FY que la surface peut offrir — jamais un FY qui refuserait."""
    _reject_foreign_params(request)
    return nsfobligations.fiscal_years(db)


@router.get("/nsf-obligations/aggregate")
def nsf_obligations_aggregate(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    fy: Annotated[str | None, Query()] = None,
    by: Annotated[str, Query()] = "fy",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    _reject_foreign_params(request)
    if fy is None:
        raise HTTPException(status_code=400, detail="fy_required")
    fys = _parse_fy(fy)
    if by not in nsfobligations.DIMENSIONS:
        raise HTTPException(status_code=400, detail="dimension_not_supported")
    try:
        return nsfobligations.aggregate(db, fys=fys, by=by, limit=limit)
    except nsfobligations.FyCoverageBelowThreshold as exc:
        raise HTTPException(status_code=422, detail="fy_coverage_below_threshold") from exc
    except nsfobligations.FyUnavailable as exc:
        detail = "nsf_obligations_unavailable" if str(exc) == "no_vintage" else "fy_unavailable"
        raise HTTPException(status_code=422, detail=detail) from exc
