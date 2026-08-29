"""Porte zéro-dette R4 — le POIDS DE PACTE et les modes du Reference Engine.

Deux défauts préexistants relevés pendant la cartographie R4B, reproduits
ici avant correction.

Le poids de pacte : quand une vue est cadrée sur un GROUPE
(`organisation=g<id>`), l'argent d'une adhésion à 50 % ne compte que
pour moitié — c'est l'argent que le pacte partage, pas les faits. Le
nominal l'applique depuis la couche identité ; les modes de lecture
doivent l'appliquer aussi, sans exception.

Corpus semé, tout calculable à la main (taux USD/EUR 2025 = 1,25 ;
indices de prix à l'identité, donc facteur réel = 1) :

    ACME France reçoit 1 000 M€ en 2025, adhésion au pacte à 50 %.
    PIB FR 2025 = 250 Md$ ; population FR 2025 = 68 M.

    nominal  = 1 000 × 0,5                    =   500,000 M€
    real     = idem (identité d'indices)      =   500,000 M€
    capita   = 500 M€ / 68 M                  =     7,352941 €/hab
    % PIB    = 500 M€ × 1,25 / 250 Md$ × 100  =     0,25 %

Le second projet, sans adhésion au pacte, sert de témoin : il ne doit
apparaître dans AUCUNE de ces vues.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion import constant_euro, macro
from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    EntityGroupMap,
    ExchangeRate,
    Funder,
    Group,
    MacroSeries,
    Organisation,
    Participation,
    PriceIndex,
    Project,
)
from orion.search import explore

MARK = "ZZWGT"
VINTAGE = date(2026, 2, 1)
YEAR = 2025
USD_PER_EUR = "1.25"
GDP_FR = 2.5e11
# Une seconde année, au PIB MOITIÉ moindre : le ratio des sommes s'y
# distingue nettement de la moyenne des ratios annuels.
GDP_FR_2024 = 1.25e11
POP_FR = 6.8e7
YEAR_PREV = 2024
RECU = 1_000_000_000
PART = Decimal("0.5")

ATTENDU_NOMINAL = float(RECU) * float(PART)
ATTENDU_CAPITA = ATTENDU_NOMINAL / POP_FR
ATTENDU_GDP = ATTENDU_NOMINAL * float(USD_PER_EUR) / GDP_FR * 100


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
    for currency, source, code in (
        ("EUR", "eurostat", "prc_hicp_aind"),
        ("USD", "bls", "CUUR0000SA0"),
    ):
        for year in (YEAR_PREV, YEAR):
            db_session.add(
                PriceIndex(
                    currency=currency,
                    year=year,
                    value=Decimal("100"),
                    series_source=source,
                    series_code=code,
                    vintage_date=VINTAGE,
                )
            )
    for year in (YEAR_PREV, YEAR):
        db_session.add(ExchangeRate(currency="USD", year=year, rate_to_eur=Decimal(USD_PER_EUR)))
    for year, gdp in ((YEAR_PREV, GDP_FR_2024), (YEAR, GDP_FR)):
        for concept, series_code, value in (
            ("gdp_current_usd", "NY.GDP.MKTP.CD", gdp),
            ("population", "SP.POP.TOTL", POP_FR),
        ):
            db_session.add(
                MacroSeries(
                    jurisdiction_code="FR",
                    concept=concept,
                    year=year,
                    value=Decimal(str(value)),
                    series_source="wdi",
                    series_code=series_code,
                    vintage_date=VINTAGE,
                )
            )

    ec = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    membre = Organisation(name=f"{MARK} ACME France", country_code="FR", org_type="PRC")
    temoin = Organisation(name=f"{MARK} Témoin France", country_code="FR", org_type="PRC")
    db_session.add_all([membre, temoin])
    db_session.flush()

    groupe = Group(name=f"{MARK} ACME", country_code="FR", source=f"test-{MARK}")
    db_session.add(groupe)
    db_session.flush()
    db_session.add(
        EntityGroupMap(
            organisation_id=membre.id,
            group_id=groupe.id,
            method="curation",
            confidence=Decimal("1.00"),
            source=f"test-{MARK}",
            share=Decimal("50"),
            is_jv=True,
            status="active",
        )
    )

    for suffix, org, amount in (("membre", membre, RECU), ("temoin", temoin, RECU)):
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{suffix}",
            title=f"{MARK} {suffix}",
            funder_id=ec.id,
            funding_amount=amount,
            funding_currency="EUR",
            funding_amount_eur=amount,
            start_date=f"{YEAR}-03-01",
        )
        db_session.add(project)
        db_session.flush()
        db_session.add(
            Participation(
                project_id=project.id,
                organisation_id=org.id,
                role="coordinator",
                country_code="FR",
                amount=amount,
                currency="EUR",
                amount_eur=amount,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-{suffix}",
            )
        )
    projet_2024 = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-membre-{YEAR_PREV}",
        title=f"{MARK} membre {YEAR_PREV}",
        funder_id=ec.id,
        funding_amount=RECU,
        funding_currency="EUR",
        funding_amount_eur=RECU,
        start_date=f"{YEAR_PREV}-03-01",
    )
    db_session.add(projet_2024)
    db_session.flush()
    db_session.add(
        Participation(
            project_id=projet_2024.id,
            organisation_id=membre.id,
            role="coordinator",
            country_code="FR",
            amount=RECU,
            currency="EUR",
            amount_eur=RECU,
            source=f"test-{MARK}",
            source_uid=f"{MARK}-p-membre-{YEAR_PREV}",
        )
    )
    db_session.flush()
    return db_session, groupe.id


def _aggregate(session: Session, group_id: int, value: str | None):
    """La vue cadrée sur le GROUPE, dans le mode demandé."""
    kwargs: dict = {}
    if value in ("real", "capita"):
        kwargs["factor_set"] = constant_euro.factor_set(session, YEAR, display_currency="EUR")
    if value in ("gdp", "capita"):
        kwargs["scale"] = value
        kwargs["macro"] = macro.macro_set(
            session, "gdp_current_usd" if value == "gdp" else "population"
        )
        if value == "gdp":
            kwargs["usd_rates"] = macro.usd_rates(session)
    return explore.aggregate(
        session,
        metric="funding",
        by="country",
        split=False,
        compare=None,
        year_from=YEAR,
        year_to=YEAR,
        q=None,
        country=None,
        scope=None,
        limit=50,
        organisation=f"g{group_id}",
        **kwargs,
    )


def _fr(result) -> float | None:
    return next(s["value"] for s in result["series"] if s["key"] == "FR")


def test_le_poids_de_pacte_s_applique_au_nominal(seeded):
    """Le témoin, hors pacte, n'est pas dans la vue ; le membre y compte
    pour la moitié de ce qu'il a reçu."""
    session, group_id = seeded
    assert _fr(_aggregate(session, group_id, None)) == pytest.approx(ATTENDU_NOMINAL)


def test_le_poids_de_pacte_s_applique_au_reel(seeded):
    session, group_id = seeded
    assert _fr(_aggregate(session, group_id, "real")) == pytest.approx(ATTENDU_NOMINAL)


def test_le_poids_de_pacte_s_applique_au_par_habitant(seeded):
    """DÉFAUT R3 corrigé : la surcharge de poids reconstruisait la colonne
    depuis `_funding_col`, qui ne connaît que nominal et réel — elle
    écrasait donc la division par la population, et le par-habitant
    servait des EUROS. Restaurer l'ancien code fait échouer ce test de
    sept ordres de grandeur."""
    session, group_id = seeded
    valeur = _fr(_aggregate(session, group_id, "capita"))
    assert valeur == pytest.approx(ATTENDU_CAPITA)
    # Le garde qui dit POURQUOI il échoue si le défaut revient : la
    # valeur servie était le montant réel pondéré, pas un par-habitant.
    assert valeur != pytest.approx(ATTENDU_NOMINAL)


def test_le_poids_de_pacte_s_applique_au_pourcentage_de_pib(seeded):
    """DÉFAUT R3 corrigé : la branche à DEUX NIVEAUX du % PIB construit
    son propre SQL et n'a jamais lu `cols["funding"]` — le poids de pacte
    y était ignoré, et l'intensité servie valait le double du vrai. Le
    ratio des sommes de R3 reste la formule : 100 × Σ financement_USD /
    Σ PIB_USD sur les mêmes années valides."""
    session, group_id = seeded
    valeur = _fr(_aggregate(session, group_id, "gdp"))
    assert valeur == pytest.approx(ATTENDU_GDP)
    # Sans le poids, l'intensité vaudrait exactement le double.
    assert valeur != pytest.approx(ATTENDU_GDP * 2)


def test_le_classement_reste_nominal_et_pondere(seeded):
    """Le Top vient du nominal — pondéré lui aussi, sinon l'échantillon
    d'une vue de groupe ne serait pas celui du nominal de la même vue."""
    session, group_id = seeded
    nominal = _aggregate(session, group_id, None)
    for mode in ("real", "capita", "gdp"):
        autre = _aggregate(session, group_id, mode)
        assert [s["key"] for s in autre["series"]] == [s["key"] for s in nominal["series"]], mode


def test_les_modes_sans_groupe_sont_inchanges(seeded):
    """Le correctif ne touche que le chemin pondéré : hors groupe, les
    deux projets comptent en entier, dans tous les modes."""
    session, _ = seeded
    total = float(RECU) * 2

    def sans_groupe(value: str | None):
        kwargs: dict = {}
        if value in ("real", "capita"):
            kwargs["factor_set"] = constant_euro.factor_set(session, YEAR, display_currency="EUR")
        if value in ("gdp", "capita"):
            kwargs["scale"] = value
            kwargs["macro"] = macro.macro_set(
                session, "gdp_current_usd" if value == "gdp" else "population"
            )
            if value == "gdp":
                kwargs["usd_rates"] = macro.usd_rates(session)
        return explore.aggregate(
            session,
            metric="funding",
            by="country",
            split=False,
            compare=None,
            year_from=YEAR,
            year_to=YEAR,
            q=None,
            country=None,
            scope=None,
            limit=50,
            **kwargs,
        )

    assert _fr(sans_groupe(None)) == pytest.approx(total)
    assert _fr(sans_groupe("real")) == pytest.approx(total)
    assert _fr(sans_groupe("capita")) == pytest.approx(total / POP_FR)
    assert _fr(sans_groupe("gdp")) == pytest.approx(total * float(USD_PER_EUR) / GDP_FR * 100)


def test_la_formule_agregee_du_pib_reste_le_ratio_des_sommes(seeded):
    """Verrou R3, sous poids de pacte. Sur deux années, l'intensité est
    100 × Σ financement_USD / Σ PIB_USD — l'intensité pondérée par le
    PIB, jamais la moyenne arithmétique des pourcentages annuels.

    Ici : 500 M€ pondérés chaque année, PIB 125 Md$ en 2024 et 250 Md$
    en 2025.
      ratio des sommes   = 100 × (625 + 625) / (125 000 + 250 000) = 0,3333 %
      moyenne des ratios = (0,5 + 0,25) / 2                        = 0,375 %
    Les deux se distinguent : le test attrape une régression vers la
    moyenne comme il attrape la perte du poids."""
    session, group_id = seeded
    result = explore.aggregate(
        session,
        metric="funding",
        by="country",
        split=False,
        compare=None,
        year_from=YEAR_PREV,
        year_to=YEAR,
        q=None,
        country=None,
        scope=None,
        limit=50,
        organisation=f"g{group_id}",
        scale="gdp",
        macro=macro.macro_set(session, "gdp_current_usd"),
        usd_rates=macro.usd_rates(session),
    )
    numerateur = ATTENDU_NOMINAL * float(USD_PER_EUR) * 2
    ratio_des_sommes = 100 * numerateur / (GDP_FR_2024 + GDP_FR)
    moyenne_des_ratios = (
        ATTENDU_NOMINAL * float(USD_PER_EUR) / GDP_FR_2024 * 100
        + ATTENDU_NOMINAL * float(USD_PER_EUR) / GDP_FR * 100
    ) / 2

    valeur = _fr(result)
    assert valeur == pytest.approx(ratio_des_sommes)
    assert valeur != pytest.approx(moyenne_des_ratios)
    # Et sans le poids, le numérateur doublerait.
    assert valeur != pytest.approx(ratio_des_sommes * 2)


def test_la_branche_a_deux_niveaux_pondere_la_serie_temporelle(seeded):
    """La même branche sert la vue éclatée par année : chaque année y
    porte son propre ratio, poids compris."""
    session, group_id = seeded
    result = explore.aggregate(
        session,
        metric="funding",
        by="country",
        split=True,
        compare=None,
        year_from=YEAR_PREV,
        year_to=YEAR,
        q=None,
        country=None,
        scope=None,
        limit=50,
        organisation=f"g{group_id}",
        scale="gdp",
        macro=macro.macro_set(session, "gdp_current_usd"),
        usd_rates=macro.usd_rates(session),
    )
    par_annee = {p["year"]: p["value"] for serie in result["series"] for p in serie["points"]}
    assert par_annee[YEAR] == pytest.approx(ATTENDU_GDP)
    assert par_annee[YEAR_PREV] == pytest.approx(
        ATTENDU_NOMINAL * float(USD_PER_EUR) / GDP_FR_2024 * 100
    )
