"""E2 V1 — les acteurs historiques d'un appel : hiérarchie de preuve
(exact › famille par identifiant › famille par code gardée), unité
organisation × projet distinct, état vide honnête, piège du code
transversal (cas SPACE de l'audit), lentille sans effet."""

import pytest
from sqlalchemy import text

from orion.core.db import SessionLocal
from orion.search.call_actors import norm_year, strip_family

SRC = "e2t"


@pytest.fixture(scope="module")
def corpus(test_database):  # la base migrée suffit ; le client vient par test
    """Un corpus synthétique complet pour les neuf cas, nettoyé après."""
    session = SessionLocal()
    ids: dict[str, int] = {}

    def one(sql: str, **params) -> int:
        return session.execute(text(sql), params).scalar_one()

    try:
        session.execute(
            text(
                "INSERT INTO countries (code, name_en, region, eu_member) "
                "VALUES ('FR', 'France', 'Europe', true) ON CONFLICT (code) DO NOTHING"
            )
        )
        ids["funder"] = one(
            "INSERT INTO funders (code, name, jurisdiction, default_currency) "
            "VALUES ('e2t', 'Fonds de test E2', 'EU', 'EUR') RETURNING id"
        )
        ids["prog_root"] = one(
            "INSERT INTO programmes (funder_id, code, name) "
            "VALUES (:f, 'E2TFP', 'Cadre de test') RETURNING id",
            f=ids["funder"],
        )
        ids["prog_child"] = one(
            "INSERT INTO programmes (funder_id, parent_id, code, name) "
            "VALUES (:f, :p, 'E2TFP.1', 'Sous-programme') RETURNING id",
            f=ids["funder"],
            p=ids["prog_root"],
        )
        for org_key, name in (
            ("o1", "ACTEUR ALPHA"),
            ("o2", "ACTEUR BETA"),
            ("o3", "FAUX VOISIN GAMMA"),
        ):
            ids[org_key] = one(
                "INSERT INTO organisations (name, name_normalized, country_code) "
                "VALUES (:n, lower(:n), 'FR') RETURNING id",
                n=name,
            )

        def call(code: str) -> int:
            return one(
                "INSERT INTO calls (funder_id, code) VALUES (:f, :c) RETURNING id",
                f=ids["funder"],
                c=code,
            )

        def project(sid: str, call_id: int, year: int) -> int:
            return one(
                "INSERT INTO projects (source, source_id, title, funder_id, programme_id, "
                "call_id, start_date, funding_amount_eur) "
                "VALUES (:s, :sid, :title, :f, :prog, :c, make_date(:y, 6, 1), 100000) RETURNING id",
                s=SRC,
                sid=sid,
                title=f"Projet {sid}",
                f=ids["funder"],
                prog=ids["prog_child"],
                c=call_id,
                y=year,
            )

        def take_part(project_id: int, org: int, role: str, uid: str, amount: float) -> None:
            session.execute(
                text(
                    "INSERT INTO participations (project_id, organisation_id, role, "
                    "country_code, amount, currency, amount_eur, source, source_uid) "
                    "VALUES (:p, :o, :r, 'FR', :a, 'EUR', :a, :s, :u)"
                ),
                {"p": project_id, "o": org, "r": role, "a": amount, "s": SRC, "u": uid},
            )

        def topic(sid: str, identifier: str, call_code, call_id) -> int:
            return one(
                "INSERT INTO call_topics (source, source_id, identifier, call_code, call_id, raw) "
                "VALUES ('ft-portal', :sid, :i, :cc, :ci, '{}'::jsonb) RETURNING id",
                sid=sid,
                i=identifier,
                cc=call_code,
                ci=call_id,
            )

        # ---- Cas 1 : PONT EXACT (3 projets, doublon d'org sur P1) ----
        ce = call("E2T-EX-2023-AA-01")
        p1, p2, p3 = (project(f"ex-{i}", ce, 2020 + i) for i in range(3))
        take_part(p1, ids["o1"], "coordinator", "ex-p1-o1", 100000)
        take_part(p1, ids["o1"], "partner", "ex-p1-o1bis", 20000)  # doublon connu du dédoublonnage
        take_part(p1, ids["o2"], "partner", "ex-p1-o2", 50000)
        take_part(p2, ids["o1"], "coordinator", "ex-p2-o1", 100000)
        take_part(p3, ids["o1"], "partner", "ex-p3-o1", 30000)
        take_part(p3, ids["o2"], "partner", "ex-p3-o2", 40000)
        ids["t_exact"] = topic("t-exact", "E2T-EX-2026-AA-01-01", "E2T-EX-2026-AA-01", ce)

        # ---- Cas 2 : FAMILLE PAR IDENTIFIANT + piège transversal ----
        cf1 = call("E2T-CL9-2021-DEMO-01")
        cf2 = call("E2T-CL9-2022-DEMO-01")
        cx = call("E2T-CL9-2021-03")  # l'appel TRANSVERSAL du cluster
        for i, c in enumerate((cf1, cf1, cf2)):
            p = project(f"fam-{i}", c, 2021 + i)
            take_part(p, ids["o2"], "coordinator" if i == 0 else "partner", f"fam-{i}-o2", 60000)
        px = project("cross-0", cx, 2021)
        take_part(px, ids["o3"], "coordinator", "cross-0-o3", 999999)
        ids["t_fam"] = topic("t-fam", "E2T-CL9-2026-DEMO-02-07", "E2T-CL9-2026-02", None)

        # ---- Cas 3 : FAMILLE PAR CODE admise (motif EIC) ----
        cb1 = call("E2T-EIC-2023-BOOST-01")
        cb2 = call("E2T-EIC-2024-BOOST-01")
        for i, c in enumerate((cb1, cb1, cb2)):
            p = project(f"boost-{i}", c, 2023 + i)
            take_part(p, ids["o1"], "partner", f"boost-{i}-o1", 10000)
        ids["t_code"] = topic(
            "t-code", "E2T-EIC-2026-BOOSTCHALLENGES-01", "E2T-EIC-2026-BOOST-01", None
        )

        # ---- Cas 4 : le PIÈGE — code transversal, identifiant sans historique ----
        ids["t_trap"] = topic("t-trap", "E2T-CL9-2026-SPACE-03-12", "E2T-CL9-2026-03", None)

        # ---- Cas 5 : AUCUN historique ----
        ids["t_empty"] = topic("t-empty", "E2T-NONE-2026-ZZ-01", None, None)

        # ---- Cas 6 : SOUS LE SEUIL (2 projets) ----
        cs = call("E2T-SM-2023-QQ-01")
        for i in range(2):
            p = project(f"sm-{i}", cs, 2022 + i)
            take_part(p, ids["o1"], "coordinator", f"sm-{i}-o1", 5000)
        ids["t_small"] = topic("t-small", "E2T-SM-2026-QQ-01-01", "E2T-SM-2026-QQ-01", cs)

        session.commit()
        yield ids
    finally:
        for table, clause in (
            ("call_topics", "source_id LIKE 't-%'"),
            ("participations", f"source = '{SRC}'"),
            ("projects", f"source = '{SRC}'"),
            ("calls", "code LIKE 'E2T-%'"),
            ("programmes", "code LIKE 'E2TFP%'"),
            ("organisations", "name IN ('ACTEUR ALPHA','ACTEUR BETA','FAUX VOISIN GAMMA')"),
            ("funders", "code = 'e2t'"),
            ("countries", "code = 'FR'"),
        ):
            session.execute(text(f"DELETE FROM {table} WHERE {clause}"))
        session.commit()
        session.close()


def _get(client, topic_id: int) -> dict:
    res = client.get(f"/api/calls/{topic_id}/historical-actors")
    assert res.status_code == 200
    return res.json()


# ------------------------------------------------------- normalisation


def test_families_match_the_audit_cases():
    assert strip_family("HORIZON-CL4-2027-SPACE-03-12") == "HORIZON-CL4-Y-SPACE"
    assert norm_year("HORIZON-CL4-2027-03") == "HORIZON-CL4-Y-03"
    assert strip_family("HORIZON-CL4-2027-03") == "HORIZON-CL4-Y"


# ----------------------------------------------------------- les neuf cas


def test_exact_bridge_actors_and_no_double_counting(corpus, client):
    payload = _get(client, corpus["t_exact"])
    assert payload["level"] == "exact"
    by_name = {a["name"]: a for a in payload["actors"]}
    alpha = by_name["ACTEUR ALPHA"]
    # Doublon d'organisation sur P1 : 3 projets, jamais 4.
    assert alpha["projects"] == 3
    # Coordination comptée au niveau projet : P1 et P2.
    assert alpha["coordinations"] == 2
    # Le montant est la somme des CONTRIBUTIONS (doublon compris : chaque
    # euro versé compte une fois) — jamais le budget projet répété.
    assert alpha["contributions_eur"] == 250000
    assert alpha["period"] == {"from": 2020, "to": 2022}
    assert "E2TFP" in alpha["programmes"]
    assert by_name["ACTEUR BETA"]["projects"] == 2
    assert by_name["ACTEUR BETA"]["coordinations"] == 0
    # Une organisation n'apparaît qu'une fois.
    names = [a["name"] for a in payload["actors"]]
    assert len(names) == len(set(names))


def test_identifier_family_level_labeled_and_trap_actor_absent(corpus, client):
    payload = _get(client, corpus["t_fam"])
    assert payload["level"] == "identifier_family"
    assert payload["family"] == "E2T-CL9-Y-DEMO"
    names = [a["name"] for a in payload["actors"]]
    assert "ACTEUR BETA" in names
    # L'appel transversal E2T-CL9-2021-03 n'appartient PAS à la famille :
    # son acteur ne remonte jamais ici.
    assert "FAUX VOISIN GAMMA" not in names
    assert payload["historical"] == {"calls": 2, "projects": 3}


def test_code_family_fallback_admitted_and_labeled(corpus, client):
    payload = _get(client, corpus["t_code"])
    assert payload["level"] == "code_family"
    assert payload["family"] == "E2T-EIC-Y-BOOST-01"
    assert [a["name"] for a in payload["actors"]] == ["ACTEUR ALPHA"]


def test_transversal_code_family_refused_not_a_fake_list(corpus, client):
    """Le cas SPACE de l'audit : identifiant sans historique, code
    transversal au cluster — mieux vaut rien qu'une liste trompeuse."""
    payload = _get(client, corpus["t_trap"])
    assert payload["level"] is None
    assert payload["actors"] == []
    assert payload["reason"] == "family_too_transversal"


def test_no_history_is_an_honest_result(corpus, client):
    payload = _get(client, corpus["t_empty"])
    assert payload["level"] is None
    assert payload["actors"] == []
    assert payload["reason"] == "no_comparable_history"


def test_below_threshold_says_so(corpus, client):
    payload = _get(client, corpus["t_small"])
    assert payload["level"] is None
    assert payload["actors"] == []
    assert payload["reason"] == "below_threshold"
    assert payload["historical"]["projects"] == 2


def test_lens_never_alters_the_methodology(corpus, client):
    bare = _get(client, corpus["t_exact"])
    framed = client.get(
        f"/api/calls/{corpus['t_exact']}/historical-actors", params={"sector": "space"}
    )
    assert framed.status_code == 200
    assert framed.json() == bare


def test_unknown_topic_is_404(corpus, client):
    assert client.get("/api/calls/999999999/historical-actors").status_code == 404


def test_method_meta_rides_along(corpus, client):
    payload = _get(client, corpus["t_exact"])
    meta = payload["meta"]
    assert meta["min_projects"] == 3
    assert "organisation × projet distinct" in meta["unit"]
    assert "jamais le budget projet" in meta["amounts"]
