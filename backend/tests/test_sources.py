def test_sources_reports_totals_and_per_source_freshness(client):
    response = client.get("/api/sources")

    assert response.status_code == 200
    body = response.json()
    assert set(body["totals"]) == {"projects", "organisations", "participations"}
    assert all(isinstance(v, int) for v in body["totals"].values())
    for source in body["sources"]:
        # Maintenance passes are not sources; and a source WITHDRAWN by the
        # licence rule must never resurface here through its old run journal.
        assert source["source"] not in {"reference", "dedup", "anr"}
        assert isinstance(source["projects"], int)
