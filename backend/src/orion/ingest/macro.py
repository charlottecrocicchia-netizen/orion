"""Chargeur des séries macro WDI (lot R3) — même discipline de vintage
que les indices de prix : chaque exécution récupère les jeux complets
et ne crée une NOUVELLE vintage par (juridiction, concept) que si les
valeurs diffèrent. Jamais d'UPDATE d'une vintage existante ; en cas
d'échec source, la vintage courante reste en service.

Source : API World Bank v2 (World Development Indicators, CC BY-4.0
vérifié PAR INDICATEUR le 2026-08-24 — License_Type des métadonnées).
Le WDI révise EN PLACE et republie trimestriellement : le versionnement
côté Orion est la condition de rejouabilité.

Trois concepts :
- `gdp_current_usd`      ← NY.GDP.MKTP.CD (PIB courant, US$) ;
- `population`           ← SP.POP.TOTL ;
- `gdp_ppp_current_intl` ← NY.GDP.MKTP.PP.CD (PIB courant, $ intl.).

LE COUPLE PPP EST UNE UNITÉ D'ÉCRITURE (lot R4B, doc § 17 étape 3).
`gdp_ppp_current_intl` et `gdp_current_usd` forment le rapport qui
convertit un financement en dollars internationaux ; les diviser l'un
par l'autre n'a de sens que s'ils viennent du MÊME état de la source.
Or `vintage_date` est la date d'ingestion Orion, écrite par
(juridiction, concept) et seulement si les valeurs changent : deux
concepts parfaitement cohérents porteraient donc des dates différentes,
et « dernière vintage de chacun » ne prouverait rien. D'où la règle :
quand l'un des deux s'écrit pour une juridiction, l'AUTRE s'écrit
aussi, à la même date, même inchangé. L'invariant devient une propriété
de la donnée — `ppp_ratio_set()` le vérifie et refuse sinon.

Deux corollaires qui ne vont pas de soi :
- la règle doit être AUTO-RÉPARATRICE. Un état dépareillé ne se
  rattrape pas tout seul : les valeurs étant inchangées des deux côtés,
  rien ne déclenche l'écriture. `_vintages_disagree()` déclenche donc
  sur les DATES, indépendamment des valeurs ;
- le couple est une unité de LECTURE autant que d'écriture : un run
  récupère les deux séries puis les écrit ensemble. La granularité de
  `vintage_date` étant le jour, deux écritures séparées d'une même
  journée porteraient la même date et l'invariant ne verrait rien —
  seul le fetch groupé protège de ce recomposé-là.

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
from orion.ingest.runlog import RunStats, record_run
from orion.models import MacroSeries

SOURCE = "macro"
SERIES_SOURCE = "wdi"
INDICATORS = {
    "gdp_current_usd": "NY.GDP.MKTP.CD",
    "population": "SP.POP.TOTL",
    "gdp_ppp_current_intl": "NY.GDP.MKTP.PP.CD",
}
# Numérateur puis dénominateur du ratio PPP — l'ordre compte pour les
# garde-fous ci-dessous, jamais pour l'écriture (les deux sont égaux
# devant la règle de couple).
COUPLE = ("gdp_ppp_current_intl", "gdp_current_usd")
# Bande de plausibilité du ratio : large à dessein. Elle n'arbitre
# aucune valeur économique, elle attrape une inversion de concepts, un
# mauvais indicateur ou un changement d'unité chez la source. Mesuré au
# 2026-07-13 : le ratio va de 0,64 (Bermudes) à 7,79 (Nigeria).
RATIO_BAND = (Decimal("0.1"), Decimal("20"))
# Le dollar international est ancré sur les États-Unis : leur ratio vaut
# 1 par construction. Les deux séries y sont la même grandeur, mais le
# JSON de la source porte du bruit de représentation flottante
# (27 811 516 999 999,9 contre 27 811 517 000 000 en 2023) — le contrôle
# se fait donc à six décimales, pas au bit près.
ANCHOR = "US"
ANCHOR_PRECISION = Decimal("0.000001")
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
        response = _get_with_retry(
            client, f"{API}/country", {"format": "json", "per_page": 300, "page": page}
        )
        if response.status_code != 200:
            raise ValueError(f"liste des pays : WDI a répondu {response.status_code}")
        payload = response.json()
        known |= {entry["iso2Code"] for entry in payload[1]}
        if page >= payload[0]["pages"]:
            return known
        page += 1


def fetch_all(codes: list[str]) -> dict[str, dict[str, dict[int, float]]]:
    """Les trois indicateurs pour les juridictions demandées, en UNE passe
    réseau : {concept: {juridiction: {année: valeur}}}. Valeurs nulles ou
    ≤ 0 écartées au parsing (la validation tranche en aval).

    UNE requête PAR (concept, juridiction) : le WAF de la Banque mondiale
    bloque certaines simples séquences de codes dans les listes
    semi-colonées (mesuré le 2026-08-24 : « LR;LS » → 403) — la requête
    unitaire est déterministe et immune, et ce geste est annuel.

    Tout le réseau AVANT toute écriture : c'est ce qui fait du couple une
    unité de lecture (docstring du module). Un échec sur le second
    concept ne laisse pas le premier écrit."""
    out: dict[str, dict[str, dict[int, float]]] = {concept: {} for concept in INDICATORS}
    with httpx.Client(timeout=TIMEOUT) as client:
        known = _wdi_known(client)  # une seule fois pour les trois concepts
        wanted = [code for code in codes if code in known]
        for concept, indicator in INDICATORS.items():
            for code in wanted:
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
                    out[concept].setdefault(code, {})[int(row["date"])] = float(value)
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


def _prepare(concept: str, code: str, values: dict[int, float]) -> dict[int, Decimal]:
    """Le jeu tel qu'il sera écrit — quantifié comme la colonne."""
    if any(value <= 0 for value in values.values()):
        raise ValueError(f"{code}/{concept}: valeur non positive reçue")
    return {year: Decimal(str(value)).quantize(Decimal("0.0001")) for year, value in values.items()}


def _differs(session: Session, code: str, concept: str, fresh: dict[int, Decimal]) -> bool:
    """La source a-t-elle bougé depuis la dernière vintage ?"""
    return bool(fresh) and fresh != _current_vintage(session, code, concept)


def _write(
    session: Session, code: str, concept: str, fresh: dict[int, Decimal], vintage: date
) -> bool:
    """Écrit le jeu complet à `vintage`. Rend True si une vintage du MÊME
    JOUR a été remplacée — la table est append-only entre jours, pas dans
    la journée, et c'est la seule trace de ce remplacement.

    À N'APPELER QU'UNE FOIS par (code, concept) et par run : la session
    est en `autoflush=False`, donc un second DELETE ne verrait pas les
    lignes encore en attente et le commit lèverait sur la contrainte
    d'unicité."""
    deleted = session.execute(
        text(
            "DELETE FROM macro_series WHERE jurisdiction_code = :j AND concept = :c"
            " AND vintage_date = :v"
        ),
        {"j": code, "c": concept, "v": vintage},
    ).rowcount
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
    return bool(deleted)


def _latest_vintages(session: Session, code: str) -> dict[str, date]:
    """Dernière vintage de chaque concept du couple, pour une juridiction."""
    rows = session.execute(
        text(
            "SELECT concept, max(vintage_date) FROM macro_series"
            " WHERE jurisdiction_code = :j AND concept = ANY(:cs) GROUP BY concept"
        ),
        {"j": code, "cs": list(COUPLE)},
    )
    return {str(concept): vintage for concept, vintage in rows}


def _vintages_disagree(session: Session, code: str) -> bool:
    """L'invariant de couple est-il rompu pour cette juridiction ?

    Déclencheur INDÉPENDANT DES VALEURS : sans lui, un état dépareillé ne
    serait jamais réparé, puisque `_differs` rendrait False des deux
    côtés. Une juridiction qui ne porte qu'UN des deux concepts n'est pas
    une faute (une poignée d'économies publient le PIB en dollars sans le
    PIB en dollars internationaux) — la réécrire à chaque run ne
    servirait à rien."""
    latest = _latest_vintages(session, code)
    return len(latest) == len(COUPLE) and len(set(latest.values())) > 1


def _check_couple(fetched: dict[str, dict[str, dict[int, float]]]) -> int:
    """Garde-fous BLOQUANTS du couple, en mémoire, avant toute écriture.

    Ils ne supposent aucune identité externe : ils portent sur le couple
    réellement consommé en production (doc § 17 étape 2, niveau 1). Un
    échec lève — le run est journalisé en échec et la vintage courante
    reste en service.

    Rend le nombre de cellules hors bande, pour le journal : une valeur
    extrême isolée est un fait de la source, elle se compte sans
    bloquer."""
    numerator, denominator = COUPLE
    lo, hi = RATIO_BAND
    anchor_seen = False
    outliers = 0
    for code, years in fetched[numerator].items():
        other = fetched[denominator].get(code, {})
        ratios: list[Decimal] = []
        for year, value in sorted(years.items()):
            if year not in other:
                continue
            ratio = Decimal(str(value)) / Decimal(str(other[year]))
            ratios.append(ratio)
            if not lo <= ratio <= hi:
                outliers += 1
            # L'ancre se vérifie CELLULE PAR CELLULE : le dollar
            # international est défini sur les États-Unis, et un seul
            # écart y trahirait un couple dépareillé.
            if code == ANCHOR:
                anchor_seen = True
                if ratio.quantize(ANCHOR_PRECISION) != Decimal(1):
                    raise ValueError(f"{ANCHOR}/{year}: ratio PPP {ratio} devrait valoir 1")
        if ratios:
            median = sorted(ratios)[len(ratios) // 2]
            if not lo <= median <= hi:
                raise ValueError(
                    f"{code}: ratio PPP médian {median} hors bande [{lo} ; {hi}]"
                    " — inversion de concepts ou changement d'unité chez la source"
                )
    if not anchor_seen:
        raise ValueError(f"aucune année du couple pour {ANCHOR} — ancre du dollar international")
    return outliers


def _check_coverage(session: Session, concept: str, fresh: dict[str, dict[int, float]]) -> None:
    """La couverture historique ne régresse pas en silence : le nombre
    d'observations reçues doit rester au moins égal à celui de la vintage
    en service. Une source qui perd la moitié de son histoire est un
    incident, pas une mise à jour."""
    stored = session.execute(
        text(
            "SELECT count(*) FROM macro_series ms JOIN ("
            "  SELECT jurisdiction_code, max(vintage_date) AS v FROM macro_series"
            "  WHERE concept = :c GROUP BY jurisdiction_code) latest"
            " ON latest.jurisdiction_code = ms.jurisdiction_code AND latest.v = ms.vintage_date"
            " WHERE ms.concept = :c"
        ),
        {"c": concept},
    ).scalar_one()
    received = sum(len(years) for years in fresh.values())
    if stored and received < stored:
        raise ValueError(
            f"{concept}: couverture en régression — {received} observations reçues"
            f" contre {stored} en service"
        )


def store(
    session: Session,
    fetched: dict[str, dict[str, dict[int, float]]],
    vintage: date,
    stats: RunStats,
) -> None:
    """La phase d'écriture, séparée du réseau pour être testable telle
    quelle. Les concepts hors couple gardent le comportement R3 ; le
    couple s'écrit par juridiction, les deux concepts ensemble."""
    stats.add("couple_ratio_outliers", _check_couple(fetched))
    for concept in INDICATORS:
        _check_coverage(session, concept, fetched[concept])

    prepared = {
        concept: {
            code: _prepare(concept, code, values) for code, values in fetched[concept].items()
        }
        for concept in INDICATORS
    }

    for concept in INDICATORS:
        if concept in COUPLE:
            continue  # traités ensemble ci-dessous — jamais deux _write sur la même clé
        fresh_vintages = 0
        same_day = 0
        for code, fresh in sorted(prepared[concept].items()):
            if _differs(session, code, concept, fresh):
                same_day += _write(session, code, concept, fresh, vintage)
                fresh_vintages += 1
        stats.add(f"{concept}_jurisdictions", len(prepared[concept]))
        stats.add(f"{concept}_years", sum(len(v) for v in prepared[concept].values()))
        stats.add(f"{concept}_vintages", fresh_vintages)
        stats.add(f"{concept}_sameday_overwrites", same_day)

    # LE COUPLE — une passe par juridiction, les deux concepts liés.
    codes = sorted({code for concept in COUPLE for code in prepared[concept]})
    written = {concept: 0 for concept in COUPLE}
    same_day = {concept: 0 for concept in COUPLE}
    paired = repairs = 0
    for code in codes:
        changed = [c for c in COUPLE if _differs(session, code, c, prepared[c].get(code, {}))]
        disagree = _vintages_disagree(session, code)
        if not changed and not disagree:
            continue
        repairs += bool(disagree and not changed)
        for concept in COUPLE:
            fresh = prepared[concept].get(code)
            if not fresh:
                continue
            paired += concept not in changed
            same_day[concept] += _write(session, code, concept, fresh, vintage)
            written[concept] += 1
    for concept in COUPLE:
        stats.add(f"{concept}_jurisdictions", len(prepared[concept]))
        stats.add(f"{concept}_years", sum(len(v) for v in prepared[concept].values()))
        stats.add(f"{concept}_vintages", written[concept])
        stats.add(f"{concept}_sameday_overwrites", same_day[concept])
    stats.add("couple_paired_writes", paired)
    stats.add("couple_vintage_repairs", repairs)


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
            # La date est fixée UNE fois : le fetch complet dure de longues
            # minutes et pourrait sinon franchir minuit, fabriquant un
            # couple à deux dates par simple effet d'horloge.
            vintage = date.today()
            store(session, fetch_all(codes), vintage, stats)
            session.commit()
        finally:
            session.close()
    return stats.counts
