from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from orion import __version__
from orion.core.db import engine

router = APIRouter()


class HealthCheck(BaseModel):
    status: str
    version: str
    checks: dict[str, str]


@router.get(
    "/health",
    response_model=HealthCheck,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthCheck}},
)
def health(response: Response) -> HealthCheck:
    checks = {"database": "ok"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError:
        checks["database"] = "unreachable"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    if overall != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthCheck(status=overall, version=__version__, checks=checks)
