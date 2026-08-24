"""Lot A — la source unique du facteur (constanteuro.py).

Les deux tests-or de la conception (§ 2.12) verrouillent la formule :
identité EUR 2025 (facteur exactement 1) et équivalence USD 2025 avec
la convention ④ à taux BCE identique — un taux inversé, un mauvais
millésime, un mauvais indice ou un mauvais ordre de transformation les
font tomber. Les valeurs d'indices semées ici sont citées en dur, et
l'étalonnage 100 USD de 2010 est calculé à la main dans le test."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from orion import constanteuro
from orion.core.db import engine
from orion.models import ExchangeRate, PriceIndex

VINTAGE = date(2026, 1, 15)

# HICP zone euro (2015=100) et CPI-U (1982-84=100) — jeu de test figé.
HICP = {2010: "91.0", 2020: "105.1", 2024: "126.3", 2025: "128.9"}
CPIU = {2010: "218.056", 2020: "258.811", 2024: "313.7", 2025: "322.132"}
USD_PER_EUR_2025 = "1.09"


@pytest.fixture
def db_session(test_database):
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


def seed_indices(session: Session, vintage: date = VINTAGE) -> None:
    for year, value in HICP.items():
        session.add(
            PriceIndex(
                currency="EUR",
                year=year,
                value=Decimal(value),
                series_source="eurostat",
                series_code="prc_hicp_aind",
                vintage_date=vintage,
            )
        )
    for year, value in CPIU.items():
        session.add(
            PriceIndex(
                currency="USD",
                year=year,
                value=Decimal(value),
                series_source="bls",
                series_code="CUUR0000SA0",
                vintage_date=vintage,
            )
        )
    session.add(ExchangeRate(currency="USD", year=2025, rate_to_eur=Decimal(USD_PER_EUR_2025)))
    session.flush()


def test_or_eur_2025_facteur_identite(db_session):
    """Test-or EUR 2025 : un euro de l'année de référence vaut son
    nominal EXACTEMENT — facteur 1.000…, pas un arrondi qui y ressemble."""
    seed_indices(db_session)
    fs = constanteuro.factor_set(db_session, 2025)
    assert fs is not None
    assert fs.factors[("EUR", 2025)] == Decimal(1)


def test_or_usd_2025_equivalence_convention_4(db_session):
    """Test-or USD 2025 : constant(2025) ≡ nominal ④ quand les deux
    chaînes lisent le même taux BCE annuel 2025 — attrape un taux
    inversé, un mauvais millésime BCE, un mauvais indice CPI et un
    mauvais ordre de transformation."""
    seed_indices(db_session)
    fs = constanteuro.factor_set(db_session, 2025)
    native = Decimal("1090000")
    nominal_convention_4 = native / Decimal(USD_PER_EUR_2025)
    constant = native * fs.factors[("USD", 2025)]
    assert constant == nominal_convention_4


def test_etalonnage_100_usd_2010(db_session):
    """100 USD de 2010, à la main : 100 × (322.132/218.056) / 1.09."""
    seed_indices(db_session)
    fs = constanteuro.factor_set(db_session, 2025)
    value = Decimal(100) * fs.factors[("USD", 2010)]
    assert float(value) == pytest.approx(135.5312144376, abs=1e-6)


def test_annee_sans_indice_absente(db_session):
    """A1 : 2026 n'a pas d'indice publié — pas de facteur, JAMAIS un
    1,0 artificiel."""
    seed_indices(db_session)
    fs = constanteuro.factor_set(db_session, 2025)
    assert ("USD", 2026) not in fs.factors
    assert ("EUR", 2026) not in fs.factors


def test_condition_de_validite_refuse_2026(db_session):
    """La bascule d'année de référence se refuse si l'indice ou le taux
    de l'année demandée manquent (§ 2.1)."""
    seed_indices(db_session)
    assert constanteuro.factor_set(db_session, 2026) is None


def test_condition_de_validite_refuse_sans_taux(db_session):
    """Indices présents mais taux BCE 2025 absent → refus."""
    seed_indices(db_session)
    db_session.query(ExchangeRate).filter_by(currency="USD", year=2025).delete()
    db_session.flush()
    assert constanteuro.factor_set(db_session, 2025) is None


def test_derniere_vintage_gagne(db_session):
    """§ 2.11 : une révision AJOUTE une vintage, le facteur suit la
    dernière — rien n'est réécrit."""
    seed_indices(db_session)
    db_session.add(
        PriceIndex(
            currency="EUR",
            year=2020,
            value=Decimal("104.0"),
            series_source="eurostat",
            series_code="prc_hicp_aind",
            vintage_date=date(2026, 2, 1),
        )
    )
    db_session.add(
        PriceIndex(
            currency="EUR",
            year=2025,
            value=Decimal("128.9"),
            series_source="eurostat",
            series_code="prc_hicp_aind",
            vintage_date=date(2026, 2, 1),
        )
    )
    db_session.flush()
    fs = constanteuro.factor_set(db_session, 2025)
    assert fs.vintages["EUR"] == "2026-02-01"
    assert fs.factors[("EUR", 2020)] == Decimal("128.9") / Decimal("104.0")
    # La vintage 2026-01-15 ne portait que 4 années : la nouvelle en
    # porte 2 — 2010 sort du périmètre EUR, preuve que SEULE la
    # dernière vintage est lue, jamais un mélange.
    assert ("EUR", 2010) not in fs.factors


def test_or_real_usd_meme_realite_economique(db_session):
    """Test-or R1 (R0 § D1) : Real 2025·USD ≡ Real 2025·EUR × taux BCE
    2025 — un scalaire de ré-expression unique appliqué à TOUT le jeu,
    jamais une seconde méthode économique."""
    seed_indices(db_session)
    eur = constanteuro.factor_set(db_session, 2025)
    usd = constanteuro.factor_set(db_session, 2025, display_currency="USD")
    assert usd is not None
    assert usd.display_currency == "USD"
    rate = Decimal(USD_PER_EUR_2025)
    assert set(usd.factors) == set(eur.factors)
    for pair, factor in usd.factors.items():
        assert float(factor) == pytest.approx(float(eur.factors[pair] * rate), rel=1e-15)


def test_or_usd_2025_identite_en_affichage_usd(db_session):
    """Un dollar de l'année de référence, affiché en USD, vaut son
    nominal natif — la même identité que le test-or EUR, dans l'autre
    unité."""
    seed_indices(db_session)
    usd = constanteuro.factor_set(db_session, 2025, display_currency="USD")
    native = Decimal("1090000")
    assert float(native * usd.factors[("USD", 2025)]) == pytest.approx(float(native), rel=1e-15)


def test_devise_affichage_sans_taux_refusee(db_session):
    """Condition de validité étendue (R0 § D1) : pas de taux BCE de
    l'année de référence pour la devise d'affichage → refus complet."""
    seed_indices(db_session)
    assert constanteuro.factor_set(db_session, 2025, display_currency="GBP") is None


def test_bases_honorables_seule_2025(db_session):
    """R0 § D6 : le jeu déclare les années de référence honorables —
    ici seule 2025 porte le taux BCE USD, les autres années d'indices
    ne sont jamais offertes."""
    seed_indices(db_session)
    fs = constanteuro.factor_set(db_session, 2025)
    assert fs.bases == (2025,)


def test_cle_de_cache_distingue_la_devise_affichage(db_session):
    """Jamais de collision EUR/USD dans les caches aval : la devise
    d'affichage entre dans la clé du jeu de facteurs."""
    seed_indices(db_session)
    eur = constanteuro.factor_set(db_session, 2025)
    usd = constanteuro.factor_set(db_session, 2025, display_currency="USD")
    assert eur.key != usd.key


def test_devise_non_couverte_ignoree(db_session):
    """§ 2.3 : une devise hors indice admis n'entre jamais au facteur."""
    seed_indices(db_session)
    db_session.add(
        PriceIndex(
            currency="GBP",
            year=2025,
            value=Decimal("135.0"),
            series_source="ons",
            series_code="TEST",
            vintage_date=VINTAGE,
        )
    )
    db_session.flush()
    fs = constanteuro.factor_set(db_session, 2025)
    assert fs is not None
    assert all(currency in constanteuro.COVERED for currency, _ in fs.factors)
