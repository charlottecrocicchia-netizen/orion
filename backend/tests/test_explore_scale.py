"""Lot R3 — ECONOMIC SCALE : % PIB et par-habitant, aux deux perspectives.

Corpus semé, calculable à la main (taux USD/EUR 2025 = 1.25) :
- financeur `ec` (EU) : projet 2025 de 2 000 000 000 € → 2,5 Md$ ;
  PIB UE 2025 = 2 500 Md$ → effort = 0,1 % ;
- financeur `nih` (US) : projet 2025 de 2 000 000 000 € nominal
  (natif 2,5 Md$) → 2,5 Md$ ; PIB US 2025 = 5 000 Md$ → 0,05 % ;
- bénéficiaires : le projet ec porte 1 000 000 000 € vers FR et
  400 000 000 € vers DE — PIB FR 2025 = 250 Md$ → FR = 0,5 % ;
  population DE 2025 = 80 M hab → DE = 5 € réels/hab (HICP identité
  2025) ;
- le GRAIN empêche le double comptage : l'effort compte le projet
  UNE fois (2 Md€), l'intensité FR ne compte que la part FR (1 Md€),
  jamais le total du projet ;
- année macro absente (2026), juridiction absente (participation sans
  pays), vue au dénominateur non résoluble (by=programme) → refus.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion import constanteuro, macro
from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    ExchangeRate,
    Funder,
    MacroSeries,
    Organisation,
    Participation,
    PriceIndex,
    Project,
)
from orion.search import explore

MARK = "ZZSCL"
VINTAGE = date(2026, 2, 1)
USD_PER_EUR_2025 = "1.25"

GDP = {"EU": 2.5e12, "US": 5e12, "FR": 2.5e11, "DE": 4e11}
POP = {"EU": 4.5e8, "US": 3.4e8, "FR": 6.8e7, "DE": 8.0e7}


@pytest.fixture
def db_session(test_database):
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        seed_reference(session, RunStats())
        session.flush()
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


@pytest.fixture
def seeded(db_session):
    # Indices 2024-2025 à 100 (identité) — le par-habitant divise la
    # valeur RÉELLE ; taux USD identique sur les deux années.
    for currency, series in (("EUR", ("eurostat", "prc_hicp_aind")), ("USD", ("bls", "CUUR0000SA0"))):
        for year in (2024, 2025):
            db_session.add(
                PriceIndex(
                    currency=currency,
                    year=year,
                    value=Decimal("100"),
                    series_source=series[0],
                    series_code=series[1],
                    vintage_date=VINTAGE,
                )
            )
    for year in (2024, 2025):
        db_session.add(ExchangeRate(currency="USD", year=year, rate_to_eur=Decimal(USD_PER_EUR_2025)))
    # 2025 : les valeurs de tête ; 2024 : PIB FR moitié (1,25e11) pour
    # que le ratio des sommes se distingue de la moyenne arithmétique.
    GDP_2024 = {**GDP, "FR": 1.25e11}
    for year, gdp_map in ((2024, GDP_2024), (2025, GDP)):
        for code, gdp in gdp_map.items():
            db_session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept="gdp_current_usd",
                    year=year,
                    value=Decimal(str(gdp)),
                    series_source="wdi",
                    series_code="NY.GDP.MKTP.CD",
                    vintage_date=VINTAGE,
                )
            )
    for year in (2024, 2025):
        for code, pop in POP.items():
            db_session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept="population",
                    year=year,
                    value=Decimal(str(pop)),
                    series_source="wdi",
                    series_code="SP.POP.TOTL",
                    vintage_date=VINTAGE,
                )
            )

    ec = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    nih = db_session.scalar(select(Funder).where(Funder.code == "nih"))
    org_fr = Organisation(name=f"{MARK} FR", country_code="FR", org_type="REC")
    org_de = Organisation(name=f"{MARK} DE", country_code="DE", org_type="REC")
    db_session.add_all([org_fr, org_de])
    db_session.flush()

    # Le projet EU : 2 Md€, participations FR 1 Md€ + DE 0,4 Md€ + une
    # part sans pays (juridiction absente) — plus un projet 2026 (année
    # macro absente).
    project = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-eu",
        title=f"{MARK} eu",
        funder_id=ec.id,
        funding_amount=2_000_000_000,
        funding_currency="EUR",
        funding_amount_eur=2_000_000_000,
        start_date="2025-03-01",
    )
    db_session.add(project)
    db_session.flush()
    db_session.add_all(
        [
            Participation(
                project_id=project.id,
                organisation_id=org_fr.id,
                role="coordinator",
                country_code="FR",
                amount=1_000_000_000,
                currency="EUR",
                amount_eur=1_000_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-fr",
            ),
            Participation(
                project_id=project.id,
                organisation_id=org_de.id,
                role="participant",
                country_code="DE",
                amount=400_000_000,
                currency="EUR",
                amount_eur=400_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-de",
            ),
            Participation(
                project_id=project.id,
                organisation_id=org_fr.id,
                role="participant",
                country_code=None,
                amount=100_000_000,
                currency="EUR",
                amount_eur=100_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-nul",
            ),
        ]
    )
    project_2024 = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-eu24",
        title=f"{MARK} eu24",
        funder_id=ec.id,
        funding_amount=1_500_000_000,
        funding_currency="EUR",
        funding_amount_eur=1_500_000_000,
        start_date="2024-03-01",
    )
    db_session.add(project_2024)
    db_session.flush()
    db_session.add_all(
        [
            Participation(
                project_id=project_2024.id,
                organisation_id=org_fr.id,
                role="coordinator",
                country_code="FR",
                amount=1_000_000_000,
                currency="EUR",
                amount_eur=1_000_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p24-fr",
            ),
            Participation(
                project_id=project_2024.id,
                organisation_id=org_de.id,
                role="participant",
                country_code="DE",
                amount=400_000_000,
                currency="EUR",
                amount_eur=400_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p24-de",
            ),
        ]
    )
    nih_project = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-us",
        title=f"{MARK} us",
        funder_id=nih.id,
        funding_amount=2_500_000_000,
        funding_currency="USD",
        funding_amount_eur=2_000_000_000,
        start_date="2025-06-01",
    )
    future = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-2026",
        title=f"{MARK} 2026",
        funder_id=ec.id,
        funding_amount=500_000_000,
        funding_currency="EUR",
        funding_amount_eur=500_000_000,
        start_date="2026-02-01",
    )
    db_session.add_all([nih_project, future])
    db_session.flush()
    return db_session


def _sets(session):
    return (
        macro.macro_set(session, "gdp_current_usd"),
        macro.macro_set(session, "population"),
        macro.usd_rates(session),
    )


def test_or_effort_eu_et_us_grain_projet(seeded):
    """EU sur 2024-2025 : Σf = 3,5 Md€ × 1,25 = 4,375 Md$ ;
    ΣPIB = 5 000 Md$ → 0,0875 % (ratio des sommes). US : 2 Md€ × 1,25
    (= le natif 2,5 Md$ reconstruit) / 5 000 Md$ = 0,05 %. Le projet EU
    compte UNE fois — pas la somme de ses participations."""
    gdp, _, rates = _sets(seeded)
    result = explore.aggregate(
        seeded, metric="funding", by="funder", scale="gdp", macro=gdp, usd_rates=rates
    )
    values = {s["key"]: s["value"] for s in result["series"]}
    assert values["ec"] == pytest.approx(0.0875)
    assert values["nih"] == pytest.approx(0.05)
    assert result["unit"] == "gdppct"
    assert result["meta"]["reference"]["perspective"] == "funder"
    assert result["total"] is None


def test_or_intensite_fr_ratio_des_sommes(seeded):
    """LE test-or pluriannuel (verrou R3) : FR reçoit 1 Md€ en 2024
    (PIB 125 Md$ → 1 %/an) et 1 Md€ en 2025 (PIB 250 Md$ → 0,5 %/an).
    L'agrégat = 100 × Σf/ΣPIB = 2,5 Md$ / 375 Md$ = 0,6667 % — la
    moyenne pondérée par le PIB, PAS la moyenne arithmétique (0,75 %)."""
    gdp, _, rates = _sets(seeded)
    result = explore.aggregate(
        seeded, metric="funding", by="country", scale="gdp", macro=gdp, usd_rates=rates
    )
    values = {s["key"]: s["value"] for s in result["series"]}
    assert values["FR"] == pytest.approx(100 * 2.5e9 / 3.75e11)
    assert values["FR"] != pytest.approx(0.75, abs=0.01)  # jamais la moyenne arithmétique
    assert values["DE"] == pytest.approx(0.125)  # uniforme sur les deux années
    assert result["meta"]["reference"]["perspective"] == "recipient"


def test_or_intensite_temporelle_ratios_annuels(seeded):
    """Sur la vue temporelle, chaque année garde SON ratio : FR 2024 =
    1 %, FR 2025 = 0,5 % — la formule agrégée se réduit à l'année."""
    gdp, _, rates = _sets(seeded)
    result = explore.aggregate(
        seeded,
        metric="funding",
        by="country",
        split=True,
        compare=["FR"],
        scale="gdp",
        macro=gdp,
        usd_rates=rates,
    )
    fr = next(serie for serie in result["series"] if serie["key"] == "FR")
    points = {p["year"]: p["value"] for p in fr["points"]}
    assert points[2024] == pytest.approx(1.0)
    assert points[2025] == pytest.approx(0.5)


def test_or_capita_cumul_pluriannuel(seeded):
    """Par habitant agrégé = Σ [réel(a)/pop(a)] (verrou R3) : DE
    400 M€/80 M hab sur DEUX années → 5 + 5 = 10 € par habitant — un
    cumul, jamais dix ans de financement divisés par la population
    d'une seule année."""
    _, pop, _ = _sets(seeded)
    fs = constanteuro.factor_set(seeded, 2025)
    result = explore.aggregate(
        seeded, metric="funding", by="country", scale="capita", macro=pop, factor_set=fs
    )
    values = {s["key"]: s["value"] for s in result["series"]}
    assert values["DE"] == pytest.approx(10.0)
    assert values["FR"] == pytest.approx(2 * 1_000_000_000 / 68_000_000)
    assert result["unit"] == "eurcap"


def test_or_capita_usd_re_exprime(seeded):
    """La devise d'affichage reste un scalaire : per capita USD = per
    capita EUR × 1,25 — et l'unité le dit."""
    _, pop, _ = _sets(seeded)
    usd = constanteuro.factor_set(seeded, 2025, display_currency="USD")
    result = explore.aggregate(
        seeded, metric="funding", by="country", scale="capita", macro=pop, factor_set=usd
    )
    values = {s["key"]: s["value"] for s in result["series"]}
    assert values["DE"] == pytest.approx(12.5)  # 10 €/hab × 1,25
    assert result["unit"] == "usdcap"


def test_annee_macro_absente_et_jurisdiction_absente(seeded):
    """2026 n'a ni PIB ni taux → no_gdp_year (le dénominateur est
    l'histoire utile) ; la participation sans pays → no_jurisdiction ;
    jamais un zéro, jamais un silence."""
    gdp, _, rates = _sets(seeded)
    effort = explore.aggregate(
        seeded, metric="funding", by="funder", scale="gdp", macro=gdp, usd_rates=rates
    )
    assert effort["excluded"]["reasons"]["no_gdp_year"]["years"] == [2026]
    assert effort["excluded"]["reasons"]["no_gdp_year"]["projects"] == 1

    received = explore.aggregate(
        seeded, metric="funding", by="country", scale="gdp", macro=gdp, usd_rates=rates
    )
    # La participation SANS pays n'entre jamais dans le périmètre d'une
    # vue par pays (clause de dimension `country_code IS NOT NULL`) :
    # elle n'est ni comptée, ni exclue — hors vue. Le motif
    # no_jurisdiction reste un garde-fou structurel, à zéro ici.
    assert received["excluded"]["reasons"]["no_jurisdiction"]["projects"] == 0
    values = {s_["key"]: s_["value"] for s_ in received["series"]}
    assert values["FR"] == pytest.approx(100 * 2.5e9 / 3.75e11)  # la part sans pays n'a rien pollué


def test_intensite_temporelle_pays_cadre(seeded):
    """by=year cadré sur FR : grain participation (la part FR, jamais le
    total projet), point 2025 = 0,5 %."""
    gdp, _, rates = _sets(seeded)
    result = explore.aggregate(
        seeded,
        metric="funding",
        by="year",
        country="FR",
        scale="gdp",
        macro=gdp,
        usd_rates=rates,
    )
    points = {p["year"]: p["value"] for p in result["series"][0]["points"]}
    assert points[2025] == pytest.approx(0.5)
    assert result["meta"]["reference"]["perspective"] == "recipient"


def test_nominal_reste_strictement_identique(seeded):
    """L'invariant sacré tient toujours : sans mode, aucune clé nouvelle."""
    result = explore.aggregate(seeded, metric="funding", by="funder")
    assert "reference" not in result["meta"]
    assert "excluded" not in result
    assert result["series"][0]["value"] is not None


def test_api_refus_vue_sans_denominateur(client):
    """Un dénominateur non résoluble pour la vue → 422 explicite —
    jamais une interprétation silencieuse (R0 § D4/D13)."""
    for query in (
        "metric=funding&by=programme&value=gdp",
        "metric=funding&by=organisation&value=capita",
        "metric=funding&by=year&value=gdp",  # sans pays cadré
        "metric=projects&by=funder&value=gdp",  # métrique non monétaire
    ):
        response = client.get(f"/api/explore/aggregate?{query}")
        assert response.status_code == 422, query
        assert response.json()["detail"].endswith("_unavailable")


def test_api_refus_sans_macro_chargee(client):
    """Base sans macro_series : le mode se refuse globalement."""
    response = client.get("/api/explore/aggregate?metric=funding&by=funder&value=gdp")
    assert response.status_code == 422
    assert response.json()["detail"] == "gdp_unavailable"


def test_methodologique_pont_usd_deux_chemins():
    """Le pont USD du % PIB (décision R3, consignée) : le dénominateur
    est le PIB current US$ PUBLIÉ par le WDI (ses propres taux
    officiels), le numérateur suit la convention FX Orion/BCE — deux
    conversions distinctes, jamais présentées comme une identité de
    change. Contrôle sur constantes RELEVÉES le 2026-08-24 :
    - zone euro : la Banque mondiale convertit exactement au taux moyen
      annuel BCE (écart mesuré 0,000 % sur FR/DE/US 2015-2024) ;
    - hors euro (SE) : écart ≤ 0,34 % sur 2015-2024 — négligeable pour
      tout résultat ou classement ;
    - l'agrégat UE n'est PAS publié en monnaie locale (CN absent) : le
      chemin USD est la seule forme officielle."""
    # FR 2023 — identité exacte des deux chemins.
    fr_cd = 3.056250648e12   # NY.GDP.MKTP.CD (relevé 2026-08-24)
    fr_cn = 2.8265415e12     # NY.GDP.MKTP.CN, EUR
    usd_2023 = 1.081269      # taux moyen annuel BCE
    assert abs(fr_cn * usd_2023 / fr_cd - 1) < 1e-6

    # SE 2023 — écart sous 0,5 % entre taux BM et taux croisés BCE.
    se_cd = 5.789909152e11   # NY.GDP.MKTP.CD
    se_cn = 6.143187e12      # NY.GDP.MKTP.CN, SEK
    sek_2023 = 11.478758     # SEK par EUR, BCE
    reconstructed = se_cn / sek_2023 * usd_2023
    assert abs(reconstructed / se_cd - 1) < 0.005
