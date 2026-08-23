"""CPI-U BLS — l'indice annuel moyen des États-Unis (devise USD).

API publique v2 (POST JSON), série `CUUR0000SA0` (all items, US city
average, non désaisonnalisé — base 1982-84=100). Sans clé, l'API borne
chaque requête à 10 ans : on fenêtre. La moyenne annuelle publiée
(période M13) arrive quand le service la donne ; sinon elle se
recalcule comme le BLS la définit — la moyenne arithmétique des douze
mois — et une année incomplète est refusée, jamais approximée.
Production fédérale américaine : domaine public."""

import httpx

SERIES_SOURCE = "bls"
SERIES_CODE = "CUUR0000SA0"
URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
FROM_YEAR = 1996
WINDOW = 10
MONTHS_IN_YEAR = 12


def _window(start: int, end: int) -> dict[int, float]:
    response = httpx.post(
        URL,
        json={
            "seriesid": [SERIES_CODE],
            "startyear": str(start),
            "endyear": str(end),
            "annualaverage": True,
        },
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "REQUEST_SUCCEEDED":
        raise ValueError(f"BLS: {payload.get('status')}: {payload.get('message')}")
    annual: dict[int, float] = {}
    monthly: dict[int, list[float]] = {}
    for row in payload["Results"]["series"][0]["data"]:
        year, period = int(row["year"]), row["period"]
        raw = str(row["value"]).strip()
        try:
            value = float(raw)
        except ValueError:
            # « - » : période non encore publiée chez BLS — on l'ignore,
            # la validation de couverture tranchera en aval.
            continue
        if value <= 0:
            raise ValueError(f"CPI-U {year}/{period}: valeur non positive {value!r}")
        if period == "M13":
            annual[year] = value
        elif period.startswith("M"):
            monthly.setdefault(year, []).append(value)
    for year, months in monthly.items():
        if year not in annual and len(months) == MONTHS_IN_YEAR:
            annual[year] = sum(months) / MONTHS_IN_YEAR
    return annual


def fetch(until_year: int) -> dict[int, float]:
    """{année → indice annuel moyen}, de FROM_YEAR à `until_year`."""
    out: dict[int, float] = {}
    start = FROM_YEAR
    while start <= until_year:
        end = min(start + WINDOW - 1, until_year)
        out.update(_window(start, end))
        start = end + 1
    return out
