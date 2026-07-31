from dataclasses import dataclass


@dataclass(frozen=True)
class Framework:
    source: str
    url: str
    programme_code: str
    programme_name: str


FRAMEWORKS: dict[str, Framework] = {
    "cordis-horizon": Framework(
        source="cordis-horizon",
        url="https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip",
        programme_code="HORIZON",
        programme_name="Horizon Europe (2021-2027)",
    ),
    "cordis-h2020": Framework(
        source="cordis-h2020",
        url="https://cordis.europa.eu/data/cordis-h2020projects-csv.zip",
        programme_code="H2020",
        programme_name="Horizon 2020 (2014-2020)",
    ),
    "cordis-fp7": Framework(
        source="cordis-fp7",
        url="https://cordis.europa.eu/data/cordis-fp7projects-csv.zip",
        programme_code="FP7",
        programme_name="Seventh Framework Programme (2007-2013)",
    ),
}
