from decimal import Decimal, InvalidOperation

import pycountry
from sqlalchemy.orm import Session

from orion.ingest.runlog import RunStats, record_run
from orion.ingest.upsert import upsert
from orion.models import Country, Funder

EU_MEMBERS = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
    "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
}  # fmt: skip

REGIONS: dict[str, set[str]] = {
    "europe": EU_MEMBERS
    | {
        "GB",
        "CH",
        "NO",
        "IS",
        "LI",
        "UA",
        "RS",
        "BA",
        "ME",
        "MK",
        "AL",
        "MD",
        "GE",
        "AM",
        "AZ",
        "TR",
        "RU",
        "BY",
        "XK",
        "FO",
        "GI",
        "MC",
        "SM",
        "AD",
        "VA",
    },  # fmt: skip
    "americas": {
        "US",
        "CA",
        "BR",
        "AR",
        "CL",
        "MX",
        "CO",
        "PE",
        "UY",
        "EC",
        "BO",
        "PY",
        "VE",
        "CR",
        "PA",
        "GT",
        "CU",
        "DO",
        "HN",
        "NI",
        "SV",
        "JM",
        "TT",
    },  # fmt: skip
    "asia": {
        "CN",
        "JP",
        "KR",
        "IN",
        "IL",
        "TW",
        "SG",
        "TH",
        "VN",
        "MY",
        "ID",
        "PH",
        "KZ",
        "UZ",
        "KG",
        "TJ",
        "TM",
        "MN",
        "HK",
        "SA",
        "AE",
        "QA",
        "JO",
        "LB",
        "IQ",
        "IR",
        "PK",
        "BD",
        "LK",
        "NP",
        "KH",
        "LA",
        "MM",
        "PS",
        "SY",
        "YE",
        "OM",
        "KW",
        "BH",
        "BT",
        "MV",
        "AF",
    },  # fmt: skip
    "africa": {
        "ZA",
        "EG",
        "MA",
        "TN",
        "DZ",
        "KE",
        "NG",
        "GH",
        "SN",
        "CM",
        "ET",
        "UG",
        "TZ",
        "CI",
        "BF",
        "ML",
        "MZ",
        "ZM",
        "ZW",
        "RW",
        "BJ",
        "TG",
        "NE",
        "TD",
        "LY",
        "SD",
        "MR",
        "MG",
        "MW",
        "BW",
        "NA",
        "GA",
        "CG",
        "CD",
        "AO",
        "SO",
        "DJ",
        "ER",
        "GM",
        "GN",
        "GW",
        "SL",
        "LR",
        "CV",
        "MU",
        "SC",
        "KM",
        "ST",
        "SZ",
        "LS",
        "BI",
        "CF",
        "GQ",
        "SS",
    },  # fmt: skip
    "oceania": {"AU", "NZ", "FJ", "PG", "SB", "VU", "WS", "TO", "NC", "PF"},
}

# Codes used by EU datasets that differ from ISO 3166-1 alpha-2.
COUNTRY_CODE_FIXES = {"EL": "GR", "UK": "GB"}

# ISO user-assigned code used by EU sources for Kosovo, absent from pycountry.
EXTRA_COUNTRIES = [("XK", "Kosovo")]

FUNDERS = [
    {
        "code": "ec",
        "name": "European Commission",
        "jurisdiction": "EU",
        "country_code": None,
        "default_currency": "EUR",
    },
    {
        "code": "anr",
        "name": "Agence nationale de la recherche",
        "jurisdiction": "FR",
        "country_code": "FR",
        "default_currency": "EUR",
    },
    {
        "code": "ademe",
        "name": "ADEME",
        "jurisdiction": "FR",
        "country_code": "FR",
        "default_currency": "EUR",
    },
]

_KNOWN_CODES: set[str] | None = None


def _known_codes() -> set[str]:
    global _KNOWN_CODES
    if _KNOWN_CODES is None:
        _KNOWN_CODES = {c.alpha_2 for c in pycountry.countries} | {
            code for code, _ in EXTRA_COUNTRIES
        }
    return _KNOWN_CODES


def region_of(code: str) -> str | None:
    return next((region for region, codes in REGIONS.items() if code in codes), None)


def normalize_country(raw: str | None) -> str | None:
    """Map a source country label to ISO 3166-1 alpha-2, or None if unknown."""
    if not raw:
        return None
    code = COUNTRY_CODE_FIXES.get(raw.strip().upper(), raw.strip().upper())
    return code if code in _known_codes() else None


def parse_decimal(raw: str | None) -> Decimal | None:
    """Parse source amounts, tolerating the EU comma decimal separator."""
    if raw is None:
        return None
    cleaned = raw.strip().replace(" ", "").replace(" ", "")
    if not cleaned:
        return None
    if "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def seed_reference(session: Session, stats: RunStats) -> None:
    countries = [
        {
            "code": c.alpha_2,
            "name_en": getattr(c, "common_name", None) or c.name,
            "region": region_of(c.alpha_2),
            "eu_member": c.alpha_2 in EU_MEMBERS,
        }
        for c in pycountry.countries
    ] + [
        {"code": code, "name_en": name, "region": region_of(code), "eu_member": False}
        for code, name in EXTRA_COUNTRIES
    ]
    upsert(session, Country, countries, ["code"], ["name_en", "region", "eu_member"])
    stats.add("countries", len(countries))

    upsert(
        session,
        Funder,
        FUNDERS,
        ["code"],
        ["name", "jurisdiction", "country_code", "default_currency"],
    )
    stats.add("funders", len(FUNDERS))


def run(force: bool = False) -> dict[str, int]:
    from orion.core.db import SessionLocal

    with record_run("reference") as stats:
        session = SessionLocal()
        try:
            seed_reference(session, stats)
            session.commit()
        finally:
            session.close()
    return stats.counts
