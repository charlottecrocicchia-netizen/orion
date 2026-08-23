"""HICP Eurostat — l'indice annuel moyen de la zone euro (devise EUR).

API de dissémination JSON-stat, dataset `prc_hicp_aind`, filtres
`unit=INX_A_AVG` (indice, moyenne annuelle, base 2015=100),
`coicop=CP00` (tous articles), `geo=EA` (zone euro à composition
courante). Réutilisation CC-BY 4.0 — l'attribution vit dans la
méthodologie affichée à l'écran."""

import httpx

SERIES_SOURCE = "eurostat"
SERIES_CODE = "prc_hicp_aind"
URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    "prc_hicp_aind"
)
PARAMS = {"format": "JSON", "unit": "INX_A_AVG", "coicop": "CP00", "geo": "EA", "lang": "EN"}


def fetch() -> dict[int, float]:
    """{année → valeur d'indice} — parsing strict, refus propre sinon."""
    response = httpx.get(URL, params=PARAMS, timeout=60)
    response.raise_for_status()
    payload = response.json()
    time_index: dict[str, int] = payload["dimension"]["time"]["category"]["index"]
    values: dict[str, float] = payload["value"]
    out: dict[int, float] = {}
    for period, position in time_index.items():
        value = values.get(str(position))
        if value is None or not period.isdigit():
            continue
        if float(value) <= 0:
            raise ValueError(f"HICP {period}: valeur non positive {value!r}")
        out[int(period)] = float(value)
    return out
