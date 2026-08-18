"""Les lentilles (M0, généralisation de la lentille spatiale V1) : un
secteur se DÉFINIT dans un fichier versionné et se tague sur pièces —
programmes par sous-arbre, thèmes par préfixe de code (jamais un
libellé), motifs texte cadrés par source (jamais NIH, où « satellite
cell » est un muscle). Le registre famille → lentille est validé tout ou
rien, et un projet peut porter plusieurs lentilles (D1) — chaque vue
n'en lit qu'une (D3)."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.lenses import (
    LensError,
    load_all,
    load_lens,
    parse_registry,
    parse_rules,
)
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats


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


def _lens(tmp_path, rows, name="space.csv"):
    path = tmp_path / name
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
    'text,microgravity,enabling,cordis|nsf,"Micropesanteur — habilitante",test',
]


def _tags(session, ids, lens="space"):
    return {
        sid: session.execute(
            text("SELECT tag FROM project_lens_tags WHERE project_id = :i AND lens = :lens"),
            {"i": pid, "lens": lens},
        ).scalar()
        for sid, pid in ids.items()
    }


def test_the_lens_tags_by_subtree_prefix_and_framed_text(db_session, tmp_path):
    ids = _seed(db_session)
    load_lens(db_session, RunStats(), "space", _lens(tmp_path, RULES))
    tags = _tags(db_session, ids)
    assert tags["zzsl-1"] == "core"  # sous-arbre du programme
    assert tags["zzsl-2"] == "core"  # préfixe de thème, malgré le programme
    assert tags["zzsl-3"] == "core"  # motif texte, source cordis
    assert tags["zzsl-4"] is None  # même motif, source NIH : jamais tagué
    assert tags["zzsl-5"] == "enabling"


def test_core_beats_enabling_whatever_the_file_order(db_session, tmp_path):
    ids = _seed(db_session)
    rows = [
        'text,in-orbit,core,cordis|nsf,"Services en orbite",test',
        'text,servicing,enabling,cordis|nsf,"Générique — habilitant",test',
    ]
    load_lens(db_session, RunStats(), "space", _lens(tmp_path, rows))
    assert _tags(db_session, ids)["zzsl-3"] == "core"


def test_reload_retags_from_scratch(db_session, tmp_path):
    ids = _seed(db_session)
    load_lens(db_session, RunStats(), "space", _lens(tmp_path, RULES))
    load_lens(db_session, RunStats(), "space", _lens(tmp_path, [RULES[0]]))
    tags = _tags(db_session, ids)
    assert tags["zzsl-1"] == "core"
    assert tags["zzsl-3"] is None


def test_missing_programme_is_counted_never_fatal(db_session, tmp_path):
    _seed(db_session)
    stats = RunStats()
    load_lens(
        db_session,
        stats,
        "space",
        _lens(tmp_path, ['programme,ABSENT-CODE,core,,"Règle vraie corpus absent",test']),
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
        with pytest.raises(LensError):
            parse_rules(_lens(tmp_path, [row]))


def _registry(tmp_path, rows):
    path = tmp_path / "registry.csv"
    path.write_text("\n".join(["family_key,slug,rank,status", *rows]) + "\n", encoding="utf-8")
    return path


def test_registry_validates_all_or_nothing(tmp_path):
    """Amendement M0 n°1 : famille → lentille, clés techniques stables —
    un registre mal formé ne mire rien. I2 : le statut fait partie de la
    forme validée."""
    assert parse_registry(_registry(tmp_path, ["aerospace_mobility,space,1,published"])) == [
        {"family_key": "aerospace_mobility", "slug": "space", "rank": 1, "status": "published"}
    ]
    bad = [
        ["Aérospatial,space,1,published"],  # un libellé n'est pas une clé de famille
        ["aerospace_mobility,Space,1,published"],  # slug en minuscules, toujours
        ["aerospace_mobility,space-direct,1,published"],  # « -direct » = grammaire D2
        ["aerospace_mobility,space,0,published"],  # rang ≥ 1
        ["aerospace_mobility,space,1,soon"],  # statut hors draft|published|retired
        ["aerospace_mobility,space,1,published", "energy,space,2,published"],  # slug en double
        ["aerospace_mobility,space,1,published", "energy,solar,1,published"],  # rang en double
    ]
    for rows in bad:
        with pytest.raises(LensError):
            parse_registry(_registry(tmp_path, rows))


def test_load_all_refuses_rules_outside_the_registry(db_session, tmp_path):
    """Toute lentille naît au registre — un CSV orphelin comme une entrée
    sans règles refusent de charger, dans les deux sens."""
    _registry(tmp_path, ["aerospace_mobility,space,1,published"])
    _lens(tmp_path, RULES, name="space.csv")
    _lens(tmp_path, RULES, name="orphan.csv")
    with pytest.raises(LensError):
        load_all(db_session, RunStats(), base_dir=tmp_path)

    (tmp_path / "orphan.csv").unlink()
    (tmp_path / "space.csv").unlink()
    with pytest.raises(LensError):
        load_all(db_session, RunStats(), base_dir=tmp_path)


def test_a_project_carries_two_lenses_each_read_full(db_session, tmp_path):
    """D1 + D3 : le chevauchement est permis par construction — le même
    projet compte PLEIN dans chaque lentille, et chaque vue n'en lit
    qu'une (les nombres de deux lentilles ne s'additionnent jamais)."""
    from orion.search.explore import aggregate

    ids = _seed(db_session)
    _registry(
        tmp_path,
        ["aerospace_mobility,space,1,published", "zz_family,zztest,2,published"],
    )
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,"Services en orbite",test'], name="space.csv")
    _lens(
        tmp_path,
        ['text,servicing,enabling,cordis|nsf,"Lecture seconde du même monde",test'],
        name="zztest.csv",
    )
    load_all(db_session, RunStats(), base_dir=tmp_path)

    assert _tags(db_session, ids, lens="space")["zzsl-3"] == "core"
    assert _tags(db_session, ids, lens="zztest")["zzsl-3"] == "enabling"

    both = db_session.execute(
        text("SELECT count(*) FROM project_lens_tags WHERE project_id = :p"),
        {"p": ids["zzsl-3"]},
    ).scalar()
    assert both == 2

    one = aggregate(db_session, metric="projects", by="funder", sector="zztest")
    assert one is not None
    assert sum(s["value"] or 0 for s in one["series"]) == 1


def test_only_published_lenses_exist_for_the_product(db_session, tmp_path):
    """I2 (2026-08-18) : draft se charge et se vérifie en base sans
    exister pour le produit — sector refusé, absente du bloc lenses ;
    retired n'est plus rechargée du tout."""
    from orion.search import aggregates
    from orion.search.explore import aggregate

    ids = _seed(db_session)
    _registry(
        tmp_path,
        [
            "aerospace_mobility,space,1,published",
            "zz_family,zzdraft,2,draft",
            "zz_family2,zzretired,3,retired",
        ],
    )
    _lens(tmp_path, RULES, name="space.csv")
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,"Brouillon",test'], name="zzdraft.csv")
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,"Retirée",test'], name="zzretired.csv")
    stats = RunStats()
    load_all(db_session, stats, base_dir=tmp_path)

    # Le draft est en base, vérifiable…
    assert _tags(db_session, ids, lens="zzdraft")["zzsl-3"] == "core"
    # …mais n'existe pas pour le produit.
    assert aggregate(db_session, metric="projects", by="funder", sector="zzdraft") is None
    exposed = [entry["slug"] for entry in aggregates.global_stats(db_session)["lenses"]]
    assert "zzdraft" not in exposed and "space" in exposed

    # La retirée n'a même pas été rechargée.
    assert stats.counts.get("lens_retired_skipped") == 1
    assert _tags(db_session, ids, lens="zzretired")["zzsl-3"] is None


def test_the_two_perimeters_frame_the_explorer(db_session, tmp_path):
    """Space natif, lot 1 (validé 2026-08-17) : « Spatial direct » = le
    cœur seul ; « Spatial + habilitant » = core + enabling (le sens
    historique de sector=space, désormais nommé) ; une valeur inconnue
    est refusée — jamais un cadrage silencieusement ignoré."""
    from orion.search.explore import aggregate

    ids = _seed(db_session)
    load_lens(db_session, RunStats(), "space", _lens(tmp_path, RULES))
    del ids

    enabling = aggregate(db_session, metric="projects", by="funder", sector="space")
    direct = aggregate(db_session, metric="projects", by="funder", sector="space-direct")
    assert enabling is not None and direct is not None
    total_enabling = sum(s["value"] or 0 for s in enabling["series"])
    total_direct = sum(s["value"] or 0 for s in direct["series"])
    # La graine : 3 cœurs + 1 habilitant tagués.
    assert total_enabling == total_direct + 1
    assert direct["meta"]["sector"] == "space-direct"

    assert aggregate(db_session, metric="projects", by="funder", sector="martien") is None


def test_the_api_contract_speaks_the_canonical_pair(client):
    """I3 (validé fondatrice, 2026-08-18) : le contrat d'API parle la
    paire canonique — `core` et `enabling` existent, `adjacent` n'existe
    plus NULLE PART dans le payload, à aucune profondeur. C'est la
    garde de la convention : un troisième terme ne peut plus revenir par
    une clé oubliée."""
    import json as _json

    response = client.get("/api/stats")
    assert response.status_code == 200
    body = response.json()

    assert body["lenses"], "le registre expose au moins la lentille publiée"
    for entry in body["lenses"]:
        assert {"core", "enabling"} <= set(entry), entry["slug"]
    # L'alias historique `space` porte le même vocabulaire (il tombe en M1.4).
    assert {"core", "enabling"} <= set(body["space"])

    assert "adjacent" not in _json.dumps(body)
