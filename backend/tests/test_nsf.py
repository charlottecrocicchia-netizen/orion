"""NSF: the parse guarantees, the transverse convention, and THE SIBLING
FOLD (registry extension, founder-validated 2026-08-03).

The fold is what makes American collaboration visible: NSF splits one
project across N institutions into N awards. These tests hold its four
guards — they are the reason the extension was accepted, so a regression
here must break the build, not a reader's trust."""

import json
import zipfile
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.nsf import load, parse
from orion.ingest.nsf.config import PERSONAL_DATA_KEYS
from orion.ingest.reference import resolve_country, seed_reference
from orion.ingest.runlog import RunStats


def _award(awd_id: str, title: str, amount: float, institution: str, **over) -> dict:
    award = {
        "awd_id": awd_id,
        "agcy_id": "NSF",
        "tran_type": "Grant",
        "awd_istr_txt": "Standard Grant",
        "awd_titl_txt": title,
        "cfda_num": "47.078",
        "awd_eff_date": "2021-09-01",
        "awd_exp_date": "2025-08-31",
        "awd_amount": amount,
        "tot_intn_awd_amt": amount * 3,  # the intention, deliberately wrong
        "awd_abstract_narration": f"Abstract for {awd_id}. " + "detail " * 10,
        "dir_abbr": "GEO",
        "org_dir_long_name": "Directorate for Geosciences",
        "div_abbr": "ZZOPP",
        "org_div_long_name": "Office of Polar Programs (ZZ)",
        "oblg_fy": [
            {"fund_oblg_fiscal_yr": 2021, "fund_oblg_amt": amount / 2},
            {"fund_oblg_fiscal_yr": 2022, "fund_oblg_amt": amount / 2},
        ],
        # Personal data, present in the source, never read by the parser.
        "pi": [{"pi_full_name": "Jane ZZDOE", "pi_email_addr": "jane@example.edu"}],
        "po_email": "officer@nsf.gov",
        "po_phone": "7032928048",
        "po_sign_block_name": "John ZZSMITH",
        "inst": {
            "inst_name": institution,
            "inst_city_name": "RENO",
            "inst_state_code": "NV",
            "inst_country_name": "United States",
            "inst_phone_num": "7756737300",
            # A UEI is twelve alphanumerics — the shape the bridge guards.
            "org_uei_num": f"UEI{awd_id}".ljust(12, "X"),
            "org_prnt_uei_num": "UEIPARENT001",
        },
        "perf_inst": {"perf_ctry_code": "DA", "perf_ctry_name": "Denmark"},
    }
    award.update(over)
    return award


def _zip_awards(path: Path, awards: list[dict]) -> Path:
    with zipfile.ZipFile(path, "w") as archive:
        for award in awards:
            archive.writestr(f"{award['awd_id']}.json", json.dumps(award))
    return path


def test_personal_data_never_leaves_the_file(tmp_path):
    path = _zip_awards(tmp_path / "y.zip", [_award("100", "A study", 500_000, "ZZNSF Institute")])
    rows = list(parse.parse_awards(path))
    assert len(rows) == 1
    row = rows[0]
    # Not filtered out — never read. The whitelist is the guarantee.
    assert not (set(row) & PERSONAL_DATA_KEYS)
    serialised = json.dumps(row, default=str)
    for trace in ("ZZDOE", "ZZSMITH", "officer@nsf.gov", "7032928048", "7756737300"):
        assert trace not in serialised
    # Founder-validated ①: the obligated amount, never the intention.
    assert row["amount"] == 500_000
    assert row["start_date"] == date(2021, 9, 1)


def test_the_collaborative_prefix_is_the_only_fold_signal():
    """Without NSF's explicit prefix, identical titles are fellowship
    umbrellas — folding them would merge 152 unrelated awards."""
    assert parse.collaborative_key("Collaborative Research: Ice, Ocean & Life") == (
        "ice ocean life"
    )
    assert parse.collaborative_key("COLLABORATIVE PROPOSAL: Ice, ocean and life") == (
        "ice ocean and life"
    )
    assert parse.collaborative_title("Collaborative Research: Ice") == "Ice"
    # Umbrellas and ordinary awards carry no key at all.
    assert parse.collaborative_key("NSF East Asia Summer Institutes") is None
    assert parse.collaborative_key("Graduate Research Fellowship Program") is None
    assert parse.collaborative_key(None) is None


def test_the_catalogue_keeps_fiscal_years_and_leaves_the_rest():
    payload = {
        "files": [
            {"fileName": "2024.zip", "downloadUrl": "u2024"},
            {"fileName": "2005.zip", "downloadUrl": "u2005"},
            {"fileName": "2004.zip", "downloadUrl": "u2004"},  # before the window
            {"fileName": "1900.zip", "downloadUrl": "u1900"},  # undated bucket
            {"fileName": "Historical.zip", "downloadUrl": "uhist"},  # pre-1976
            {"fileName": "timestamp.txt", "downloadUrl": "uts"},
            {"fileName": "2023.zip"},  # no link
        ]
    }
    assert load.select_years(payload) == [(2005, "u2005"), (2024, "u2024")]


def test_country_names_resolve_the_way_sources_write_them():
    """NSF publishes country NAMES, not codes — and everyday ones."""
    assert resolve_country("United States") == "US"
    assert resolve_country("Russia") == "RU"
    assert resolve_country("Turkey") == "TR"
    # A city-qualified name still finds its country (run finding).
    assert resolve_country("Germany, Berlin") == "DE"
    # …without breaking the ISO forms that legitimately carry a comma.
    assert resolve_country("Korea, Republic of") == "KR"
    # A region is not a country, and stays unresolved rather than guessed.
    assert resolve_country("Australasia") is None
    # `perf_ctry_code` is NOT ISO (DA is Denmark, not Dominica): the
    # loader never uses it, and this is why.
    assert resolve_country("Denmark") == "DK"


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


def _ingest(session, path, fy=2021, stats=None) -> RunStats:
    stats = stats or RunStats()
    funder = session.execute(text("SELECT id FROM funders WHERE code = 'nsf'")).scalar_one()
    session.execute(
        text("""
        INSERT INTO exchange_rates (currency, year, rate_to_eur, source)
        VALUES ('USD', 2021, 1.25, 'ecb') ON CONFLICT DO NOTHING
        """)
    )
    session.execute(text("DROP TABLE IF EXISTS nsf_awards"))
    session.execute(text(load.STAGING_DDL))
    load.stage_year(session, path, fy, stats)
    load.apply_fold(session, stats)
    load._seed_programmes(session, funder, stats)
    load.fold_projects(session, funder, stats)
    load.load_organisations(session, stats)
    load.load_bridges(session, stats)
    load.load_texts(session, stats)
    load.prune_stale(session, stats)
    return stats


def test_siblings_fold_into_one_project_with_one_participation_each(db_session, tmp_path):
    """Three institutions, one project — the first American collaboration
    Orion can show. Amount summed, euros at the start year's rate, and
    every member a partner (NSF publishes no lead, so we invent none)."""
    path = _zip_awards(
        tmp_path / "y.zip",
        [
            _award("201", "Collaborative Research: Ice and Life", 400_000, "ZZNSF Alpha"),
            _award("202", "Collaborative Research: Ice and Life", 300_000, "ZZNSF Beta"),
            _award("203", "Collaborative Research: Ice and Life", 300_000, "ZZNSF Gamma"),
            # A lone award keeps its own identity.
            _award("204", "A solitary study", 100_000, "ZZNSF Delta"),
        ],
    )
    stats = _ingest(db_session, path)
    assert stats.counts["folded_projects"] == 1
    assert stats.counts["folded_awards"] == 3

    project = db_session.execute(
        text("""
        SELECT source_id, title, funding_amount, funding_currency, funding_amount_eur,
               start_date, end_date, raw->>'collaborative' AS collaborative,
               jsonb_array_length(raw->'awards') AS awards, url
        FROM projects WHERE source = 'nsf' AND title = 'Ice and Life'
        """)
    ).one()
    assert float(project.funding_amount) == pytest.approx(1_000_000)
    assert project.funding_currency == "USD"
    # ④ dated conversion at the START YEAR's rate (2021: 1.25)
    assert float(project.funding_amount_eur) == pytest.approx(800_000)
    assert project.collaborative == "true"
    assert project.awards == 3
    # The prefix is NSF plumbing; the project carries the real name.
    assert project.title == "Ice and Life"
    assert project.url.endswith("AWD_ID=201")

    members = db_session.execute(
        text("""
        SELECT o.name, pa.role, pa.amount, pa.amount_eur, pa.order_index
        FROM participations pa
        JOIN projects p ON p.id = pa.project_id
        JOIN organisations o ON o.id = pa.organisation_id
        WHERE p.source_id = :key ORDER BY pa.order_index
        """),
        {"key": project.source_id},
    ).all()
    assert [m.name for m in members] == ["ZZNSF Alpha", "ZZNSF Beta", "ZZNSF Gamma"]
    assert {m.role for m in members} == {"partner"}
    # A project's euros equal the sum of its participations' euros.
    assert sum(float(m.amount_eur) for m in members) == pytest.approx(800_000)

    lone = db_session.execute(
        text("""
        SELECT p.source_id, pa.role FROM projects p
        JOIN participations pa ON pa.project_id = p.id
        WHERE p.source = 'nsf' AND p.title = 'A solitary study'
        """)
    ).one()
    assert lone.source_id == "204"
    assert lone.role == "coordinator"
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_the_fold_refuses_a_group_that_repeats_an_institution(db_session, tmp_path):
    """Guard: institutions must all be distinct. Two awards to the same
    university under one title are not a collaboration."""
    path = _zip_awards(
        tmp_path / "y.zip",
        [
            _award("301", "Collaborative Research: Same House", 100_000, "ZZNSF Alpha"),
            _award("302", "Collaborative Research: Same House", 100_000, "ZZNSF Alpha"),
        ],
    )
    stats = _ingest(db_session, path)
    assert stats.counts.get("folded_projects", 0) == 0
    assert stats.counts["fold_refused_groups"] == 1
    keys = {
        row[0]
        for row in db_session.execute(
            text("SELECT source_id FROM projects WHERE source = 'nsf' AND title = 'Same House'")
        )
    }
    assert keys == {"301", "302"}
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_the_fold_refuses_a_group_spread_over_more_than_a_year(db_session, tmp_path):
    """Guard: siblings start together. Measured maximum spread is 319
    days — beyond a year, it is not the same project."""
    path = _zip_awards(
        tmp_path / "y.zip",
        [
            _award("401", "Collaborative Research: Far Apart", 100_000, "ZZNSF Alpha"),
            _award(
                "402",
                "Collaborative Research: Far Apart",
                100_000,
                "ZZNSF Beta",
                awd_eff_date="2023-06-01",
            ),
        ],
    )
    stats = _ingest(db_session, path)
    assert stats.counts.get("folded_projects", 0) == 0
    assert stats.counts["fold_refused_groups"] == 1
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_the_fold_never_crosses_fiscal_years(db_session, tmp_path):
    """Guard: the same title in two yearly files is two projects. NSF
    reuses titles across generations of a programme."""
    first = _zip_awards(
        tmp_path / "a.zip",
        [
            _award("501", "Collaborative Research: Recurring", 100_000, "ZZNSF Alpha"),
            _award("502", "Collaborative Research: Recurring", 100_000, "ZZNSF Beta"),
        ],
    )
    second = _zip_awards(
        tmp_path / "b.zip",
        [
            _award("601", "Collaborative Research: Recurring", 100_000, "ZZNSF Alpha"),
            _award("602", "Collaborative Research: Recurring", 100_000, "ZZNSF Beta"),
        ],
    )
    funder = db_session.execute(text("SELECT id FROM funders WHERE code = 'nsf'")).scalar_one()
    stats = RunStats()
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))
    db_session.execute(text(load.STAGING_DDL))
    load.stage_year(db_session, first, 2021, stats)
    load.stage_year(db_session, second, 2022, stats)
    load.apply_fold(db_session, stats)
    load._seed_programmes(db_session, funder, stats)
    load.fold_projects(db_session, funder, stats)

    assert stats.counts["folded_projects"] == 2
    count = db_session.execute(
        text("SELECT count(*) FROM projects WHERE source = 'nsf' AND title = 'Recurring'")
    ).scalar_one()
    assert count == 2
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_a_project_that_becomes_collaborative_leaves_no_ghost(db_session, tmp_path):
    """An award alone in one run joins a group in the next: its solitary
    project must disappear, not survive as a duplicate."""
    alone = _zip_awards(
        tmp_path / "a.zip",
        [_award("701", "Collaborative Research: Growing", 100_000, "ZZNSF Alpha")],
    )
    _ingest(db_session, alone)
    assert (
        db_session.execute(
            text("SELECT count(*) FROM projects WHERE source = 'nsf' AND source_id = '701'")
        ).scalar_one()
        == 1
    )

    grown = _zip_awards(
        tmp_path / "b.zip",
        [
            _award("701", "Collaborative Research: Growing", 100_000, "ZZNSF Alpha"),
            _award("702", "Collaborative Research: Growing", 100_000, "ZZNSF Beta"),
        ],
    )
    _ingest(db_session, grown)
    rows = db_session.execute(
        text("SELECT source_id FROM projects WHERE source = 'nsf' AND title = 'Growing'")
    ).all()
    assert len(rows) == 1 and rows[0][0].startswith("c-2021-")
    participations = db_session.execute(
        text("SELECT count(*) FROM participations WHERE source = 'nsf'")
    ).scalar_one()
    assert participations == 2
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_uei_bridges_are_captured_the_day_the_data_passes(db_session, tmp_path):
    """The ANR lesson: capture the identifier while you hold it. The
    parent link is the American consolidation bridge for the groups
    wave — stored raw, unused until then."""
    malformed = _award("803", "A third study", 100_000, "ZZNSF Gamma")
    # The real anomaly the source produced: a UEI with a sub-entity
    # suffix, sixteen characters long (run finding, 2026-08-03).
    malformed["inst"]["org_uei_num"] = "N49DHX6D3FH60018"
    path = _zip_awards(
        tmp_path / "y.zip",
        [
            _award("801", "A study", 100_000, "ZZNSF Alpha"),
            _award("802", "Another study", 100_000, "ZZNSF Beta"),
            malformed,
        ],
    )
    stats = _ingest(db_session, path)
    identifiers = {
        row[0]
        for row in db_session.execute(
            text("""
            SELECT i.value FROM organisation_identifiers i
            JOIN organisations o ON o.id = i.organisation_id
            WHERE i.scheme = 'uei' AND o.name LIKE 'ZZNSF%'
            """)
        )
    }
    # The malformed one is refused and COUNTED, never widened in.
    assert identifiers == {"UEI801XXXXXX", "UEI802XXXXXX"}
    assert stats.counts["uei_malformed"] == 1
    links = db_session.execute(
        text("SELECT child_uei, parent_uei, source FROM uei_links ORDER BY child_uei")
    ).all()
    assert [(row.child_uei, row.parent_uei, row.source) for row in links] == [
        ("UEI801XXXXXX", "UEIPARENT001", "nsf"),
        ("UEI802XXXXXX", "UEIPARENT001", "nsf"),
    ]
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))


def test_the_division_is_the_programme_and_the_text_is_indexed(db_session, tmp_path):
    path = _zip_awards(tmp_path / "y.zip", [_award("901", "A polar study", 100_000, "ZZNSF Alpha")])
    _ingest(db_session, path)
    row = db_session.execute(
        text("""
        SELECT pr.code, pr.name, t.title, t.abstract IS NOT NULL AS has_abstract
        FROM projects p
        JOIN programmes pr ON pr.id = p.programme_id
        JOIN project_texts t ON t.project_id = p.id AND t.lang = 'en'
        WHERE p.source = 'nsf' AND p.source_id = '901'
        """)
    ).one()
    assert row.code == "ZZOPP"
    assert row.name == "Office of Polar Programs (ZZ)"
    assert row.title == "A polar study"
    assert row.has_abstract
    db_session.execute(text("DROP TABLE IF EXISTS nsf_awards"))
