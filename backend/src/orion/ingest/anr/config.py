from dataclasses import dataclass

SOURCE = "anr"
RESOURCE_URL = "https://www.data.gouv.fr/fr/datasets/r/{resource_id}"


@dataclass(frozen=True)
class AnrDataset:
    """One published ANR file pair (projects + partners) on data.gouv.fr."""

    key: str
    projects_resource: str
    partners_resource: str
    directorate: str


# Resource ids are stable per file; data.gouv republishes updated content at the
# same id, so the download cache detects real changes on its own.
DATASETS: tuple[AnrDataset, ...] = (
    AnrDataset(
        key="dgds-2010",
        projects_resource="87d29a24-392e-4a29-a009-83eddcff3e66",
        partners_resource="4b576f41-8f4a-4f0f-860a-98eca420f3b9",
        directorate="DGDS",
    ),
    AnrDataset(
        key="dgds-2005",
        projects_resource="74a59cc0-ef79-458a-83e0-f181f9da459f",
        partners_resource="0d691519-9a6c-4d66-a2e0-b9a8b3938968",
        directorate="DGDS",
    ),
    AnrDataset(
        key="dgpie-2010",
        projects_resource="aca6972b-577c-496a-aa26-009f81256dcb",
        partners_resource="51cba202-da27-4f95-9337-0ff5aae7e6ae",
        directorate="DGPIE",
    ),
)


def resource_url(resource_id: str) -> str:
    return RESOURCE_URL.format(resource_id=resource_id)
