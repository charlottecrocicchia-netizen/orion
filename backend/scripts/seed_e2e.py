"""Seed a small, fully-formed dataset for the Playwright end-to-end suite.

Ten projects across five countries and two years, three of them about
hydrogen (one written in French), so the whole demo journey works: bilingual
search, country facets, project → organisation → country-hub rebounds, and
the Explorer's five-series default view. Idempotent for a fresh database
(CI runs it right after `alembic upgrade head`).

Run from backend/:  ORION_DATABASE_URL=... uv run python scripts/seed_e2e.py
"""

from datetime import UTC, datetime

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from orion.core.config import get_settings
from orion.ingest.dedup.merge import refresh_normalized_names
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    EntityGroupMap,
    Funder,
    Group,
    IngestionRun,
    Organisation,
    Participation,
    Programme,
    Project,
    ProjectText,
    ProjectTopic,
    Topic,
)

# Level-2 euroSciVoc themes and the acronyms attached to each — enough for
# the Explorer's theme dimension to render in CI.
THEMES = {
    "/25/73": (
        "electrical engineering, electronic engineering, information engineering",
        ["H2STORE", "HYVALLEY", "GRIDFLEX"],
    ),
    "/23/43": ("physical sciences", ["QUBITNET", "FUSIONX", "SKYFORGE"]),
    "/23/45": ("earth and related environmental sciences", ["MEDAIR", "DEEPSEA"]),
}

ORGS = {
    "cnrs": ("CENTRE NATIONAL DE LA RECHERCHE SCIENTIFIQUE CNRS", "FR", "REC"),
    "cea": ("COMMISSARIAT A L ENERGIE ATOMIQUE ET AUX ENERGIES ALTERNATIVES", "FR", "REC"),
    "fraunhofer": (
        "FRAUNHOFER GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG EV",
        "DE",
        "REC",
    ),
    "upm": ("UNIVERSIDAD POLITECNICA DE MADRID", "ES", "HES"),
    "polito": ("POLITECNICO DI TORINO", "IT", "HES"),
    "tno": (
        "NEDERLANDSE ORGANISATIE VOOR TOEGEPAST NATUURWETENSCHAPPELIJK ONDERZOEK TNO",
        "NL",
        "REC",
    ),
    # Hors d'Europe — la règle du chantier régions se teste : tout pays du
    # corpus est vivant sur les cartes (US : polygone ; IL : Moyen-Orient
    # & Afrique ; MT : pastille, aucun polygone dans le 110m).
    "mit": ("MASSACHUSETTS INSTITUTE OF TECHNOLOGY", "US", "HES"),
    "technion": ("TECHNION ISRAEL INSTITUTE OF TECHNOLOGY", "IL", "HES"),
    "um_malta": ("UNIVERSITA TA MALTA", "MT", "HES"),
    # La paire AEROSTELLAR (fictive) porte la fiche groupe : deux entités
    # légales sous un même groupe, qui co-signent un projet — le consolidé
    # doit le compter UNE fois (la règle DISTINCT se teste en e2e).
    "aero_sa": ("AEROSTELLAR SA", "FR", "PRC"),
    "aero_gmbh": ("AEROSTELLAR AVIONICS GMBH", "DE", "PRC"),
    # L'homonyme HORS périmètre : porte le nom du groupe, jamais
    # rattaché — la note d'honnêteté de la fiche doit le compter.
    "aero_services": ("AEROSTELLAR GROUP SERVICES BV", "NL", "PRC"),
}

# (source_id, acronym, year, programme, m€ shares by org — first is coordinator,
#  texts {lang: (title, abstract)})
PROJECTS = [
    (
        "e2e-nsf-ocean",
        "OCEANSENSE",
        2024,
        "nsf-root",
        [("mit", 3.2), ("technion", 1.1), ("um_malta", 0.4)],
        {
            "en": (
                "Ocean sensing across three seas",
                "Distributed sensors for ocean monitoring, a transatlantic collaboration.",
            )
        },
    ),
    (
        "e2e-h2store",
        "H2STORE",
        2023,
        "he-child",
        [("cnrs", 4.0), ("fraunhofer", 2.5), ("tno", 1.5)],
        {
            "en": (
                "Reversible hydrogen storage at scale",
                "Green hydrogen electrolysis and solid-state storage for heavy industry.",
            )
        },
    ),
    (
        "e2e-hyvalley",
        "HYVALLEY",
        2021,
        "he-child",
        [("fraunhofer", 3.0), ("upm", 2.0), ("polito", 1.0)],
        {
            "en": (
                "A cross-border hydrogen valley",
                "Deploying hydrogen production and refuelling across three regions.",
            )
        },
    ),
    (
        "e2e-hystock",
        "HYSTOCK",
        2023,
        "he-child",
        [("cea", 0.5)],
        {
            "fr": (
                "Stockage réversible de l'hydrogène par hydrures",
                "Modèles pour le stockage réversible de l'hydrogène et applications catalytiques.",
            )
        },
    ),
    (
        "e2e-qubitnet",
        "QUBITNET",
        # 2022, pas 2023 : le thème « physical sciences » doit porter au
        # moins deux années, sinon sa polyline de l'Explorateur est un
        # point invisible (cassé en CI le 2026-08-04 quand SKYFORGE l'a
        # promu série 1).
        2022,
        "he-child",
        [("cnrs", 3.0), ("polito", 2.0)],
        {
            "en": (
                "Quantum repeater networks",
                "Entanglement distribution for a continental quantum internet.",
            )
        },
    ),
    (
        "e2e-gridflex",
        "GRIDFLEX",
        2021,
        "he-child",
        [("cnrs", 2.2), ("tno", 1.3)],
        {"en": ("Flexible power grids", "Storage and demand response at distribution level.")},
    ),
    (
        "e2e-batloop",
        "BATLOOP",
        2021,
        "he-child",
        [("cea", 1.8), ("fraunhofer", 1.2)],
        {"en": ("Battery materials in the loop", "Closed-loop recycling of lithium-ion cells.")},
    ),
    (
        "e2e-agrisol",
        "AGRISOL",
        2021,
        "nih-root",
        [("cea", 0.4)],
        {
            "fr": (
                "Agrivoltaïsme et sols vivants",
                "Panneaux solaires et pratiques agroécologiques.",
            )
        },
    ),
    (
        "e2e-medair",
        "MEDAIR",
        2021,
        "he-child",
        [("upm", 1.5), ("polito", 0.9)],
        {"en": ("Air quality and health", "Urban exposure models for the Mediterranean.")},
    ),
    (
        "e2e-deepsea",
        "DEEPSEA",
        2023,
        "he-child",
        [("tno", 1.6), ("upm", 1.1)],
        {"en": ("Deep-sea observation", "Autonomous platforms for ocean monitoring.")},
    ),
    (
        "e2e-fusionx",
        "FUSIONX",
        2023,
        "he-child",
        [("cea", 2.4), ("fraunhofer", 1.9)],
        {"en": ("Fusion materials exchange", "Plasma-facing components under neutron load.")},
    ),
    # Co-signé par les deux entités du groupe AEROSTELLAR : la fiche
    # groupe doit dire 1 projet, 8 M€ — jamais 2 projets.
    (
        "e2e-skyforge",
        "SKYFORGE",
        2023,
        "he-child",
        # MIT co-signe SANS être du groupe : l'acte partenaires se teste,
        # et le consolidé ne bouge pas (les totaux somment les entités).
        [("aero_sa", 5.0), ("aero_gmbh", 3.0), ("mit", 0.7)],
        {"en": ("Hybrid-electric regional aircraft", "Propulsion chain for regional aviation.")},
    ),
    (
        "e2e-aeroserv",
        "AEROSERV",
        2022,
        "he-child",
        [("aero_services", 0.4)],
        {"en": ("Aerostellar services platform", "MRO data services for regional fleets.")},
    ),
    # Le projet SPATIAL de la graine : la lentille (motif « in-orbit »)
    # doit le taguer core — la home et ?sector=space se testent dessus.
    (
        "e2e-orbit",
        "ORBITGUARD",
        2024,
        "he-child",
        [("tno", 1.2), ("polito", 0.8)],
        {
            "en": (
                "In-orbit servicing demonstrator",
                "Debris removal and in-orbit servicing for LEO constellations.",
            )
        },
    ),
]


def main() -> None:
    engine = create_engine(get_settings().database_url)
    with Session(engine) as session:
        if session.scalar(select(func.count()).select_from(Project)) > 0:
            print("Database is not empty — refusing to seed on top of real data.")
            raise SystemExit(1)

        seed_reference(session, RunStats())
        session.flush()

        ec = session.scalar(select(Funder).where(Funder.code == "ec"))
        # The second funder is NIH since the ANR left the product
        # (2026-08-03): the seed must mirror the sources that exist.
        nih = session.scalar(select(Funder).where(Funder.code == "nih"))
        nsf = session.scalar(select(Funder).where(Funder.code == "nsf"))

        he_root = Programme(funder_id=ec.id, code="HORIZON", name="Horizon Europe (2021-2027)")
        nih_root = Programme(funder_id=nih.id, code="CA", name="National Cancer Institute")
        nsf_root = Programme(funder_id=nsf.id, code="OPP", name="Office of Polar Programs")
        session.add_all([he_root, nih_root, nsf_root])
        session.flush()
        he_child = Programme(funder_id=ec.id, parent_id=he_root.id, code="HORIZON-CL5")
        session.add(he_child)
        session.flush()
        programmes = {"he-child": he_child, "nih-root": nih_root, "nsf-root": nsf_root}

        organisations = {}
        for key, (name, country, org_type) in ORGS.items():
            organisation = Organisation(name=name, country_code=country, org_type=org_type)
            session.add(organisation)
            organisations[key] = organisation
        session.flush()

        # Le groupe AEROSTELLAR — la couche identité en miniature, pour
        # que la fiche groupe se teste de bout en bout (suggest → fiche).
        aero_group = Group(
            name="AEROSTELLAR GROUP",
            country_code="FR",
            lei="E2ELEI0000000000TEST",
            source="gleif",
        )
        session.add(aero_group)
        session.flush()
        for org_key in ("aero_sa", "aero_gmbh"):
            session.add(
                EntityGroupMap(
                    organisation_id=organisations[org_key].id,
                    group_id=aero_group.id,
                    method="gleif",
                    confidence=0.9,
                    source="gleif",
                    is_jv=False,
                )
            )

        for source_id, acronym, year, programme_key, shares, texts in PROJECTS:
            programme = programmes[programme_key]
            funder_id = (
                ec.id
                if programme_key.startswith("he")
                else nsf.id
                if programme_key.startswith("nsf")
                else nih.id
            )
            source = (
                "cordis-horizon" if funder_id == ec.id else "nsf" if funder_id == nsf.id else "nih"
            )
            total = round(sum(amount for _, amount in shares) * 1e6, 2)
            main_lang = next(iter(texts))
            project = Project(
                source=source,
                source_id=source_id,
                acronym=acronym,
                title=texts[main_lang][0],
                title_lang=main_lang,
                status="SIGNED",
                funder_id=funder_id,
                programme_id=programme.id,
                funding_amount_eur=total,
                start_date=f"{year}-01-15",
                end_date=f"{year + 3}-01-14",
            )
            session.add(project)
            session.flush()
            for lang, (title, abstract) in texts.items():
                session.add(
                    ProjectText(project_id=project.id, lang=lang, title=title, abstract=abstract)
                )
            for index, (org_key, amount) in enumerate(shares):
                organisation = organisations[org_key]
                session.add(
                    Participation(
                        project_id=project.id,
                        organisation_id=organisation.id,
                        role="coordinator" if index == 0 else "participant",
                        country_code=organisation.country_code,
                        amount_eur=round(amount * 1e6, 2),
                        source=source,
                        source_uid=f"{source_id}:{org_key}",
                    )
                )

        by_acronym = {
            project.acronym: project.id for project in session.scalars(select(Project)).all()
        }
        for code, (label, acronyms) in THEMES.items():
            topic = Topic(scheme="euroscivoc", code=code, label=label)
            session.add(topic)
            session.flush()
            for acronym in acronyms:
                session.add(ProjectTopic(project_id=by_acronym[acronym], topic_id=topic.id))

        session.add(
            IngestionRun(
                source="e2e-seed",
                status="succeeded",
                finished_at=datetime.now(UTC),
                records_processed=len(PROJECTS),
            )
        )
        refresh_normalized_names(session, RunStats())
        session.commit()

    # The seed IS an ingestion chain in miniature, so it ends like one:
    # every materialised aggregate refreshed, from the single list the
    # real chain uses. Naming views one by one here is how the country
    # index went silently empty in CI (2026-08-03).
    from orion.ingest.dedup.merge import MATERIALIZED_VIEWS

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        for view in MATERIALIZED_VIEWS:
            connection.execute(text(f"REFRESH MATERIALIZED VIEW {view}"))

    # La lentille spatiale tague la graine comme elle taguera la prod —
    # même fichier, même chargeur (ORBITGUARD doit sortir core).
    from orion.ingest.runlog import RunStats as _RunStats
    from orion.ingest.space_lens import load_space_lens

    with Session(engine) as session:
        load_space_lens(session, _RunStats())

    print(f"Seeded {len(PROJECTS)} projects, {len(ORGS)} organisations, 5 countries.")


if __name__ == "__main__":
    main()
