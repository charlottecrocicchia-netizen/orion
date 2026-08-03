"""GLEIF golden-copy parsing (socle identité) — fixtures, no network."""

import csv
import io
import zipfile
from pathlib import Path

from orion.ingest.gleif import parse


def _zip_csv(path: Path, header: list[str], rows: list[list[str]]) -> Path:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("golden.csv", buffer.getvalue())
    return path


def test_lei_records_keep_identity_and_registration_authority(tmp_path):
    path = _zip_csv(
        tmp_path / "lei2.zip",
        [
            "LEI",
            "Entity.LegalName",
            "Entity.LegalAddress.Country",
            "Entity.RegistrationAuthority.RegistrationAuthorityEntityID",
            "Entity.EntityStatus",
        ],
        [
            ["969500UIC89GT3UL7L24", "SAFRAN", "FR", "562082909", "ACTIVE"],
            ["", "Ghost without LEI", "FR", "", "ACTIVE"],
            ["LEI0000000000000XX99", "No country corp", "", "", "ACTIVE"],
        ],
    )
    rows = list(parse.parse_lei_records(path))
    assert len(rows) == 2
    safran = rows[0]
    assert safran["lei"] == "969500UIC89GT3UL7L24"
    # The French registration authority id IS the SIREN — the bridge's
    # GLEIF side, captured verbatim.
    assert safran["ra_id"] == "562082909"
    assert safran["country_code"] == "FR"
    assert rows[1]["country_code"] is None


def test_relationships_keep_active_consolidation_only(tmp_path):
    header = [
        "Relationship.StartNode.NodeID",
        "Relationship.EndNode.NodeID",
        "Relationship.RelationshipType",
        "Relationship.RelationshipStatus",
        "Registration.ValidationSources",
    ]
    path = _zip_csv(
        tmp_path / "rr.zip",
        header,
        [
            [
                "CHILD000000000000001",
                "PARENT00000000000001",
                "IS_ULTIMATELY_CONSOLIDATED_BY",
                "ACTIVE",
                "FULLY_CORROBORATED",
            ],
            [
                "CHILD000000000000002",
                "PARENT00000000000001",
                "IS_DIRECTLY_CONSOLIDATED_BY",
                "ACTIVE",
                "ENTITY_SUPPLIED_ONLY",
            ],
            ["FUND0000000000000001", "MANAGER0000000000001", "IS_FUND-MANAGED_BY", "ACTIVE", ""],
            [
                "CHILD000000000000003",
                "PARENT00000000000001",
                "IS_ULTIMATELY_CONSOLIDATED_BY",
                "INACTIVE",
                "",
            ],
            [
                "SELF0000000000000001",
                "SELF0000000000000001",
                "IS_ULTIMATELY_CONSOLIDATED_BY",
                "ACTIVE",
                "",
            ],
        ],
    )
    rows = list(parse.parse_relationships(path))
    assert [row["child_lei"] for row in rows] == [
        "CHILD000000000000001",
        "CHILD000000000000002",
    ]
    assert rows[0]["corroboration"] == "FULLY_CORROBORATED"


def test_exceptions_filter_to_bridged_leis(tmp_path):
    path = _zip_csv(
        tmp_path / "repex.zip",
        ["LEI", "ExceptionCategory", "ExceptionReason"],
        [
            ["BRIDGED0000000000001", "DIRECT_ACCOUNTING_CONSOLIDATION_PARENT", "NON_CONSOLIDATING"],
            ["OTHER000000000000001", "DIRECT_ACCOUNTING_CONSOLIDATION_PARENT", "NON_PUBLIC"],
        ],
    )
    rows = list(parse.parse_exceptions(path, keep=frozenset({"BRIDGED0000000000001"})))
    assert len(rows) == 1
    assert rows[0]["reason"] == "NON_CONSOLIDATING"
