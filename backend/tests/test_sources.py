def test_sources_reports_totals_and_per_source_freshness(client):
    response = client.get("/api/sources")

    assert response.status_code == 200
    body = response.json()
    assert set(body["totals"]) == {"projects", "organisations", "participations"}
    assert all(isinstance(v, int) for v in body["totals"].values())
    for source in body["sources"]:
        assert source["source"] != "reference"
        assert isinstance(source["projects"], int)
