"""Le versionnement par vintage (conception § 2.11) : chaque exécution
récupère les jeux complets et ne crée une NOUVELLE vintage que si les
valeurs diffèrent de la vintage courante. Jamais d'UPDATE d'une vintage
existante ; en cas d'échec source, la vintage courante reste en service.

Validation avant écriture — refus propre sinon :
- valeurs strictement positives (déjà refusées au parsing) ;
- années CONTIGUËS sur la plage chargée ;
- couverture minimale du périmètre corpus : EUR ≥ 2007 (premier projet
  libellé en euros), USD ≥ 2004 (bord bas du nominal EUR, audit § 1.2).
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.config import get_settings
from orion.core.db import SessionLocal
from orion.ingest.prices import bls, eurostat
from orion.ingest.runlog import record_run
from orion.models import PriceIndex

SOURCE = "prices"

# (devise, borne minimale exigée) — le périmètre réellement ajustable.
REQUIRED_FROM = {"EUR": 2007, "USD": 2004}


def _validate(currency: str, values: dict[int, float], reference_year: int) -> None:
    if not values:
        raise ValueError(f"{currency}: aucune valeur d'indice reçue")
    years = sorted(values)
    if years != list(range(years[0], years[-1] + 1)):
        raise ValueError(f"{currency}: années non contiguës ({years[0]}–{years[-1]})")
    required_from = REQUIRED_FROM[currency]
    missing = [y for y in range(required_from, reference_year + 1) if y not in values]
    if missing:
        raise ValueError(f"{currency}: couverture insuffisante, années manquantes {missing}")


def _current_vintage(session: Session, currency: str) -> dict[int, Decimal]:
    rows = session.execute(
        text(
            "SELECT year, value FROM price_indices "
            "WHERE currency = :c AND vintage_date = "
            "  (SELECT max(vintage_date) FROM price_indices WHERE currency = :c)"
        ),
        {"c": currency},
    )
    return {int(year): Decimal(value) for year, value in rows}


def _store(
    session: Session,
    currency: str,
    values: dict[int, float],
    series_source: str,
    series_code: str,
) -> bool:
    """Écrit une nouvelle vintage si les valeurs diffèrent — idempotent."""
    fresh = {
        year: Decimal(str(value)).quantize(Decimal("0.0001")) for year, value in values.items()
    }
    if fresh == _current_vintage(session, currency):
        return False
    vintage = date.today()
    # Rejouer le chargeur le même jour après une divergence remplace la
    # vintage DU JOUR (jamais une vintage antérieure) : l'unicité
    # (devise, année, vintage) l'exige, et un correctif intrajournalier
    # ne doit pas fabriquer deux vintages du même jour.
    session.execute(
        text("DELETE FROM price_indices WHERE currency = :c AND vintage_date = :v"),
        {"c": currency, "v": vintage},
    )
    session.add_all(
        PriceIndex(
            currency=currency,
            year=year,
            value=value,
            series_source=series_source,
            series_code=series_code,
            vintage_date=vintage,
        )
        for year, value in sorted(fresh.items())
    )
    return True


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — toujours re-vérifié, c'est minuscule
    reference_year = get_settings().constant_euro_reference_year
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            hicp = eurostat.fetch()
            _validate("EUR", hicp, reference_year)
            cpiu = bls.fetch(until_year=reference_year)
            _validate("USD", cpiu, reference_year)
            if _store(session, "EUR", hicp, eurostat.SERIES_SOURCE, eurostat.SERIES_CODE):
                stats.add("eur_vintage")
            stats.add("eur_years", len(hicp))
            if _store(session, "USD", cpiu, bls.SERIES_SOURCE, bls.SERIES_CODE):
                stats.add("usd_vintage")
            stats.add("usd_years", len(cpiu))
            session.commit()
        finally:
            session.close()
    return stats.counts
