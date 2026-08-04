"""La fiche groupe (recette fondatrice 2026-08-04) : la couche identité
devient une surface produit. Les pièges qu'elle doit tenir : un projet
co-signé par deux entités du groupe compte UNE fois au consolidé, les
parts se disent sur le total du groupe, et le suggest fait remonter les
groupes en tête."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.search.groups_hub import group_hub
from orion.search.service import suggest


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


def _seed_group(session: Session) -> int:
    funder = session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    session.execute(
        text(
            "INSERT INTO groups (name, country_code, lei, source) "
            "VALUES ('ZZGROUPE AERO', 'FR', 'ZZLEI000000000000001', 'gleif')"
        )
    )
    group_id = session.execute(
        text("SELECT id FROM groups WHERE name = 'ZZGROUPE AERO'")
    ).scalar_one()

    orgs = {}
    for name, country in (("ZZAERO SA", "FR"), ("ZZAERO GMBH", "DE")):
        session.execute(
            text(
                "INSERT INTO organisations (name, name_normalized, country_code) "
                "VALUES (:n, :n, :c)"
            ),
            {"n": name, "c": country},
        )
        orgs[name] = session.execute(
            text("SELECT id FROM organisations WHERE name = :n"), {"n": name}
        ).scalar_one()
        session.execute(
            text(
                "INSERT INTO entity_group_map (organisation_id, group_id, method, confidence, "
                "source, is_jv) VALUES (:o, :g, 'gleif', 0.9, 'gleif', false)"
            ),
            {"o": orgs[name], "g": group_id},
        )

    projects = {}
    for sid, title, year in (("zzg-1", "zz solo", 2020), ("zzg-2", "zz co-signe", 2022)):
        session.execute(
            text(
                "INSERT INTO projects (source, source_id, title, funder_id, start_date) "
                "VALUES ('test-zzg', :sid, :title, :f, :d)"
            ),
            {"sid": sid, "title": title, "f": funder, "d": f"{year}-01-01"},
        )
        projects[sid] = session.execute(
            text("SELECT id FROM projects WHERE source_id = :sid"), {"sid": sid}
        ).scalar_one()

    rows = [
        ("zzg-1", "ZZAERO SA", 4_000_000, "p1"),
        ("zzg-2", "ZZAERO SA", 3_000_000, "p2"),  # le même projet…
        ("zzg-2", "ZZAERO GMBH", 1_000_000, "p3"),  # …signé par les deux entités
    ]
    for sid, org, amount, uid in rows:
        session.execute(
            text(
                "INSERT INTO participations (project_id, organisation_id, role, country_code, "
                "amount_eur, source, source_uid) "
                "VALUES (:p, :o, 'participant', "
                "(SELECT country_code FROM organisations WHERE id = :o), :a, 'test-zzg', :u)"
            ),
            {"p": projects[sid], "o": orgs[org], "a": amount, "u": uid},
        )
    session.flush()
    return group_id


def test_the_consolidated_view_counts_a_co_signed_project_once(db_session):
    group_id = _seed_group(db_session)
    hub = group_hub(db_session, group_id)

    assert hub is not None
    assert hub["name"] == "ZZGROUPE AERO"
    # 2 projets DISTINCTS (pas 3 participations), 8 M€ au total.
    assert hub["totals"] == {
        "entities": 2,
        "projects": 2,
        "funding_eur": pytest.approx(8_000_000),
        "countries": 2,
    }
    # La trajectoire suit les années calendaires des projets.
    assert [(r["year"], r["funding_eur"]) for r in hub["trajectory"]] == [
        (2020, pytest.approx(4_000_000)),
        (2022, pytest.approx(4_000_000)),
    ]
    # Les parts se disent sur le total du groupe.
    sa = next(e for e in hub["entities"] if e["name"] == "ZZAERO SA")
    gmbh = next(e for e in hub["entities"] if e["name"] == "ZZAERO GMBH")
    assert sa["funding_eur"] == pytest.approx(7_000_000)
    assert sa["share_pct"] == pytest.approx(87.5)
    assert gmbh["share_pct"] == pytest.approx(12.5)
    assert sa["method"] == "gleif" and sa["confidence"] == pytest.approx(0.9)
    # La carte : deux pays, la région portée par le référentiel.
    codes = {c["code"]: c for c in hub["countries"]}
    assert set(codes) == {"FR", "DE"}
    assert codes["FR"]["region"] == "europe"


def test_group_hub_is_none_for_unknown_id(db_session):
    assert group_hub(db_session, 99_999_999) is None


def test_suggest_surfaces_the_group_first_with_its_entity_count(db_session):
    _seed_group(db_session)
    result = suggest(db_session, "ZZGROUPE")
    assert result["groups"], "le groupe doit remonter"
    top = result["groups"][0]
    assert top["name"] == "ZZGROUPE AERO"
    assert top["entities"] == 2
    assert top["country"] == "FR"
