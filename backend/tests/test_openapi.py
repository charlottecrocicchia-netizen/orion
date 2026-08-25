def test_openapi_schema_is_served(client):
    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Orion API"
    assert "/api/health" in schema["paths"]


def test_openapi_publie_la_grammaire_des_modes(client):
    """La description du paramètre `value` EST le contrat public de la
    grammaire URL (R0 § D10) : sans ce verrou, un mode pourrait
    disparaître de la documentation sans qu'aucun test ne bronche."""
    schema = client.get("/api/openapi.json").json()
    params = {p["name"]: p for p in schema["paths"]["/api/explore/aggregate"]["get"]["parameters"]}
    description = params["value"]["schema"].get("description") or params["value"]["description"]
    for mode in ("nominal", "real", "gdp", "capita", "ppp"):
        assert mode in description
