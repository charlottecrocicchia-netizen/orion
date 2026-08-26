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
    ExchangeRate,
    Funder,
    Group,
    IngestionRun,
    MacroSeries,
    Organisation,
    Participation,
    PriceIndex,
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
    # Le cas que la règle de couverture vise (lot E, 2026-08-17) : un
    # partenaire japonais dans un consortium européen. Le Japon n'a
    # AUCUN bailleur domestique chargé chez nous — son chiffre est vrai
    # mais partiel, et l'écran doit le dire plutôt que laisser lire
    # « le Japon ne finance rien ».
    "riken": ("RIKEN", "JP", "REC"),
    # La paire AEROSTELLAR (fictive) porte la fiche groupe : deux entités
    # légales sous un même groupe, qui co-signent un projet — le consolidé
    # doit le compter UNE fois (la règle DISTINCT se teste en e2e).
    "aero_sa": ("AEROSTELLAR SA", "FR", "PRC"),
    "aero_gmbh": ("AEROSTELLAR AVIONICS GMBH", "DE", "PRC"),
    # Lot A : le porteur du projet 2026 (FUTUREWATT), volontairement
    # HORS du groupe AEROSTELLAR — les consolidés du groupe (8 M€) sont
    # recettés au chiffre près et ne doivent pas bouger.
    "voltify": ("VOLTIFY LABS", "FR", "PRC"),
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
        [("upm", 1.5), ("polito", 0.9), ("riken", 0.3)],
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
    # Le projet HABILITANT de la graine : le motif réel « microgravity »
    # (enabling, cadré cordis|nsf) doit le taguer — sans lui, Space
    # n'aurait aucun habilitant en graine et le chip n'offrirait qu'une
    # entrée (règle de l'entrée unique, 2026-08-19) : les tests des deux
    # libellés perdraient leur objet.
    (
        "e2e-microg",
        "MICROGROW",
        2023,
        "he-child",
        [("cnrs", 0.9)],
        {
            "en": (
                "Microgravity protein crystal growth",
                "Protein crystallisation in microgravity for structural biology.",
            )
        },
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
    # Une DEUXIÈME année spatiale (motif « earth observation ») : le hero
    # spatial dessine sa constellation, et une courbe à un point est
    # invisible — la leçon QUBITNET, apprise deux fois, gravée ici.
    (
        "e2e-earthobs",
        "TERRASCOPE",
        2021,
        "he-child",
        [("cnrs", 0.6)],
        {
            "en": (
                "Earth observation for coastal resilience",
                "Multispectral earth observation services for shoreline monitoring.",
            )
        },
    ),
    # Lot A (euros constants) : UN projet qui démarre APRÈS la dernière
    # année d'indice publiée (2025) — il reste en nominal et la ligne
    # « hors calcul constant » de l'Explorateur a un cas réel à chiffrer
    # (arbitrage A1 : exclusion, jamais un facteur 1,0 artificiel).
    (
        "e2e-futurewatt",
        "FUTUREWATT",
        2026,
        "he-child",
        [("voltify", 2.0)],
        {
            "en": (
                "Power electronics beyond the index horizon",
                "Wide-bandgap converters for industrial electrification, starting next cycle.",
            )
        },
    ),
]


# La lentille SYNTHÉTIQUE de la recette (M1.1, motif ORBITGUARD : une
# donnée inventée vit dans la graine, JAMAIS dans curation/ ni en prod).
# Son nom est neutre — aucune hypothèse métier sur la vraie deuxième
# lentille à venir. Elle prouve que le mécanisme marche à plusieurs
# lentilles publiées, sans une seule condition spéciale sur « space » :
# le chip la propose, ses mots viennent des motifs génériques (elle n'a
# pas de curation), et le projet spatial qu'elle tague aussi démontre le
# chevauchement (D1) — plein dans chaque lentille, jamais additionné.
SEED_LENS_SLUG = "test-lens"
# Et une lentille en PRÉPARATION : elle se charge, se vérifie en base,
# mais n'existe pas pour le produit (I2). La recette du refus s'appuie
# dessus — l'écran dit « indisponible », jamais « en préparation ».
SEED_DRAFT_LENS_SLUG = "test-draft"


def _seed_synthetic_lens(session: Session) -> None:
    for slug, rank, status in (
        (SEED_LENS_SLUG, 99, "published"),
        (SEED_DRAFT_LENS_SLUG, 98, "draft"),
    ):
        session.execute(
            text(
                "INSERT INTO lenses (slug, family_key, rank, status) "
                "VALUES (:slug, 'zz_seed_family', :rank, :status) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {"slug": slug, "rank": rank, "status": status},
        )
    for source_id, tag in (("e2e-aeroserv", "core"), ("e2e-orbit", "enabling")):
        session.execute(
            text(
                "INSERT INTO project_lens_tags (project_id, lens, tag) "
                "SELECT id, :slug, :tag FROM projects WHERE source_id = :sid "
                "ON CONFLICT (project_id, lens) DO UPDATE SET tag = excluded.tag"
            ),
            {"slug": SEED_LENS_SLUG, "tag": tag, "sid": source_id},
        )
    # Le journal de méthodologie est DÉRIVÉ des runs (S1 ①) : sur une
    # base neuve il n'y a rien à journaliser (un premier chargement n'est
    # pas un changement). La graine en pose donc un, à SES échelles, pour
    # que la surface ait quelque chose de vrai à montrer.
    session.execute(
        text(
            "INSERT INTO lens_changelog (lens, version, changed_on, core_before, core_after, "
            "enabling_before, enabling_after, funding_before_eur, funding_after_eur) "
            "VALUES ('space', 2, '2026-08-18', 2, 2, 1, 0, 3400000, 2600000) "
            "ON CONFLICT (lens, version) DO NOTHING"
        )
    )
    session.commit()


def _seed_price_indices(session: Session) -> None:
    """Lot A (euros constants) : les indices annuels et le taux BCE de
    l'année de référence, en vintage de graine. Les DEUX devises
    couvertes doivent porter leur indice 2025 — la condition de
    validité du mode constant l'exige, même si le corpus semé est tout
    en euros. 2026 n'a volontairement AUCUN indice : FUTUREWATT reste
    hors calcul constant (arbitrage A1) et la ligne d'exclusion se
    recette sur un vrai cas."""
    hicp = {
        2020: "105.1",
        2021: "107.8",
        2022: "116.8",
        2023: "123.2",
        2024: "126.1",
        2025: "128.9",
    }
    cpiu = {
        2020: "258.8",
        2021: "271.0",
        2022: "292.7",
        2023: "304.7",
        2024: "313.7",
        2025: "322.1",
    }
    for currency, series, values in (
        ("EUR", ("eurostat", "prc_hicp_aind"), hicp),
        ("USD", ("bls", "CUUR0000SA0"), cpiu),
    ):
        for year, value in values.items():
            session.add(
                PriceIndex(
                    currency=currency,
                    year=year,
                    value=value,
                    series_source=series[0],
                    series_code=series[1],
                    vintage_date="2026-01-15",
                )
            )
    session.add(ExchangeRate(currency="USD", year=2025, rate_to_eur="1.09"))
    session.commit()


def _seed_macro(session: Session) -> None:
    """Lot R3 (ECONOMIC SCALE) : les dénominateurs macro de la graine —
    PIB courant USD et population, valeurs rondes calculables à la main,
    2021-2025. 2026 n'a volontairement AUCUNE série : le projet
    FUTUREWATT reste hors calcul (motif no_gdp_year/no_population_year)
    et la bande d'indisponibilité se recette sur un vrai cas. Les taux
    USD 2021-2024 alimentent le numérateur du % PIB (2025 est déjà semé
    par les indices de prix, à 1.09 — les tests real en dépendent).

    Lot R4B (PURCHASING POWER) : le PIB en dollars internationaux, semé
    à LA MÊME vintage que son homologue en dollars — le couple est une
    unité d'écriture, et les semer à deux dates mettrait tout le e2e PPP
    en refus (c'est l'invariant qui parlerait, pas un bug). Ratios ronds,
    vérifiables à la main : US 1,00 (l'ancre), FR 1,30, DE 1,25, NL 1,20,
    EU 1,30. L'Italie porte le couple sur 2022 SEULEMENT, ce qui donne le
    motif `no_reference_year` sur la vue 2021 ; l'Espagne, jamais
    couverte, y donne `no_jurisdiction_series` — les deux se recettent
    côte à côte."""
    gdp = {"EU": 2.0e13, "US": 2.5e13, "FR": 3.0e12, "DE": 4.0e12, "NL": 1.0e12}
    gdp_ppp = {"EU": 2.6e13, "US": 2.5e13, "FR": 3.9e12, "DE": 5.0e12, "NL": 1.2e12}
    pop = {"EU": 4.5e8, "US": 3.4e8, "FR": 6.8e7, "DE": 8.0e7, "NL": 1.8e7}
    for year in range(2021, 2026):
        for code, value in gdp.items():
            session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept="gdp_current_usd",
                    year=year,
                    value=value,
                    series_source="wdi",
                    series_code="NY.GDP.MKTP.CD",
                    vintage_date="2026-01-15",
                )
            )
        for code, value in gdp_ppp.items():
            session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept="gdp_ppp_current_intl",
                    year=year,
                    value=value,
                    series_source="wdi",
                    series_code="NY.GDP.MKTP.PP.CD",
                    vintage_date="2026-01-15",
                )
            )
        for code, value in pop.items():
            session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept="population",
                    year=year,
                    value=value,
                    series_source="wdi",
                    series_code="SP.POP.TOTL",
                    vintage_date="2026-01-15",
                )
            )
    # L'Italie : le couple sur 2022 SEULEMENT. Ses participations de 2021
    # (HYVALLEY) se comptent alors en `no_reference_year` — un territoire
    # qui A la référence, ailleurs — quand l'Espagne, jamais couverte,
    # tombe en `no_jurisdiction_series`. Les deux motifs se recettent
    # côte à côte sur la même vue, ce qui est tout l'enjeu.
    for year in (2022,):
        for concept, series_code, value in (
            ("gdp_current_usd", "NY.GDP.MKTP.CD", 2.0e12),
            ("gdp_ppp_current_intl", "NY.GDP.MKTP.PP.CD", 3.0e12),
        ):
            session.add(
                MacroSeries(
                    jurisdiction_code="IT",
                    concept=concept,
                    year=year,
                    value=value,
                    series_source="wdi",
                    series_code=series_code,
                    vintage_date="2026-01-15",
                )
            )
    for year in range(2021, 2025):
        session.add(ExchangeRate(currency="USD", year=year, rate_to_eur="1.25"))
    session.commit()


def _seed_call_topics(session: Session) -> None:
    """Les appels de la graine (E1) : un ouvert avec budget, un à venir,
    un CLOS DONT LA SOURCE DIT ENCORE « OPEN » (la dérivation par les
    dates est la règle recettée), un ouvert sans budget. Dates relatives
    au moment du seed — la recette tient à n'importe quelle date. Un
    tag test-lens est posé à la main : la recette ne dépend jamais des
    règles éditoriales vivantes de space/aviation."""
    from datetime import UTC, datetime, timedelta

    now = datetime.now(UTC)

    def iso(days: int) -> str:
        return (now + timedelta(days=days)).strftime("%Y-%m-%dT17:00:00+00:00")

    topics = [
        {
            "sid": "TEST-CALL-2026-OPEN-01",
            "title": "Cryogenic test rigs for the seed corpus",
            "call_code": "TEST-CALL-2026",
            "status_code": "31094502",
            "status_label": "Open for submission",
            "opening": iso(-30),
            "deadlines": f'["{iso(30)}"]',
            "budget_min": 2_000_000,
            "budget_max": 4_000_000,
        },
        {
            # Identifiant HORS de la famille TEST-CALL : la remontée
            # d'ancêtres ne doit pas le rattacher au pont exact voisin —
            # c'est le cas « aucun historique » de la recette.
            "sid": "TEST-UPCOMING-2026-ZZ-01",
            "title": "Upcoming orbital logistics topic",
            "call_code": "TEST-UPCOMING-2026",
            "status_code": "31094501",
            "status_label": "Forthcoming",
            "opening": iso(20),
            "deadlines": f'["{iso(90)}"]',
            "budget_min": None,
            "budget_max": None,
        },
        {
            # Le piège recetté : la source dit « Open », la date dit clos.
            "sid": "TEST-CALL-2026-STALE-01",
            "title": "Stale status topic — deadline passed",
            "call_code": "TEST-CALL-2026",
            "status_code": "31094502",
            "status_label": "Open for submission",
            "opening": iso(-90),
            "deadlines": f'["{iso(-10)}"]',
            "budget_min": None,
            "budget_max": None,
        },
        {
            "sid": "TEST-CALL-2026-OPEN-02",
            "title": "Open topic without published budget",
            "call_code": "TEST-CALL-2026",
            "status_code": "31094502",
            "status_label": "Open for submission",
            "opening": iso(-5),
            "deadlines": f'["{iso(60)}"]',
            "budget_min": None,
            "budget_max": None,
        },
    ]
    for topic in topics:
        session.execute(
            text(
                "INSERT INTO call_topics (source, source_id, identifier, title, call_code, "
                "framework_programme_code, framework_programme_label, status_code, status_label, "
                "opening_date, deadline_dates, deadline_model, types_of_action, "
                "budget_min_eur, budget_max_eur, url, raw) "
                "VALUES ('ft-portal', :sid, :sid, :title, :call_code, "
                "'43108390', 'Horizon Europe (HORIZON)', :status_code, :status_label, "
                "CAST(:opening AS timestamptz), CAST(:deadlines AS jsonb), 'single-stage', "
                "'[\"Seed Research Actions\"]'::jsonb, "
                ":budget_min, :budget_max, 'https://example.invalid/portal-topic', '{}'::jsonb) "
                "ON CONFLICT (source, source_id) DO NOTHING"
            ),
            topic,
        )
    session.execute(
        text(
            "INSERT INTO call_topic_lens_tags (call_topic_id, lens, tag, proof, rule) "
            "SELECT id, :slug, 'core', 'structural', 'call:TEST-CALL-' FROM call_topics "
            "WHERE source_id = 'TEST-CALL-2026-OPEN-01' "
            "ON CONFLICT (call_topic_id, lens) DO NOTHING"
        ),
        {"slug": SEED_LENS_SLUG},
    )
    # Le PONT EXACT d'E2 : l'appel TEST-CALL-2026 reçoit trois projets
    # de la graine — la fiche de l'appel OPEN-01 montre alors de vrais
    # « acteurs historiques » (niveau exact), et les autres topics
    # TEST-CALL restent sans historique (l'état vide honnête se recette
    # aussi). Le call_id est posé comme le ferait le pont d'E1.
    session.execute(
        text(
            "INSERT INTO calls (funder_id, code) "
            "SELECT DISTINCT funder_id, 'TEST-CALL-2026' FROM projects "
            "WHERE source_id = 'e2e-aeroserv' "
            "ON CONFLICT (funder_id, code) DO NOTHING"
        )
    )
    session.execute(
        text(
            "UPDATE projects SET call_id = c.id FROM calls c "
            "WHERE c.code = 'TEST-CALL-2026' "
            "AND projects.source_id IN ('e2e-aeroserv', 'e2e-orbit', 'e2e-qubitnet')"
        )
    )
    session.execute(
        text(
            "UPDATE call_topics SET call_id = c.id FROM calls c "
            "WHERE c.code = 'TEST-CALL-2026' "
            "AND call_topics.source_id = 'TEST-CALL-2026-OPEN-01'"
        )
    )
    # Le journal du run : la page /calls affiche sa fraîcheur depuis lui.
    session.execute(
        text(
            "INSERT INTO ingestion_runs (source, status, started_at, finished_at, "
            "records_processed) VALUES ('calls', 'succeeded', now(), now(), 4)"
        )
    )
    session.commit()


def _seed_nsf_obligations(session: Session) -> None:
    """Lot R5B : la surface `Share of NSF award obligations`, calculable à
    la main. Une vintage (2026-08-26), deux FY DISPONIBLES (2022 :
    couverture 0,99 ; 2023 : couverture 1,0) et un FY FERMÉ (2019 :
    couverture 0 → indisponible, jamais un zéro). Les lignes joignables
    portent l'award « e2e-nsf-ocean:mit » — le SEUL `source_uid` des
    participations nsf de la graine qui tienne dans `award_id`
    VARCHAR(20) (« e2e-nsf-ocean:technion » et « …:um_malta » font
    22 caractères) : plutôt qu'inventer des participations, les montants
    joignables sont ajustés pour rester exacts. Une ligne porte
    l'instrument 'Contract Interagency Agreement' (§ 9.4.9 : inclus sur
    preuve, jamais filtré)."""
    from decimal import Decimal

    from orion.models import NsfAwardObligation, NsfObligationArtifact, NsfObligationTotal

    vintage = "2026-08-26"
    joinable_award = "e2e-nsf-ocean:mit"

    artifact = NsfObligationArtifact(
        vintage_date=vintage,
        filename="e2e-award-details-sheet.tsv",
        sheet="@Award Details Sheet",
        source_url="https://www.nsf.gov/about/about-nsf-by-the-numbers",
        filters={"metric": "Award Obligation"},
        acquired_at=datetime.now(UTC),
        codebook_version="v1.0.7",
        sha256="5eed" * 16,
        bytes=4096,
        parser_version="e2e",
        validation={"rows": 6, "fiscal_years": [2019, 2022, 2023]},
    )
    session.add(artifact)
    session.flush()

    # (fy, award_id, award_fy, directorate, division, instrument, montant)
    lines = [
        # FY2019 — le FY fermé : rien ne se joint, coverage 0.
        (2019, "1900001", 2019, "Geosciences", "Ocean Sciences", "Standard Grant", "1000000.00"),
        # FY2022 — 990 000 joignables + 10 000 hors jointure.
        (
            2022,
            joinable_award,
            2022,
            "Geosciences",
            "Ocean Sciences",
            "Standard Grant",
            "600000.00",
        ),
        (
            2022,
            joinable_award,
            2022,
            "Geosciences",
            "Polar Programs",
            "Contract Interagency Agreement",
            "390000.00",
        ),
        (2022, "2200001", 2022, "Geosciences", "Ocean Sciences", "Standard Grant", "10000.00"),
        # FY2023 — tout se joint (coverage 1,0) : increments prior-year
        # du même award, deux divisions.
        (
            2023,
            joinable_award,
            2022,
            "Geosciences",
            "Ocean Sciences",
            "Standard Grant",
            "900000.00",
        ),
        (
            2023,
            joinable_award,
            2022,
            "Geosciences",
            "Polar Programs",
            "Continuing Grant",
            "600000.00",
        ),
    ]
    for fy, award_id, award_fy, directorate, division, instrument, amount in lines:
        joins = award_id == joinable_award
        session.add(
            NsfAwardObligation(
                vintage_date=vintage,
                artifact_id=artifact.id,
                award_id=award_id,
                fiscal_year=fy,
                award_fiscal_year=award_fy,
                funding_directorate=directorate,
                funding_division=division,
                award_instrument=instrument,
                institution_id="E2EMIT01" if joins else "E2EXX01",
                institution_name="MASSACHUSETTS INSTITUTE OF TECHNOLOGY" if joins else None,
                institution_state_code="MA" if joins else "AK",
                country_code="US",
                amount=amount,
            )
        )

    totals = [
        # (fy, official, joinable, coverage, available, notes)
        (
            2019,
            "1000000.00",
            "0.00",
            "0.0000",
            False,
            "e2e : FY fermé — couverture de jointure hors seuil",
        ),
        (2022, "1000000.00", "990000.00", "0.9900", True, None),
        (2023, "1500000.00", "1500000.00", "1.0000", True, None),
    ]
    for fy, official, joinable, coverage, available, notes in totals:
        unjoinable = str(Decimal(official) - Decimal(joinable))
        session.add(
            NsfObligationTotal(
                vintage_date=vintage,
                fiscal_year=fy,
                official_total=official,
                trend_total=official,
                joinable_total=joinable,
                unjoinable_total=unjoinable,
                coverage=coverage,
                available=available,
                notes=notes,
            )
        )
    session.flush()

    # Cohérence VÉRIFIÉE, jamais présumée : official = Σ des lignes du
    # snapshot ; joinable = Σ des montants dont award_id ∈ source_uid des
    # participations nsf réellement semées (§ 20.1 C4-1).
    snapshot = {
        int(fy): Decimal(total)
        for fy, total in session.execute(
            text(
                "SELECT fiscal_year, sum(amount) FROM nsf_award_obligations "
                "WHERE vintage_date = :v GROUP BY fiscal_year"
            ),
            {"v": vintage},
        ).all()
    }
    joined = {
        int(fy): Decimal(total)
        for fy, total in session.execute(
            text(
                "SELECT o.fiscal_year, sum(o.amount) FROM nsf_award_obligations o "
                "JOIN participations pa "
                "  ON pa.source = 'nsf' AND pa.source_uid = o.award_id "
                "WHERE o.vintage_date = :v GROUP BY o.fiscal_year"
            ),
            {"v": vintage},
        ).all()
    }
    for fy, official, joinable, _coverage, _available, _notes in totals:
        assert snapshot[fy] == Decimal(official), (
            f"graine R5B incohérente : Σ snapshot FY{fy} = {snapshot[fy]}, "
            f"official_total = {official}"
        )
        assert joined.get(fy, Decimal(0)) == Decimal(joinable), (
            f"graine R5B incohérente : Σ joignable FY{fy} = "
            f"{joined.get(fy, Decimal(0))}, joinable_total = {joinable}"
        )
    session.commit()


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
                # Lot A : le montant NATIF est l'entrée de la chaîne
                # constante — la graine le pose en EUR (natif = nominal),
                # ce qui suffit à exercer tout le mécanisme.
                funding_amount=total,
                funding_currency="EUR",
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
                        amount=round(amount * 1e6, 2),
                        currency="EUR",
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

    # Les lentilles taguent la graine comme elles tagueront la prod —
    # même registre, mêmes fichiers, même chargeur (ORBITGUARD doit
    # sortir core sous la lentille spatiale).
    from orion.ingest.lenses import load_all
    from orion.ingest.runlog import RunStats as _RunStats
    from orion.ingest.subdivisions import (
        backfill_nuts_meshes,
        seed_nuts_meshes,
        seed_nuts_nomenclature,
        seed_subdivisions,
    )

    with Session(engine) as session:
        load_all(session, _RunStats())
        _seed_synthetic_lens(session)
        _seed_call_topics(session)
        _seed_price_indices(session)
        _seed_macro(session)
        _seed_nsf_obligations(session)
        # La maille sous le pays : le référentiel complet, et le MIT posé
        # dans son État (les caches ne sont pas là en CI — la graine dit
        # la maille comme le backfill la dirait).
        seed_subdivisions(session, _RunStats())
        session.execute(
            text(
                "UPDATE participations pa SET subdivision_code = 'US-MA' "
                "FROM organisations o WHERE o.id = pa.organisation_id "
                "AND o.name LIKE 'MASSACHUSETTS%'"
            )
        )
        # La maille européenne (symétrie validée le 2026-08-17) : les
        # VRAIS chargeurs — nomenclature, mailles au niveau curé, puis la
        # troncature d'affichage. La graine pose les NUTS bruts comme
        # CORDIS les écrirait : le CNRS en Île-de-France (NUTS3 FR101 →
        # maille FR1), le CEA en Auvergne-Rhône-Alpes (FRK26 → FRK), et
        # AEROSTELLAR au NUTS national sec — le résidu « non rattaché »
        # que l'écran doit dire, jamais fondre.
        seed_nuts_nomenclature(session, _RunStats())
        seed_nuts_meshes(session, _RunStats())
        for pattern, nuts in (
            ("CENTRE NATIONAL DE LA RECHERCHE%", "FR101"),
            ("COMMISSARIAT A L ENERGIE%", "FRK26"),
            ("AEROSTELLAR SA", "FR"),
        ):
            session.execute(
                text(
                    "UPDATE participations pa SET nuts_code = :nuts "
                    "FROM organisations o WHERE o.id = pa.organisation_id "
                    "AND o.name LIKE :pattern"
                ),
                {"nuts": nuts, "pattern": pattern},
            )
        backfill_nuts_meshes(session, _RunStats())
        session.commit()

    print(f"Seeded {len(PROJECTS)} projects, {len(ORGS)} organisations, 5 countries.")


if __name__ == "__main__":
    main()
