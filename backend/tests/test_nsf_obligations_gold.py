"""R5B — gold tests production-like sur les ARTEFACTS OFFICIELS RÉELS.

Ces tests ingèrent le snapshot « NSF by the Numbers » acquis le
2026-08-26 (contrat § 20.1 C2) et verrouillent les valeurs officielles
constatées — dont les quatre Award IDs de preuve R5A, pour qu'aucun
refactor ne réintroduise la règle d'instrument invalidée (§ 9.4.9).

Skip ATTENDU ET NOMMÉ sur un poste sans artefacts (la CI n'a pas le
répertoire d'acquisition — les artefacts ne sont jamais commités) ;
sur le poste d'acquisition, ils tournent toujours.
"""

import os
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import text

from orion.core.db import SessionLocal
from orion.ingest.nsf_obligations import load as obligations_load

# Le magasin durable (régime data/, promotion du runbook § 2) — le
# dernier millésime, comme l'ingestion de production.
_STORE = Path(__file__).resolve().parents[1] / "data" / "r5-nsf"
_VINTAGES = sorted(p for p in _STORE.iterdir() if p.is_dir()) if _STORE.is_dir() else []
ARTIFACT_DIR = _VINTAGES[-1] if _VINTAGES else _STORE

pytestmark = pytest.mark.skipif(
    not (ARTIFACT_DIR / "award-details-fy2019.tsv").exists(),
    reason="artefacts officiels non présents (poste sans magasin r5-nsf promu)",
)

# Valeurs OFFICIELLES constatées (série Trends du millésime 2026-08-26,
# § 9.4.6) — en dollars, converties du format affiché « $X,XXX.XXM ».
TREND_SCREEN = {
    2016: Decimal("7071840000"),
    2017: Decimal("6982040000"),
    2018: Decimal("7417980000"),
    2019: Decimal("7688610000"),
    2020: Decimal("7750690000"),
    2021: Decimal("8118560000"),
    2022: Decimal("8541760000"),
    2023: Decimal("8653720000"),
    2024: Decimal("8429420000"),
    2025: Decimal("8601820000"),
}


@pytest.fixture(scope="module")
def gold(test_database):
    """Ingestion réelle des artefacts dans la base de test."""
    session = SessionLocal()
    os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(ARTIFACT_DIR)
    try:
        counts = obligations_load.run(force=True)
        yield counts
    finally:
        os.environ.pop("ORION_NSF_OBLIGATIONS_DIR", None)
        for table in (
            "nsf_award_obligations",
            "nsf_obligation_totals",
            "nsf_obligation_artifacts",
        ):
            session.execute(text(f"DELETE FROM {table}"))
        session.execute(text("DELETE FROM ingestion_runs WHERE source = 'nsf-obligations'"))
        session.commit()
        session.close()


def _totals(session):
    return {
        int(r[0]): {
            "official": Decimal(r[1]),
            "trend": Decimal(r[2]) if r[2] is not None else None,
            "joinable": Decimal(r[3]),
            "unjoinable": Decimal(r[4]),
            "coverage": Decimal(r[5]),
            "available": bool(r[6]),
        }
        for r in session.execute(
            text(
                "SELECT fiscal_year, official_total, trend_total, joinable_total,"
                " unjoinable_total, coverage, available FROM nsf_obligation_totals"
                " ORDER BY fiscal_year"
            )
        )
    }


def test_gold_les_quinze_exercices_sont_charges(gold):
    session = SessionLocal()
    try:
        totals = _totals(session)
        assert sorted(totals) == list(range(2011, 2026))
        vintage = (
            session.execute(text("SELECT DISTINCT vintage_date FROM nsf_obligation_totals"))
            .scalars()
            .all()
        )
        assert vintage == [date.today()]
    finally:
        session.close()


def test_gold_totaux_officiels_contre_la_serie_trends(gold):
    """Σ des détails ↔ valeur affichée : tolérance = le seul arrondi
    d'affichage (demi-centime de million), § 20.1 C2/C4."""
    session = SessionLocal()
    try:
        totals = _totals(session)
        for fy, screen in TREND_SCREEN.items():
            stored_trend = totals[fy]["trend"]
            assert stored_trend == screen, f"FY{fy}: trend stocké ≠ écran"
            gap = abs(totals[fy]["official"] - screen)
            assert gap <= Decimal("5000"), f"FY{fy}: écart {gap} > tolérance"
        # FY2011-2015 : pas de valeur Trends (fenêtre décennale de la
        # vue) — le contrôle est neutre, jamais un zéro inventé.
        for fy in range(2011, 2016):
            assert totals[fy]["trend"] is None
    finally:
        session.close()


def test_gold_fy2019_verrouille_au_dollar(gold):
    """La valeur constatée à la première ingestion réelle, gravée."""
    session = SessionLocal()
    try:
        official = session.execute(
            text("SELECT official_total FROM nsf_obligation_totals WHERE fiscal_year = 2019")
        ).scalar()
        assert Decimal(official) == Decimal("7688613472.95")
    finally:
        session.close()


def test_gold_les_preuves_r5a(gold):
    """Les quatre Award IDs de preuve (§ 9.4.9) : si un filtre
    d'instrument revient, 1902627/2221247 disparaissent et ce test
    casse ; si l'éligibilité cesse d'être héritée du snapshot, 2102180
    apparaît et ce test casse aussi."""
    session = SessionLocal()
    try:
        row = session.execute(
            text(
                "SELECT amount, award_instrument, funding_division FROM nsf_award_obligations"
                " WHERE award_id = '1902627' AND fiscal_year = 2019"
            )
        ).one()
        assert Decimal(row[0]) == Decimal("82740404.00")
        assert row[1] == "Contract Interagency Agreement"
        assert row[2] == "OPP"

        amount_2221247 = session.execute(
            text(
                "SELECT amount FROM nsf_award_obligations"
                " WHERE award_id = '2221247' AND fiscal_year = 2022"
            )
        ).scalar()
        assert Decimal(amount_2221247) == Decimal("55000000.00")

        absent = session.execute(
            text("SELECT count(*) FROM nsf_award_obligations WHERE award_id = '2102180'")
        ).scalar()
        assert absent == 0

        prior_year = session.execute(
            text(
                "SELECT count(DISTINCT fiscal_year), count(DISTINCT funding_division)"
                " FROM nsf_award_obligations WHERE award_id = '1823600'"
            )
        ).one()
        assert prior_year[0] >= 7  # increments sur les exercices suivants
        assert prior_year[1] >= 2  # scindé par funding division
    finally:
        session.close()


def test_gold_reconciliation_coherente_et_sans_renormalisation(gold):
    session = SessionLocal()
    try:
        totals = _totals(session)
        for fy, t in totals.items():
            assert t["joinable"] + t["unjoinable"] == t["official"], f"FY{fy}"
            recomputed = (t["joinable"] / t["official"]).quantize(Decimal("0.0001"))
            assert t["coverage"] == recomputed, f"FY{fy}: coverage ≠ recalcul"
            assert t["available"] == (t["coverage"] >= Decimal("0.95")), f"FY{fy}"
        detail = session.execute(
            text("SELECT sum(amount) FROM nsf_award_obligations WHERE fiscal_year = 2019")
        ).scalar()
        assert Decimal(detail) == totals[2019]["official"]
    finally:
        session.close()
