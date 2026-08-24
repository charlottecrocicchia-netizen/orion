"""Chargeur des séries macro WDI (lot R3) — même discipline de vintage
que les indices de prix : chaque exécution récupère les jeux complets
et ne crée une NOUVELLE vintage par (juridiction, concept) que si les
valeurs diffèrent. Jamais d'UPDATE d'une vintage existante ; en cas
d'échec source, la vintage courante reste en service.

Source : API World Bank v2 (World Development Indicators, CC BY-4.0
vérifié PAR INDICATEUR le 2026-08-24 — License_Type des métadonnées).
Le WDI révise EN PLACE et republie trimestriellement : le versionnement
côté Orion est la condition de rejouabilité.

Deux concepts R3 :
- `gdp_current_usd` ← NY.GDP.MKTP.CD (PIB courant, US$) ;
- `population`      ← SP.POP.TOTL.

Périmètre : les juridictions du référentiel (`jurisdictions`) connues
du WDI — l'agrégat Union européenne est la série publiée par la source
(iso2 « EU »), jamais une somme maison. Les juridictions hors WDI
(Taïwan, micro-territoires) restent sans série : leurs lignes se
comptent en exclusions dynamiques à l'affichage, jamais approximées.

Validation avant écriture — refus propre sinon : valeurs strictement
positives ; les TROUS d'années sont admis (contrairement aux indices de
prix) : une année macro absente est un fait de la source, dit à
l'écran par les motifs `no_gdp_year` / `no_population_year`."""

import time
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.runlog import record_run
from orion.models import MacroSeries

SOURCE = "macro"
SERIES_SOURCE = "wdi"
INDICATORS = {
    "gdp_current_usd": "NY.GDP.MKTP.CD",
    "population": "SP.POP.TOTL",
}
API = "https://api.worldbank.org/v2"
FROM_YEAR = 1990
TIMEOUT = 60.0


def _get_with_retry(client: httpx.Client, url: str, params: dict) -> httpx.Response:
    """Trois tentatives, backoff court : ~500 petites requêtes traversent
    forcément un aléa réseau de temps en temps — l'échec APRÈS retries
    reste bruyant (run failed, la vintage courante reste en service)."""
    last: Exception | None = None
    for attempt in range(3):
        try:
            return client.get(url, params=params)
        except httpx.TransportError as error:  # timeout, reset, DNS…
            last = error
            time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def _wdi_known(client: httpx.Client) -> set[str]:
    """Les iso2 que le WDI connaît — une juridiction hors de cette liste
    n'est pas demandée (l'API refuse la requête entière sinon)."""
    known: set[str] = set()
    page = 1
    while True:
        payload = client.get(
            f"{API}/country", params={"format": "json", "per_page": 300, "page": page}
        ).json()
        known |= {entry["iso2Code"] for entry in payload[1]}
        if page >= payload[0]["pages"]:
            return known
        page += 1


def fetch(concept: str, codes: list[str]) -> dict[str, dict[int, float]]:
    """Le jeu complet d'un indicateur pour les juridictions demandées :
    {juridiction: {année: valeur}} — valeurs nulles ou ≤ 0 écartées au
    parsing (la validation de couverture tranche en aval).

    UNE requête PAR juridiction : le WAF de la Banque mondiale bloque
    certaines simples séquences de codes dans les listes semi-colonées
    (mesuré le 2026-08-24 : « LR;LS » → 403) — la requête unitaire est
    déterministe et immune, et ce geste est annuel."""
    indicator = INDICATORS[concept]
    out: dict[str, dict[int, float]] = {}
    with httpx.Client(timeout=TIMEOUT) as client:
        known = _wdi_known(client)
        for code in codes:
            if code not in known:
                continue
            response = _get_with_retry(
                client,
                f"{API}/country/{code}/indicator/{indicator}",
                {
                    "format": "json",
                    "per_page": 200,
                    "date": f"{FROM_YEAR}:{date.today().year}",
                },
            )
            if response.status_code != 200:
                raise ValueError(f"{concept}/{code}: WDI a répondu {response.status_code}")
            payload = response.json()
            if len(payload) < 2 or payload[1] is None:
                continue  # juridiction connue mais sans série pour cet indicateur
            for row in payload[1]:
                value = row["value"]
                if value is None or value <= 0:
                    continue
                out.setdefault(code, {})[int(row["date"])] = float(value)
    return out


def _current_vintage(session: Session, code: str, concept: str) -> dict[int, Decimal]:
    rows = session.execute(
        text(
            "SELECT year, value FROM macro_series "
            "WHERE jurisdiction_code = :j AND concept = :c AND vintage_date = "
            "  (SELECT max(vintage_date) FROM macro_series"
            "   WHERE jurisdiction_code = :j AND concept = :c)"
        ),
        {"j": code, "c": concept},
    )
    return {int(year): Decimal(value) for year, value in rows}


def _store(session: Session, code: str, concept: str, values: dict[int, float]) -> bool:
    """Écrit une nouvelle vintage si les valeurs diffèrent — idempotent.
    Rejouer le même jour après divergence remplace la vintage DU JOUR."""
    if not values:
        return False
    if any(value <= 0 for value in values.values()):
        raise ValueError(f"{code}/{concept}: valeur non positive reçue")
    fresh = {
        year: Decimal(str(value)).quantize(Decimal("0.0001")) for year, value in values.items()
    }
    if fresh == _current_vintage(session, code, concept):
        return False
    vintage = date.today()
    session.execute(
        text(
            "DELETE FROM macro_series WHERE jurisdiction_code = :j AND concept = :c"
            " AND vintage_date = :v"
        ),
        {"j": code, "c": concept, "v": vintage},
    )
    session.add_all(
        MacroSeries(
            jurisdiction_code=code,
            concept=concept,
            year=year,
            value=value,
            series_source=SERIES_SOURCE,
            series_code=INDICATORS[concept],
            vintage_date=vintage,
        )
        for year, value in sorted(fresh.items())
    )
    return True


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — toujours re-vérifié
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            codes = [
                str(code)
                for (code,) in session.execute(text("SELECT code FROM jurisdictions ORDER BY code"))
            ]
            if not codes:
                raise ValueError(
                    "aucune juridiction seedée — lancer orion-ingest reference d'abord"
                )
            for concept in INDICATORS:
                sets = fetch(concept, codes)
                fresh_vintages = 0
                years_total = 0
                for code, values in sorted(sets.items()):
                    if _store(session, code, concept, values):
                        fresh_vintages += 1
                    years_total += len(values)
                stats.add(f"{concept}_jurisdictions", len(sets))
                stats.add(f"{concept}_years", years_total)
                stats.add(f"{concept}_vintages", fresh_vintages)
            session.commit()
        finally:
            session.close()
    return stats.counts
