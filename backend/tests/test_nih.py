"""NIH RePORTER: the parse guarantees and THE transverse convention
(registry, 2026-08-03) — yearly slices folded onto the core project,
calendar time axis, dated ECB conversion, native USD kept."""

import csv
import io
import zipfile
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.nih import load, parse
from orion.ingest.nih.config import PERSONAL_DATA_COLUMNS, current_fy, fiscal_years
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats

PROJECT_COLUMNS = [
    "APPLICATION_ID",
    "ACTIVITY",
    "ADMINISTERING_IC",
    "CORE_PROJECT_NUM",
    "FY",
    "IC_NAME",
    "ORG_CITY",
    "ORG_COUNTRY",
    "ORG_IPF_CODE",
    "ORG_NAME",
    "PI_NAMEs",
    "PROGRAM_OFFICER_NAME",
    "PROJECT_START",
    "PROJECT_END",
    "PROJECT_TITLE",
    "SUBPROJECT_ID",
    "TOTAL_COST",
    "TOTAL_COST_SUB_PROJECT",
]


def _zip_csv(path: Path, header: list[str], rows: list[list[str]]) -> Path:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("RePORTER_PRJ_C_FY2023.csv", buffer.getvalue())
    return path


def _award(application_id: str, core: str, fy: str, cost: str, **over: str) -> list[str]:
    row = {
        "APPLICATION_ID": application_id,
        "ACTIVITY": "R01",
        "ADMINISTERING_IC": "CA",
        "CORE_PROJECT_NUM": core,
        "FY": fy,
        "IC_NAME": "NATIONAL CANCER INSTITUTE",
        "ORG_CITY": "BOSTON",
        "ORG_COUNTRY": "UNITED STATES",
        "ORG_IPF_CODE": "578604",
        "ORG_NAME": "ZZNIH RESEARCH INSTITUTE",
        "PI_NAMEs": "DOE, JANE",
        "PROGRAM_OFFICER_NAME": "SMITH, JOHN",
        "PROJECT_START": "2019-04-01",
        "PROJECT_END": "2023-03-31",
        "PROJECT_TITLE": f"A study of things ({fy})",
        "SUBPROJECT_ID": "",
        "TOTAL_COST": cost,
        "TOTAL_COST_SUB_PROJECT": "",
    }
    row.update(over)
    return [row[column] for column in PROJECT_COLUMNS]


def test_personal_data_never_leaves_the_file(tmp_path):
    path = _zip_csv(
        tmp_path / "p.zip", PROJECT_COLUMNS, [_award("1", "R01CA000001", "2023", "500000")]
    )
    rows = list(parse.parse_awards(path))
    assert len(rows) == 1
    # The investigator's and officer's names are dropped at the door —
    # they never reach a dict, let alone the base (the ANR rule).
    assert not (set(rows[0]) & {key.lower() for key in PERSONAL_DATA_COLUMNS})
    assert "DOE" not in str(rows[0])
    assert rows[0]["core_num"] == "R01CA000001"
    assert rows[0]["total_cost"] == 500_000
    assert rows[0]["project_start"] == date(2019, 4, 1)


def test_fiscal_year_window_follows_the_october_rule():
    assert current_fy(date(2026, 8, 3)) == 2026
    assert current_fy(date(2026, 10, 1)) == 2027
    years = fiscal_years(date(2026, 8, 3))
    assert years[0] == 2005 and years[-1] == 2026


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


def test_convention_folds_years_and_converts_at_the_start_year_rate(db_session, tmp_path):
    """Three fiscal slices of one award + one sub-project row become ONE
    project: summed amount, real span, USD kept, EUR at the start year."""
    funder = db_session.execute(text("SELECT id FROM funders WHERE code = 'nih'")).scalar_one()
    db_session.execute(
        text("""
        INSERT INTO exchange_rates (currency, year, rate_to_eur, source)
        VALUES ('USD', 2019, 1.25, 'ecb') ON CONFLICT DO NOTHING
        """)
    )
    path = _zip_csv(
        tmp_path / "p.zip",
        PROJECT_COLUMNS,
        [
            _award("11", "R01CA999001", "2021", "500000"),
            _award("12", "R01CA999001", "2022", "300000"),
            _award("13", "R01CA999001", "2023", "200000", PROJECT_END="2024-03-31"),
            # A sub-project: folded onto its core, never counted twice.
            _award(
                "14",
                "R01CA999001",
                "2023",
                "",
                SUBPROJECT_ID="1234",
                TOTAL_COST_SUB_PROJECT="90000",
            ),
        ],
    )
    stats = RunStats()
    db_session.execute(text("DROP TABLE IF EXISTS nih_awards"))
    db_session.execute(text(load.STAGING_DDL))
    load.stage_year(db_session, path, stats)
    load._seed_programmes(db_session, funder, stats)
    load._fold_projects(db_session, funder, stats)
    load._fold_organisations(db_session, stats)

    row = db_session.execute(
        text("""
        SELECT funding_amount, funding_currency, funding_amount_eur, start_date, end_date,
               raw->>'award_years' AS award_years, raw->>'eur_rate' AS rate, title
        FROM projects WHERE source = 'nih' AND source_id = 'R01CA999001'
        """)
    ).one()
    # ① one project, ② amount = sum of the slices (sub-project excluded)
    assert float(row.funding_amount) == pytest.approx(1_000_000)
    # ④ native currency kept, EUR at the START YEAR's rate (2019: 1.25)
    assert row.funding_currency == "USD"
    assert float(row.funding_amount_eur) == pytest.approx(800_000)
    assert float(row.rate) == pytest.approx(1.25)
    # ③ calendar span, never the fiscal year
    assert row.start_date == date(2019, 4, 1)
    assert row.end_date == date(2024, 3, 31)
    assert row.award_years == "4"
    # The most recent slice names the project.
    assert row.title.endswith("(2023)")

    # The awardee organisation exists once, with its country and IPF id.
    org = db_session.execute(
        text("""
        SELECT o.country_code, o.city, i.value
        FROM organisations o
        LEFT JOIN organisation_identifiers i
               ON i.organisation_id = o.id AND i.scheme = 'ipf'
        WHERE o.name = 'ZZNIH RESEARCH INSTITUTE'
        """)
    ).one()
    assert org.country_code == "US"
    assert org.value == "578604"
    participations = db_session.execute(
        text("SELECT count(*) FROM participations WHERE source = 'nih'")
    ).scalar_one()
    assert participations == 1
    db_session.execute(text("DROP TABLE IF EXISTS nih_awards"))
