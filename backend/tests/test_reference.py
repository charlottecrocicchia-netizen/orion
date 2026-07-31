from decimal import Decimal

from orion.ingest.reference import normalize_country, parse_decimal


def test_normalize_country_maps_eu_specific_codes_to_iso():
    assert normalize_country("EL") == "GR"
    assert normalize_country("UK") == "GB"
    assert normalize_country("fr") == "FR"
    assert normalize_country("XK") == "XK"
    assert normalize_country("") is None
    assert normalize_country("ZZ") is None


def test_parse_decimal_handles_eu_comma_separator():
    assert parse_decimal("2999250,5") == Decimal("2999250.5")
    assert parse_decimal("1500000") == Decimal("1500000")
    assert parse_decimal("1.5") == Decimal("1.5")
    assert parse_decimal("") is None
    assert parse_decimal(None) is None
    assert parse_decimal("n/a") is None
