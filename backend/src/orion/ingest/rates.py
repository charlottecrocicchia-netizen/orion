"""ECB yearly average exchange rates — the transverse currency brick.

Convention ④ of the registry: a source keeps its native amount, and the
EUR figure is converted at the ECB annual average rate of the project's
start year. This loader fills `exchange_rates` for every currency the
corpus will meet (USD with NIH, then GBP/CHF/SEK/NOK/DKK with UKRI,
SNSF, Vinnova…) so the rule needs no second discussion per source.

Source: ECB Data Portal (data-api.ecb.europa.eu), series
EXR.A.<CCY>.EUR.SP00.A — free reuse with attribution."""

import csv
import io

import httpx

from orion.core.db import SessionLocal
from orion.ingest.runlog import record_run
from orion.ingest.upsert import upsert
from orion.models import ExchangeRate

SOURCE = "ecb"
BASE_URL = "https://data-api.ecb.europa.eu/service/data/EXR"
FROM_YEAR = 2004

# Every currency the wave-1 sources will bring; adding one is one line.
CURRENCIES = ("USD", "GBP", "CHF", "SEK", "NOK", "DKK", "CAD", "JPY", "AUD")


def fetch_rates(currency: str) -> list[dict[str, object]]:
    """Yearly averages for one currency: OBS_VALUE is <currency> per EUR."""
    response = httpx.get(
        f"{BASE_URL}/A.{currency}.EUR.SP00.A",
        params={"format": "csvdata", "startPeriod": str(FROM_YEAR)},
        timeout=60,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    rows: list[dict[str, object]] = []
    for row in csv.DictReader(io.StringIO(response.text)):
        period = (row.get("TIME_PERIOD") or "").strip()
        value = (row.get("OBS_VALUE") or "").strip()
        if not period.isdigit() or not value:
            continue
        try:
            rate = float(value)
        except ValueError:
            continue
        if rate <= 0:
            continue
        rows.append(
            {
                "currency": currency,
                "year": int(period),
                "rate_to_eur": rate,
                "source": SOURCE,
            }
        )
    return rows


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — always refreshed, it is tiny
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            for currency in CURRENCIES:
                rows = fetch_rates(currency)
                if not rows:
                    stats.add(f"missing_{currency.lower()}")
                    continue
                upsert(
                    session,
                    ExchangeRate,
                    rows,
                    conflict_cols=["currency", "year"],
                    update_cols=["rate_to_eur", "source"],
                )
                stats.add("rates", len(rows))
            session.commit()
        finally:
            session.close()
    return stats.counts
