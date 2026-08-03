"""The groups layer build (socle identité): conservative bridges, GLEIF
groups with the Wikidata fallback, curation that survives rebuilds."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.groups import build
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import LeiRecord, LeiRelationship, Organisation

MARK = "ZZGRP"


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


def _org(session, name: str, country: str) -> Organisation:
    organisation = Organisation(
        name=name, name_normalized=normalize_name(name), country_code=country
    )
    session.add(organisation)
    session.flush()
    return organisation


def _lei(session, lei: str, name: str, country: str, status: str = "ACTIVE") -> None:
    session.add(
        LeiRecord(
            lei=lei,
            name=name,
            name_normalized=normalize_name(name),
            country_code=country,
            status=status,
        )
    )


@pytest.fixture
def seeded(db_session):
    """Two French subsidiaries bridgeable by name+country, one ambiguous
    name (two LEI records) that must NOT bridge, one org whose only link
    is a Wikidata parent."""
    alpha = _org(db_session, f"{MARK} Aircraft Engines", "FR")
    beta = _org(db_session, f"{MARK} Electronics Defense", "FR")
    gamma = _org(db_session, f"{MARK} Ambiguous Labs", "FR")
    delta = _org(db_session, f"{MARK} Wikidata Only", "DE")

    _lei(db_session, "LEIAIRCRAFT00000001", f"{MARK} Aircraft Engines", "FR")
    _lei(db_session, "LEIELECTRONICS00001", f"{MARK} Electronics Defense", "FR")
    # Ambiguity on the LEI side: two ACTIVE records share the key.
    _lei(db_session, "LEIAMBIGUOUS0000001", f"{MARK} Ambiguous Labs", "FR")
    _lei(db_session, "LEIAMBIGUOUS0000002", f"{MARK} Ambiguous Labs", "FR")
    _lei(db_session, "LEIWIKIONLY0000001X", f"{MARK} Wikidata Only", "DE")
    _lei(db_session, "LEIHEAD000000000001", f"{MARK} Group Head", "FR")
    _lei(db_session, "LEIWIKIHEAD0000001X", f"{MARK} Wiki Head", "DE")

    db_session.add_all(
        [
            LeiRelationship(
                child_lei="LEIAIRCRAFT00000001",
                parent_lei="LEIHEAD000000000001",
                relationship_type="IS_ULTIMATELY_CONSOLIDATED_BY",
                corroboration="FULLY_CORROBORATED",
            ),
            LeiRelationship(
                child_lei="LEIELECTRONICS00001",
                parent_lei="LEIHEAD000000000001",
                relationship_type="IS_DIRECTLY_CONSOLIDATED_BY",
                corroboration="ENTITY_SUPPLIED_ONLY",
            ),
            LeiRelationship(
                child_lei="LEIWIKIONLY0000001X",
                parent_lei="LEIWIKIHEAD0000001X",
                relationship_type="WIKIDATA_PARENT",
            ),
        ]
    )
    db_session.flush()
    return {"alpha": alpha.id, "beta": beta.id, "gamma": gamma.id, "delta": delta.id}


def test_bridge_is_conservative(db_session, seeded):
    stats = RunStats()
    build.bridge_organisations(db_session, stats)
    bridged = dict(
        db_session.execute(
            text("""
            SELECT organisation_id, value FROM organisation_identifiers
            WHERE scheme = 'lei' AND organisation_id = ANY(:ids)
            """),
            {"ids": list(seeded.values())},
        ).all()
    )
    assert bridged[seeded["alpha"]] == "LEIAIRCRAFT00000001"
    assert bridged[seeded["beta"]] == "LEIELECTRONICS00001"
    # Two ACTIVE LEI records share Gamma's key: no bridge, by design.
    assert seeded["gamma"] not in bridged


def test_groups_built_from_gleif_with_wikidata_fallback(db_session, seeded):
    stats = RunStats()
    build.bridge_organisations(db_session, stats)
    build.build_groups(db_session, stats)

    rows = list(
        db_session.execute(
            text("""
            SELECT m.organisation_id, g.name, g.lei, m.method, m.confidence
            FROM entity_group_map m JOIN groups g ON g.id = m.group_id
            WHERE m.organisation_id = ANY(:ids)
            """),
            {"ids": list(seeded.values())},
        )
    )
    by_org = {row[0]: row for row in rows}
    # Both French subsidiaries land in the SAME group, named after the head.
    assert by_org[seeded["alpha"]][1] == f"{MARK} Group Head"
    assert by_org[seeded["alpha"]][1] == by_org[seeded["beta"]][1]
    assert by_org[seeded["alpha"]][3] == "gleif"
    # Fully corroborated ultimate link scores above the direct-only one.
    assert float(by_org[seeded["alpha"]][4]) > float(by_org[seeded["beta"]][4])
    # The Wikidata-only organisation gets its fallback group, lower confidence.
    assert by_org[seeded["delta"]][3] == "wikidata"
    assert float(by_org[seeded["delta"]][4]) == pytest.approx(0.6)


def test_rebuild_keeps_curation(db_session, seeded):
    stats = RunStats()
    build.bridge_organisations(db_session, stats)
    build.build_groups(db_session, stats)
    # A curator pins Gamma (unbridgeable automatically) to a manual group.
    group_id = db_session.execute(
        text("""
        INSERT INTO groups (name, country_code, source) VALUES ('ZZGRP Curated', 'FR', 'curation')
        RETURNING id
        """)
    ).scalar_one()
    db_session.execute(
        text("""
        INSERT INTO entity_group_map (organisation_id, group_id, method, confidence, source)
        VALUES (:org, :grp, 'curation', 1.0, 'curation')
        """),
        {"org": seeded["gamma"], "grp": group_id},
    )
    db_session.flush()

    build.build_groups(db_session, stats)  # rebuild wipes ONLY gleif/wikidata
    kept = db_session.execute(
        text("SELECT count(*) FROM entity_group_map WHERE method = 'curation'")
    ).scalar_one()
    assert kept == 1
