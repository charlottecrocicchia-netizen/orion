"""Euros constants (lot A) — la SOURCE UNIQUE du facteur, comme
`callstatus.py` l'est pour les statuts d'appels.

Chaîne C de la taxonomie monétaire (docs/conception-a-euros-constants.md
§ 2.7) : pour un montant NATIF en devise `d` rattaché à l'année de
début `a`, avec `R` l'année de référence,

    facteur(d, a) = [ indice_d(R) / indice_d(a) ] / taux_BCE_d(R)

— on déflate D'ABORD dans la monnaie d'origine (méthode OCDE/CAD),
puis on convertit au seul taux BCE de l'année de référence. ATTENTION
au sens du taux : `exchange_rates.rate_to_eur` est « devise par euro »
(série BCE EXR.A.<CCY>.EUR), la conversion vers l'euro DIVISE — le
test-or USD 2025 verrouille ce sens. Pour l'EUR le taux vaut 1.

Devise d'affichage (R0 § D1 `real`) : la ré-expression est un SCALAIRE
unique — le facteur vers l'EUR est multiplié par le taux BCE de la
devise d'affichage à l'année de référence. `Real 2025 · USD` et
`Real 2025 · EUR` sont donc strictement la même réalité économique
dans deux unités (test-or dédié), jamais deux méthodes.

Règles gravées, toutes vérifiées ici et nulle part ailleurs :
- (devise, année) absents du dictionnaire = NON AJUSTABLE — année sans
  indice publié (dont 2026-2027, arbitrage A1 : jamais de facteur 1,0
  artificiel) ou devise sans indice admis (§ 2.3) ;
- condition de validité (§ 2.1) : l'année de référence demandée doit
  avoir son indice pour CHAQUE devise couverte ET son taux BCE —
  sinon `factor_set` répond None et le mode constant se refuse ;
- lecture de la DERNIÈRE vintage par devise (§ 2.11) — une révision
  d'indice ajoute une vintage, le facteur suit, rien n'est réécrit ;
- tout en `Decimal` — l'agrégation précède l'arrondi, l'arrondi
  n'existe qu'à la présentation.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

# Devise → indice admis (licences relues, § 0 de la conception). Une
# devise hors de cette table n'est JAMAIS ajustée, jamais approximée.
COVERED: tuple[str, ...] = ("EUR", "USD")

# Devises d'affichage offertes en R1 (R0 § D6) : l'API n'offre que ce
# que les taux BCE de l'année de référence peuvent honorer.
DISPLAY_CURRENCIES: tuple[str, ...] = ("EUR", "USD")


@dataclass(frozen=True)
class FactorSet:
    """Le jeu de facteurs d'UNE année de référence, sous UNE vintage,
    exprimé dans UNE devise d'affichage."""

    reference_year: int
    display_currency: str
    factors: dict[tuple[str, int], Decimal] = field(hash=False)
    vintages: dict[str, str] = field(hash=False)  # devise → vintage ISO
    series: dict[str, str] = field(hash=False)  # devise → source:code
    # Les années de référence que le serveur peut honorer pour CETTE
    # devise d'affichage (R0 § D6 : le contrôle n'offre que ce qui est
    # honorable) — indices de toutes les devises couvertes ET taux BCE
    # présents. L'UI ne propose jamais une année qui mènerait à un 422.
    bases: tuple[int, ...] = ()

    @property
    def key(self) -> str:
        """La part de clé de cache : année + devise d'affichage + vintages."""
        stamped = ",".join(f"{c}@{v}" for c, v in sorted(self.vintages.items()))
        return f"{self.reference_year}|{self.display_currency}|{stamped}"


# Mémoïsation par (année de référence, vintages) : une nouvelle vintage
# chargée change la clé, l'ancien jeu meurt de lui-même.
_CACHE: dict[str, FactorSet] = {}
_CACHE_MAX = 8


def _latest_vintages(session: Session) -> dict[str, str]:
    rows = session.execute(
        text("SELECT currency, max(vintage_date) FROM price_indices GROUP BY currency")
    )
    return {row[0]: row[1].isoformat() for row in rows}


def factor_set(
    session: Session, reference_year: int, display_currency: str = "EUR"
) -> FactorSet | None:
    """Le jeu complet des facteurs pour une année de référence et une
    devise d'affichage — ou None si la condition de validité échoue
    (mode real indisponible)."""
    vintages = {c: v for c, v in _latest_vintages(session).items() if c in COVERED}
    stamped = ",".join(f"{c}@{v}" for c, v in sorted(vintages.items()))
    cache_key = f"{reference_year}|{display_currency}|{stamped}"
    hit = _CACHE.get(cache_key)
    if hit is not None:
        return hit
    if set(vintages) != set(COVERED):
        return None

    indices: dict[tuple[str, int], Decimal] = {}
    series: dict[str, str] = {}
    for currency, vintage in vintages.items():
        rows = session.execute(
            text(
                "SELECT year, value, series_source, series_code FROM price_indices "
                "WHERE currency = :c AND vintage_date = :v"
            ),
            {"c": currency, "v": vintage},
        ).all()
        for year, value, src, code in rows:
            indices[(currency, int(year))] = Decimal(value)
            series[currency] = f"{src}:{code}"

    rates: dict[str, Decimal] = {"EUR": Decimal(1)}
    for currency, rate in session.execute(
        text("SELECT currency, rate_to_eur FROM exchange_rates WHERE year = :y"),
        {"y": reference_year},
    ):
        rates[str(currency)] = Decimal(rate)

    # Les années honorables comme référence (mêmes conditions de
    # validité, appliquées à chaque année) : la table des taux est
    # minuscule, une lecture des couples (devise, année) suffit.
    rate_years: dict[str, set[int]] = {}
    for currency, year in session.execute(
        text("SELECT currency, year FROM exchange_rates WHERE rate_to_eur > 0")
    ):
        rate_years.setdefault(str(currency), set()).add(int(year))
    needs_rate = {c for c in COVERED if c != "EUR"} | (
        {display_currency} if display_currency != "EUR" else set()
    )
    bases = tuple(
        sorted(
            year
            for year in {y for _, y in indices}
            if all((c, year) in indices and indices[(c, year)] > 0 for c in COVERED)
            and all(year in rate_years.get(c, ()) for c in needs_rate)
        )
    )

    # Condition de validité nommée (§ 2.1, étendue R0 § D1) : indice(réf)
    # ET taux(réf) pour chaque devise couverte, ET taux(réf) de la devise
    # d'affichage — sinon refus, jamais un à-peu-près.
    for currency in COVERED:
        if (currency, reference_year) not in indices or currency not in rates:
            return None
        if indices[(currency, reference_year)] <= 0:
            return None
    if display_currency not in rates or rates[display_currency] <= 0:
        return None

    # La ré-expression est un scalaire unique de l'année de référence :
    # même réalité économique, autre unité (Real 2025·USD ≡ Real 2025·EUR).
    display_rate = rates[display_currency]
    factors: dict[tuple[str, int], Decimal] = {}
    for (currency, year), value in indices.items():
        if value <= 0:
            continue
        reference_index = indices[(currency, reference_year)]
        factors[(currency, year)] = (reference_index / value) / rates[currency] * display_rate

    built = FactorSet(
        reference_year=reference_year,
        display_currency=display_currency,
        factors=factors,
        vintages=vintages,
        series=series,
        bases=bases,
    )
    if len(_CACHE) >= _CACHE_MAX:
        _CACHE.clear()
    _CACHE[cache_key] = built
    return built
