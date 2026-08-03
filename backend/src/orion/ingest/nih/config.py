"""NIH RePORTER — source configuration (vague 1, étape 1).

Bulk-by-fiscal-year is the main road (one zipped CSV per FY, verified
2026-08-03); the v2 search API stays the fallback should a file go
missing. Licence: US federal government data, public domain — verified
on reporter.nih.gov at instruction time, re-checked at each load per the
registry rule."""

from datetime import date

SOURCE = "nih"
PROJECTS_URL = "https://reporter.nih.gov/exporter/projects/download/{fy}"
ABSTRACTS_URL = "https://reporter.nih.gov/exporter/abstracts/download/{fy}"

# Founder-validated window: FY2005+, aligned with the corpus (the fonds
# goes back to 1985 but triples the volume outside the product window).
FIRST_FY = 2005

# Personal data never enters the base, not even the raw payload — the
# ANR rule, applied at the door for every source (a funding analysis
# needs no principal investigator's name).
PERSONAL_DATA_COLUMNS = frozenset({"PI_NAMEs", "PI_IDS", "PROGRAM_OFFICER_NAME", "PI_NAMES"})


def current_fy(today: date | None = None) -> int:
    """US federal fiscal year: October 1st opens the next one."""
    today = today or date.today()
    return today.year + 1 if today.month >= 10 else today.year


def fiscal_years(today: date | None = None) -> list[int]:
    return list(range(FIRST_FY, current_fy(today) + 1))
