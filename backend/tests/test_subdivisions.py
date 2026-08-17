"""La maille sous le pays (lot D, 2026-08-17) : le référentiel est
complet et l'index sort TOUTE maille référencée — financée ou non (le
gris dira l'absence, jamais une maille manquante). L'Explorateur sait
distribuer par subdivision, et le pays cadre la vue."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.ingest.subdivisions import (
    US_STATES,
    US_TERRITORIES,
    seed_subdivisions,
    subdivision_index,
)


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


def _seed_participations(session: Session) -> None:
    funder = session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    session.execute(
        text(
            "INSERT INTO projects (source, source_id, title, funder_id, start_date) VALUES "
            "('test-sd', 'sd-1', 'zz un', :f, '2023-01-01'), "
            "('test-sd', 'sd-2', 'zz deux', :f, '2023-01-01')"
        ),
        {"f": funder},
    )
    session.execute(
        text(
            "INSERT INTO organisations (name, name_normalized, country_code) VALUES "
            "('ZZ MIT', 'zz mit', 'US'), ('ZZ CALTECH', 'zz caltech', 'US')"
        )
    )
    ids = {
        r.name: r.id
        for r in session.execute(text("SELECT id, name FROM organisations WHERE name LIKE 'ZZ %'"))
    }
    projects = {
        r.source_id: r.id
        for r in session.execute(
            text("SELECT id, source_id FROM projects WHERE source = 'test-sd'")
        )
    }
    rows = [
        ("sd-1", "ZZ MIT", "US-MA", 3_000_000, "u1"),
        ("sd-2", "ZZ MIT", "US-MA", 1_000_000, "u2"),
        ("sd-1", "ZZ CALTECH", "US-CA", 5_000_000, "u3"),
    ]
    for sid, org, subdivision, amount, uid in rows:
        session.execute(
            text(
                "INSERT INTO participations (project_id, organisation_id, role, country_code, "
                "subdivision_code, amount_eur, source, source_uid) "
                "VALUES (:p, :o, 'participant', 'US', :sd, :a, 'test-sd', :u)"
            ),
            {"p": projects[sid], "o": ids[org], "sd": subdivision, "a": amount, "u": uid},
        )
    session.flush()


def test_the_reference_is_complete_and_written_once(db_session):
    seed_subdivisions(db_session, RunStats())
    codes = {
        r[0]
        for r in db_session.execute(text("SELECT code FROM subdivisions WHERE country_code = 'US'"))
    }
    assert len(codes) == len(US_STATES) + len(US_TERRITORIES) == 56
    assert "US-CA" in codes and "US-DC" in codes and "US-PR" in codes
    # Rejouable : le référentiel est remplacé, jamais dupliqué.
    seed_subdivisions(db_session, RunStats())
    assert (
        db_session.execute(
            text("SELECT count(*) FROM subdivisions WHERE country_code = 'US'")
        ).scalar()
        == 56
    )


def test_the_index_lists_every_mesh_funded_or_not(db_session):
    seed_subdivisions(db_session, RunStats())
    _seed_participations(db_session)
    index = subdivision_index(db_session, "US")

    assert len(index) == 56, "toute maille référencée sort — le gris dit l'absence"
    by_code = {row["code"]: row for row in index}
    assert by_code["US-CA"]["funding_eur"] == pytest.approx(5_000_000)
    assert by_code["US-CA"]["projects_count"] == 1
    # Deux participations, deux projets DISTINCTS.
    assert by_code["US-MA"]["funding_eur"] == pytest.approx(4_000_000)
    assert by_code["US-MA"]["projects_count"] == 2
    assert by_code["US-WY"]["funding_eur"] == 0
    assert by_code["US-WY"]["projects_count"] == 0
    # Classé par financement : la Californie mène.
    assert index[0]["code"] == "US-CA"
    assert index[0]["name"] == "California"


def test_explore_distributes_by_subdivision(db_session):
    from orion.search.explore import aggregate

    seed_subdivisions(db_session, RunStats())
    _seed_participations(db_session)

    result = aggregate(db_session, metric="funding", by="subdivision", country="US")
    assert result is not None
    series = {s["key"]: s for s in result["series"]}
    assert series["US-CA"]["value"] == pytest.approx(5_000_000)
    assert series["US-CA"]["label"] == "California"
    # Seules les participations TAGUÉES entrent : pas de maille fantôme.
    assert set(series) == {"US-CA", "US-MA"}

    # La maille se compare comme une dimension de plein droit.
    compared = aggregate(
        db_session,
        metric="funding",
        by="subdivision",
        split=True,
        compare=["US-CA", "US-MA"],
    )
    assert compared is not None
    assert {s["key"] for s in compared["series"]} == {"US-CA", "US-MA"}


def test_the_nuts_nomenclature_names_the_raw_codes(db_session):
    """Lot F (2026-08-17) : le fichier versionné charge tout ou rien, et
    les codes BRUTS du backfill CORDIS y trouvent leurs noms officiels —
    des régions nommées, jamais dessinées (la géométrie GISCO est exclue
    au registre, la nomenclature CC BY 4.0 passe)."""
    from orion.ingest.subdivisions import seed_nuts_nomenclature

    seed_nuts_nomenclature(db_session, RunStats())
    rows = {
        r.code: (r.level, r.name)
        for r in db_session.execute(text("SELECT code, level, name FROM nuts_nomenclature"))
    }
    assert len(rows) > 3000, "la nomenclature couvre l'Europe élargie"
    # Les codes constatés en prod au backfill se résolvent, aux niveaux
    # attendus — libellés Eurostat VERBATIM (« Ile de France »).
    assert rows["FR10"] == (2, "Ile de France")
    assert rows["FRJ2"] == (2, "Midi-Pyrénées")
    assert rows["FRJ"] == (1, "Occitanie")
    assert rows["DE21"] == (2, "Oberbayern")
    # Le niveau est cohérent avec la longueur du code, partout.
    assert all(len(code) - 2 == level for code, (level, _) in rows.items())
    # Rejouable : remplacée, jamais dupliquée.
    seed_nuts_nomenclature(db_session, RunStats())
    assert db_session.execute(text("SELECT count(*) FROM nuts_nomenclature")).scalar() == len(rows)


def test_the_european_meshes_derive_from_the_curated_levels(db_session):
    """Symétrie géographique (validée le 2026-08-17) : chaque pays curé a
    ses mailles AU NIVEAU CHOISI — la France en NUTS1 (la carte de 2016),
    l'Espagne en NUTS2, la Suède en NUTS3 — et la Grèce s'écrit GR chez
    nous même si Eurostat écrit EL."""
    from orion.ingest.subdivisions import seed_nuts_meshes, seed_nuts_nomenclature

    seed_subdivisions(db_session, RunStats())
    seed_nuts_nomenclature(db_session, RunStats())
    seed_nuts_meshes(db_session, RunStats())

    fr = {
        r.code: r.name
        for r in db_session.execute(
            text("SELECT code, name FROM subdivisions WHERE country_code = 'FR'")
        )
    }
    assert "FR1" in fr and fr["FRJ"] == "Occitanie"
    assert all(len(code) == 3 for code in fr), "France : NUTS1, la maille de 2016"
    es_levels = {
        r[0]
        for r in db_session.execute(
            text("SELECT DISTINCT level FROM subdivisions WHERE country_code = 'ES'")
        )
    }
    assert es_levels == {"nuts2"}
    gr = db_session.execute(
        text("SELECT count(*) FROM subdivisions WHERE country_code = 'GR' AND code LIKE 'EL%'")
    ).scalar()
    assert gr > 0, "les mailles grecques portent le préfixe Eurostat EL sous le pays ISO GR"
    # La maille US n'a pas bougé.
    assert (
        db_session.execute(
            text("SELECT count(*) FROM subdivisions WHERE country_code = 'US'")
        ).scalar()
        == 56
    )


def test_the_display_mesh_truncates_the_raw_nuts_and_keeps_the_residue_null(db_session):
    """La troncature est une VUE : le brut reste, le résidu reste NULL —
    « FR » sec n'est d'aucune région, il sera affiché comme tel."""
    from orion.ingest.subdivisions import (
        backfill_nuts_meshes,
        seed_nuts_meshes,
        seed_nuts_nomenclature,
    )

    seed_nuts_nomenclature(db_session, RunStats())
    seed_nuts_meshes(db_session, RunStats())
    funder = db_session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    db_session.execute(
        text(
            "INSERT INTO projects (source, source_id, title, funder_id, start_date) "
            "VALUES ('cordis-h', 'nm-1', 'zz', :f, '2023-01-01')"
        ),
        {"f": funder},
    )
    db_session.execute(
        text(
            "INSERT INTO organisations (name, name_normalized, country_code) "
            "VALUES ('ZZ CNRS', 'zz cnrs', 'FR')"
        )
    )
    pid = db_session.execute(text("SELECT id FROM projects WHERE source_id = 'nm-1'")).scalar_one()
    oid = db_session.execute(
        text("SELECT id FROM organisations WHERE name = 'ZZ CNRS'")
    ).scalar_one()
    rows = [("FR101", "nm-u1"), ("FRK26", "nm-u2"), ("FR", "nm-u3")]
    for nuts, uid in rows:
        db_session.execute(
            text(
                "INSERT INTO participations (project_id, organisation_id, role, country_code, "
                "nuts_code, amount_eur, source, source_uid) "
                "VALUES (:p, :o, 'participant', 'FR', :n, 1000, 'cordis-h', :u)"
            ),
            {"p": pid, "o": oid, "n": nuts, "u": uid},
        )
    db_session.flush()

    backfill_nuts_meshes(db_session, RunStats())
    got = {
        r.source_uid: r.subdivision_code
        for r in db_session.execute(
            text(
                "SELECT source_uid, subdivision_code FROM participations "
                "WHERE source_uid LIKE 'nm-%'"
            )
        )
    }
    # NUTS3 brut → maille NUTS1 : Île-de-France, Auvergne-Rhône-Alpes.
    assert got["nm-u1"] == "FR1"
    assert got["nm-u2"] == "FRK"
    # Le code pays sec ne se rattache à rien : résidu affiché, jamais fondu.
    assert got["nm-u3"] is None
