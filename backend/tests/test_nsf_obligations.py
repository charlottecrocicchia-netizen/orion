"""R5B — `Share of NSF award obligations`, du parseur à l'API.

Le contrat gelé (R5A § 19, § 20.1 C1-C5) est la référence de chaque
assertion. Les tests sont conçus pour ÉCHOUER si l'on réintroduit :
un filtre d'instrument (règle invalidée sur preuve, § 9.4.9), une
moyenne de ratios annuels, une renormalisation de couverture, un
rattachement à `project.start_year` ou `project.amount`, ou la
réinterprétation de `time=`/`fy=` d'une surface à l'autre.
"""

import json
import os
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal, engine
from orion.ingest.nsfobligations import load as obligations_load
from orion.ingest.nsfobligations import parse
from orion.search import nsfobligations

MARK = "ZZR5B"

HEADER = (
    "Award ID",
    "Fiscal Year",
    "Award Fiscal Year",
    "Funding Directorate",
    "Funding Division",
    "Award Instrument",
    "Managing Directorate",
    "Managing Division",
    "Institution ID",
    "Institution Name",
    "Institution State Code",
    "Country Code",
    "Award Obligation Amount",
    "Award Title",  # colonne surnuméraire : le lookup se fait par nom
)


def tsv(rows: list[tuple[str, ...]], header: tuple[str, ...] = HEADER) -> bytes:
    """Un artefact synthétique au format constaté : tabulé UTF-16LE + BOM,
    lignes CRLF — construit octet par octet, comme Tableau le sert."""
    lines = ["\t".join(header)] + ["\t".join(row) for row in rows]
    return ("﻿" + "\r\n".join(lines) + "\r\n").encode("utf-16-le")


def detail_row(
    award: str,
    fy: str,
    amount: str,
    *,
    award_fy: str = "",
    directorate: str = "Directorate for Geosciences",
    division: str = "Division Of Ocean Sciences",
    instrument: str = "Standard Grant",
    state: str = "CA",
    country: str = "US",
) -> tuple[str, ...]:
    return (
        award,
        fy,
        award_fy or fy,
        directorate,
        division,
        instrument,
        directorate,
        division,
        f"I{award}",
        f"Institution {award}",
        state,
        country,
        amount,
        f"Titre {award}",
    )


# ---------------------------------------------------------------- parseur


def test_parser_refuse_sans_bom():
    raw = b"Award ID\tFiscal Year\r\n"
    with pytest.raises(parse.ArtifactFormatError, match="BOM UTF-16LE"):
        parse.parse_award_details(raw, filename="x.tsv")


def test_parser_en_us_montants_et_grain():
    raw = tsv(
        [
            detail_row("7000001", "2022", "$600,000.00"),
            detail_row("7000001", "2022", "$150,000.00", division="Office of Polar Programs"),
            detail_row("9999999", "2022", "-$1,234.56"),
            detail_row("9999998", "2022", "$-491.58"),
        ]
    )
    rows = parse.parse_award_details(raw, filename="x.tsv")
    assert [r.amount for r in rows] == [
        Decimal("600000.00"),
        Decimal("150000.00"),
        Decimal("-1234.56"),
        Decimal("-491.58"),
    ]
    assert rows[0].fiscal_year == 2022
    assert rows[1].funding_division == "Office of Polar Programs"


def test_parser_fr_espaces_insecables_et_annee_formatee():
    # Locale fr : « $1 000 000,00 » (insécables) et année « 2 023 ».
    raw = tsv([detail_row("7000002", "2 023", "$1 000 000,00")])
    rows = parse.parse_award_details(raw, filename="x.tsv")
    assert rows[0].amount == Decimal("1000000.00")
    assert rows[0].fiscal_year == 2023


def test_parser_refuse_le_melange_de_locales():
    raw = tsv(
        [
            detail_row("7000001", "2022", "$600,000.00"),
            detail_row("7000002", "2022", "$1 000 000,00"),
        ]
    )
    with pytest.raises(parse.ArtifactFormatError, match="hors format en-US"):
        parse.parse_award_details(raw, filename="x.tsv")


def test_parser_refuse_colonne_manquante():
    header = tuple(c for c in HEADER if c != "Award Obligation Amount")
    raw = tsv([], header=header)
    with pytest.raises(parse.ArtifactFormatError, match="colonnes absentes"):
        parse.parse_award_details(raw, filename="x.tsv")


def test_parser_refuse_largeur_incoherente():
    raw = tsv([("7000001", "2022")])
    with pytest.raises(parse.ArtifactFormatError, match="champs pour"):
        parse.parse_award_details(raw, filename="x.tsv")


def test_parser_trend_millions_abreges():
    grid = "\r\n".join(
        [
            "\t2022\t2023\t2024",
            "Award Obligation Amount\t$1,00M\t$1,50M\t",
        ]
    )
    raw = ("﻿" + grid + "\r\n").encode("utf-16-le")
    totals = parse.parse_trend_totals(raw, filename="trend.tsv")
    assert totals == {2022: Decimal("1000000.00"), 2023: Decimal("1500000.00")}


# ------------------------------------------------------------- ingestion

FY19 = "award-details-fy2019.tsv"
FY22 = "award-details-fy2022.tsv"
FY23 = "award-details-fy2023.tsv"
TREND = "trend-awards-obligated-amount-blue.tsv"


def write_artifact(directory, name: str, raw: bytes, sheet: str = "@Award Details Sheet"):
    path = directory / name
    path.write_bytes(raw)
    meta = {
        "source_url": "https://tableau.external.nsf.gov/views/NSFbyNumbers/Details",
        "sheet": sheet,
        "filters": {"Fiscal Year": name},
        "acquired_at": "2026-08-26T12:00:00+00:00",
        "codebook_version": "v1.0.7 (April 2026)",
        "sha256": obligations_load._sha256(raw),
        "bytes": len(raw),
        "method": "test-fixture",
    }
    (directory / f"{name}.meta.json").write_text(json.dumps(meta))
    return path


def build_artifacts(directory):
    """Le corpus synthétique calculable à la main.

    FY2022 (en-US) : 7000001 → 600k + 150k (deux funding divisions, même
    award, même FY) ; 7000002 → 240k en « Contract Interagency
    Agreement » (INCLUS, § 9.4.9) ; 9999999 → 10k, non joignable.
      official = 1 000 000 ; joinable = 990 000 ; coverage = 0,99.
    FY2023 (fr) : 7000001 → 1 000k (increment prior-year : Award Fiscal
    Year 2022) ; 7000002 → 500k. official = 1 500 000 ; coverage 1,0.
    FY2019 : 1 000k entièrement non joignable → coverage 0 → fermé.
    Trend : $1,00M / $1,50M / $1,00M — cohérent à l'arrondi près.

    Ratio des sommes attendu pour 7000001 sur 2022..2023 :
      (750k + 1 000k) / (1 000k + 1 500k) = 70,00 %
    quand la moyenne des ratios annuels dirait 70,83 % — le test tient
    la différence."""
    write_artifact(
        directory,
        FY22,
        tsv(
            [
                detail_row("7000001", "2022", "$600,000.00"),
                detail_row(
                    "7000001",
                    "2022",
                    "$150,000.00",
                    division="Office of Polar Programs (OPP)",
                ),
                detail_row(
                    "7000002",
                    "2022",
                    "$240,000.00",
                    instrument="Contract Interagency Agreement",
                    state="VA",
                ),
                detail_row("9999999", "2022", "$10,000.00", state="AK"),
            ]
        ),
    )
    write_artifact(
        directory,
        FY23,
        tsv(
            [
                detail_row("7000001", "2 023", "$1 000 000,00", award_fy="2022"),
                detail_row("7000002", "2 023", "$500 000,00", state="VA"),
            ]
        ),
    )
    write_artifact(directory, FY19, tsv([detail_row("1111111", "2019", "$1,000,000.00")]))
    grid = "\r\n".join(["\t2019\t2022\t2023", "Award Obligation Amount\t$1,00M\t$1,00M\t$1,50M"])
    write_artifact(
        directory,
        TREND,
        ("﻿" + grid + "\r\n").encode("utf-16-le"),
        sheet="Trend-Awards Obligated Amount (Blue)",
    )


@pytest.fixture(scope="module")
def corpus(test_database, tmp_path_factory):
    """Participations NSF committées + artefacts synthétiques ingérés."""
    directory = tmp_path_factory.mktemp("r5-artifacts")
    build_artifacts(directory)
    session = SessionLocal()
    try:
        session.execute(
            text(
                "INSERT INTO countries (code, name_en, region, eu_member)"
                " VALUES ('US','United States','americas',false),"
                "        ('DE','Germany','europe',true)"
                " ON CONFLICT (code) DO NOTHING"
            )
        )
        funder_id = session.execute(
            text(
                f"INSERT INTO funders (code, name, jurisdiction, default_currency)"
                f" VALUES ('{MARK}', 'NSF {MARK}', 'US', 'USD') RETURNING id"
            )
        ).scalar_one()
        for uid, name, country in (
            ("7000001", f"{MARK} Alpha", "US"),
            ("7000002", f"{MARK} Beta", "DE"),
            ("0856145", f"{MARK} Gamma", "US"),
        ):
            org_id = session.execute(
                text(
                    "INSERT INTO organisations (name, country_code, org_type)"
                    " VALUES (:n, :c, 'HES') RETURNING id"
                ),
                {"n": name, "c": country},
            ).scalar_one()
            project_id = session.execute(
                text(
                    "INSERT INTO projects (source, source_id, title, funder_id,"
                    " funding_amount, funding_currency, start_date)"
                    " VALUES ('nsf', :sid, :t, :f, 1, 'USD', '2022-01-01') RETURNING id"
                ),
                {"sid": f"{MARK}{uid}", "t": f"P {uid}", "f": funder_id},
            ).scalar_one()
            session.execute(
                text(
                    "INSERT INTO participations (project_id, organisation_id, role,"
                    " country_code, amount, currency, source, source_uid)"
                    " VALUES (:p, :o, 'coordinator', :c, 1, 'USD', 'nsf', :u)"
                ),
                {"p": project_id, "o": org_id, "c": country, "u": uid},
            )
        session.commit()

        os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(directory)
        counts = obligations_load.run()
        assert counts["fiscal_years"] == 3
        assert counts["available_years"] == 2  # FY2019 fermé (coverage 0)
        yield directory
    finally:
        os.environ.pop("ORION_NSF_OBLIGATIONS_DIR", None)
        session.rollback()
        for table in (
            "nsf_award_obligations",
            "nsf_obligation_totals",
            "nsf_obligation_artifacts",
        ):
            session.execute(text(f"DELETE FROM {table}"))
        session.execute(
            text("DELETE FROM participations WHERE source_uid LIKE :m OR source = 'nsf'"),
            {"m": f"{MARK}%"},
        )
        session.execute(text("DELETE FROM projects WHERE source_id LIKE :m"), {"m": f"{MARK}%"})
        session.execute(text("DELETE FROM organisations WHERE name LIKE :m"), {"m": f"{MARK}%"})
        session.execute(text("DELETE FROM funders WHERE code = :m"), {"m": MARK})
        session.execute(text("DELETE FROM ingestion_runs WHERE source = 'nsf-obligations'"))
        session.commit()
        session.close()


def test_ingestion_totaux_et_couverture(corpus):
    session = SessionLocal()
    try:
        rows = session.execute(
            text(
                "SELECT fiscal_year, official_total, joinable_total, coverage, available"
                " FROM nsf_obligation_totals ORDER BY fiscal_year"
            )
        ).all()
        assert [(int(r[0]), Decimal(r[1]), Decimal(r[2])) for r in rows] == [
            (2019, Decimal("1000000.00"), Decimal("0.00")),
            (2022, Decimal("1000000.00"), Decimal("990000.00")),
            (2023, Decimal("1500000.00"), Decimal("1500000.00")),
        ]
        availability = {int(r[0]): bool(r[4]) for r in rows}
        assert availability == {2019: False, 2022: True, 2023: True}
    finally:
        session.close()


def test_ingestion_le_contract_est_inclus(corpus):
    """§ 9.4.9 : les Contract Interagency Agreements sont DANS la
    métrique officielle. Si un filtre d'instrument réapparaît, la ligne
    disparaît ou le total officiel baisse — ce test casse."""
    session = SessionLocal()
    try:
        amount = session.execute(
            text(
                "SELECT sum(amount) FROM nsf_award_obligations"
                " WHERE award_instrument = 'Contract Interagency Agreement'"
            )
        ).scalar()
        assert Decimal(amount) == Decimal("240000.00")
        official = session.execute(
            text("SELECT official_total FROM nsf_obligation_totals WHERE fiscal_year = 2022")
        ).scalar()
        # 1 000 000 CONTIENT les 240k du contract : pas de filtre.
        assert Decimal(official) == Decimal("1000000.00")
    finally:
        session.close()


def test_ingestion_award_multi_fy_et_multi_division(corpus):
    session = SessionLocal()
    try:
        rows = session.execute(
            text(
                "SELECT fiscal_year, funding_division, amount FROM nsf_award_obligations"
                " WHERE award_id = '7000001' ORDER BY fiscal_year, funding_division"
            )
        ).all()
        assert len(rows) == 3  # 2 divisions en FY2022 + 1 en FY2023
        prior = session.execute(
            text(
                "SELECT award_fiscal_year FROM nsf_award_obligations"
                " WHERE award_id = '7000001' AND fiscal_year = 2023"
            )
        ).scalar()
        assert int(prior) == 2022  # increment prior-year, accepté tel quel
    finally:
        session.close()


def test_ingestion_absent_du_snapshot_reste_absent(corpus):
    """L'éligibilité est la présence dans le snapshot : un award Orion
    (0856145, semé) absent des artefacts n'existe nulle part côté R5."""
    session = SessionLocal()
    try:
        n = session.execute(
            text("SELECT count(*) FROM nsf_award_obligations WHERE award_id = '0856145'")
        ).scalar()
        assert n == 0
    finally:
        session.close()


def test_ingestion_rejoue_sans_changement(corpus):
    counts = obligations_load.run()
    assert counts == {"unchanged": 0}


def test_ingestion_sha_divergent_refuse(corpus, tmp_path):
    build_artifacts(tmp_path)
    (tmp_path / FY22).write_bytes(tsv([detail_row("7000001", "2022", "$1.00")]))
    os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(tmp_path)
    try:
        with pytest.raises(parse.ArtifactFormatError, match="SHA256 divergent"):
            obligations_load.run()
    finally:
        os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(corpus)


def test_ingestion_exercice_etranger_refuse(corpus, tmp_path):
    raw = tsv([detail_row("7000001", "2023", "$1.00")])
    write_artifact(tmp_path, FY22, raw)
    os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(tmp_path)
    try:
        with pytest.raises(parse.ArtifactFormatError, match="exercices étrangers"):
            obligations_load.run()
    finally:
        os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(corpus)


def test_ingestion_ligne_identique_refusee_lignes_voisines_acceptees(corpus, tmp_path):
    """Le crosstab est un agrégat : une ligne RIGOUREUSEMENT identique
    dupliquée est un artefact corrompu (refus) — mais deux lignes du
    même award ne différant que par une dimension (montant, division,
    managing…) sont le grain officiel réel, acceptées telles quelles."""
    raw = tsv(
        [
            detail_row("7000001", "2022", "$1.00"),
            detail_row("7000001", "2022", "$1.00"),
        ]
    )
    write_artifact(tmp_path, FY22, raw)
    os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(tmp_path)
    try:
        with pytest.raises(parse.ArtifactFormatError, match="rigoureusement dupliquée"):
            obligations_load.run()
    finally:
        os.environ["ORION_NSF_OBLIGATIONS_DIR"] = str(corpus)


# ------------------------------------------------------------------ API


def test_api_meta_liste_les_fy_offrables(client, corpus):
    payload = client.get("/api/nsf-obligations/meta").json()
    years = {y["fy"]: y for y in payload["years"]}
    assert set(years) == {2019, 2022, 2023}
    assert years[2019]["available"] is False
    assert years[2022]["available"] is True
    assert payload["vintage"] == date.today().isoformat()


def test_api_aggregate_fy_unique(client, corpus):
    payload = client.get("/api/nsf-obligations/aggregate?fy=2022&by=fy").json()
    assert payload["denominator_usd"] == 1_000_000.0
    assert payload["joinable_usd"] == 990_000.0
    assert payload["coverage"] == pytest.approx(0.99)
    assert payload["per_fy"][0]["fy"] == 2022


def test_api_aggregate_organisations_top_par_obligations(client, corpus):
    payload = client.get("/api/nsf-obligations/aggregate?fy=2022&by=organisation").json()
    buckets = payload["buckets"]
    # Top R5 (§ 19.5) : classé par les obligations elles-mêmes.
    assert [b["label"] for b in buckets] == [f"{MARK} Alpha", f"{MARK} Beta"]
    assert buckets[0]["amount_usd"] == 750_000.0
    assert buckets[0]["share_pct"] == pytest.approx(75.0)
    # PAS de renormalisation : Beta = 24 % du total OFFICIEL (240k/1M),
    # jamais 240k/990k.
    assert buckets[1]["share_pct"] == pytest.approx(24.0)
    assert payload["unjoinable_usd"] == 10_000.0


def test_api_aggregate_multi_fy_ratio_des_sommes(client, corpus):
    payload = client.get("/api/nsf-obligations/aggregate?fy=2022..2023&by=organisation").json()
    alpha = next(b for b in payload["buckets"] if b["label"] == f"{MARK} Alpha")
    # (750k + 1 000k) / (1M + 1,5M) = 70,00 % — la moyenne des ratios
    # annuels dirait 70,83 % : si elle revient, ce test casse.
    assert alpha["share_pct"] == pytest.approx(70.0)
    assert payload["denominator_usd"] == 2_500_000.0


def test_api_aggregate_division_et_state_sans_jointure(client, corpus):
    divisions = client.get("/api/nsf-obligations/aggregate?fy=2022&by=division").json()["buckets"]
    assert divisions[0]["amount_usd"] == 850_000.0  # Ocean Sciences (600k+240k+10k)
    states = client.get("/api/nsf-obligations/aggregate?fy=2022&by=state").json()["buckets"]
    assert {b["key"]: b["amount_usd"] for b in states} == {
        "CA": 750_000.0,
        "VA": 240_000.0,
        "AK": 10_000.0,
    }


def test_api_aggregate_country_est_une_dimension_jointe(client, corpus):
    payload = client.get("/api/nsf-obligations/aggregate?fy=2023&by=country").json()
    assert {b["key"]: b["amount_usd"] for b in payload["buckets"]} == {
        "US": 1_000_000.0,
        "DE": 500_000.0,
    }


def test_api_refus_fy_ferme_par_couverture(client, corpus):
    response = client.get("/api/nsf-obligations/aggregate?fy=2019&by=fy")
    assert response.status_code == 422
    assert response.json()["detail"] == "fy_coverage_below_threshold"


def test_api_refus_fy_hors_vintage(client, corpus):
    response = client.get("/api/nsf-obligations/aggregate?fy=2031&by=fy")
    assert response.status_code == 422
    assert response.json()["detail"] == "fy_unavailable"


def test_api_refus_parametres_d_un_autre_monde(client, corpus):
    for query, detail in (
        ("fy=2022&time=2022..2023", "time_not_supported_on_this_surface"),
        ("fy=2022&value=real", "value_not_supported_on_this_surface"),
        ("fy=2022&source=ec", "nsf_only_surface"),
        ("by=fy", "fy_required"),
        ("fy=20xx", "fy_invalid"),
        ("fy=2023..2022", "fy_invalid"),
        ("fy=2022&by=funder", "dimension_not_supported"),
    ):
        response = client.get(f"/api/nsf-obligations/aggregate?{query}")
        assert response.status_code == 400, query
        assert response.json()["detail"] == detail
    assert client.get("/api/nsf-obligations/aggregate?fy=2022&source=nsf").status_code == 200


def test_api_explorer_rejette_fy(client, corpus):
    """Symétrie du contrat § 19.4 : `fy=` n'existe pas sur l'Explorer."""
    response = client.get("/api/explore/aggregate?metric=funding&by=country&fy=2022")
    assert response.status_code == 400
    assert response.json()["detail"] == "fy_not_supported_on_this_surface"


def test_api_reference_engine_intact(client, corpus):
    """R5 n'ajoute AUCUN mode : le nominal de l'Explorer ignore tout de
    la surface R5 et répond comme avant."""
    response = client.get("/api/explore/aggregate?metric=funding&by=country")
    assert response.status_code == 200
    assert "nsf_award_obligations_share" not in response.text


def test_unite_no_vintage(test_database):
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            # Vider les vintages DANS le savepoint (annulé au rollback) :
            # le cas « aucune vintage » doit exister quel que soit l'ordre
            # des tests du module.
            session.execute(text("DELETE FROM nsf_obligation_totals"))
            with pytest.raises(nsfobligations.FyUnavailable, match="no_vintage"):
                nsfobligations.aggregate(session, fys=[2022], by="fy")
        finally:
            session.close()
            outer.rollback()
