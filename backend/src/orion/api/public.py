"""Le strict nécessaire public de la landing (pivot du 2026-08-22).

Un SEUL endpoint, un payload qui se lit d'un coup d'œil — chaque champ
est une décision de publication délibérée :

- `totals` : les totaux du corpus (le chiffre du hero) ;
- `funding_by_year` : la série annuelle agrégée — la courbe du hero,
  aucune maille en dessous de l'année ;
- `lenses` : la carte de visite des lentilles publiées (slug, version,
  comptes cœur/habilitant) — ce que la landing présente en verres ;
- `coverage` : les pays COUVERTS (code, nom, région) — la teinte du
  globe, AUCUN montant par pays.

Rien qui se fouille (pas de recherche), rien qui se liste (pas
d'entités), rien qui se suit (pas de dates d'ingestion).
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from orion.core.db import get_db
from orion.search import aggregates

router = APIRouter()


@router.get("/public/overview")
def overview(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    stats = aggregates.global_stats(db)
    countries = aggregates.countries_index(db)
    return {
        "totals": stats["totals"],
        "funding_by_year": stats.get("funding_by_year", []),
        "lenses": [
            {
                "slug": lens["slug"],
                "rank": lens["rank"],
                "version": lens["version"],
                "core": lens["core"],
                "enabling": lens["enabling"],
            }
            for lens in stats.get("lenses", [])
        ],
        "coverage": [
            {"code": c["code"], "name": c["name"], "region": c.get("region")} for c in countries
        ],
    }
