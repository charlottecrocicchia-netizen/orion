"""Le mode `value=real` de l'Explorateur (moteur A sous la grammaire R0).

Corpus semé : EUR 2025 (identité), EUR 2020 (déflaté), USD 2025
(équivalence ④), USD 2026 (exclu A1 — indice non publié), EUR sans
date (exclu — pas d'année de rattachement). Vérifie les sommes au
centime, la ventilation dynamique de la part exclue, l'absence de
point real pour 2026 SANS troncature de l'axe, la ré-expression USD
(un scalaire, même réalité économique) et l'invariant sacré : une
réponse nominale ne porte AUCUNE clé nouvelle."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion import constanteuro
from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import ExchangeRate, Funder, Organisation, Participation, PriceIndex, Project
from orion.search import explore

MARK = "ZZCEU"
VINTAGE = date(2026, 1, 15)
HICP = {2020: "105.1", 2025: "128.9"}
CPIU = {2025: "322.132", 2010: "218.056"}
USD_PER_EUR_2025 = "1.09"

# Montants semés (natif, devise, nominal EUR, année) — la vérité du test.
EUR_2025 = 1_000_000
EUR_2020 = 2_000_000
USD_2025_NATIVE = 1_090_000
USD_2025_EUR = 1_000_000  # convention ④ au même taux 1.09
USD_2026_EUR = 450_000
EUR_NODATE = 300_000

EUR_2020_REAL = float(Decimal(EUR_2020) * Decimal("128.9") / Decimal("105.1"))


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
    for currency, series, values in (
        ("EUR", ("eurostat", "prc_hicp_aind"), HICP),
        ("USD", ("bls", "CUUR0000SA0"), CPIU),
    ):
        for year, value in values.items():
            db_session.add(
                PriceIndex(
                    currency=currency,
                    year=year,
                    value=Decimal(value),
                    series_source=series[0],
                    series_code=series[1],
                    vintage_date=VINTAGE,
                )
            )
    db_session.add(ExchangeRate(currency="USD", year=2025, rate_to_eur=Decimal(USD_PER_EUR_2025)))

    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    org = Organisation(name=f"{MARK} Labo", country_code="FR", org_type="REC")
    db_session.add(org)
    db_session.flush()

    projects = [
        ("eur25", "EUR", EUR_2025, EUR_2025, "2025-03-01"),
        ("eur20", "EUR", EUR_2020, EUR_2020, "2020-03-01"),
        ("usd25", "USD", USD_2025_NATIVE, USD_2025_EUR, "2025-06-01"),
        ("usd26", "USD", 490_500, USD_2026_EUR, "2026-02-01"),
        ("nodate", "EUR", EUR_NODATE, EUR_NODATE, None),
    ]
    for slug, currency, native, eur, start in projects:
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{slug}",
            title=f"{MARK} {slug}",
            funder_id=funder.id,
            funding_amount=native,
            funding_currency=currency,
            funding_amount_eur=eur,
            start_date=start,
        )
        db_session.add(project)
        db_session.flush()
        db_session.add(
            Participation(
                project_id=project.id,
                organisation_id=org.id,
                role="coordinator",
                country_code="FR",
                amount=native,
                currency=currency,
                amount_eur=eur,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-{slug}",
            )
        )
    db_session.flush()
    return db_session


def test_nominal_reste_strictement_identique(seeded):
    """L'invariant sacré : sans mode real, AUCUNE clé nouvelle et les
    sommes nominales intactes (les 2026 et sans-date comptent)."""
    result = explore.aggregate(seeded, metric="funding", by="funder")
    assert "reference" not in result["meta"]
    assert "excluded" not in result
    total = EUR_2025 + EUR_2020 + USD_2025_EUR + USD_2026_EUR + EUR_NODATE
    assert result["series"][0]["value"] == pytest.approx(total)


def test_real_kpi_et_part_exclue(seeded):
    fs = constanteuro.factor_set(seeded, 2025)
    assert fs is not None
    result = explore.aggregate(seeded, metric="funding", by="funder", factor_set=fs)
    expected = EUR_2025 + USD_2025_EUR + EUR_2020_REAL
    assert result["series"][0]["value"] == pytest.approx(expected, abs=0.01)
    assert result["unit"] == "eur"
    assert result["meta"]["reference"]["mode"] == "real"
    assert result["meta"]["reference"]["base"] == 2025
    assert result["meta"]["reference"]["cur"] == "EUR"
    # Seule 2025 a l'indice des DEUX devises et le taux BCE : la seule
    # année de référence honorable — le contrôle n'offre qu'elle.
    assert result["meta"]["reference"]["bases"] == [2025]
    assert result["meta"]["reference"]["vintages"] == {"EUR": "2026-01-15", "USD": "2026-01-15"}
    excluded = result["excluded"]
    assert excluded["projects"] == 2
    assert excluded["amount_eur_nominal"] == pytest.approx(USD_2026_EUR + EUR_NODATE)
    assert excluded["reasons"]["no_index_year"] == {
        "projects": 1,
        "amount_eur_nominal": pytest.approx(USD_2026_EUR),
        "years": [2026],
    }
    assert excluded["reasons"]["no_date"]["projects"] == 1
    assert excluded["reasons"]["no_date"]["amount_eur_nominal"] == pytest.approx(EUR_NODATE)
    assert excluded["reasons"]["no_currency_index"]["projects"] == 0


def test_real_usd_re_expression_scalaire(seeded):
    """Test-or R1 : la vue en `cur=USD` est la vue EUR multipliée par le
    seul taux BCE de l'année de référence — mêmes exclusions (toujours
    chiffrées en EUR nominal), même périmètre, autre unité."""
    eur = constanteuro.factor_set(seeded, 2025)
    usd = constanteuro.factor_set(seeded, 2025, display_currency="USD")
    r_eur = explore.aggregate(seeded, metric="funding", by="funder", factor_set=eur)
    r_usd = explore.aggregate(seeded, metric="funding", by="funder", factor_set=usd)
    rate = float(Decimal(USD_PER_EUR_2025))
    assert r_usd["series"][0]["value"] == pytest.approx(
        r_eur["series"][0]["value"] * rate, abs=0.02
    )
    assert r_usd["meta"]["reference"]["cur"] == "USD"
    assert r_usd["unit"] == "usd"
    assert r_eur["unit"] == "eur"
    assert r_usd["excluded"] == r_eur["excluded"]


def test_real_serie_temporelle_sans_faux_zero(seeded):
    """A1 à l'écran : 2026 émet un point à valeur ABSENTE (null), jamais
    un zéro — et l'année reste dans la série (l'axe garde l'horizon)."""
    fs = constanteuro.factor_set(seeded, 2025)
    result = explore.aggregate(seeded, metric="funding", by="year", factor_set=fs)
    points = {p["year"]: p["value"] for p in result["series"][0]["points"]}
    assert points[2026] is None
    assert points[2025] == pytest.approx(EUR_2025 + USD_2025_EUR)
    assert points[2020] == pytest.approx(EUR_2020_REAL, abs=0.01)
    # L'exclusion de la vue temporelle ne parle QUE des années sans
    # indice : les sans-date sont déjà hors du périmètre nominal de
    # cette vue (même clause de dimension).
    assert result["excluded"]["reasons"]["no_date"]["projects"] == 0
    assert result["excluded"]["reasons"]["no_index_year"]["years"] == [2026]


def test_real_grain_participation(seeded):
    """La même mécanique au grain participations (by=country) : devise
    NATIVE de la participation, année de début du projet."""
    fs = constanteuro.factor_set(seeded, 2025)
    result = explore.aggregate(seeded, metric="funding", by="country", factor_set=fs)
    fr = next(s for s in result["series"] if s["key"] == "FR")
    expected = EUR_2025 + USD_2025_EUR + EUR_2020_REAL
    assert fr["value"] == pytest.approx(expected, abs=0.01)
    assert result["excluded"]["projects"] == 2


def test_metrique_de_comptes_identique_en_real(seeded):
    """Le mode real ne transforme que l'argent : une métrique de comptes
    rend les mêmes valeurs, seule `meta.reference` s'ajoute."""
    fs = constanteuro.factor_set(seeded, 2025)
    nominal = explore.aggregate(seeded, metric="projects", by="funder")
    real = explore.aggregate(seeded, metric="projects", by="funder", factor_set=fs)
    assert real["series"] == nominal["series"]
    assert real["meta"]["reference"]["mode"] == "real"
    assert "excluded" not in real


def test_api_real_indisponible_sans_indices(client):
    """422 real_unavailable — réservé à l'indisponibilité GLOBALE du mode
    (aucun indice chargé dans cette base), jamais un repli silencieux."""
    response = client.get("/api/explore/aggregate?metric=funding&by=funder&value=real")
    assert response.status_code == 422
    assert response.json()["detail"] == "real_unavailable"


def test_api_mode_inconnu_refuse(client):
    response = client.get("/api/explore/aggregate?metric=funding&by=funder&value=reel")
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported value mode"


def test_api_devise_affichage_inconnue_refusee(client):
    """La grammaire ne forme jamais silencieusement une combinaison
    incohérente (R0 § D10) : cur hors des devises offertes → 400."""
    response = client.get("/api/explore/aggregate?metric=funding&by=funder&value=real&cur=GBP")
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported display currency"
