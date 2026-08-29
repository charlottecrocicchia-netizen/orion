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

import logging
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# PURCHASING POWER (lot R4B) — le couple, dans l'ordre numérateur puis
# dénominateur. Il ne se lit JAMAIS concept par concept : voir
# `ppp_ratio_set()`.
PPP_CONCEPTS: tuple[str, str] = ("gdp_ppp_current_intl", "gdp_current_usd")
PPP_SERIES: dict[str, str] = {
    "gdp_ppp_current_intl": "wdi:NY.GDP.MKTP.PP.CD",
    "gdp_current_usd": "wdi:NY.GDP.MKTP.CD",
}


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
_PPP_CACHE: dict[str, "PppRatioSet"] = {}
_CACHE_MAX = 8


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
    built = MacroSet(concept=concept, values=values, series_code=series_code, latest_vintage=latest)
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


@dataclass(frozen=True)
class PppRatioSet:
    """Le jeu des ratios de pouvoir d'achat, prêt à joindre.

    `ratios[(pays, année)] = PIB_PPP_courant / PIB_courant_USD`, lu du
    couple publié et de lui seul — jamais reconstruit depuis un facteur
    PPP ou un taux de change (doc § 3.6).

    `covered` distingue les deux motifs d'exclusion qui se ressemblent :
    une juridiction ABSENTE de `covered` n'a le couple sur AUCUNE année
    (`no_jurisdiction_series`) ; une juridiction présente mais sans ratio
    pour l'année cadrée a le couple ailleurs (`no_reference_year`).
    Confondre les deux produirait le libellé mensonger que la porte § 5
    de R4B a précisément écarté."""

    ratios: dict[tuple[str, int], Decimal] = field(hash=False)
    covered: frozenset[str] = frozenset()
    years: frozenset[int] = frozenset()
    vintages: dict[str, str] = field(default_factory=dict, hash=False)

    @property
    def series(self) -> dict[str, str]:
        return dict(PPP_SERIES)

    @property
    def key(self) -> str:
        """Part de clé de cache d'agrégat. `_data_stamp` n'observe pas la
        source `macro` : cette clé est le SEUL vecteur d'invalidation
        après un rechargement WDI — d'où les deux millésimes ET le
        cardinal."""
        stamp = ",".join(f"{c}@{self.vintages.get(c, '')}" for c in PPP_CONCEPTS)
        return f"ppp|{stamp}|{len(self.ratios)}"


def ppp_ratio_set(session: Session) -> PppRatioSet | None:
    """Le couple, lu à vintage ALIGNÉE par juridiction — ou rien.

    Deux refus, aucun silence :
    - une année qui n'a pas son homologue sort du dictionnaire (la ligne
      se comptera en `no_reference_year` à l'affichage) ;
    - une juridiction dont les deux dernières vintages DIFFÈRENT fait
      échouer la construction entière. C'est un défaut de chargement,
      pas un cas d'exécution : le mode devient indisponible et les
      juridicions fautives partent au journal. Servir un numérateur et
      un dénominateur de deux éditions de la source serait pire qu'un
      refus.

    L'invariant porte sur l'INTERSECTION des deux concepts : une
    juridiction qui n'en publie qu'un (une poignée d'économies) n'est pas
    une faute — la faire échouer mettrait le mode en refus mondial."""
    stamp_rows = session.execute(
        text(
            "SELECT jurisdiction_code, concept, max(vintage_date) FROM macro_series"
            " WHERE concept = ANY(:cs) GROUP BY jurisdiction_code, concept"
        ),
        {"cs": list(PPP_CONCEPTS)},
    ).all()
    if not stamp_rows:
        return None

    latest: dict[str, dict[str, str]] = {}
    for code, concept, vintage in stamp_rows:
        latest.setdefault(str(code), {})[str(concept)] = vintage.isoformat()
    disagreeing = sorted(
        code
        for code, per_concept in latest.items()
        if len(per_concept) == len(PPP_CONCEPTS) and len(set(per_concept.values())) > 1
    )
    if disagreeing:
        logger.error(
            "ppp: couple à millésimes divergents, mode refusé — juridictions %s",
            ", ".join(disagreeing),
        )
        return None

    # La clé de cache tient AUSSI compte du désaccord potentiel : elle est
    # construite depuis l'estampille, donc une réparation la change.
    cache_key = "ppp|" + "|".join(
        f"{code}:{per_concept[c]}"
        for code, per_concept in sorted(latest.items())
        for c in PPP_CONCEPTS
        if c in per_concept
    )
    hit = _PPP_CACHE.get(cache_key)
    if hit is not None:
        return hit

    numerator, denominator = PPP_CONCEPTS
    values: dict[str, dict[str, dict[int, Decimal]]] = {c: {} for c in PPP_CONCEPTS}
    for code, concept, year, value in session.execute(
        text(
            "SELECT ms.jurisdiction_code, ms.concept, ms.year, ms.value FROM macro_series ms"
            " JOIN (SELECT jurisdiction_code, concept, max(vintage_date) AS v FROM macro_series"
            "       WHERE concept = ANY(:cs) GROUP BY jurisdiction_code, concept) latest"
            "   ON latest.jurisdiction_code = ms.jurisdiction_code"
            "  AND latest.concept = ms.concept AND latest.v = ms.vintage_date"
            " WHERE ms.concept = ANY(:cs)"
        ),
        {"cs": list(PPP_CONCEPTS)},
    ):
        if value is None or value <= 0:
            continue
        values[str(concept)].setdefault(str(code), {})[int(year)] = Decimal(value)

    ratios: dict[tuple[str, int], Decimal] = {}
    for code, per_year in values[numerator].items():
        other = values[denominator].get(code, {})
        for year, value in per_year.items():
            if year in other:
                ratios[(code, year)] = value / other[year]
    if not ratios:
        return None

    vintages = {
        concept: max(
            (per_concept[concept] for per_concept in latest.values() if concept in per_concept),
            default="",
        )
        for concept in PPP_CONCEPTS
    }
    built = PppRatioSet(
        ratios=ratios,
        # Construit sur les couples COMPLETS : une juridiction qui ne
        # publie qu'un concept ne produit aucun ratio et doit rester en
        # `no_jurisdiction_series`.
        covered=frozenset(code for code, _ in ratios),
        years=frozenset(year for _, year in ratios),
        vintages=vintages,
    )
    if len(_PPP_CACHE) >= _CACHE_MAX:
        _PPP_CACHE.clear()
    _PPP_CACHE[cache_key] = built
    return built
