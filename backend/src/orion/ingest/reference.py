import gettext
import unicodedata
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

# LES CINQ RÉGIONS « MANAGER » (chantier régions, validé le 2026-08-04).
# Le monde entier, découpé comme un décideur le lit — et COMPLET : chaque
# code ISO connu appartient à une région, un test le garantit (la leçon
# Vega du « nom en dur » appliquée à la géographie : aucun pays à données
# ne doit pouvoir rester du décor). Règle de rattachement des territoires
# (verdict fondatrice ③) : la géographie, seule règle défendable — la
# Guyane rejoint l'Amérique latine au référentiel même si le polygone
# France la colore en Europe sur les cartes (fait cartographique).
# RU/TR restent en Europe (réalité du corpus) ; Israël au
# Moyen-Orient & Afrique. Unique exception à la complétude : l'Antarctique
# (AQ) n'a ni région ni financeur — l'exception est écrite, le test la
# connaît.
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
        "JE",
        "GG",
        "IM",
        "AX",
        "SJ",
    },  # fmt: skip
    "north-america": {"US", "CA", "MX", "BM", "GL", "PM"},
    "latin-america": {
        "BR",
        "AR",
        "CL",
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
        "HT",
        "BS",
        "BZ",
        "GY",
        "SR",
        "GF",
        "GP",
        "MQ",
        "BL",
        "MF",
        "PR",
        "VI",
        "VG",
        "AI",
        "CW",
        "AW",
        "BQ",
        "SX",
        "MS",
        "TC",
        "KY",
        "DM",
        "GD",
        "KN",
        "LC",
        "VC",
        "AG",
        "BB",
        "FK",
        "GS",
        "BV",
    },  # fmt: skip
    "asia-pacific": {
        "CN",
        "JP",
        "KR",
        "KP",
        "IN",
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
        "MO",
        "PK",
        "BD",
        "LK",
        "NP",
        "KH",
        "LA",
        "MM",
        "BT",
        "MV",
        "AF",
        "BN",
        "TL",
        "AU",
        "NZ",
        "FJ",
        "PG",
        "SB",
        "VU",
        "WS",
        "TO",
        "NC",
        "PF",
        "GU",
        "MP",
        "AS",
        "FM",
        "MH",
        "PW",
        "KI",
        "TV",
        "NR",
        "CK",
        "NU",
        "TK",
        "PN",
        "NF",
        "UM",
        "WF",
        "CX",
        "CC",
        "IO",
        "HM",
    },  # fmt: skip
    "middle-east-africa": {
        "SA",
        "AE",
        "QA",
        "JO",
        "LB",
        "IQ",
        "IR",
        "PS",
        "SY",
        "YE",
        "OM",
        "KW",
        "BH",
        "IL",
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
        "EH",
        "SH",
        "RE",
        "YT",
        "TF",
    },  # fmt: skip
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
        "code": "ademe",
        "name": "ADEME",
        "jurisdiction": "FR",
        "country_code": "FR",
        "default_currency": "EUR",
    },
    {
        # Wave 1, step 1. RePORTER also carries the other HHS agencies and
        # the VA — the funder stays "NIH RePORTER" and the awarding
        # institute is the programme, so the reader always sees who paid.
        "code": "nih",
        "name": "National Institutes of Health (RePORTER)",
        "jurisdiction": "US",
        "country_code": "US",
        "default_currency": "USD",
    },
    {
        # Wave 1, step 2. The awarding division is the programme, so the
        # reader sees which part of the NSF paid.
        "code": "nsf",
        "name": "National Science Foundation",
        "jurisdiction": "US",
        "country_code": "US",
        "default_currency": "USD",
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


_NAME_INDEX: dict[str, str] | None = None

# French exonyms that no ISO listing carries (sources use everyday names).
FRENCH_EXONYMS = {
    "moldavie": "MD",
    "birmanie": "MM",
    "coree du sud": "KR",
    "coree du nord": "KP",
    "etats unis": "US",
    "grande bretagne": "GB",
    "angleterre": "GB",
    "ecosse": "GB",
    "pays de galles": "GB",
    "vatican": "VA",
    "cap vert": "CV",
    "timor oriental": "TL",
    "republique tcheque": "CZ",
    "tchequie": "CZ",
    "macedoine": "MK",
    "coree": "KR",
    # Inverted and older French forms seen in French-language sources.
    "cook iles": "CK",
    "norfolk ile": "NF",
    "saint kitts et nevis": "KN",
}

# Everyday English names no ISO listing carries. NSF publishes country
# NAMES, not codes, and writes them the way people speak: "Russia", not
# "Russian Federation" (measured on three real fiscal years, 2026-08-03).
# Every one below was verified to fail resolution before being added —
# an unresolved country is journalled by each loader, never swallowed.
ENGLISH_EXONYMS = {
    "russia": "RU",
    "turkey": "TR",
    "ivory coast": "CI",
    "cape verde": "CV",
    "east timor": "TL",
    "burma": "MM",
    "brunei": "BN",
    "democratic republic of the congo": "CD",
    "republic of korea": "KR",
    "swaziland": "SZ",
    "macedonia": "MK",
    "vatican city": "VA",
    "st kitts and nevis": "KN",
}


def _key(name: str) -> str:
    """Fold case, accents and punctuation so 'Corée (République de)' meets 'Coree'."""
    folded = unicodedata.normalize("NFKD", name.strip().lower())
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in folded).split())


def _name_index() -> dict[str, str]:
    """Country names to ISO codes: English and French, full and short forms."""
    global _NAME_INDEX
    if _NAME_INDEX is not None:
        return _NAME_INDEX

    french = gettext.translation(
        "iso3166-1", pycountry.LOCALES_DIR, languages=["fr"], fallback=True
    )
    index: dict[str, str] = {}

    def add(name: str | None, code: str) -> None:
        if not name:
            return
        index.setdefault(_key(name), code)
        # ISO renders qualifiers after a comma ("Russie, Fédération de") while
        # sources use the bare name ("Russie") — index both.
        head = name.split(",")[0]
        if head != name:
            index.setdefault(_key(head), code)

    for country in pycountry.countries:
        for name in (country.name, getattr(country, "common_name", None)):
            add(name, country.alpha_2)
            add(french.gettext(name) if name else None, country.alpha_2)
        official = getattr(country, "official_name", None)
        add(official, country.alpha_2)
        add(french.gettext(official) if official else None, country.alpha_2)

    for code, name in EXTRA_COUNTRIES:
        add(name, code)
    index.update(FRENCH_EXONYMS)
    index.update(ENGLISH_EXONYMS)

    _NAME_INDEX = index
    return index


def resolve_country(raw: str | None) -> str | None:
    """Resolve an ISO code *or* a country name (English/French) to alpha-2."""
    if not raw:
        return None
    value = raw.strip()
    if len(value) <= 3:
        return normalize_country(value)

    index = _name_index()
    candidates = [value]
    if "(" in value:  # "Corée (République de)" → also try "Corée"
        candidates.append(value.split("(")[0])
    if "," in value:
        # "Germany, Berlin" → "Germany" (NSF qualifies a few names with
        # a city). Tried only AFTER the full string, so ISO forms like
        # "Korea, Republic of" still resolve on their own name.
        candidates.append(value.split(",")[0])
    for candidate in candidates:
        code = index.get(_key(candidate))
        if code:
            return code
    return None


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
