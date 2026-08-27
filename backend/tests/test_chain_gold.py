"""B1 — les golds manuels de B0 transformés en tests backend.

Chaque cas réplique un cas RÉEL de l'audit B0 (mêmes identifiants
sources, mêmes montants — docs/conception-b-chaine-argent-public.md
§ 9) et verrouille un invariant du moteur : I1 aucun financement
inventé, I2 aucun double compte silencieux, I3 aucune agrégation de
mesures incompatibles, I4 l'inconnu reste inconnu, I5 aucun étage
synthétisé, I6 nature et provenance voyagent avec la mesure, I7 un
changement de grain ne change jamais silencieusement la signification,
I8 navigation valide ≠ agrégation valide.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Call,
    Funder,
    NsfAwardObligation,
    NsfObligationArtifact,
    Organisation,
    Participation,
    Programme,
    Project,
)
from orion.search import chain

MARK = "ZZB1"


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


def _project(session, **kwargs) -> Project:
    project = Project(**kwargs)
    session.add(project)
    session.flush()
    return project


def _org(session, name, country) -> Organisation:
    organisation = Organisation(name=f"{MARK} {name}", country_code=country)
    session.add(organisation)
    session.flush()
    return organisation


def _part(
    session, project, organisation, uid, amount, *, role="participant", eur=None, country=None
):
    participation = Participation(
        project_id=project.id,
        organisation_id=organisation.id,
        role=role,
        country_code=country or organisation.country_code,
        amount=amount,
        currency=("EUR" if project.source.startswith("cordis") else "USD")
        if amount is not None
        else None,
        amount_eur=eur
        if eur is not None
        else (amount if project.source.startswith("cordis") else None),
        source=project.source,
        source_uid=uid,
    )
    session.add(participation)
    session.flush()
    return participation


@pytest.fixture
def gold(db_session):
    """Le corpus gold B0, resemé à l'identique (valeurs sources)."""
    session = db_session
    ec = session.scalar(select(Funder).where(Funder.code == "ec"))
    nih = session.scalar(select(Funder).where(Funder.code == "nih"))
    nsf = session.scalar(select(Funder).where(Funder.code == "nsf"))

    g: dict = {}

    # ---------------------------------------------------------- CORDIS
    horizon = Programme(funder_id=ec.id, code="HORIZON", name="Horizon Europe")
    session.add(horizon)
    session.flush()
    p31 = Programme(funder_id=ec.id, parent_id=horizon.id, code="HORIZON.3.1", name="The EIC")
    p33 = Programme(funder_id=ec.id, parent_id=horizon.id, code="H2020-EU.3.3.", name="Energie")
    pa = Programme(funder_id=ec.id, parent_id=horizon.id, code=f"{MARK}.PA", name="PA")
    pb = Programme(funder_id=ec.id, parent_id=horizon.id, code=f"{MARK}.PB", name="PB")
    session.add_all([p31, p33, pa, pb])
    session.flush()
    call_pf = Call(funder_id=ec.id, code="HORIZON-EIC-2021-PATHFINDEROPEN-01")
    call_adhoc = Call(funder_id=ec.id, code=f"{MARK}-ADHOC")
    session.add_all([call_pf, call_adhoc])
    session.flush()
    g.update(
        horizon=horizon, p31=p31, p33=p33, pa=pa, pb=pb, call_pf=call_pf, call_adhoc=call_adhoc
    )

    # G1/G8 — VerSiLiB : décomposition exacte, 8 participations.
    versilib = _project(
        session,
        source="cordis-horizon",
        source_id="101046217",
        acronym="VerSiLiB",
        title="Versatile Amplification…",
        funder_id=ec.id,
        programme_id=p31.id,
        call_id=call_pf.id,
        funding_amount=Decimal("2994244.99"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("2994244.99"),
        total_cost=Decimal("2994244.99"),
        total_cost_currency="EUR",
        start_date=date(2022, 4, 1),
        raw={"legalBasis": "HORIZON.3.1"},
    )
    versilib_parts = [
        ("VTT", "FI", "coordinator", "878463.81"),
        ("AIT", "AT", "participant", "77031.63"),
        ("IFO", "IT", "participant", "450000.00"),
        ("Catania", "IT", "participant", "495410.00"),
        ("Finnadvance", "FI", "participant", "196691.81"),
        ("Procomcure", "AT", "participant", "449498.75"),
        ("Fyzikalni", "CZ", "participant", "422002.11"),
        ("Proteins1", "FI", "participant", "25146.88"),
    ]
    for index, (name, country, role, amount) in enumerate(versilib_parts):
        _part(
            session,
            versilib,
            _org(session, name, country),
            f"101046217:{index}:0",
            Decimal(amount),
            role=role,
        )
    g["versilib"] = versilib

    # G10a — EURIZON : Σ parts < plafond projet (non-ventilé positif).
    eurizon = _project(
        session,
        source="cordis-horizon",
        source_id="871072",
        acronym="EURIZON",
        title="EURIZON",
        funder_id=ec.id,
        programme_id=p31.id,
        funding_amount=Decimal("24767360.43"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("24767360.43"),
        raw={"legalBasis": "HORIZON.3.1"},
    )
    for index, amount in enumerate(["10000000.00", "10000000.00", "417631.73"]):
        organisation = _org(session, f"EZ{index}", "DE")
        _part(session, eurizon, organisation, f"871072:{index}:0", Decimal(amount))
    g["eurizon"] = eurizon

    # G10b — EUROfusion : Σ parts > plafond projet.
    eurofusion = _project(
        session,
        source="cordis-horizon",
        source_id="101052200",
        acronym="EUROfusion",
        title="EUROfusion",
        funder_id=ec.id,
        programme_id=p33.id,
        funding_amount=Decimal("549442000.00"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("549442000.00"),
        raw={"legalBasis": "H2020-EU.3.3."},
    )
    _part(session, eurofusion, _org(session, "EFa", "DE"), "101052200:0:0", Decimal("600000000.00"))
    _part(session, eurofusion, _org(session, "EFb", "FR"), "101052200:1:0", Decimal("64587862.11"))
    g["eurofusion"] = eurofusion

    # G7 — BIO-QED : la part d'ITACONIX est INCONNUE dans la source.
    itaconix = _org(session, "ITACONIX", "US")
    bioqed = _project(
        session,
        source="cordis-fp7",
        source_id="613941",
        acronym="BIO-QED",
        title="BIO-QED",
        funder_id=ec.id,
        programme_id=p33.id,
        funding_amount=Decimal("5335158.39"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("5335158.39"),
        raw={"legalBasis": "H2020-EU.3.3."},
    )
    _part(session, bioqed, _org(session, "BQ-coord", "IT"), "613941:0:0", Decimal("3000000.00"))
    _part(session, bioqed, itaconix, "613941:1:0", None)
    g.update(bioqed=bioqed, itaconix=itaconix)

    # Appel réellement multi-programmes (transversal).
    for programme, sid, amount in ((pa, "900001", "1000000.00"), (pb, "900002", "2000000.00")):
        _project(
            session,
            source="cordis-h2020",
            source_id=sid,
            title=f"{MARK} adhoc {sid}",
            funder_id=ec.id,
            programme_id=programme.id,
            call_id=call_adhoc.id,
            funding_amount=Decimal(amount),
            funding_currency="EUR",
            funding_amount_eur=Decimal(amount),
            raw={"legalBasis": programme.code},
        )

    # B0.1 — ancêtre commun : rattachement DÉRIVÉ, jamais fait source.
    multi_lb = _project(
        session,
        source="cordis-h2020",
        source_id="654408",
        title="Multi parts à drapeau",
        funder_id=ec.id,
        programme_id=p33.id,
        funding_amount=Decimal("1000000.00"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("1000000.00"),
        raw={"legalBasis": "H2020-EU.3.3.;H2020-EU.3.3.3.1.;H2020-EU.3.3.3.3."},
    )
    g["multi_lb"] = multi_lb

    # D7 — total_cost = 0 publié par la source : non disponible, pas nul.
    hero = _project(
        session,
        source="cordis-horizon",
        source_id="101208645",
        acronym="HERO",
        title="HERO",
        funder_id=ec.id,
        programme_id=p31.id,
        funding_amount=Decimal("517435.92"),
        funding_currency="EUR",
        funding_amount_eur=Decimal("517435.92"),
        total_cost=Decimal("0.00"),
        total_cost_currency="EUR",
        raw={"legalBasis": "HORIZON.3.1"},
    )
    g["hero"] = hero

    # ------------------------------------------------------------- NSF
    dbi = Programme(funder_id=nsf.id, code="DBI", name="Division of Biological Infrastructure")
    session.add(dbi)
    session.flush()
    msu = _org(session, "Michigan State", "US")
    beacon = _project(
        session,
        source="nsf",
        source_id="0939454",
        title="BEACON",
        funder_id=nsf.id,
        programme_id=dbi.id,
        funding_amount=Decimal("48035209.00"),
        funding_currency="USD",
        start_date=date(2010, 8, 1),
    )
    _part(session, beacon, msu, "0939454", Decimal("48035209.00"), role="coordinator")
    g.update(beacon=beacon, dbi=dbi)

    artifact = NsfObligationArtifact(
        vintage_date=date(2026, 8, 26),
        filename="award-details-test.tsv",
        sheet="@Award Details Sheet",
        source_url="https://example.test",
        acquired_at=datetime(2026, 8, 26, 12, 0, 0),
        sha256="0" * 64,
        bytes=1,
        parser_version="test",
        validation={},
    )
    session.add(artifact)
    session.flush()
    beacon_fys = [
        (2011, ["4999892.00"]),
        (2012, ["5000000.00", "199833.00"]),  # le grain crosstab : 2 lignes, 1 FY
        (2013, ["5087584.00"]),
        (2014, ["4999885.00"]),
        (2015, ["5079409.00"]),
        (2016, ["5169030.00"]),
        (2017, ["5000000.00"]),
        (2018, ["5000000.00"]),
        (2019, ["3700000.00"]),
        (2020, ["1300000.00"]),
    ]
    for fy, amounts in beacon_fys:
        for amount in amounts:
            session.add(
                NsfAwardObligation(
                    vintage_date=date(2026, 8, 26),
                    artifact_id=artifact.id,
                    award_id="0939454",
                    fiscal_year=fy,
                    amount=Decimal(amount),
                )
            )
    session.flush()

    # G5 — fratrie collaborative : parts = awards constituants, Σ exacte.
    arecibo = _project(
        session,
        source="nsf",
        source_id="c-2005-037a7366ff4a1296",
        title="Arecibo ALFA",
        funder_id=nsf.id,
        programme_id=dbi.id,
        funding_amount=Decimal("1098188.00"),
        funding_currency="USD",
    )
    for uid, name, amount in (
        ("0507376", "Columbia", "335297.00"),
        ("0507747", "Cornell", "372647.00"),
        ("0507807", "Berkeley", "390244.00"),
    ):
        _part(session, arecibo, _org(session, name, "US"), uid, Decimal(amount))
    g["arecibo"] = arecibo

    # ITACONIX côté NSF : trois awards, mesure homogène USD.
    for sid, amount, eur in (
        ("1113804", "150000.00", "107762.10"),
        ("1214843", "150000.00", "116750.69"),
        ("1353592", "765989.00", "576581.43"),
    ):
        award = _project(
            session,
            source="nsf",
            source_id=sid,
            title=f"SBIR {sid}",
            funder_id=nsf.id,
            programme_id=dbi.id,
            funding_amount=Decimal(amount),
            funding_currency="USD",
            funding_amount_eur=Decimal(eur),
        )
        _part(session, award, itaconix, sid, Decimal(amount), role="coordinator", eur=Decimal(eur))

    # ------------------------------------------------------------- NIH
    ai = Programme(
        funder_id=nih.id, code="AI", name="National Institute of Allergy and Infectious Diseases"
    )
    session.add(ai)
    session.flush()
    prosetta = _org(session, "PROSETTA", "US")
    rabies = _project(
        session,
        source="nih",
        source_id="R21AI101276",
        title="Rabies therapeutics",
        funder_id=nih.id,
        programme_id=ai.id,
        funding_amount=Decimal("441743.00"),
        funding_currency="USD",
        funding_amount_eur=Decimal("343825.33"),
    )
    # La participation NIH RECOPIE le total projet — c'est un bénéficiaire.
    _part(
        session,
        rabies,
        prosetta,
        "R21AI101276",
        Decimal("441743.00"),
        role="coordinator",
        eur=Decimal("343825.33"),
    )
    orphan = _project(
        session,
        source="nih",
        source_id="75N95024P00040",
        title="Consulting services (contrat, sans organisation publiée)",
        funder_id=nih.id,
        programme_id=ai.id,
        funding_amount=Decimal("100000.00"),
        funding_currency="USD",
    )
    g.update(rabies=rabies, orphan=orphan, ai=ai, prosetta=prosetta)
    session.flush()
    return g


# ================================================================= CORDIS


def test_versilib_decomposition_exacte(db_session, gold):
    node = chain.project_node(db_session, gold["versilib"].id)
    assert node["measure"]["amount"] == pytest.approx(2994244.99)
    assert node["measure"]["key"] == "ec_max_contribution"
    assert node["measure"]["provenance"] == "source_fact"
    assert node["measure"]["accounting_nature"] == "commitment_ceiling"
    assert node["measure"]["currency"] == "EUR"
    assert node["children"]["total"] == 8
    reconciliation = node["reconciliation"]
    assert reconciliation["status"] == "exact"
    assert reconciliation["children_known_sum"] == pytest.approx(2994244.99)
    assert reconciliation["unallocated"] == pytest.approx(0.0)
    assert reconciliation["unknown_children"] == 0


def test_versilib_pas_de_double_compte_x8(db_session, gold):
    """I2 : le total projet n'est JAMAIS répété par participant — la
    somme des parts vaut le projet, pas 8 × le projet (gold G8)."""
    node = chain.project_node(db_session, gold["versilib"].id)
    parts_sum = sum(i["amount"] for i in node["children"]["items"])
    assert parts_sum == pytest.approx(2994244.99)
    assert parts_sum != pytest.approx(8 * 2994244.99)
    # Et l'agrégat du programme compte le projet UNE fois.
    programme = chain.programme_node(db_session, gold["p31"].id)
    amount = programme["aggregate"]["amount"]
    assert amount == pytest.approx(2994244.99 + 24767360.43 + 517435.92)


def test_eurizon_non_ventile_positif(db_session, gold):
    node = chain.project_node(db_session, gold["eurizon"].id)
    reconciliation = node["reconciliation"]
    assert reconciliation["status"] == "gap"
    assert reconciliation["children_known_sum"] == pytest.approx(20417631.73)
    assert reconciliation["unallocated"] == pytest.approx(4349728.70)


def test_eurofusion_parts_depassent_le_plafond(db_session, gold):
    node = chain.project_node(db_session, gold["eurofusion"].id)
    reconciliation = node["reconciliation"]
    assert reconciliation["status"] == "children_exceed_parent"
    assert reconciliation["children_known_sum"] == pytest.approx(664587862.11)
    assert reconciliation["unallocated"] == pytest.approx(-115145862.11)


def test_bioqed_part_inconnue_reste_inconnue(db_session, gold):
    """I4 : NULL ne devient jamais 0 — la part manquante est comptée
    inconnue et la réconciliation dit la couverture (gold G7)."""
    node = chain.project_node(db_session, gold["bioqed"].id)
    unknown = [i for i in node["children"]["items"] if i["amount"] is None]
    assert len(unknown) == 1
    reconciliation = node["reconciliation"]
    assert reconciliation["status"] == "gap"
    assert reconciliation["unknown_children"] == 1
    assert reconciliation["coverage"] == {"with_amount": 1, "total": 2}
    assert reconciliation["children_known_sum"] == pytest.approx(3000000.00)


def test_appel_transversal_multi_programmes(db_session, gold):
    """Un appel servant deux programmes : le total global n'apparaît
    sous aucun programme ; le contexte programme filtre (B0 § 7)."""
    call_id = gold["call_adhoc"].id
    node = chain.call_node(db_session, call_id)
    assert len(node["programmes"]) == 2
    assert node["aggregate"]["amount"] == pytest.approx(3000000.00)
    assert any("transversal" in r for r in node["restrictions"])

    scoped = chain.call_node(db_session, call_id, programme_id=gold["pa"].id)
    assert scoped["aggregate"]["amount"] == pytest.approx(1000000.00)
    assert scoped["context"]["programme_id"] == gold["pa"].id
    # Et le programme ne montre de cet appel que SES projets.
    programme = chain.programme_node(db_session, gold["pa"].id)
    call_item = next(i for i in programme["children"]["items"] if i["id"] == call_id)
    assert call_item["amount"] == pytest.approx(1000000.00)
    assert call_item["scope"] == "projects_of_this_programme_only"


def test_ancetre_commun_est_un_derive_orion(db_session, gold):
    """Arbitrage B0.1 : le rattachement recouvré (ancêtre commun) est
    classé dérivé, jamais fait source littéral."""
    node = chain.project_node(db_session, gold["multi_lb"].id)
    attribution = node["node"]["programme"]["attribution"]
    assert attribution["provenance"] == "derived"
    literal = chain.project_node(db_session, gold["versilib"].id)
    assert literal["node"]["programme"]["attribution"]["provenance"] == "source_fact"


def test_total_cost_zero_horizon_non_disponible(db_session, gold):
    """D7 : le 0 publié par CORDIS est une absence de donnée."""
    node = chain.project_node(db_session, gold["hero"].id)
    assert node["total_cost"]["amount"] is None
    assert node["total_cost"]["status"] == "not_available"
    assert "source_published_zero" in node["total_cost"]["provenance_note"]


# =================================================================== NSF


def test_beacon_deux_mesures_incompatibles(db_session, gold):
    """R3 / gold G9 : le cumul awd_amount et l'axe annuel R5B sont deux
    systèmes de mesure — jamais sommés, incompatibilité déclarée."""
    node = chain.project_node(db_session, gold["beacon"].id)
    assert node["measure"]["amount"] == pytest.approx(48035209.00)
    assert node["measure"]["accounting_nature"] == "obligations_cumulative"
    axis = node["annual_obligations"]
    assert axis["window_sum"] == pytest.approx(45535633.00)
    assert axis["window_sum"] != node["measure"]["amount"]
    assert axis["comparability"]["with_cumulative_total"] == "incompatible"
    # Le grain crosstab est pré-agrégé PAR AWARD : FY2012 = 1 entrée.
    fy2012 = [f for f in axis["fiscal_years"] if f["fy"] == 2012]
    assert len(fy2012) == 1 and fy2012[0]["amount"] == pytest.approx(5199833.00)
    assert axis["vintage"] == "2026-08-26"


def test_nsf_sans_etage_call_ni_synthese(db_session, gold):
    """I5 : pas d'appel NSF — l'étage est déclaré absent, jamais créé."""
    node = chain.project_node(db_session, gold["beacon"].id)
    assert node["node"]["parent"]["level"] == "programme"
    call_status = next(e for e in node["navigation"]["down"] if e["level"] == "call")
    assert call_status["status"] == "not_available"
    programme = chain.programme_node(db_session, gold["dbi"].id)
    assert programme["children"]["level"] == "project"


def test_fratrie_collaborative_derivee_et_exacte(db_session, gold):
    node = chain.project_node(db_session, gold["arecibo"].id)
    assert node["measure"]["provenance"] == "derived"  # repli = analyse assumée
    assert node["reconciliation"]["status"] == "exact"
    assert node["reconciliation"]["children_known_sum"] == pytest.approx(1098188.00)
    semantics = {i["semantics"] for i in node["children"]["items"]}
    assert semantics == {"constituent_award"}


# =================================================================== NIH


def test_nih_beneficiaire_pas_une_ventilation(db_session, gold):
    """La participation NIH est un bénéficiaire : montant à None au
    grain participation (la copie du total ne devient pas une part),
    réconciliation déclarée non applicable (I7)."""
    node = chain.project_node(db_session, gold["rabies"].id)
    assert node["measure"]["amount"] == pytest.approx(441743.00)
    assert node["measure"]["provenance"] == "derived"
    assert node["measure"]["accounting_nature"] == "obligations_annual_sum"
    assert node["children"]["level"] == "beneficiary"
    item = node["children"]["items"][0]
    assert item["semantics"] == "beneficiary_marker"
    assert item["amount"] is None
    reconciliation = node["reconciliation"]
    assert reconciliation["status"] == "not_applicable"
    assert reconciliation["children_known_sum"] is None


def test_nih_sans_call_et_orphelin(db_session, gold):
    node = chain.project_node(db_session, gold["orphan"].id)
    assert node["node"]["parent"]["level"] == "programme"
    assert node["children"]["total"] == 0
    call_status = next(e for e in node["navigation"]["down"] if e["level"] == "call")
    assert call_status["status"] == "not_available"
    # Le montant du projet existe même sans bénéficiaire publié.
    assert node["measure"]["amount"] == pytest.approx(100000.00)


# ============================================================ TRANSVERSE


def test_itaconix_refus_du_total_unique(db_session, gold):
    """Gold G11 / I3, I8 : « combien a reçu ITACONIX » n'existe pas
    comme un nombre unique — par financeur, chaque somme dans SA mesure
    et SA devise ; la part FP7 inconnue reste inconnue."""
    node = chain.organisation_node(db_session, gold["itaconix"].id)
    assert node["cross_funder_total"]["available"] is False
    assert "total" not in node  # aucun champ total unique, nulle part
    blocks = {b["funder"]: b for b in node["by_funder"]}
    assert set(blocks) == {"ec", "nsf"}

    nsf_block = blocks["nsf"]
    assert nsf_block["amount"] == pytest.approx(1065989.00)
    assert nsf_block["measure"]["currency"] == "USD"
    assert nsf_block["measure"]["provenance"] == "derived"
    assert nsf_block["amount_eur_observed"]["amount"] == pytest.approx(801094.22)
    assert nsf_block["amount_eur_observed"]["provenance"] == "derived"

    ec_block = blocks["ec"]
    assert ec_block["amount"] is None  # I4 : inconnu, jamais 0
    assert ec_block["coverage"] == {"with_amount": 0, "unknown_amount": 1}
    assert ec_block["measure"]["currency"] == "EUR"
    # Deux devises, deux natures : l'incompatibilité est structurelle.
    assert nsf_block["measure"]["currency"] != ec_block["measure"]["currency"]
    assert nsf_block["measure"]["accounting_nature"] != ec_block["measure"]["accounting_nature"]


def test_pays_destination_et_couverture(db_session, gold):
    node = chain.country_node(db_session, "FI")
    ec_block = next(b for b in node["by_funder"] if b["funder"] == "ec")
    assert ec_block["amount"] == pytest.approx(878463.81 + 196691.81 + 25146.88)
    assert node["cross_funder_total"]["available"] is False
    assert "destination" in node["node"]["provenance"]["note"]


def test_funder_ec_descend_par_programme(db_session, gold):
    node = chain.funder_node(db_session, "ec")
    items = {i["code"]: i for i in node["children"]["items"]}
    assert "HORIZON" in items
    horizon = items["HORIZON"]
    # Roll-up du sous-arbre : les 8 projets EC semés ici.
    assert horizon["projects"] == 8
    assert horizon["amount"] == pytest.approx(
        2994244.99 + 24767360.43 + 549442000.00 + 5335158.39 + 3000000.00 + 1000000.00 + 517435.92
    )
    assert node["aggregate"]["measure"]["provenance"] == "derived"
    assert "jamais un budget" in node["aggregate"]["measure"]["basis"]


def test_niveaux_absents_jamais_synthetises_en_navigation(db_session, gold):
    """I5 : les descentes NIH et NSF déclarent l'étage call absent."""
    for code in ("nih", "nsf"):
        node = chain.funder_node(db_session, code)
        call_status = next(e for e in node["navigation"]["down"] if e["level"] == "call")
        assert call_status["status"] == "not_available"


def test_funders_index_et_refus_de_total(db_session, gold):
    """La racine de la chaîne : les financeurs viennent du moteur (rien
    de câblé côté UI) et le total inter-financeurs est refusé là aussi."""
    index = chain.funders_index(db_session)
    codes = {f["id"] for f in index["funders"]}
    assert {"ec", "nih", "nsf"} <= codes
    assert index["cross_funder_total"]["available"] is False
    ec = next(f for f in index["funders"] if f["id"] == "ec")
    assert ec["aggregate"]["measure"]["currency"] == "EUR"


def test_ancestors_portent_le_fil_reel(db_session, gold):
    """B2 lit le fil d'ancêtres du moteur — jamais reconstruit côté
    client, jamais un étage absent (I5)."""
    # CORDIS : financeur / cadre / programme / appel.
    node = chain.project_node(db_session, gold["versilib"].id)
    levels = [(a["level"], a.get("code", a["id"])) for a in node["ancestors"]]
    assert levels == [
        ("funder", "ec"),
        ("programme", "HORIZON"),
        ("programme", "HORIZON.3.1"),
        ("call", "HORIZON-EIC-2021-PATHFINDEROPEN-01"),
    ]
    # NIH : financeur / institut — PAS d'étage appel.
    node = chain.project_node(db_session, gold["rabies"].id)
    assert [a["level"] for a in node["ancestors"]] == ["funder", "programme"]
    # Programme : financeur (+ cadre pour une feuille EC).
    node = chain.programme_node(db_session, gold["p31"].id)
    assert [(a["level"], a.get("code", a["id"])) for a in node["ancestors"]] == [
        ("funder", "ec"),
        ("programme", "HORIZON"),
    ]
    # Appel en contexte programme : le fil porte le contexte.
    node = chain.call_node(db_session, gold["call_adhoc"].id, programme_id=gold["pa"].id)
    assert [a["level"] for a in node["ancestors"]] == ["funder", "programme", "programme"]
    # Organisation et pays : pas de fil unique — jamais inventé.
    assert chain.organisation_node(db_session, gold["itaconix"].id)["ancestors"] == []
    assert chain.country_node(db_session, "FI")["ancestors"] == []


def test_node_not_found(db_session):
    with pytest.raises(chain.NodeNotFound):
        chain.project_node(db_session, -1)
    with pytest.raises(chain.NodeNotFound):
        chain.funder_node(db_session, "inexistant")
    with pytest.raises(chain.NodeNotFound):
        chain.country_node(db_session, "XX")
