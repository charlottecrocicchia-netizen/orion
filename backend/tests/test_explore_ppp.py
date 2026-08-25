"""Lot R4B — PURCHASING POWER : le financement en dollars internationaux.

Corpus semé, entièrement calculable à la main. Taux BCE USD/EUR 2023 =
1,25 ; ratios PPP choisis ronds :

| pays | PIB PPP | PIB USD | ratio | reçu 2023 | → $ intl |
|------|---------|---------|-------|-----------|----------|
| US   | 2,0e13  | 2,0e13  | 1,00  | —         | —        |
| FR   | 3,9e12  | 3,0e12  | 1,30  | 100 M€    | 162,5 M  |
| DE   | 5,0e12  | 4,0e12  | 1,25  |  80 M€    | 125,0 M  |
| PL   | 4,0e12  | 1,0e12  | 4,00  |  40 M€    | 200,0 M  |
| NL   | couple en 2022 SEULEMENT          |  10 M€    | exclu    |
| ES   | aucune série macro               |   5 M€    | exclu    |
| —    | participation sans pays          |   3 M€    | exclu    |

Total convertible : 487,5 M $ internationaux sur 220 M€ nominaux.

Les trois motifs d'exclusion ne se confondent jamais : ES n'a le couple
sur AUCUNE année (`no_jurisdiction_series`), NL l'a sur 2022 mais pas
sur l'année cadrée (`no_reference_year`), et la participation sans pays
est un troisième cas encore. La porte § 5 de R4B a montré que les
fusionner produirait un libellé mensonger.

Le CLASSEMENT reste nominal : FR (100) > DE (80) > PL (40), alors que le
PPP donne PL (200) > FR (162,5) > DE (125). « View funding as » change
comment on regarde, jamais qui on regarde.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion import macro
from orion.core.db import SessionLocal, engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    ExchangeRate,
    Funder,
    MacroSeries,
    Organisation,
    Participation,
    Project,
)
from orion.search import explore

MARK = "ZZPPP"
VINTAGE = date(2026, 2, 1)
# Le corpus committé porte SON millésime : la contrainte d'unicité
# (juridiction, concept, année, vintage) le ferait sinon entrer en
# collision avec les fixtures à savepoint du même module.
VINTAGE_HTTP = date(2026, 1, 5)
USD_PER_EUR = "1.25"
YEAR = 2023

PPP = {"US": 2.0e13, "FR": 3.9e12, "DE": 5.0e12, "PL": 4.0e12}
USD = {"US": 2.0e13, "FR": 3.0e12, "DE": 4.0e12, "PL": 1.0e12}
# NL n'a le couple que sur 2022 — le motif `no_reference_year`.
PPP_2022 = {**PPP, "NL": 1.2e12}
USD_2022 = {**USD, "NL": 1.0e12}
RECEIVED = {"FR": 100_000_000, "DE": 80_000_000, "PL": 40_000_000, "NL": 10_000_000}
EXPECTED = {"FR": 162_500_000.0, "DE": 125_000_000.0, "PL": 200_000_000.0}


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


def _macro(session: Session, year: int, ppp: dict, usd: dict, vintage: date = VINTAGE) -> None:
    for concept, series_code, values in (
        ("gdp_ppp_current_intl", "NY.GDP.MKTP.PP.CD", ppp),
        ("gdp_current_usd", "NY.GDP.MKTP.CD", usd),
    ):
        for code, value in values.items():
            session.add(
                MacroSeries(
                    jurisdiction_code=code,
                    concept=concept,
                    year=year,
                    value=Decimal(str(value)),
                    series_source="wdi",
                    series_code=series_code,
                    vintage_date=vintage,
                )
            )


@pytest.fixture
def seeded(db_session):
    db_session.add(ExchangeRate(currency="USD", year=YEAR, rate_to_eur=Decimal(USD_PER_EUR)))
    _macro(db_session, YEAR, PPP, USD)
    _macro(db_session, 2022, PPP_2022, USD_2022)

    ec = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    orgs = {
        code: Organisation(name=f"{MARK} {code}", country_code=code, org_type="REC")
        for code in ("FR", "DE", "PL", "NL", "ES")
    }
    orphan = Organisation(name=f"{MARK} orphan", country_code=None, org_type="REC")
    db_session.add_all([*orgs.values(), orphan])
    db_session.flush()

    # UN projet multinational : la règle d'agrégation est la somme des
    # participations converties chacune au pays qui la reçoit.
    project = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-multi",
        title=f"{MARK} multinational",
        funder_id=ec.id,
        funding_amount=238_000_000,
        funding_currency="EUR",
        funding_amount_eur=238_000_000,
        start_date=f"{YEAR}-03-01",
    )
    db_session.add(project)
    db_session.flush()
    rows = [
        *(
            Participation(
                project_id=project.id,
                organisation_id=orgs[code].id,
                role="coordinator" if code == "DE" else "participant",
                country_code=code,
                amount=amount,
                currency="EUR",
                amount_eur=amount,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p-{code}",
            )
            for code, amount in RECEIVED.items()
        ),
        Participation(
            project_id=project.id,
            organisation_id=orgs["ES"].id,
            role="participant",
            country_code="ES",
            amount=5_000_000,
            currency="EUR",
            amount_eur=5_000_000,
            source=f"test-{MARK}",
            source_uid=f"{MARK}-p-ES",
        ),
        Participation(
            project_id=project.id,
            organisation_id=orphan.id,
            role="participant",
            country_code=None,
            amount=3_000_000,
            currency="EUR",
            amount_eur=3_000_000,
            source=f"test-{MARK}",
            source_uid=f"{MARK}-p-none",
        ),
    ]
    db_session.add_all(rows)
    db_session.flush()
    return db_session


def _aggregate(session: Session, **kwargs):
    ppp = macro.ppp_ratio_set(session)
    assert ppp is not None
    return explore.aggregate(
        session,
        metric="funding",
        by=kwargs.pop("by", "country"),
        split=False,
        compare=None,
        year_from=kwargs.pop("year_from", YEAR),
        year_to=kwargs.pop("year_to", YEAR),
        q=None,
        country=kwargs.pop("country", None),
        scope=None,
        limit=kwargs.pop("limit", 50),
        ppp=ppp,
        usd_rates=macro.usd_rates(session),
        **kwargs,
    )


def _values(result) -> dict[str, float]:
    return {s["key"]: s["value"] for s in result["series"]}


# --------------------------------------------------------------- test-or 1


def test_or_ancre_us_vaut_un(seeded):
    """Le dollar international est ancré sur les États-Unis : leur ratio
    vaut 1 par construction. Le contrôle le plus puissant du lot — il
    n'est vrai que si les deux séries sont le bon couple, au bon
    millésime, sur le bon pays."""
    ppp = macro.ppp_ratio_set(seeded)
    assert ppp.ratios[("US", YEAR)].quantize(Decimal("0.000001")) == Decimal(1)


# --------------------------------------------------------------- test-or 4


def test_or_chiffre_recalcule_a_la_main(seeded):
    """100 M€ reçus en France en 2023, au taux BCE 1,25 et au ratio 1,30
    du couple publié : 100 × 1,25 × 1,30 = 162,5 M $ internationaux."""
    result = _aggregate(seeded)
    assert result["unit"] == "intl"
    assert _values(result)["FR"] == pytest.approx(EXPECTED["FR"])
    assert _values(result)["DE"] == pytest.approx(EXPECTED["DE"])
    assert _values(result)["PL"] == pytest.approx(EXPECTED["PL"])


# --------------------------------------------------------------- test-or 3


def test_or_projet_multinational_est_la_somme_des_participations(seeded):
    """`PPP(projet multinational) = Σ participations converties au pays
    de chacune` — jamais le pays du coordinateur (DE, ratio 1,25)
    appliqué à tout, qui donnerait 220 × 1,25 × 1,25 = 343,75 M."""
    result = _aggregate(seeded)
    total_converti = sum(EXPECTED.values())
    assert result["total"] == pytest.approx(total_converti)

    nominal_convertible = sum(RECEIVED[c] for c in EXPECTED)
    ppp_coordinateur = nominal_convertible * 1.25 * 1.25
    assert result["total"] != pytest.approx(ppp_coordinateur)


def test_or_agregation_entre_pays_est_la_somme(seeded):
    """Sommer entre pays, à unité et année identiques, est cohérent avec
    la pratique d'agrégation de la source. Sur une dimension qui
    regroupe (`by=region`), la valeur est la somme exacte des
    conversions par pays — jamais une PPP « moyenne » de la région."""
    par_pays = _aggregate(seeded)
    par_region = _aggregate(seeded, by="region")

    # Les pays sans référence rendent None, jamais 0 : absence de chiffre
    # n'est pas absence d'argent.
    valeurs_pays = _values(par_pays)
    assert valeurs_pays["NL"] is None and valeurs_pays["ES"] is None

    somme_pays = sum(v for v in valeurs_pays.values() if v is not None)
    somme_region = sum(v for v in _values(par_region).values() if v is not None)
    assert somme_region == pytest.approx(somme_pays)
    assert somme_region == pytest.approx(sum(EXPECTED.values()))


# --------------------------------------------------------------- verrou § 11


def _nominal(session, **kwargs):
    return explore.aggregate(
        session,
        metric="funding",
        by=kwargs.pop("by", "country"),
        split=False,
        compare=None,
        year_from=kwargs.pop("year_from", YEAR),
        year_to=kwargs.pop("year_to", YEAR),
        q=None,
        country=kwargs.pop("country", None),
        scope=None,
        limit=kwargs.pop("limit", 50),
        **kwargs,
    )


def test_le_top_est_celui_du_nominal(seeded):
    """Verrou § 11. L'ÉCHANTILLON vient du classement nominal : avec
    `limit=2`, le Top est {FR, DE} — les deux plus gros montants reçus —
    alors que la Pologne a la plus grosse valeur PPP (200 M contre
    162,5). « View funding as » change comment on regarde, jamais qui on
    regarde. L'ordre visuel des barres, lui, suit la valeur du mode
    (doctrine R3 inchangée)."""
    ppp = _aggregate(seeded, limit=2)
    nominal = _nominal(seeded, limit=2)
    assert (
        {s["key"] for s in ppp["series"]}
        == {s["key"] for s in nominal["series"]}
        == {
            "FR",
            "DE",
        }
    )
    # Sur la vue complète, l'appartenance est identique elle aussi.
    assert {s["key"] for s in _aggregate(seeded)["series"]} == {
        s["key"] for s in _nominal(seeded)["series"]
    }


# ------------------------------------------------------- les trois motifs


def test_les_trois_motifs_ne_se_confondent_jamais(seeded):
    """ES n'a le couple sur AUCUNE année ; NL l'a sur 2022 mais pas sur
    2023. Les mettre sous le même libellé serait faux."""
    result = _aggregate(seeded, by="organisation")
    reasons = result["excluded"]["reasons"]

    assert reasons["no_jurisdiction_series"]["amount_eur_nominal"] == pytest.approx(5_000_000)
    assert reasons["no_reference_year"]["amount_eur_nominal"] == pytest.approx(10_000_000)
    assert reasons["no_country"]["amount_eur_nominal"] == pytest.approx(3_000_000)
    assert reasons["no_reference_year"]["years"] == [YEAR]


def test_no_country_est_hors_perimetre_sur_by_country(seeded):
    """La dimension `country` écarte du périmètre les participations sans
    pays (`pa.country_code IS NOT NULL`) : elles n'y sont pas une
    exclusion, elles n'y sont pas du tout."""
    result = _aggregate(seeded, by="country")
    assert result["excluded"]["reasons"]["no_country"]["amount_eur_nominal"] == 0


def test_couverture_est_calculee_sur_le_perimetre_affiche(seeded):
    """220 M€ convertibles sur 235 M€ affichés en `by=country` (les 3 M€
    sans pays sont hors périmètre, pas exclus)."""
    result = _aggregate(seeded, by="country")
    attendu = 220_000_000 / 235_000_000
    assert result["meta"]["reference"]["coverage"] == pytest.approx(attendu, rel=1e-6)
    assert result["meta"]["reference"]["mode"] == "ppp"
    assert result["meta"]["reference"]["perspective"] == "recipient"
    assert result["meta"]["reference"]["year"] == YEAR


# ------------------------------------------------- règle du périmètre § 15.3


def test_perimetre_sans_rien_de_convertible_est_marque(seeded):
    """Une vue filtrée qui porte de la valeur nominale mais rien de
    convertible est NON DÉFINIE : le marqueur est posé, sans couverture
    ni exclusions — l'API le traduit en 422 et jette le corps."""
    # `by=country` refuse un filtre pays (cadrer et distribuer la même
    # chose n'a pas de sens) : la vue filtrée passe par `by=organisation`.
    result = _aggregate(seeded, by="organisation", country="ES")
    reference = result["meta"]["reference"]
    assert reference["no_convertible_value"] is True
    assert "coverage" not in reference
    assert "excluded" not in result


def test_perimetre_partiellement_convertible_sort_en_200(seeded):
    """Une seule valeur convertible suffit : la vue existe, les autres
    lignes se comptent en exclusions."""
    result = _aggregate(seeded, by="organisation")
    assert result["meta"]["reference"]["coverage"] > 0
    assert "no_convertible_value" not in result["meta"]["reference"]
    assert result["excluded"]["amount_eur_nominal"] == pytest.approx(18_000_000)


def test_vue_vide_n_est_pas_une_vue_refusee(seeded):
    """Aucune valeur nominale du tout : la référence n'est pas en cause.
    Ni couverture, ni exclusions, ni marqueur de refus — une vue vide,
    exactement comme en nominal."""
    result = _aggregate(seeded, by="organisation", country="JP")
    reference = result["meta"]["reference"]
    assert "no_convertible_value" not in reference
    assert "coverage" not in reference
    assert "excluded" not in result


# ------------------------------------------------------------- test-or 7


def test_or_millesimes_divergents_refusent_le_couple(db_session):
    """Le verrou du couple. Deux instantanés de source incompatibles ne
    doivent JAMAIS se rencontrer dans une même division : mieux vaut un
    mode indisponible qu'un ratio dont on ne sait pas de quelle édition
    il vient."""
    _macro(db_session, YEAR, PPP, USD)
    db_session.flush()
    assert macro.ppp_ratio_set(db_session) is not None

    db_session.execute(
        text(
            "UPDATE macro_series SET vintage_date = :v"
            " WHERE jurisdiction_code = 'FR' AND concept = 'gdp_ppp_current_intl'"
        ),
        {"v": date(2026, 11, 1)},
    )
    db_session.flush()
    macro._PPP_CACHE.clear()

    assert macro.ppp_ratio_set(db_session) is None


def test_juridiction_a_un_seul_concept_ne_refuse_pas_le_monde(db_session):
    """Une poignée d'économies publient le PIB en dollars sans le PIB en
    dollars internationaux. L'invariant porte sur l'INTERSECTION : les
    faire échouer mettrait le mode en refus mondial."""
    _macro(db_session, YEAR, PPP, USD)
    db_session.add(
        MacroSeries(
            jurisdiction_code="CU",
            concept="gdp_current_usd",
            year=YEAR,
            value=Decimal("1e11"),
            series_source="wdi",
            series_code="NY.GDP.MKTP.CD",
            vintage_date=date(2026, 5, 1),
        )
    )
    db_session.flush()
    macro._PPP_CACHE.clear()

    ppp = macro.ppp_ratio_set(db_session)
    assert ppp is not None
    assert "CU" not in ppp.covered  # donc `no_jurisdiction_series`, jamais `no_reference_year`


# --------------------------------------------------------- invariant nominal


def test_nominal_reste_strictement_identique(seeded):
    """Aucune clé du Reference Engine n'existe en nominal."""
    nominal = explore.aggregate(
        seeded,
        metric="funding",
        by="country",
        split=False,
        compare=None,
        year_from=YEAR,
        year_to=YEAR,
        q=None,
        country=None,
        scope=None,
        limit=50,
    )
    assert "reference" not in nominal["meta"]
    assert "excluded" not in nominal
    assert nominal["unit"] == "eur"
    assert _values(nominal)["FR"] == pytest.approx(100_000_000)


def test_le_grain_est_toujours_la_participation(seeded):
    """Les quatre dimensions autorisées sont toutes au grain
    participation : entre nominal et PPP, la population comptée est
    identique — aucun glissement de grain, donc aucun Top qui bouge."""
    for by in sorted(explore.PPP_DIMS):
        result = _aggregate(seeded, by=by)
        assert result["basis"] == "participants", by


def test_les_annees_honorables_ne_sont_pas_codees_en_dur(seeded):
    """Le jour où la source publiera une année de plus, elle apparaîtra
    d'elle-même : la liste sort du référentiel, pas d'une borne."""
    ppp = macro.ppp_ratio_set(seeded)
    assert {2022, YEAR} <= ppp.years
    assert 2026 not in ppp.years
    _macro(seeded, 2026, PPP, USD)
    seeded.flush()
    macro._PPP_CACHE.clear()
    assert 2026 in macro.ppp_ratio_set(seeded).years


# ------------------------------------------------------------------- API


def test_api_refuse_les_vues_hors_matrice(client):
    for query in (
        "metric=funding&by=year&value=ppp&year_from=2023&year_to=2023",
        "metric=funding&by=funder&value=ppp&year_from=2023&year_to=2023",
        "metric=funding&by=programme&value=ppp&year_from=2023&year_to=2023",
        "metric=funding&by=subdivision&value=ppp&year_from=2023&year_to=2023",
        "metric=projects&by=country&value=ppp&year_from=2023&year_to=2023",
    ):
        response = client.get(f"/api/explore/aggregate?{query}")
        assert response.status_code == 422, query
        assert response.json()["detail"] == "ppp_unavailable", query


def test_api_exige_une_annee_unique(client):
    for query in (
        "metric=funding&by=country&value=ppp",  # aucune borne
        "metric=funding&by=country&value=ppp&year_from=2020&year_to=2023",
        "metric=funding&by=country&value=ppp&year_from=2023",  # borne unique
    ):
        response = client.get(f"/api/explore/aggregate?{query}")
        assert response.status_code == 422, query
        assert response.json()["detail"] == "ppp_requires_single_award_year", query


def test_api_refuse_les_parametres_etrangers(client):
    for extra in ("base=2025", "cur=USD", "perspective=funder"):
        response = client.get(
            f"/api/explore/aggregate?metric=funding&by=country&value=ppp"
            f"&year_from=2023&year_to=2023&{extra}"
        )
        assert response.status_code == 400, extra
        assert response.json()["detail"] == "Unsupported parameter for value=ppp", extra


def test_api_sans_couple_charge_refuse_le_mode(client):
    """Base sans `macro_series` PPP : le mode n'existe pas."""
    response = client.get(
        "/api/explore/aggregate?metric=funding&by=country&value=ppp&year_from=2023&year_to=2023"
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "ppp_unavailable"


# ------------------------------- API sur corpus committé (le refus n° 3)


@pytest.fixture(scope="module")
def corpus_http(test_database):
    """Un corpus COMMITTÉ : les données d'une transaction annulée sont
    invisibles au client HTTP, qui parle à sa propre session."""
    session = SessionLocal()
    src = f"{MARK}HTTP"
    try:
        session.execute(
            text(
                "INSERT INTO countries (code, name_en, region, eu_member)"
                " VALUES ('FR','France','europe',true), ('ES','Espagne','europe',true)"
                " ON CONFLICT (code) DO NOTHING"
            )
        )
        session.execute(
            text(
                "INSERT INTO jurisdictions (code, kind, name_key, currency)"
                " VALUES ('FR','country','country.FR','EUR')"
                " ON CONFLICT (code) DO NOTHING"
            )
        )
        session.execute(
            text(
                "INSERT INTO exchange_rates (currency, year, rate_to_eur, source)"
                " VALUES ('USD', :y, 1.25, 'ecb') ON CONFLICT DO NOTHING"
            ),
            {"y": YEAR},
        )
        for concept, code_series, value in (
            ("gdp_ppp_current_intl", "NY.GDP.MKTP.PP.CD", "3.9e12"),
            ("gdp_current_usd", "NY.GDP.MKTP.CD", "3.0e12"),
        ):
            session.execute(
                text(
                    "INSERT INTO macro_series"
                    " (jurisdiction_code, concept, year, value, series_source,"
                    "  series_code, vintage_date)"
                    " VALUES ('FR', :c, :y, :v, 'wdi', :s, :d)"
                ),
                {"c": concept, "y": YEAR, "v": value, "s": code_series, "d": VINTAGE_HTTP},
            )
        funder_id = session.execute(
            text(
                "INSERT INTO funders (code, name, jurisdiction, default_currency)"
                f" VALUES ('{src}', 'Fonds {src}', 'EU', 'EUR') RETURNING id"
            )
        ).scalar_one()
        project_id = session.execute(
            text(
                "INSERT INTO projects"
                " (source, source_id, title, funder_id, funding_amount, funding_currency,"
                "  funding_amount_eur, start_date)"
                " VALUES (:s, :s, 'projet PPP HTTP', :f, 105000000, 'EUR', 105000000, :d)"
                " RETURNING id"
            ),
            {"s": src, "f": funder_id, "d": f"{YEAR}-03-01"},
        ).scalar_one()
        for code, amount in (("FR", 100_000_000), ("ES", 5_000_000)):
            org_id = session.execute(
                text(
                    "INSERT INTO organisations (name, country_code, org_type)"
                    " VALUES (:n, :c, 'REC') RETURNING id"
                ),
                {"n": f"{src} {code}", "c": code},
            ).scalar_one()
            session.execute(
                text(
                    "INSERT INTO participations"
                    " (project_id, organisation_id, role, country_code, amount, currency,"
                    "  amount_eur, source, source_uid)"
                    " VALUES (:p, :o, 'participant', :c, :a, 'EUR', :a, :s, :u)"
                ),
                {
                    "p": project_id,
                    "o": org_id,
                    "c": code,
                    "a": amount,
                    "s": src,
                    "u": f"{src}{code}",
                },
            )
        session.commit()
        yield src
    finally:
        for table in ("participations", "projects"):
            session.execute(text(f"DELETE FROM {table} WHERE source = :s"), {"s": src})
        session.execute(text("DELETE FROM organisations WHERE name LIKE :n"), {"n": f"{src}%"})
        session.execute(text("DELETE FROM funders WHERE code = :s"), {"s": src})
        session.execute(
            text("DELETE FROM macro_series WHERE vintage_date = :d"), {"d": VINTAGE_HTTP}
        )
        session.execute(
            text("DELETE FROM exchange_rates WHERE currency = 'USD' AND year = :y"), {"y": YEAR}
        )
        session.commit()
        session.close()


def test_api_perimetre_sans_reference_refuse_la_vue(client, corpus_http):
    """`year=2023` + `country=ES` : l'Espagne n'a pas de référence, mais
    2023 existe pour d'autres pays — réutiliser `ppp_year_unavailable`
    dirait une chose fausse. La vue n'est pas « 100 % exclue », elle
    n'est pas définie."""
    response = client.get(
        "/api/explore/aggregate?metric=funding&by=organisation&value=ppp"
        "&year_from=2023&year_to=2023&country=ES"
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "ppp_reference_unavailable_for_view"


def test_api_annee_non_publiee_refuse_l_annee(client, corpus_http):
    """2026 : aucune juridiction ne publie le couple. Le refus porte sur
    l'année, pas sur les territoires de la vue."""
    response = client.get(
        "/api/explore/aggregate?metric=funding&by=country&value=ppp&year_from=2026&year_to=2026"
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "ppp_year_unavailable"


def test_api_vue_servie_porte_le_contrat(client, corpus_http):
    response = client.get(
        "/api/explore/aggregate?metric=funding&by=country&value=ppp&year_from=2023&year_to=2023"
    )
    assert response.status_code == 200
    payload = response.json()
    reference = payload["meta"]["reference"]
    assert payload["unit"] == "intl"
    assert reference["mode"] == "ppp"
    assert reference["perspective"] == "recipient"
    assert reference["year"] == YEAR
    assert reference["series"] == {
        "gdp_ppp_current_intl": "wdi:NY.GDP.MKTP.PP.CD",
        "gdp_current_usd": "wdi:NY.GDP.MKTP.CD",
    }
    assert reference["vintages"] == {
        "gdp_ppp_current_intl": VINTAGE_HTTP.isoformat(),
        "gdp_current_usd": VINTAGE_HTTP.isoformat(),
    }
    assert "no_convertible_value" not in reference
    assert {s["key"]: s["value"] for s in payload["series"]}["FR"] == pytest.approx(162_500_000)


def test_api_annees_honorables_sur_corpus(client, corpus_http):
    """« Le contrôle n'offre que ce que la vue peut honorer » : la liste
    est l'intersection exacte des conditions du refus ⑤ — le couple
    publié ET le taux BCE. Une année absente de cette liste ne doit
    jamais être proposée, sans quoi l'utilisateur tombe sur un refus."""
    response = client.get("/api/explore/ppp-years")
    assert response.status_code == 200
    years = response.json()["years"]
    assert YEAR in years
    assert 2026 not in years
    # Et le contrat tient dans les deux sens : l'année proposée est
    # servie, celle qui manque est refusée.
    servie = client.get(
        f"/api/explore/aggregate?metric=funding&by=country&value=ppp"
        f"&year_from={YEAR}&year_to={YEAR}"
    )
    assert servie.status_code == 200
    refusee = client.get(
        "/api/explore/aggregate?metric=funding&by=country&value=ppp&year_from=2026&year_to=2026"
    )
    assert refusee.status_code == 422
    assert refusee.json()["detail"] == "ppp_year_unavailable"
