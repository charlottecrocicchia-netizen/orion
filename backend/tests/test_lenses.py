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


HEADER = "rule_type,value,tag,sources,group,scope,evidence,source"


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
    'programme,ZZ-SPACE,core,,,,"Programme spatial de test",test',
    'theme,/23/43/257,core,,,,"Sous-arbre astronomie",test',
    'text,in-orbit,core,cordis|nsf,,,"Services en orbite",test',
    'text,microgravity,enabling,cordis|nsf,,,"Micropesanteur — habilitante",test',
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
        'text,in-orbit,core,cordis|nsf,,,"Services en orbite",test',
        'text,servicing,enabling,cordis|nsf,,,"Générique — habilitant",test',
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
        _lens(tmp_path, ['programme,ABSENT-CODE,core,,,,"Règle vraie corpus absent",test']),
    )
    assert stats.counts.get("rule_skipped_no_match") == 1


def test_malformed_rules_refuse_to_tag(tmp_path):
    bad = [
        'programme,X,core,cordis,,,"sources sur un programme",test',
        'text,in-orbit,core,,,,"motif sans cadre de sources",test',
        'text,orbit,core,cordis,,,"motif court ambigu",test',
        'theme,/23/43,wrong,,,,"tag inconnu",test',
    ]
    for row in bad:
        with pytest.raises(LensError):
            parse_rules(_lens(tmp_path, [row]))


def _registry(tmp_path, rows):
    path = tmp_path / "registry.csv"
    path.write_text(
        "\n".join(["family_key,slug,rank,status,version", *rows]) + "\n", encoding="utf-8"
    )
    return path


def test_registry_validates_all_or_nothing(tmp_path):
    """Amendement M0 n°1 : famille → lentille, clés techniques stables —
    un registre mal formé ne mire rien. I2 : le statut fait partie de la
    forme validée."""
    assert parse_registry(_registry(tmp_path, ["aerospace_mobility,space,1,published,1"])) == [
        {
            "family_key": "aerospace_mobility",
            "slug": "space",
            "rank": 1,
            "status": "published",
            "version": 1,
        }
    ]
    bad = [
        ["Aérospatial,space,1,published"],  # un libellé n'est pas une clé de famille
        ["aerospace_mobility,Space,1,published"],  # slug en minuscules, toujours
        ["aerospace_mobility,space-direct,1,published,1"],  # « -direct » = grammaire D2
        ["aerospace_mobility,space,0,published,1"],  # rang ≥ 1
        ["aerospace_mobility,space,1,soon,1"],  # statut hors draft|published|retired
        ["aerospace_mobility,space,1,published,0"],  # version ≥ 1
        ["aerospace_mobility,space,1,published,1", "energy,space,2,published,1"],  # slug en double
        ["aerospace_mobility,space,1,published,1", "energy,solar,1,published,1"],  # rang en double
    ]
    for rows in bad:
        with pytest.raises(LensError):
            parse_registry(_registry(tmp_path, rows))


def test_load_all_refuses_rules_outside_the_registry(db_session, tmp_path):
    """Toute lentille naît au registre — un CSV orphelin comme une entrée
    sans règles refusent de charger, dans les deux sens."""
    _registry(tmp_path, ["aerospace_mobility,space,1,published,1"])
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
        ["aerospace_mobility,space,1,published,1", "zz_family,zztest,2,published,1"],
    )
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Services en orbite",test'], name="space.csv")
    _lens(
        tmp_path,
        ['text,servicing,enabling,cordis|nsf,,,"Lecture seconde du même monde",test'],
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
            "aerospace_mobility,space,1,published,1",
            "zz_family,zzdraft,2,draft,1",
            "zz_family2,zzretired,3,retired,1",
        ],
    )
    _lens(tmp_path, RULES, name="space.csv")
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Brouillon",test'], name="zzdraft.csv")
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Retirée",test'], name="zzretired.csv")
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
    assert "adjacent" not in _json.dumps(body)


def test_the_space_alias_never_comes_back(client):
    """M1.4 : `stats.space` est DÉPOSÉ — `lenses` est la seule source de
    vérité. Ce test existe pour qu'on ne le réintroduise pas « pour
    compatibilité » dans six mois : /api/stats n'est pas un contrat
    public, c'est le contrat interne de CE front, et il parle registre.
    Une lentille reste nommée `space` — dans `lenses`, à sa place."""
    body = client.get("/api/stats").json()

    assert "space" not in body, "aucune clé de premier niveau par lentille"
    assert not [
        key
        for key in body
        if key not in {"totals", "lenses", "funding_by_year", "overlap_projects"}
    ]
    assert any(entry["slug"] == "space" for entry in body["lenses"])


def test_the_seed_lens_can_never_come_from_the_production_registry():
    """La barrière du motif ORBITGUARD (M1.1) : la lentille SYNTHÉTIQUE
    de la recette vit dans la graine e2e — jamais dans `curation/`, donc
    jamais en production. Si quelqu'un l'y glissait un jour, ou lui
    écrivait un fichier de règles, ce test tombe."""
    import re
    from pathlib import Path

    from orion.ingest.lenses import LENSES_DIR, REGISTRY_FILE, parse_registry

    seed = (Path(__file__).resolve().parents[1] / "scripts" / "seed_e2e.py").read_text(
        encoding="utf-8"
    )
    slugs = re.findall(r'^SEED_(?:DRAFT_)?LENS_SLUG = "([^"]+)"', seed, re.M)
    assert len(slugs) == 2, "la graine nomme sa lentille publiée ET sa draft"

    registry = {entry["slug"] for entry in parse_registry(REGISTRY_FILE)}
    for seed_slug in slugs:
        assert seed_slug not in registry
        assert not (LENSES_DIR / f"{seed_slug}.csv").exists()


def _refusal(response) -> dict:
    assert response.status_code == 400, response.status_code
    body = response.json()["detail"]
    assert body["error"] == "INVALID_LENS"
    assert body["parameter"] == "sector"
    return body


def test_the_refusal_is_the_same_on_every_surface(client):
    """M1.2 : une valeur inconnue, vide ou multiple est REFUSÉE — jamais
    un repli silencieux sur le corpus entier (un tel lien mentirait sur
    ce qu'il montre). Même règle à l'Explorateur et à la recherche."""
    for url in ("/api/search/projects", "/api/explore/aggregate?metric=projects&by=funder"):
        joiner = "&" if "?" in url else "?"
        # Inconnue.
        body = _refusal(client.get(f"{url}{joiner}sector=martien"))
        assert body["value"] == "martien"
        # Vide : le paramètre a été ENVOYÉ, il doit dire quelque chose.
        assert _refusal(client.get(f"{url}{joiner}sector="))["value"] == ""
        # Multiple : jamais réduit à la première ni à la dernière valeur.
        body = _refusal(client.get(f"{url}{joiner}sector=space&sector=martien"))
        assert body["reason"] == "multiple_values"
        # Deux valeurs VALIDES restent un refus : la vue est scalaire.
        assert _refusal(client.get(f"{url}{joiner}sector=space&sector=space-direct"))


def test_the_refusal_never_says_why_nor_lists_the_registry(client, db_session):
    """Un draft est « indisponible », jamais « en préparation » : le
    corps du refus ne trahit ni le statut, ni les slugs valides."""
    db_session.execute(
        text(
            "INSERT INTO lenses (slug, family_key, rank, status) "
            "VALUES ('zzquietlens', 'zz_family', 77, 'draft') ON CONFLICT (slug) DO NOTHING"
        )
    )
    db_session.commit()
    try:
        body = client.get("/api/search/projects?sector=zzquietlens").json()["detail"]
        assert body == {"error": "INVALID_LENS", "parameter": "sector", "value": "zzquietlens"}
        # Rien du statut, rien du registre : ni « draft », ni le slug
        # d'une lentille publiée. Seule la valeur reçue est renvoyée.
        for secret in ("draft", "retired", "published", "status", "space"):
            assert secret not in str(body)
    finally:
        db_session.execute(text("DELETE FROM lenses WHERE slug = 'zzquietlens'"))
        db_session.commit()


def test_a_registry_outage_is_never_an_invalid_lens(client, monkeypatch):
    """Invariant ① : une panne de lecture du registre n'est PAS un
    verdict. Elle ne peut donc jamais se déguiser en INVALID_LENS —
    sinon un incident d'infrastructure ferait mentir des liens justes."""
    from sqlalchemy.exc import OperationalError

    from orion.api import lens_param

    def registry_down(*args, **kwargs):
        raise OperationalError("registry unreachable", None, Exception())

    monkeypatch.setattr(lens_param, "valid_sector", registry_down)
    with pytest.raises(OperationalError):
        client.get("/api/search/projects?sector=space")


def test_the_proof_hierarchy_decides_and_travels(db_session, tmp_path):
    """I6 : `call` et `topic` sont des faits de la source (structurels),
    le thème est taxonomique, le motif textuel. Chaque tag GARDE l'origine
    qui l'a posé — l'audit sait quelle famille corriger."""
    ids = _seed(db_session)
    funder = db_session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    db_session.execute(
        text(
            "INSERT INTO calls (funder_id, code, title) "
            "VALUES (:f, 'ZZ-CALL-2024-01', 'appel de test')"
        ),
        {"f": funder},
    )
    call_id = db_session.execute(
        text("SELECT id FROM calls WHERE code = 'ZZ-CALL-2024-01'")
    ).scalar_one()
    db_session.execute(
        text("UPDATE projects SET call_id = :c WHERE id = :p"),
        {"c": call_id, "p": ids["zzsl-5"]},
    )
    db_session.flush()

    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                'call,ZZ-CALL-,core,,,,"L\'appel qui a financé — un fait",test',
                'theme,/23/43/257,core,,,,"Sous-arbre astronomie",test',
                'text,in-orbit,core,cordis|nsf,,,"Services en orbite",test',
            ],
        ),
    )
    proofs = {
        sid: db_session.execute(
            text("SELECT proof FROM project_lens_tags WHERE project_id = :i AND lens = 'space'"),
            {"i": pid},
        ).scalar()
        for sid, pid in ids.items()
    }
    assert proofs["zzsl-5"] == "structural"  # par l'appel
    assert proofs["zzsl-2"] == "taxonomic"  # par le sous-arbre de thème
    assert proofs["zzsl-3"] == "textual"  # par le motif


def test_topic_takes_the_exact_concept_never_the_subtree(db_session, tmp_path):
    """I7 : `topic` nomme le concept EXACT — il n'hérite pas des voisins,
    contrairement à `theme` qui prend le sous-arbre."""
    ids = _seed(db_session)
    # zzsl-2 porte le thème /23/43/257/999, ENFANT de /23/43/257.
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(tmp_path, ['topic,/23/43/257,core,,,,"Le concept exact, pas ses enfants",test']),
    )
    assert _tags(db_session, ids)["zzsl-2"] is None

    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path, ['topic,/23/43/257/999,core,,,,"Le concept exact que porte le projet",test']
        ),
    )
    assert _tags(db_session, ids)["zzsl-2"] == "core"


def test_a_veto_never_overturns_a_fact_of_the_source(db_session, tmp_path):
    """I6, la garde : un veto textuel tue un candidat venu du texte ou du
    thème — jamais une classification obtenue par `call` ou `topic`."""
    ids = _seed(db_session)
    funder = db_session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    db_session.execute(
        text(
            "INSERT INTO calls (funder_id, code, title) "
            "VALUES (:f, 'ZZ-CALL-2024-01', 'appel de test')"
        ),
        {"f": funder},
    )
    call_id = db_session.execute(
        text("SELECT id FROM calls WHERE code = 'ZZ-CALL-2024-01'")
    ).scalar_one()
    # zzsl-3 (« in-orbit servicing ») est aussi financé par l'appel.
    db_session.execute(
        text("UPDATE projects SET call_id = :c WHERE id = :p"),
        {"c": call_id, "p": ids["zzsl-3"]},
    )
    db_session.flush()

    stats = RunStats()
    load_lens(
        db_session,
        stats,
        "space",
        _lens(
            tmp_path,
            [
                'text,microgravity,core,cordis|nsf,,,"Motif interprété",test',
                'call,ZZ-CALL-,core,,,,"Un fait de la source",test',
                'veto,servicing,,cordis|nsf,,,"Le mot est trop générique",test',
                'veto,microgravity,,cordis|nsf,,,"Retiré par veto",test',
            ],
        ),
    )
    tags = _tags(db_session, ids)
    assert tags["zzsl-5"] is None  # textuel : le veto mord
    assert tags["zzsl-3"] == "core"  # structurel : le veto NE MORD PAS
    assert stats.counts.get("vetoed", 0) >= 1


def test_a_veto_carries_no_tag(tmp_path):
    with pytest.raises(LensError):
        parse_rules(_lens(tmp_path, ['veto,servicing,core,cordis,,,"un veto ne classe pas",test']))


def test_one_lens_recalculates_alone(db_session, tmp_path):
    """I4 exécutable : `--lens <slug>` ne touche JAMAIS les tags des
    autres lentilles — chaque lentille vit sa propre vie."""
    ids = _seed(db_session)
    _registry(
        tmp_path,
        ["aerospace_mobility,space,1,published,1", "zz_family,zztest,2,published,1"],
    )
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Orbite",test'], name="space.csv")
    _lens(
        tmp_path, ['text,microgravity,core,cordis|nsf,,,"Micropesanteur",test'], name="zztest.csv"
    )
    load_all(db_session, RunStats(), base_dir=tmp_path)
    assert _tags(db_session, ids, lens="space")["zzsl-3"] == "core"
    assert _tags(db_session, ids, lens="zztest")["zzsl-5"] == "core"

    # On rétague zztest SEULE, avec des règles vides de tout résultat.
    _lens(tmp_path, ['text,absent-motif,core,cordis|nsf,,,"Rien",test'], name="zztest.csv")
    load_all(db_session, RunStats(), base_dir=tmp_path, only="zztest")
    assert _tags(db_session, ids, lens="zztest")["zzsl-5"] is None
    assert _tags(db_session, ids, lens="space")["zzsl-3"] == "core"  # intacte

    with pytest.raises(LensError):
        load_all(db_session, RunStats(), base_dir=tmp_path, only="inconnue")


def test_the_changelog_is_derived_never_typed(db_session, tmp_path):
    """S1 ① : l'avant/après d'un changement de méthodologie est MESURÉ
    par le run après succès, jamais saisi. Un premier chargement n'est
    pas un changement — il ne journalise rien."""
    ids = _seed(db_session)
    _registry(tmp_path, ["aerospace_mobility,space,1,published,1"])
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Orbite",test'], name="space.csv")
    load_all(db_session, RunStats(), base_dir=tmp_path)
    assert db_session.execute(text("SELECT count(*) FROM lens_changelog")).scalar() == 0

    # Version 2 : la règle se resserre, le run mesure et journalise.
    _registry(tmp_path, ["aerospace_mobility,space,1,published,2"])
    _lens(tmp_path, ['text,absent-motif,core,cordis|nsf,,,"Plus rien",test'], name="space.csv")
    load_all(db_session, RunStats(), base_dir=tmp_path)
    row = db_session.execute(
        text("SELECT version, core_before, core_after FROM lens_changelog WHERE lens = 'space'")
    ).one()
    assert (row.version, row.core_before, row.core_after) == (2, 1, 0)
    assert _tags(db_session, ids)["zzsl-3"] is None


def test_a_draft_lens_owes_no_changelog(db_session, tmp_path):
    """Un journal explique le mouvement de chiffres PUBLIÉS. Une lentille
    en draft n'a jamais rien montré : ses règles bougent sans dette."""
    _seed(db_session)
    _registry(tmp_path, ["zz_family,zzdraft,1,draft,1"])
    _lens(tmp_path, ['text,in-orbit,core,cordis|nsf,,,"Orbite",test'], name="zzdraft.csv")
    load_all(db_session, RunStats(), base_dir=tmp_path)

    _registry(tmp_path, ["zz_family,zzdraft,1,draft,2"])
    _lens(tmp_path, ['text,absent-motif,core,cordis|nsf,,,"Plus rien",test'], name="zzdraft.csv")
    load_all(db_session, RunStats(), base_dir=tmp_path)
    assert db_session.execute(text("SELECT count(*) FROM lens_changelog")).scalar() == 0


def test_an_unescaped_comma_says_so_plainly(tmp_path):
    """Une virgule non échappée dans une évidence ajoute des colonnes :
    le chargeur le dit, au lieu de planter obscurément plus loin."""
    with pytest.raises(LensError, match="virgule non échappée"):
        parse_rules(_lens(tmp_path, ["call,X-,core,,,,une évidence, avec virgule,test"]))


# --- Les groupes liés : candidat taxonomique + corroboration lexicale ---
#
# La politique V1 : un candidat ne tague JAMAIS seul. Le concept
# euroSciVoc ouvre un pool ; le titre ET le texte le referment. Le
# résultat est de classe TAXONOMIQUE confirmée — jamais structurelle.

CAND = 'candidate,/23/43/257/999,core,,av-test,,"Concept candidat",test'


def _in_pool(session, ids, *keys):
    topic = session.execute(
        text("SELECT id FROM topics WHERE code = '/23/43/257/999'")
    ).scalar_one()
    for key in keys:
        session.execute(
            text("INSERT INTO project_topics (project_id, topic_id) VALUES (:p, :t)"),
            {"p": ids[key], "t": topic},
        )
    session.flush()


def test_a_candidate_never_tags_without_its_two_corroborations(db_session, tmp_path):
    ids = _seed(db_session)
    _in_pool(db_session, ids, "zzsl-3", "zzsl-5")
    # Le titre corrobore (zzsl-3), le texte NON : personne n'entre.
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                CAND,
                'confirm,in-orbit,,cordis,av-test,title,"Le titre dit le sujet",test',
                'confirm,microgravity,,cordis,av-test,body_text,"Corroboration texte",test',
            ],
        ),
    )
    assert set(_tags(db_session, ids).values()) == {None}


def test_the_two_corroborations_together_tag_as_taxonomic(db_session, tmp_path):
    ids = _seed(db_session)
    _in_pool(db_session, ids, "zzsl-3", "zzsl-5")
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                CAND,
                'confirm,in-orbit,,cordis,av-test,title,"Le titre dit le sujet",test',
                # « servicing » n'est QUE dans le titre : il ne peut pas
                # se confirmer lui-même. Le corps doit porter son motif.
                'confirm,abstract,,cordis,av-test,body_text,"Le corps, hors titre",test',
            ],
        ),
    )
    tags = _tags(db_session, ids)
    assert tags["zzsl-3"] == "core"
    # zzsl-5 est dans le pool mais son titre ne corrobore pas.
    assert tags["zzsl-5"] is None
    proof = db_session.execute(
        text("SELECT proof FROM project_lens_tags WHERE project_id = :i"),
        {"i": ids["zzsl-3"]},
    ).scalar_one()
    assert proof == "taxonomic"


def test_a_confirmation_never_confirms_another_groups_candidate(db_session, tmp_path):
    """Le lien est le GROUPE, jamais la proximité dans le fichier (I8)."""
    ids = _seed(db_session)
    _in_pool(db_session, ids, "zzsl-5")  # zzsl-5 est dans le pool du groupe A
    db_session.execute(
        text(
            "INSERT INTO topics (scheme, code, label) VALUES "
            "('euroscivoc', '/23/43/257/777', 'zz autre concept')"
        )
    )
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                CAND,  # groupe av-test, pool = {zzsl-5}
                'confirm,in-orbit,,cordis,av-test,title,"Titre du groupe A",test',
                'confirm,servicing,,cordis,av-test,body_text,"Texte du groupe A",test',
                # Le groupe B corrobore PARFAITEMENT zzsl-5 « Microgravity
                # protein growth » — mais son candidat ne le contient pas.
                'candidate,/23/43/257/777,core,,av-autre,,"Autre concept",test',
                'confirm,microgravity,,cordis,av-autre,title,"Titre du groupe B",test',
                'confirm,microgravity,,cordis,av-autre,body_text,"Texte du groupe B",test',
            ],
        ),
    )
    assert set(_tags(db_session, ids).values()) == {None}


def test_the_v1_policy_refuses_incomplete_groups(tmp_path):
    """Un groupe incomplet se dit au CHARGEMENT, jamais en silence."""
    cases = [
        # Deux candidats dans un même groupe.
        [CAND, CAND.replace("/999", "/777")],
        # Une confirmation orpheline — aucun candidat ne la porte.
        [CAND, 'confirm,in-orbit,,cordis,av-orphelin,title,"Sans candidat",test'],
        # Corroboration texte manquante : la politique V1 exige les deux.
        [CAND, 'confirm,in-orbit,,cordis,av-test,title,"Titre seul",test'],
        # Un scope hors title|text.
        [CAND, 'confirm,in-orbit,,cordis,av-test,abstract,"Scope inventé",test'],
        # Une confirmation qui ne cadre pas ses sources.
        [CAND, 'confirm,in-orbit,,,av-test,title,"Sans cadre",test'],
        # Un candidat sans groupe.
        ['candidate,/23/43/257/999,core,,,,"Sans groupe",test'],
        # `group` et `scope` n'appartiennent qu'aux règles liées.
        ['text,in-orbit,core,cordis,av-test,,"Groupe usurpé",test'],
        ['text,in-orbit,core,cordis,,title,"Scope usurpé",test'],
    ]
    for rows in cases:
        with pytest.raises(LensError):
            parse_rules(_lens(tmp_path, rows))


def test_the_body_reads_the_objective_alone_never_the_title_again(db_session, tmp_path):
    """La correction du 2026-08-18 : croiser `title` et titre+résumé ne
    prouve RIEN — le motif du titre satisfait les deux lectures. Seul
    l'objectif SEUL est une vraie seconde lecture."""
    ids = _seed(db_session)
    _in_pool(db_session, ids, "zzsl-3", "zzsl-5")
    # Le MÊME motif sur les deux champs : le titre mord, le corps non.
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                CAND,
                'confirm,in-orbit,,cordis,av-test,title,"Le titre dit le sujet",test',
                'confirm,in-orbit,,cordis,av-test,body_text,"Le corps, hors titre",test',
            ],
        ),
    )
    assert set(_tags(db_session, ids).values()) == {None}

    # Un motif réellement présent dans le résumé, lui, corrobore.
    load_lens(
        db_session,
        RunStats(),
        "space",
        _lens(
            tmp_path,
            [
                CAND,
                'confirm,in-orbit,,cordis,av-test,title,"Le titre dit le sujet",test',
                'confirm,abstract,,cordis,av-test,body_text,"Le corps, hors titre",test',
            ],
        ),
    )
    tags = _tags(db_session, ids)
    assert tags["zzsl-3"] == "core"
    assert tags["zzsl-5"] is None


def test_all_text_is_never_enough_for_the_v1_policy(tmp_path):
    """`all_text` reste dans la grammaire — jamais suffisant."""
    with pytest.raises(LensError, match="body_text"):
        parse_rules(
            _lens(
                tmp_path,
                [
                    CAND,
                    'confirm,in-orbit,,cordis,av-test,title,"Titre",test',
                    'confirm,servicing,,cordis,av-test,all_text,"Titre + résumé",test',
                ],
            )
        )
