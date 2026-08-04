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
            "INSERT INTO programmes (funder_id, code, name) VALUES (:f, 'ZZPROG', 'ZZ Programme')"
        ),
        {"f": funder},
    )
    programme = session.execute(
        text("SELECT id FROM programmes WHERE code = 'ZZPROG'")
    ).scalar_one()
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

    # Le trou de couverture en miniature : un homonyme NON rattaché
    # (clé « zzgroupe aero … »), un homonyme arbitré vers un autre
    # groupe, et un partenaire extérieur qui co-signe avec le groupe.
    extras = (
        ("ZZGROUPE AERO PROPULSION SAS", "zzgroupe aero propulsion", "FR"),
        ("ZZGROUPE AERO LEGACY", "zzgroupe aero legacy", "FR"),
        ("ZZPARTNER UNIV", "zzpartner univ", "NL"),
    )
    for name, normalized, country in extras:
        session.execute(
            text(
                "INSERT INTO organisations (name, name_normalized, country_code) "
                "VALUES (:n, :k, :c)"
            ),
            {"n": name, "k": normalized, "c": country},
        )
        orgs[name] = session.execute(
            text("SELECT id FROM organisations WHERE name = :n"), {"n": name}
        ).scalar_one()
    session.execute(
        text(
            "INSERT INTO groups (name, country_code, lei, source) "
            "VALUES ('ZZGROUPE RIVAL', 'FR', 'ZZLEI000000000000002', 'gleif')"
        )
    )
    rival_id = session.execute(
        text("SELECT id FROM groups WHERE name = 'ZZGROUPE RIVAL'")
    ).scalar_one()
    session.execute(
        text(
            "INSERT INTO entity_group_map (organisation_id, group_id, method, confidence, "
            "source, is_jv) VALUES (:o, :g, 'wikidata', 0.6, 'wikidata', false)"
        ),
        {"o": orgs["ZZGROUPE AERO LEGACY"], "g": rival_id},
    )

    projects = {}
    for sid, title, year in (
        ("zzg-1", "zz solo", 2020),
        ("zzg-2", "zz co-signe", 2022),
        ("zzg-3", "zz homonyme", 2021),
    ):
        session.execute(
            text(
                "INSERT INTO projects (source, source_id, title, funder_id, programme_id, "
                "start_date) VALUES ('test-zzg', :sid, :title, :f, :prog, :d)"
            ),
            {"sid": sid, "title": title, "f": funder, "prog": programme, "d": f"{year}-01-01"},
        )
        projects[sid] = session.execute(
            text("SELECT id FROM projects WHERE source_id = :sid"), {"sid": sid}
        ).scalar_one()

    rows = [
        ("zzg-1", "ZZAERO SA", 4_000_000, "p1"),
        ("zzg-2", "ZZAERO SA", 3_000_000, "p2"),  # le même projet…
        ("zzg-2", "ZZAERO GMBH", 1_000_000, "p3"),  # …signé par les deux entités
        ("zzg-2", "ZZPARTNER UNIV", 500_000, "p4"),  # le partenaire extérieur
        ("zzg-3", "ZZGROUPE AERO PROPULSION SAS", 2_000_000, "p5"),  # l'homonyme
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


def test_coverage_confesses_the_unattached_homonyms(db_session):
    """La note d'honnêteté : l'homonyme hors périmètre est compté et
    pesé ; l'homonyme arbitré vers un autre groupe et le partenaire
    extérieur ne le sont pas."""
    group_id = _seed_group(db_session)
    hub = group_hub(db_session, group_id)

    assert hub["coverage"] == {
        "unattached_count": 1,
        "unattached_funding_eur": pytest.approx(2_000_000),
    }


def test_the_trajectory_splits_by_entity(db_session):
    group_id = _seed_group(db_session)
    hub = group_hub(db_session, group_id)

    by_name = {s["name"]: s for s in hub["by_entity"]}
    assert [(p["year"], p["funding_eur"]) for p in by_name["ZZAERO SA"]["points"]] == [
        (2020, pytest.approx(4_000_000)),
        (2022, pytest.approx(3_000_000)),
    ]
    assert [(p["year"], p["funding_eur"]) for p in by_name["ZZAERO GMBH"]["points"]] == [
        (2022, pytest.approx(1_000_000)),
    ]
    # Deux entités seulement : pas de série « autres ».
    assert None not in by_name


def test_group_partners_exclude_the_members(db_session):
    group_id = _seed_group(db_session)
    hub = group_hub(db_session, group_id)

    names = [p["name"] for p in hub["partners"]]
    assert names == ["ZZPARTNER UNIV"]
    assert hub["partners"][0]["shared_projects"] == 1


def test_group_watchpost_consolidates_with_the_org_thresholds(db_session):
    from orion.search.aggregates import group_watchpost

    group_id = _seed_group(db_session)
    post = group_watchpost(db_session, group_id, "2021-01-01")

    # Le partenaire extérieur est « nouveau » (premier projet partagé en
    # 2022) ; les entités du groupe ne comptent jamais comme partenaires.
    assert post["signals"]["new_partners"] == {"count": 1, "names": ["ZZPARTNER UNIV"]}
    assert post["sources_count"] == 1  # test-zzg


def test_the_group_enters_the_benchmark(db_session):
    from orion.search.aggregates import compare_entries

    group_id = _seed_group(db_session)
    partner_id = db_session.execute(
        text("SELECT id FROM organisations WHERE name = 'ZZPARTNER UNIV'")
    ).scalar_one()

    result = compare_entries(db_session, [f"g{group_id}", str(partner_id)])
    entries = result["entries"]
    assert [e["kind"] for e in entries] == ["group", "organisation"]
    group_entry = entries[0]
    assert group_entry["id"] == f"g{group_id}"
    assert group_entry["name"] == "ZZGROUPE AERO"
    # Le consolidé du benchmark obéit à la même règle : co-signé = UNE fois.
    assert group_entry["kpis"]["projects_count"] == 2
    assert group_entry["kpis"]["total_funding_eur"] == pytest.approx(8_000_000)
    assert group_entry["top_partners"][0]["name"] == "ZZPARTNER UNIV"
    # L'écran d'analyse : programmes forts et géographie sur l'entrée.
    assert group_entry["top_programmes"][0]["projects"] == 2
    assert {c["code"] for c in group_entry["countries"]} == {"FR", "DE"}
    # Les partenaires communs du panel : le groupe et ZZPARTNER UNIV
    # partagent zzg-2 avec... personne d'autre — panel de 2 sans tiers
    # commun, la liste est vide et le dit.
    assert result["common_partners"] == []


def _write_curation(tmp_path, rows):
    path = tmp_path / "groups.csv"
    header = (
        "group_lei,group_name,org_name,org_country,decision,"
        "confidence,is_jv,share,status,valid_from,valid_to,evidence,source"
    )
    path.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")
    return path


def test_curation_attaches_refuses_and_silences_the_radar(db_session, tmp_path):
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats

    group_id = _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            "ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,attach,"
            '0.95,false,,,,,"Filiale déclarée du groupe",https://example.test/registre',
        ],
    )
    load_curation(db_session, RunStats(), path=path)

    hub = group_hub(db_session, group_id)
    # L'entité curée entre au consolidé…
    assert hub["totals"]["entities"] == 3
    assert hub["totals"]["projects"] == 3
    assert hub["totals"]["funding_eur"] == pytest.approx(10_000_000)
    curated = next(e for e in hub["entities"] if e["name"] == "ZZGROUPE AERO PROPULSION SAS")
    assert curated["method"] == "curation"
    assert curated["confidence"] == pytest.approx(0.95)
    # …et le radar se tait : plus d'homonyme en attente.
    assert hub["coverage"] == {"unattached_count": 0, "unattached_funding_eur": 0}


def test_curation_refusal_silences_without_attaching(db_session, tmp_path):
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats

    group_id = _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            "ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,refuse,"
            ',,,,,,"Homonyme sans lien capitalistique",https://example.test/registre',
        ],
    )
    load_curation(db_session, RunStats(), path=path)

    hub = group_hub(db_session, group_id)
    assert hub["totals"]["entities"] == 2  # rien de rattaché
    assert hub["coverage"] == {"unattached_count": 0, "unattached_funding_eur": 0}


def test_curation_jv_keeps_its_share(db_session, tmp_path):
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats

    group_id = _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            "ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,attach,"
            '0.9,true,67,,,,"Coentreprise 67/33 documentée",https://example.test/registre',
        ],
    )
    load_curation(db_session, RunStats(), path=path)

    hub = group_hub(db_session, group_id)
    curated = next(e for e in hub["entities"] if e["name"] == "ZZGROUPE AERO PROPULSION SAS")
    assert curated["is_jv"] is True


def test_curation_refuses_to_guess(db_session, tmp_path):
    """Une ligne fausse = rien ne charge : évidence vide, organisation
    introuvable, JV sans part."""
    from orion.ingest.groups.curation import CurationError, load_curation
    from orion.ingest.runlog import RunStats

    _seed_group(db_session)
    bad_rows = [
        # Évidence vide.
        "ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,attach,0.9,false,,,,,,src",
        # Organisation introuvable.
        'ZZLEI000000000000001,,INCONNUE XYZ,FR,attach,0.9,false,,,,,"ev",src',
        # JV sans part.
        'ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,attach,0.9,true,,,,,"ev",src',
    ]
    for bad in bad_rows:
        path = _write_curation(tmp_path, [bad])
        with pytest.raises(CurationError):
            load_curation(db_session, RunStats(), path=path)
    count = db_session.execute(
        text("SELECT count(*) FROM entity_group_map WHERE method = 'curation'")
    ).scalar()
    assert count == 0


def test_announced_membership_is_listed_never_consolidated(db_session, tmp_path):
    """Le statut temporel (pivot spatial) : une adhésion « announced »
    apparaît sur la fiche, marquée, mais ne consolide RIEN — totaux,
    trajectoire, partenaires, benchmark restent au périmètre actif."""
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats
    from orion.search.aggregates import compare_entries

    group_id = _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            "ZZLEI000000000000001,,ZZGROUPE AERO PROPULSION SAS,FR,attach,"
            '0.7,false,,announced,,,"Opération publique annoncée non finalisée",https://example.test',
        ],
    )
    load_curation(db_session, RunStats(), path=path)

    hub = group_hub(db_session, group_id)
    # Les totaux ignorent l'annoncé…
    assert hub["totals"] == {
        "entities": 2,
        "projects": 2,
        "funding_eur": pytest.approx(8_000_000),
        "countries": 2,
    }
    # …mais la fiche le LISTE, marqué, en fin de liste.
    statuses = [(e["name"], e["status"]) for e in hub["entities"]]
    assert ("ZZGROUPE AERO PROPULSION SAS", "announced") in statuses
    assert statuses[-1][1] == "announced"
    # Le radar est apaisé (l'homonyme est arbitré par l'annonce)…
    assert hub["coverage"]["unattached_count"] == 0
    # …et le benchmark consolide l'actif seulement.
    entry = compare_entries(db_session, [f"g{group_id}"])["entries"][0]
    assert entry["kpis"]["total_funding_eur"] == pytest.approx(8_000_000)
    assert entry["entities"] == 2


def test_curation_creates_the_announced_group_head(db_session, tmp_path):
    """Une opération annoncée n'a pas de tête GLEIF : la curation crée le
    groupe (source='curation'), et le retire s'il redevient orphelin."""
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats

    _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            ",ZZ OPERATION ANNONCEE,ZZAERO SA,FR,attach,"
            '0.7,false,,announced,,,"MoU public — opération annoncée",https://example.test',
        ],
    )
    load_curation(db_session, RunStats(), path=path)
    created = db_session.execute(
        text("SELECT id, source FROM groups WHERE name = 'ZZ OPERATION ANNONCEE'")
    ).first()
    assert created is not None and created.source == "curation"
    hub = group_hub(db_session, created.id)
    assert hub["totals"]["funding_eur"] == 0  # rien de consolidé
    assert [e["status"] for e in hub["entities"]] == ["announced"]

    # Le fichier vidé de la ligne → la tête orpheline repart.
    empty = _write_curation(tmp_path, [])
    load_curation(db_session, RunStats(), path=empty)
    assert (
        db_session.execute(
            text("SELECT count(*) FROM groups WHERE name = 'ZZ OPERATION ANNONCEE'")
        ).scalar()
        == 0
    )


def test_the_organisations_search_surfaces_groups_first(db_session):
    """Recette 2026-08-04 : la règle du moment Safran vaut PARTOUT — la
    recherche de la page organisations remonte les groupes en tête, et
    un nom portant TOUS les mots de la requête gagne (l'opération
    annoncée sort sur « zzgroupe aero »)."""
    from orion.search.service import OrganisationFilters, search_organisations

    _seed_group(db_session)
    db_session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
    result = search_organisations(db_session, OrganisationFilters(q="zzgroupe aero"))

    assert result["groups"], "le bloc groupes doit exister"
    top = result["groups"][0]
    assert top["name"] == "ZZGROUPE AERO"
    assert top["entities"] == 2
    assert top["funding_eur"] == pytest.approx(8_000_000)
    assert top["announced_entities"] == 0


def test_announced_groups_surface_with_their_count(db_session, tmp_path):
    from orion.ingest.groups.curation import load_curation
    from orion.ingest.runlog import RunStats
    from orion.search.service import OrganisationFilters, search_organisations

    _seed_group(db_session)
    path = _write_curation(
        tmp_path,
        [
            ",ZZ OPERATION COMMUNE,ZZAERO SA,FR,attach,"
            '0.7,false,,announced,,,"MoU public — opération annoncée",https://example.test',
        ],
    )
    load_curation(db_session, RunStats(), path=path)
    db_session.execute(text("SELECT set_config('pg_trgm.similarity_threshold', '0.25', true)"))
    result = search_organisations(db_session, OrganisationFilters(q="zz operation commune"))
    top = result["groups"][0]
    assert top["name"] == "ZZ OPERATION COMMUNE"
    assert top["entities"] == 0
    assert top["announced_entities"] == 1
    assert top["funding_eur"] == 0


def test_common_partners_find_who_works_with_both(db_session):
    """L'info du veilleur : qui travaille avec les DEUX entités
    comparées. MIT co-signe avec le groupe (via SA sur zzg-2… non — via
    la graine : ZZPARTNER UNIV co-signe zzg-2 avec les deux entités du
    groupe) ; comparé au groupe ET à ZZAERO SA, le partenaire commun est
    ZZPARTNER UNIV."""
    from orion.search.aggregates import compare_entries

    group_id = _seed_group(db_session)
    sa_id = db_session.execute(
        text("SELECT id FROM organisations WHERE name = 'ZZAERO GMBH'")
    ).scalar_one()

    result = compare_entries(db_session, [f"g{group_id}", str(sa_id)])
    commons = result["common_partners"]
    names = [c["name"] for c in commons]
    # ZZPARTNER UNIV partage zzg-2 avec le groupe ET avec ZZAERO GMBH ;
    # les organisations des entités comparées ne comptent jamais.
    assert "ZZPARTNER UNIV" in names
    assert all("ZZAERO" not in n for n in names)
    entry_refs = set(commons[0]["shared"].keys())
    assert entry_refs == {f"g{group_id}", str(sa_id)}
