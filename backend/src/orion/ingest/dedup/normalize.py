import re
import unicodedata

# Legal forms and country-specific suffixes that say nothing about identity.
LEGAL_FORMS = {
    "sa",
    "sas",
    "sasu",
    "sarl",
    "eurl",
    "sci",
    "snc",
    "scop",
    "sem",
    "gie",
    "gmbh",
    "mbh",
    "ag",
    "kg",
    "ohg",
    "ug",
    "eg",
    "ev",
    "ltd",
    "limited",
    "plc",
    "llp",
    "llc",
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "co",
    "company",
    "bv",
    "nv",
    "cv",
    "vof",
    "spa",
    "srl",
    "sapa",
    "ab",
    "as",
    "asa",
    "oy",
    "oyj",
    "aps",
    "hf",
    "ehf",
    "sl",
    "slu",
    "sau",
    "sociedad",
    "anonima",
    "lda",
    "unipessoal",
    "sp",
    "zoo",
    "sro",
    "kft",
    "zrt",
    "nyrt",
    "doo",
    "dd",
    "ou",
    "sia",
    "uab",
    "ad",
    "ead",
}

# Generic tokens that add noise to the comparison key.
NOISE_TOKENS = {
    "the",
    "of",
    "and",
    "for",
    "de",
    "des",
    "du",
    "la",
    "le",
    "les",
    "el",
    "der",
    "die",
    "das",
    "und",
    "van",
    "den",
    "het",
    "di",
    "e",
    "y",
}

ABBREVIATIONS = {
    "univ": "universite",
    "university": "universite",
    "universitat": "universite",
    "universitaet": "universite",
    "universita": "universite",
    "universidad": "universite",
    "universiteit": "universite",
    "uniwersytet": "universite",
    "institut": "institute",
    "instituto": "institute",
    "istituto": "institute",
    "institutet": "institute",
    "lab": "laboratoire",
    "laboratory": "laboratoire",
    "laboratorio": "laboratoire",
    "labo": "laboratoire",
    "ctr": "centre",
    "center": "centre",
    "centro": "centre",
    "zentrum": "centre",
    "natl": "national",
    "nationale": "national",
    "nacional": "national",
    "intl": "international",
    "internationale": "international",
    "rech": "recherche",
    "research": "recherche",
    "sci": "science",
    "scientifique": "science",
    "tech": "technologie",
    "technology": "technologie",
    "technologies": "technologie",
    "technologie": "technologie",
}

_PARENTHETICAL = re.compile(r"\([^)]*\)")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_name(raw: str | None) -> str | None:
    """Reduce an organisation name to a comparison key.

    Case, accents, punctuation, legal forms, filler words and common
    abbreviations are all folded away, so that "Université de Toulouse" and
    "UNIV TOULOUSE" collapse onto the same key. Returns None when nothing
    meaningful survives — never an empty string, which would match everything.
    """
    if not raw:
        return None

    folded = unicodedata.normalize("NFKD", raw.strip().lower())
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    folded = _PARENTHETICAL.sub(" ", folded)

    tokens = [t for t in _NON_ALNUM.split(folded) if t]
    kept: list[str] = []
    for token in tokens:
        if token in LEGAL_FORMS or token in NOISE_TOKENS:
            continue
        kept.append(ABBREVIATIONS.get(token, token))

    # Everything was filler (e.g. a bare "SARL"): fall back to the raw tokens
    # rather than returning a key that would match other emptied names.
    if not kept:
        kept = tokens
    return " ".join(kept) or None
