import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.dedup.merge import (
    merge_exact,
    merge_fuzzy,
    refresh_normalized_names,
)
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Funder,
    Organisation,
    OrganisationAlias,
    OrganisationIdentifier,
    Participation,
    Project,
)

MARK = "ZZDEDUP"


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


def _count(session: Session, model, *where) -> int:
    return session.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _org(session: Session, name: str, country: str = "FR", **kwargs) -> Organisation:
    org = Organisation(name=name, country_code=country, **kwargs)
    session.add(org)
    session.flush()
    return org


def _project(session: Session, source_id: str) -> Project:
    funder = session.scalar(select(Funder).limit(1))
    project = Project(
        source=f"test-{MARK}",
        source_id=source_id,
        title=f"{MARK} project",
        funder_id=funder.id,
    )
    session.add(project)
    session.flush()
    return project


def _participation(session: Session, project: Project, org: Organisation, uid: str) -> None:
    session.add(
        Participation(
            project_id=project.id,
            organisation_id=org.id,
            source=f"test-{MARK}",
            source_uid=uid,
        )
    )
    session.flush()


def test_normalize_name_folds_case_accents_legal_forms_and_synonyms():
    assert normalize_name("Université de Toulouse") == normalize_name("UNIV TOULOUSE")
    assert normalize_name("Siemens AG") == normalize_name("SIEMENS")
    assert normalize_name("Acme Ltd.") == normalize_name("ACME LIMITED")
    assert normalize_name("Centre National de la Recherche") == "centre national recherche"
    assert normalize_name("Institut Pasteur (Paris)") == "institute pasteur"
    assert normalize_name("  ") is None
    assert normalize_name(None) is None


def test_normalize_never_returns_an_empty_key_for_a_legal_form_only_name():
    """'SARL' alone must not collapse to a key that matches every other stub."""
    assert normalize_name("SARL") == "sarl"
    assert normalize_name("GmbH") == "gmbh"
    assert normalize_name("SARL") != normalize_name("GmbH")


def test_exact_merge_moves_participations_and_drops_the_duplicate(db_session):
    keeper = _org(db_session, f"{MARK} Université de Toulouse")
    duplicate = _org(db_session, f"{MARK} UNIV TOULOUSE")
    project_a, project_b = _project(db_session, f"{MARK}-1"), _project(db_session, f"{MARK}-2")
    _participation(db_session, project_a, keeper, f"{MARK}-a")
    _participation(db_session, project_b, duplicate, f"{MARK}-b")
    db_session.add(
        OrganisationAlias(
            organisation_id=duplicate.id,
            source=f"test-{MARK}",
            name_raw=f"{MARK} UNIV TOULOUSE",
            country_raw="FR",
        )
    )
    db_session.flush()

    stats = RunStats()
    refresh_normalized_names(db_session, stats)
    merge_exact(db_session, stats)

    survivors = db_session.scalars(
        select(Organisation.id).where(Organisation.name.startswith(MARK))
    ).all()
    assert len(survivors) == 1
    assert survivors[0] == keeper.id
    assert (
        db_session.scalar(
            select(func.count())
            .select_from(Participation)
            .where(Participation.organisation_id == keeper.id)
        )
        == 2
    )
    assert (
        db_session.scalar(
            select(func.count())
            .select_from(OrganisationAlias)
            .where(OrganisationAlias.organisation_id == keeper.id)
        )
        == 1
    )


def test_organisations_with_conflicting_identifiers_are_never_merged(db_session):
    """Two PICs mean two legal entities, however identical the names look."""
    first = _org(db_session, f"{MARK} Institut Commun")
    second = _org(db_session, f"{MARK} INSTITUT COMMUN")
    db_session.add_all(
        [
            OrganisationIdentifier(organisation_id=first.id, scheme="pic", value=f"{MARK}001"),
            OrganisationIdentifier(organisation_id=second.id, scheme="pic", value=f"{MARK}002"),
        ]
    )
    db_session.flush()

    stats = RunStats()
    refresh_normalized_names(db_session, stats)
    merge_exact(db_session, stats)

    survivors = db_session.scalars(
        select(Organisation.id).where(Organisation.name.startswith(MARK))
    ).all()
    assert len(survivors) == 2
    assert stats.counts.get("kept_apart_by_identifier")


def test_merge_keeps_the_richest_location(db_session):
    keeper_id = _org(db_session, f"{MARK} Laboratoire Alpha", city=None).id
    other_id = _org(db_session, f"{MARK} LABORATOIRE ALPHA", city="Lyon").id
    db_session.flush()

    stats = RunStats()
    refresh_normalized_names(db_session, stats)
    merge_exact(db_session, stats)
    db_session.expunge_all()

    assert _count(db_session, Organisation, Organisation.id == other_id) == 0
    assert db_session.get(Organisation, keeper_id).city == "Lyon"


def test_fuzzy_merge_joins_near_identical_names_but_spares_short_ones(db_session):
    long_a = _org(db_session, f"{MARK} Institut National de Recherche Agronomique").id
    long_b = _org(db_session, f"{MARK} Institut National de Recherche Agronomiques").id
    short_a = _org(db_session, f"{MARK} CEA").id
    short_b = _org(db_session, f"{MARK} CEB").id
    db_session.flush()

    stats = RunStats()
    refresh_normalized_names(db_session, stats)
    merge_fuzzy(db_session, stats, name_prefix=MARK)
    db_session.expunge_all()

    assert _count(db_session, Organisation, Organisation.id == long_a) == 1
    assert _count(db_session, Organisation, Organisation.id == long_b) == 0
    # Short names stay apart: a trigram score means little on three letters.
    assert _count(db_session, Organisation, Organisation.id == short_a) == 1
    assert _count(db_session, Organisation, Organisation.id == short_b) == 1


def test_organisations_in_different_countries_are_never_merged(db_session):
    french = _org(db_session, f"{MARK} Institut de Recherche Commun", country="FR").id
    german = _org(db_session, f"{MARK} Institut de Recherche Commun", country="DE").id
    db_session.flush()

    stats = RunStats()
    refresh_normalized_names(db_session, stats)
    merge_exact(db_session, stats)
    merge_fuzzy(db_session, stats, name_prefix=MARK)
    db_session.expunge_all()

    assert _count(db_session, Organisation, Organisation.id == french) == 1
    assert _count(db_session, Organisation, Organisation.id == german) == 1
