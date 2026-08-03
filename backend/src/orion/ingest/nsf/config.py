"""NSF — source configuration (vague 1, étape 2).

The bulk road, established on the source 2026-08-03. The documented
download page (`nsf.gov/awardsearch/download.jsp`) and the old
`download?DownloadFileName=YYYY` endpoint now redirect to the search
application — and NSF's own public data inventory still points at that
dead URL. The live catalogue is the search app's own: `list-files`
returns one zip per fiscal year with a presigned link. Those links are
claimed eternal; we resolve them at every run anyway.

Format: JSON since January 2025 (NSF converted from XML), one file per
award inside the yearly zip.

Licence: US federal data, public domain — NSF's web policies state its
text is not subject to copyright and may be freely copied, and the
PAPPG makes the award abstract, with its title, an NSF document rather
than the researcher's work. Re-verified at each load, per the registry
rule."""

SOURCE = "nsf"
CATALOGUE_URL = "https://api.nsf.gov/services/v2/s3/list-files"
AWARD_URL = "https://www.nsf.gov/awardsearch/showAward?AWD_ID={award}"

# Founder-validated window: FY2005+, aligned with NIH so the two US
# sources cover the same period (22 files, ~2,7 GB compressed).
FIRST_FY = 2005

# The fold's fifth safety net: a collaborative group whose start dates
# stray more than a year apart is not one project. Measured maximum on
# three real years is 319 days, so this should never fire — it is there
# for the day NSF changes its habits.
MAX_SIBLING_SPREAD_DAYS = 365

# Personal data never enters the base, not even the raw payload — the
# ANR rule, applied at the door for every source. `parse` builds its
# rows from an explicit whitelist, so these keys are the test's target,
# not a filter the loader depends on.
PERSONAL_DATA_KEYS = frozenset(
    {"pi", "po_email", "po_phone", "po_sign_block_name", "inst_phone_num", "por"}
)
