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
    Funder,
    IngestionRun,
    Organisation,
    Participation,
    Programme,
    Project,
    ProjectText,
)

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
}

# (source_id, acronym, year, programme, m€ shares by org — first is coordinator,
#  texts {lang: (title, abstract)})
PROJECTS = [
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
        "anr-root",
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
        2023,
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
        "anr-root",
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
        anr = session.scalar(select(Funder).where(Funder.code == "anr"))

        he_root = Programme(funder_id=ec.id, code="HORIZON", name="Horizon Europe (2021-2027)")
        anr_root = Programme(funder_id=anr.id, code="AAPG", name="Appel à projets générique")
        session.add_all([he_root, anr_root])
        session.flush()
        he_child = Programme(funder_id=ec.id, parent_id=he_root.id, code="HORIZON-CL5")
        session.add(he_child)
        session.flush()
        programmes = {"he-child": he_child, "anr-root": anr_root}

        organisations = {}
        for key, (name, country, org_type) in ORGS.items():
            organisation = Organisation(name=name, country_code=country, org_type=org_type)
            session.add(organisation)
            organisations[key] = organisation
        session.flush()

        for source_id, acronym, year, programme_key, shares, texts in PROJECTS:
            programme = programmes[programme_key]
            funder_id = ec.id if programme_key.startswith("he") else anr.id
            source = "cordis-horizon" if funder_id == ec.id else "anr"
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

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("REFRESH MATERIALIZED VIEW organisation_stats"))

    print(f"Seeded {len(PROJECTS)} projects, {len(ORGS)} organisations, 5 countries.")


if __name__ == "__main__":
    main()
