"""Dénominateurs macro des juridictions (lot R3) — la SOURCE UNIQUE,
comme `constanteuro.py` l'est pour les facteurs de prix.

ECONOMIC SCALE (R0 § D1/D3) rapporte le financement à l'économie d'une
juridiction. Deux concepts en R3, tous deux WDI (CC BY-4.0 vérifié PAR
INDICATEUR le 2026-08-24) :

- `gdp_current_usd` — PIB courant en dollars US (NY.GDP.MKTP.CD).
  Le ratio % PIB se fait en DEVISE COMMUNE USD : numérateur nominal
  EUR × taux annuel BCE (convention ④ généralisée par le pivot USD,
  seul taux couvrant toutes les années pour toutes les juridictions),
  dénominateur PIB courant USD de la même année. Même devise, mêmes
  prix courants, ratio pur — aucune déflation, aucune hypothèse
  Europe : EU, US, FR ou JP passent par le même chemin.
- `population` — habitants (SP.POP.TOTL). Le par-habitant divise la
  valeur RÉELLE (facteur du moteur A) par la population de l'année.

Règles gravées, vérifiées ici et nulle part ailleurs :
- (juridiction, année) absents du dictionnaire = NON CALCULABLE — la
  ligne sort de la somme et se compte dans `excluded` (motifs
  `no_gdp_year` / `no_population_year`), jamais un à-peu-près ;
- lecture de la DERNIÈRE vintage par (juridiction, concept) — une
  révision WDI (elles sont en place chez la source, versionnées chez
  nous) ajoute une vintage, le calcul suit ;
- aucun agrégat maison : l'UE est la série publiée par la source ;
- tout en `Decimal`."""

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

CONCEPTS: tuple[str, ...] = ("gdp_current_usd", "population")


@dataclass(frozen=True)
class MacroSet:
    """Le jeu complet d'UN concept, dernières vintages par juridiction."""

    concept: str
    values: dict[tuple[str, int], Decimal] = field(hash=False)
    series_source: str = "wdi"
    series_code: str = ""
    latest_vintage: str = ""

    @property
    def key(self) -> str:
        """Part de clé de cache : une vintage nouvelle change la clé."""
        return f"{self.concept}|{self.latest_vintage}|{len(self.values)}"


_CACHE: dict[str, MacroSet] = {}
_CACHE_MAX = 4


def macro_set(session: Session, concept: str) -> MacroSet | None:
    """Le jeu complet d'un concept — ou None si rien n'est chargé
    (le mode se refuse, jamais un repli silencieux)."""
    stamp_row = session.execute(
        text(
            "SELECT max(vintage_date), count(*) FROM ("
            "  SELECT jurisdiction_code, max(vintage_date) AS vintage_date"
            "  FROM macro_series WHERE concept = :c GROUP BY jurisdiction_code"
            ") latest"
        ),
        {"c": concept},
    ).one()
    if stamp_row[0] is None:
        return None
    cache_key = f"{concept}|{stamp_row[0].isoformat()}|{stamp_row[1]}"
    hit = _CACHE.get(cache_key)
    if hit is not None:
        return hit

    values: dict[tuple[str, int], Decimal] = {}
    series_code = ""
    latest = ""
    for code, year, value, s_code, vintage in session.execute(
        text(
            "SELECT ms.jurisdiction_code, ms.year, ms.value, ms.series_code, ms.vintage_date"
            " FROM macro_series ms"
            " JOIN (SELECT jurisdiction_code, max(vintage_date) AS v FROM macro_series"
            "       WHERE concept = :c GROUP BY jurisdiction_code) latest"
            "   ON latest.jurisdiction_code = ms.jurisdiction_code AND latest.v = ms.vintage_date"
            " WHERE ms.concept = :c"
        ),
        {"c": concept},
    ):
        if value is None or value <= 0:
            continue
        values[(str(code), int(year))] = Decimal(value)
        series_code = str(s_code)
        latest = max(latest, vintage.isoformat())

    if not values:
        return None
    built = MacroSet(
        concept=concept, values=values, series_code=series_code, latest_vintage=latest
    )
    if len(_CACHE) >= _CACHE_MAX:
        _CACHE.clear()
    _CACHE[cache_key] = built
    return built


def usd_rates(session: Session) -> dict[int, Decimal]:
    """Taux annuels BCE USD-par-EUR — le pivot du ratio % PIB. Une année
    absente rend la ligne non calculable (motif `no_rate_year`)."""
    return {
        int(year): Decimal(rate)
        for year, rate in session.execute(
            text(
                "SELECT year, rate_to_eur FROM exchange_rates"
                " WHERE currency = 'USD' AND rate_to_eur > 0"
            )
        )
    }
