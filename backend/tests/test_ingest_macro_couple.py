"""Lot R4B — le couple PPP est une UNITÉ D'ÉCRITURE.

`gdp_ppp_current_intl / gdp_current_usd` n'a de sens que si les deux
séries viennent du même état de la source. Or `vintage_date` est la date
d'ingestion Orion, écrite par (juridiction, concept) et seulement si les
valeurs changent : deux concepts cohérents porteraient des dates
différentes, et « dernière vintage de chacun » ne prouverait rien.

Ces tests portent sur la phase d'écriture seule (`store`), sans réseau :
les dicts que le fetch aurait produits sont injectés tels quels.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest import macro as ingest_macro
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats

J1 = date(2026, 3, 2)
J2 = date(2026, 3, 9)


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


def fetched(ppp: dict, usd: dict, pop: dict | None = None) -> dict:
    """Le jeu que `fetch_all` aurait rendu. L'ancre US est toujours
    présente et à ratio 1 : `_check_couple` l'exige."""
    return {
        "gdp_ppp_current_intl": {"US": {2025: 2.0e13}, **ppp},
        "gdp_current_usd": {"US": {2025: 2.0e13}, **usd},
        "population": pop or {},
    }


def vintages(session: Session, code: str) -> dict[str, date]:
    rows = session.execute(
        text(
            "SELECT concept, max(vintage_date) FROM macro_series"
            " WHERE jurisdiction_code = :j GROUP BY concept"
        ),
        {"j": code},
    )
    return {str(concept): vintage for concept, vintage in rows}


def rows_of(session: Session, code: str, concept: str) -> dict[date, dict[int, Decimal]]:
    rows = session.execute(
        text(
            "SELECT vintage_date, year, value FROM macro_series"
            " WHERE jurisdiction_code = :j AND concept = :c"
        ),
        {"j": code, "c": concept},
    )
    out: dict[date, dict[int, Decimal]] = {}
    for vintage, year, value in rows:
        out.setdefault(vintage, {})[int(year)] = Decimal(value)
    return out


def test_premier_chargement_ecrit_le_couple_a_la_meme_date(db_session):
    """Le cas du jour 1. `gdp_current_usd` peut être inchangé depuis des
    semaines : sans la règle de couple, seul le concept neuf partirait à
    la date du jour et l'invariant serait violé dès le premier run."""
    ingest_macro.store(
        db_session,
        fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}}),
        J1,
        RunStats(),
    )
    db_session.flush()

    assert vintages(db_session, "FR") == {
        "gdp_ppp_current_intl": J1,
        "gdp_current_usd": J1,
    }


def test_un_concept_bouge_les_deux_sont_reecrits_a_la_meme_date(db_session):
    stats = RunStats()
    ingest_macro.store(
        db_session, fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}}), J1, stats
    )
    db_session.flush()

    # Seul le numérateur change ; le dénominateur suit quand même.
    stats2 = RunStats()
    ingest_macro.store(
        db_session, fetched({"FR": {2025: 4.0e12}}, {"FR": {2025: 3.0e12}}), J2, stats2
    )
    db_session.flush()

    assert vintages(db_session, "FR") == {
        "gdp_ppp_current_intl": J2,
        "gdp_current_usd": J2,
    }
    # Le dénominateur inchangé a bien été réécrit — et c'est compté.
    assert stats2.counts["couple_paired_writes"] >= 1
    assert rows_of(db_session, "FR", "gdp_current_usd")[J2] == {2025: Decimal("3000000000000.0000")}
    # L'historique reste : la vintage J1 n'est pas détruite.
    assert set(rows_of(db_session, "FR", "gdp_current_usd")) == {J1, J2}


def test_second_run_identique_n_ecrit_rien(db_session):
    payload = fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}})
    ingest_macro.store(db_session, payload, J1, RunStats())
    db_session.flush()

    stats = RunStats()
    ingest_macro.store(db_session, payload, J2, stats)
    db_session.flush()

    assert stats.counts["gdp_ppp_current_intl_vintages"] == 0
    assert stats.counts["gdp_current_usd_vintages"] == 0
    assert vintages(db_session, "FR") == {
        "gdp_ppp_current_intl": J1,
        "gdp_current_usd": J1,
    }


def test_etat_depareille_est_repare_sans_changement_de_valeur(db_session):
    """L'auto-réparation. Les valeurs n'ayant pas bougé, `_differs` rend
    False des deux côtés : sans déclencheur sur les DATES, l'état
    dépareillé attendrait la prochaine révision de la source."""
    payload = fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}})
    ingest_macro.store(db_session, payload, J1, RunStats())
    db_session.flush()
    # On fabrique le désalignement à la main.
    db_session.execute(
        text(
            "UPDATE macro_series SET vintage_date = :v"
            " WHERE jurisdiction_code = 'FR' AND concept = 'gdp_ppp_current_intl'"
        ),
        {"v": J2},
    )
    db_session.flush()
    assert ingest_macro._vintages_disagree(db_session, "FR")

    stats = RunStats()
    ingest_macro.store(db_session, payload, date(2026, 3, 16), stats)
    db_session.flush()

    assert not ingest_macro._vintages_disagree(db_session, "FR")
    assert stats.counts["couple_vintage_repairs"] == 1


def test_ecrasement_du_meme_jour_est_compte(db_session):
    """La table est append-only ENTRE jours, pas DANS la journée : une
    seconde écriture du même jour remplace la première. Le comportement
    est celui de R3 ; ce qui change, c'est qu'il cesse d'être muet."""
    ingest_macro.store(
        db_session, fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}}), J1, RunStats()
    )
    db_session.flush()

    stats = RunStats()
    ingest_macro.store(
        db_session, fetched({"FR": {2025: 4.2e12}}, {"FR": {2025: 3.0e12}}), J1, stats
    )
    db_session.flush()

    stored = rows_of(db_session, "FR", "gdp_ppp_current_intl")
    assert set(stored) == {J1}  # aucune vintage de plus
    assert stored[J1] == {2025: Decimal("4200000000000.0000")}  # les valeurs du matin ont disparu
    assert stats.counts["gdp_ppp_current_intl_sameday_overwrites"] == 1


def test_juridiction_a_un_seul_concept_n_est_pas_une_faute(db_session):
    """Une poignée d'économies publient le PIB en dollars sans le PIB en
    dollars internationaux : ce n'est pas un désalignement, et les
    réécrire à chaque run ne servirait à rien."""
    payload = fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}, "CU": {2025: 1.0e11}})
    ingest_macro.store(db_session, payload, J1, RunStats())
    db_session.flush()

    assert not ingest_macro._vintages_disagree(db_session, "CU")
    stats = RunStats()
    ingest_macro.store(db_session, payload, J2, stats)
    db_session.flush()
    assert stats.counts["couple_vintage_repairs"] == 0
    assert vintages(db_session, "CU") == {"gdp_current_usd": J1}


def test_population_garde_le_comportement_r3(db_session):
    """Le concept hors couple n'est pas entraîné : il ne s'écrit que
    lorsque SES valeurs changent."""
    ingest_macro.store(
        db_session,
        fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}}, {"FR": {2025: 6.8e7}}),
        J1,
        RunStats(),
    )
    db_session.flush()
    ingest_macro.store(
        db_session,
        fetched({"FR": {2025: 4.0e12}}, {"FR": {2025: 3.0e12}}, {"FR": {2025: 6.8e7}}),
        J2,
        RunStats(),
    )
    db_session.flush()

    assert vintages(db_session, "FR")["population"] == J1


def test_garde_fou_ancre_us(db_session):
    payload = fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}})
    payload["gdp_ppp_current_intl"]["US"] = {2025: 2.4e13}  # ratio 1,2 : impossible
    with pytest.raises(ValueError, match="devrait valoir 1"):
        ingest_macro.store(db_session, payload, J1, RunStats())


def test_garde_fou_bande_de_plausibilite(db_session):
    payload = fetched({"FR": {2025: 9.9e13}}, {"FR": {2025: 3.0e12}})  # ratio 33
    with pytest.raises(ValueError, match="hors bande"):
        ingest_macro.store(db_session, payload, J1, RunStats())


def test_garde_fou_regression_de_couverture(db_session):
    ingest_macro.store(
        db_session,
        fetched({"FR": {2024: 3.8e12, 2025: 3.9e12}}, {"FR": {2024: 2.9e12, 2025: 3.0e12}}),
        J1,
        RunStats(),
    )
    db_session.flush()
    with pytest.raises(ValueError, match="couverture en régression"):
        ingest_macro.store(
            db_session, fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}}), J2, RunStats()
        )


def test_valeur_non_positive_refusee(db_session):
    payload = fetched({"FR": {2025: 3.9e12}}, {"FR": {2025: 3.0e12}})
    payload["population"] = {"FR": {2025: -1.0}}
    with pytest.raises(ValueError, match="valeur non positive"):
        ingest_macro.store(db_session, payload, J1, RunStats())
