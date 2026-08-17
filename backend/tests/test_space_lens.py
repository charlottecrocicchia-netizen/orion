"""La lentille spatiale (V1, 2026-08-05) : le secteur se DÉFINIT dans un
fichier versionné et se tague sur pièces — programmes par sous-arbre,
thèmes par préfixe de code (jamais un libellé), motifs texte cadrés par
source (jamais NIH, où « satellite cell » est un muscle)."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.ingest.space_lens import SpaceLensError, load_space_lens, parse_rules


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


HEADER = "rule_type,value,tag,sources,evidence,source"


def _lens(tmp_path, rows):
    path = tmp_path / "space-lens.csv"
    path.write_text("\n".join([HEADER, *rows]) + "\n", encoding="utf-8")
    return path


def _seed(session: Session) -> dict[str, int]:
    funder = session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    session.execute(
        text(
            "INSERT INTO programmes (funder_id, code, name) VALUES "
            "(:f, 'ZZ-SPACE', 'ZZ Space root'), (:f, 'ZZ-OTHER', 'ZZ Other')"
        ),
        {"f": funder},
    )
    root = session.execute(text("SELECT id FROM programmes WHERE code = 'ZZ-SPACE'")).scalar_one()
    other = session.execute(text("SELECT id FROM programmes WHERE code = 'ZZ-OTHER'")).scalar_one()
    session.execute(
        text(
            "INSERT INTO programmes (funder_id, parent_id, code, name) "
            "VALUES (:f, :p, 'ZZ-SPACE-CHILD', 'ZZ Space child')"
        ),
        {"f": funder, "p": root},
    )
    child = session.execute(
        text("SELECT id FROM programmes WHERE code = 'ZZ-SPACE-CHILD'")
    ).scalar_one()

    ids = {}
    rows = [
        ("zzsl-1", "cordis-horizon", child, "Plain title"),
        ("zzsl-2", "cordis-horizon", other, "Plain title"),
        ("zzsl-3", "cordis-horizon", other, "An in-orbit servicing study"),
        ("zzsl-4", "nih", other, "In-orbit wording in biology"),
        ("zzsl-5", "cordis-horizon", other, "Microgravity protein growth"),
    ]
    for sid, source, prog, title in rows:
        session.execute(
            text(
                "INSERT INTO projects (source, source_id, title, funder_id, programme_id, "
                "start_date) VALUES (:src, :sid, :t, :f, :p, '2023-01-01')"
            ),
            {"src": source, "sid": sid, "t": title, "f": funder, "p": prog},
        )
        ids[sid] = session.execute(
            text("SELECT id FROM projects WHERE source_id = :sid"), {"sid": sid}
        ).scalar_one()
        session.execute(
            text(
                "INSERT INTO project_texts (project_id, lang, title, abstract) "
                "VALUES (:pid, 'en', :t, 'abstract.')"
            ),
            {"pid": ids[sid], "t": title},
        )
    session.execute(
        text(
            "INSERT INTO topics (scheme, code, label) VALUES "
            "('euroscivoc', '/23/43/257/999', 'zz astronomy child')"
        )
    )
    topic = session.execute(
        text("SELECT id FROM topics WHERE code = '/23/43/257/999'")
    ).scalar_one()
    session.execute(
        text("INSERT INTO project_topics (project_id, topic_id) VALUES (:p, :t)"),
        {"p": ids["zzsl-2"], "t": topic},
    )
    session.flush()
    return ids


RULES = [
    'programme,ZZ-SPACE,core,,"Programme spatial de test",test',
    'theme,/23/43/257,core,,"Sous-arbre astronomie",test',
    'text,in-orbit,core,cordis|nsf,"Services en orbite",test',
    'text,microgravity,adjacent,cordis|nsf,"Micropesanteur — adjacent",test',
]


def _tags(session, ids):
    return {
        sid: session.execute(
            text("SELECT space_tag FROM projects WHERE id = :i"), {"i": pid}
        ).scalar()
        for sid, pid in ids.items()
    }


def test_the_lens_tags_by_subtree_prefix_and_framed_text(db_session, tmp_path):
    ids = _seed(db_session)
    load_space_lens(db_session, RunStats(), path=_lens(tmp_path, RULES))
    tags = _tags(db_session, ids)
    assert tags["zzsl-1"] == "core"  # sous-arbre du programme
    assert tags["zzsl-2"] == "core"  # préfixe de thème, malgré le programme
    assert tags["zzsl-3"] == "core"  # motif texte, source cordis
    assert tags["zzsl-4"] is None  # même motif, source NIH : jamais tagué
    assert tags["zzsl-5"] == "adjacent"


def test_core_beats_adjacent_whatever_the_file_order(db_session, tmp_path):
    ids = _seed(db_session)
    rows = [
        'text,in-orbit,core,cordis|nsf,"Services en orbite",test',
        'text,servicing,adjacent,cordis|nsf,"Générique — adjacent",test',
    ]
    load_space_lens(db_session, RunStats(), path=_lens(tmp_path, rows))
    assert _tags(db_session, ids)["zzsl-3"] == "core"


def test_reload_retags_from_scratch(db_session, tmp_path):
    ids = _seed(db_session)
    load_space_lens(db_session, RunStats(), path=_lens(tmp_path, RULES))
    load_space_lens(db_session, RunStats(), path=_lens(tmp_path, [RULES[0]]))
    tags = _tags(db_session, ids)
    assert tags["zzsl-1"] == "core"
    assert tags["zzsl-3"] is None


def test_missing_programme_is_counted_never_fatal(db_session, tmp_path):
    _seed(db_session)
    stats = RunStats()
    load_space_lens(
        db_session,
        stats,
        path=_lens(tmp_path, ['programme,ABSENT-CODE,core,,"Règle vraie corpus absent",test']),
    )
    assert stats.counts.get("rule_skipped_no_match") == 1


def test_malformed_rules_refuse_to_tag(tmp_path):
    bad = [
        'programme,X,core,cordis,"sources sur un programme",test',
        'text,in-orbit,core,,"motif sans cadre de sources",test',
        'text,orbit,core,cordis,"motif court ambigu",test',
        'theme,/23/43,wrong,,"tag inconnu",test',
    ]
    for row in bad:
        with pytest.raises(SpaceLensError):
            parse_rules(_lens(tmp_path, [row]))


def test_the_two_perimeters_frame_the_explorer(db_session, tmp_path):
    """Space natif, lot 1 (validé 2026-08-17) : « Spatial direct » = le
    cœur seul ; « Spatial + habilitant » = cœur + adjacent (le sens
    historique de sector=space, désormais nommé) ; une valeur inconnue
    est refusée — jamais un cadrage silencieusement ignoré."""
    from orion.search.explore import aggregate

    ids = _seed(db_session)
    load_space_lens(db_session, RunStats(), path=_lens(tmp_path, RULES))
    del ids

    enabling = aggregate(db_session, metric="projects", by="funder", sector="space")
    direct = aggregate(db_session, metric="projects", by="funder", sector="space-direct")
    assert enabling is not None and direct is not None
    total_enabling = sum(s["value"] or 0 for s in enabling["series"])
    total_direct = sum(s["value"] or 0 for s in direct["series"])
    # La graine : 3 cœurs + 1 adjacent tagués.
    assert total_enabling == total_direct + 1
    assert direct["meta"]["sector"] == "space-direct"

    assert aggregate(db_session, metric="projects", by="funder", sector="martien") is None
