"""Le registre de couverture — dire l'assiette, jamais corriger le chiffre.

Lot E (2026-08-17), conçu dans docs/conception-couverture.md. Règle
fondatrice : **plus jamais un écran où l'absence de données se fait
passer pour un zéro.**

Trois classes, DÉRIVÉES de ce qui est réellement chargé — aucune prose à
maintenir, aucune liste à tenir à jour à la main :

- `funders`        : au moins un bailleur chargé finance EN PROPRE ce
                     pays (la Commission pour les membres et associés,
                     NIH/NSF pour les États-Unis) ;
- `participations` : le pays n'apparaît que par ses participations aux
                     consortiums d'un bailleur étranger — son budget
                     domestique est INVISIBLE chez nous, pas nul ;
- `none`           : aucune donnée du tout.

La table `funders` sait qui est chargé ; `FUNDER_COVERAGE` dit quels pays
chaque bailleur couvre en propre. Charger UKRI demain, c'est ajouter une
ligne — et TOUTES les surfaces changent ensemble.
"""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.ingest.reference import EU_MEMBERS
from orion.search.service import _cached

# Les pays « associés » aux programmes-cadres : la Commission finance
# leurs bénéficiaires en propre, comme un membre (liste des accords
# d'association Horizon Europe, vérifiée à la source).
EC_ASSOCIATED = {
    "NO", "IS", "LI", "CH", "GB", "IL", "TR", "UA", "MD", "RS", "AL",
    "BA", "ME", "MK", "XK", "GE", "AM", "FO", "TN", "NZ", "CA",
}  # fmt: skip

# Qui couvre quoi, EN PROPRE. Un bailleur absent de la table `funders`
# (pas encore chargé) ne couvre rien : la classe suit le réel.
FUNDER_COVERAGE: dict[str, set[str]] = {
    "ec": EU_MEMBERS | EC_ASSOCIATED,
    "nih": {"US"},
    "nsf": {"US"},
    "ademe": {"FR"},
}

CLASSES = ("funders", "participations", "none")


def coverage_map(session: Session) -> dict[str, str]:
    """code pays → classe de couverture. Cache par tampon d'ingestion,
    comme le reste de la couche recherche."""

    def build() -> dict[str, str]:
        loaded = {
            row[0]
            for row in session.execute(
                text("SELECT DISTINCT f.code FROM funders f JOIN projects p ON p.funder_id = f.id")
            )
        }
        covered: set[str] = set()
        for code in loaded:
            covered |= FUNDER_COVERAGE.get(code, set())
        seen = {
            row[0]
            for row in session.execute(
                text(
                    "SELECT DISTINCT country_code FROM participations "
                    "WHERE country_code IS NOT NULL"
                )
            )
        }
        all_countries = {row[0] for row in session.execute(text("SELECT code FROM countries"))}
        classes: dict[str, str] = {}
        for code in all_countries:
            if code in covered:
                classes[code] = "funders"
            elif code in seen:
                classes[code] = "participations"
            else:
                classes[code] = "none"
        return classes

    return _cached(session, "coverage_map", build)


def funders_by_country(session: Session) -> dict[str, list[str]]:
    """code pays → noms des bailleurs qui le couvrent EN PROPRE (chargés
    seulement). C'est ce qui rend la phrase concrète : « NIH, NSF »
    plutôt que « partiellement couvert »."""

    def build() -> dict[str, list[str]]:
        loaded = {
            row[0]: row[1]
            for row in session.execute(
                text(
                    "SELECT DISTINCT f.code, f.name FROM funders f "
                    "JOIN projects p ON p.funder_id = f.id"
                )
            )
        }
        out: dict[str, list[str]] = {}
        for code, name in loaded.items():
            for country in FUNDER_COVERAGE.get(code, set()):
                out.setdefault(country, []).append(name)
        return {country: sorted(names) for country, names in out.items()}

    return _cached(session, "coverage_funders", build)


def coverage_mix(session: Session, countries: list[str]) -> dict[str, Any]:
    """Le mélange de classes d'une VUE : ce qui déclenche (ou non) la
    phrase d'honnêteté. Une vue homogène n'a rien à confesser."""
    classes = coverage_map(session)
    present = {classes.get(code, "none") for code in countries if code}
    return {
        "classes": sorted(present),
        "mixed": len(present) > 1,
    }
