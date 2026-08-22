"""E3 V1 — opportunités structurelles d'une organisation : pont exact,
famille par identifiant au seuil d'E2, jamais un appel clos proposé,
composantes décomposées sans score agrégé, état vide honnête."""

import pytest
from sqlalchemy import text

from orion.core.db import SessionLocal

SRC = "e3t"


@pytest.fixture(scope="module")
def corpus(test_database):
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
            "VALUES ('e3t', 'Fonds E3', 'EU', 'EUR') RETURNING id"
        )
        for key, name in (("org", "CANDIDATE SARL"), ("partner_a", "PARTENAIRE A"),
                          ("partner_b", "PARTENAIRE B"), ("nobody", "SANS HISTOIRE SA")):
            ids[key] = one(
                "INSERT INTO organisations (name, name_normalized, country_code) "
                "VALUES (:n, lower(:n), 'FR') RETURNING id", n=name
            )

        def call(code: str) -> int:
            return one("INSERT INTO calls (funder_id, code) VALUES (:f, :c) RETURNING id",
                       f=ids["funder"], c=code)

        def project(sid: str, call_id: int, year: int) -> int:
            return one(
                "INSERT INTO projects (source, source_id, title, funder_id, call_id, "
                "start_date, funding_amount_eur) "
                "VALUES (:s, :sid, :t, :f, :c, make_date(:y, 3, 1), 50000) RETURNING id",
                s=SRC, sid=sid, t=f"P {sid}", f=ids["funder"], c=call_id, y=year)

        def take_part(pid: int, org: int, role: str, uid: str) -> None:
            session.execute(
                text("INSERT INTO participations (project_id, organisation_id, role, "
                     "country_code, amount, currency, amount_eur, source, source_uid) "
                     "VALUES (:p, :o, :r, 'FR', 10000, 'EUR', 10000, :s, :u)"),
                {"p": pid, "o": org, "r": role, "s": SRC, "u": uid})

        def topic(sid: str, identifier: str, call_code, call_id, opening: str, deadline: str) -> int:
            return one(
                "INSERT INTO call_topics (source, source_id, identifier, call_code, call_id, "
                "status_code, opening_date, deadline_dates, raw) "
                "VALUES ('ft-portal', :sid, :i, :cc, :ci, '31094502', "
                "CAST(:op AS timestamptz), CAST(:dl AS jsonb), '{}'::jsonb) RETURNING id",
                sid=sid, i=identifier, cc=call_code, ci=call_id, op=opening,
                dl=f'["{deadline}"]')

        # PONT EXACT : l'appel récurrent E3T-REC-2024-AA-01, 2 projets de
        # l'org (1 coordination), 2 co-participants — et un topic OUVERT
        # sous le MÊME call_id.
        c_rec = call("E3T-REC-2024-AA-01")
        p1 = project("rec-1", c_rec, 2024)
        p2 = project("rec-2", c_rec, 2025)
        take_part(p1, ids["org"], "coordinator", "r1-org")
        take_part(p1, ids["partner_a"], "partner", "r1-pa")
        take_part(p2, ids["org"], "partner", "r2-org")
        take_part(p2, ids["partner_b"], "partner", "r2-pb")
        ids["t_exact"] = topic("e3-exact", "E3T-REC-2026-AA-01-01", "E3T-REC-2026-AA-01",
                               c_rec, "2020-01-01T00:00:00+00:00", "2030-06-01T17:00:00+00:00")

        # FAMILLE PAR IDENTIFIANT : 3 projets historiques E3T-FAM-*-DEMO,
        # topic ouvert de la même famille (call_id absent).
        cf1, cf2 = call("E3T-FAM-2021-DEMO-01"), call("E3T-FAM-2022-DEMO-01")
        for i, c in enumerate((cf1, cf1, cf2)):
            p = project(f"fam-{i}", c, 2021 + i)
            take_part(p, ids["org"], "coordinator" if i == 2 else "partner", f"f{i}-org")
        ids["t_family"] = topic("e3-family", "E3T-FAM-2026-DEMO-02-03", "E3T-FAM-2026-02",
                                None, "2020-01-01T00:00:00+00:00", "2030-09-01T17:00:00+00:00")

        # SOUS LE SEUIL : 2 projets seulement dans E3T-SM-*-QQ.
        cs = call("E3T-SM-2022-QQ-01")
        for i in range(2):
            p = project(f"sm-{i}", cs, 2022)
            take_part(p, ids["org"], "partner", f"s{i}-org")
        ids["t_small"] = topic("e3-small", "E3T-SM-2026-QQ-01-01", "E3T-SM-2026-QQ-01",
                               None, "2020-01-01T00:00:00+00:00", "2030-01-01T17:00:00+00:00")

        # CLOS : même famille riche que t_family, mais deadline passée —
        # jamais proposé, quoi que dise le statut source.
        ids["t_closed"] = topic("e3-closed", "E3T-FAM-2025-DEMO-01-01", "E3T-FAM-2025-01",
                                None, "2020-01-01T00:00:00+00:00", "2025-01-01T17:00:00+00:00")

        session.commit()
        yield ids
    finally:
        for table, clause in (
            ("call_topics", "source_id LIKE 'e3-%'"),
            ("participations", f"source = '{SRC}'"),
            ("projects", f"source = '{SRC}'"),
            ("calls", "code LIKE 'E3T-%'"),
            ("organisations", "name IN ('CANDIDATE SARL','PARTENAIRE A','PARTENAIRE B','SANS HISTOIRE SA')"),
            ("funders", "code = 'e3t'"),
            ("countries", "code = 'FR'"),
        ):
            session.execute(text(f"DELETE FROM {table} WHERE {clause}"))
        session.commit()
        session.close()


def _get(client, org_id: int) -> dict:
    res = client.get(f"/api/organisations/{org_id}/call-opportunities")
    assert res.status_code == 200
    return res.json()


def test_exact_bridge_opportunity_first_with_components(corpus, client):
    payload = _get(client, corpus["org"])
    opps = {o["identifier"]: o for o in payload["opportunities"]}
    exact = opps["E3T-REC-2026-AA-01-01"]
    assert exact["basis"] == "exact"
    assert exact["status"] == "open"
    assert exact["components"]["projects"] == 2
    assert exact["components"]["coordinations"] == 1
    assert exact["components"]["last_active_year"] == 2025
    # Deux co-participants historiques distincts, l'org exclue.
    assert exact["components"]["co_participants"] == 2
    # Le pont exact passe devant la famille (tri déclaré).
    assert payload["opportunities"][0]["identifier"] == "E3T-REC-2026-AA-01-01"


def test_identifier_family_opportunity_at_threshold(corpus, client):
    payload = _get(client, corpus["org"])
    opps = {o["identifier"]: o for o in payload["opportunities"]}
    fam = opps["E3T-FAM-2026-DEMO-02-03"]
    assert fam["basis"] == "identifier_family"
    assert fam["family"] == "E3T-FAM-Y-DEMO"
    assert fam["components"]["projects"] == 3
    assert fam["components"]["coordinations"] == 1


def test_below_threshold_family_never_proposed(corpus, client):
    payload = _get(client, corpus["org"])
    assert "E3T-SM-2026-QQ-01-01" not in {o["identifier"] for o in payload["opportunities"]}


def test_closed_topic_never_proposed_even_in_a_rich_family(corpus, client):
    payload = _get(client, corpus["org"])
    assert "E3T-FAM-2025-DEMO-01-01" not in {o["identifier"] for o in payload["opportunities"]}


def test_no_history_is_an_honest_empty(corpus, client):
    payload = _get(client, corpus["nobody"])
    assert payload["opportunities"] == []
    assert "aucun score agrégé" in payload["meta"]["ranking"]


def test_method_says_unknown_eligibility_and_no_score(corpus, client):
    payload = _get(client, corpus["org"])
    assert "jamais traité" in payload["meta"]["eligibility"]
    assert "jamais une garantie" in payload["meta"]["wording"]
    for opp in payload["opportunities"]:
        assert "score" not in opp  # les composantes, rien d'autre


def test_unknown_organisation_is_404(corpus, client):
    assert client.get("/api/organisations/999999999/call-opportunities").status_code == 404
