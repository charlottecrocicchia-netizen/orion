import csv
import re
import zipfile
from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from pydantic import BaseModel

from orion.ingest.reference import parse_decimal

_HAS_LETTER = re.compile(r"[A-Za-z]")

csv.field_size_limit(10_000_000)


def extract_members(zip_path: Path, dest: Path, names: list[str]) -> dict[str, Path]:
    """Extract wanted CSV members (matched by basename) from a CORDIS zip."""
    dest.mkdir(parents=True, exist_ok=True)
    found: dict[str, Path] = {}
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.namelist():
            base = Path(member).name
            if base in names:
                target = dest / base
                with zf.open(member) as src, target.open("wb") as out:
                    out.write(src.read())
                found[base] = target
    return found


def iter_rows(path: Path) -> Iterator[dict[str, str]]:
    """Yield sanitized rows: no None keys/values even when a row over/underflows the header."""
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh, delimiter=";", quotechar='"', restval=""):
            extra = row.pop(None, None)
            if extra:
                row["_extra"] = ";".join(extra)
            yield {key: (value or "") for key, value in row.items()}


def _parse_date(raw: str | None) -> date | None:
    if not raw or not raw.strip():
        return None
    try:
        return date.fromisoformat(raw.strip()[:10])
    except ValueError:
        return None


def _parse_datetime(raw: str | None) -> datetime | None:
    if not raw or not raw.strip():
        return None
    try:
        return datetime.fromisoformat(raw.strip())
    except ValueError:
        return None


def _clean(raw: str | None) -> str | None:
    value = (raw or "").strip()
    return value or None


def _clean_short(raw: str | None, limit: int) -> str | None:
    value = _clean(raw)
    return value[:limit] if value else None


def _corrupt(raw: str | None, parsed: object) -> bool:
    """A non-empty source value the parser could not read: on CORDIS exports
    this is the signature of a row split by an unescaped quote, not of a
    blank — everything right of the break wears another column's value."""
    return bool((raw or "").strip()) and parsed is None


class ProjectRow(BaseModel):
    source_id: str
    acronym: str | None
    status: str | None
    title: str
    start_date: date | None
    end_date: date | None
    total_cost: Decimal | None
    ec_max_contribution: Decimal | None
    legal_basis: str | None
    master_call: str | None
    sub_call: str | None
    objective: str | None
    content_updated_at: datetime | None
    shifted: bool
    raw: dict[str, str]

    @classmethod
    def from_csv(cls, row: dict[str, str], framework_code: str | None = None) -> "ProjectRow":
        start_date = _parse_date(row.get("startDate"))
        end_date = _parse_date(row.get("endDate"))
        total_cost = parse_decimal(row.get("totalCost"))
        ec_max = parse_decimal(row.get("ecMaxContribution"))
        # Row-shift detection: frameworkProgramme carries the framework code on
        # every sane row of every export; a date or an amount that reads as
        # text means the break happened before the money columns. Past the
        # break, no scalar field can be trusted (B0.1-A).
        framework_raw = (row.get("frameworkProgramme") or "").strip()
        shifted = (
            (framework_code is not None and framework_raw != framework_code)
            or _corrupt(row.get("startDate"), start_date)
            or _corrupt(row.get("endDate"), end_date)
            or _corrupt(row.get("totalCost"), total_cost)
            or _corrupt(row.get("ecMaxContribution"), ec_max)
        )
        return cls(
            source_id=(row.get("id") or "").strip(),
            acronym=_clean_short(row.get("acronym"), 100),
            status=_clean_short(row.get("status"), 30),
            title=(row.get("title") or "").strip(),
            start_date=None if shifted else start_date,
            end_date=None if shifted else end_date,
            total_cost=None if shifted else total_cost,
            ec_max_contribution=None if shifted else ec_max,
            legal_basis=None if shifted else _clean(row.get("legalBasis")),
            master_call=None if shifted else _clean(row.get("masterCall")),
            sub_call=None if shifted else _clean(row.get("subCall")),
            objective=_clean(row.get("objective")),
            content_updated_at=None if shifted else _parse_datetime(row.get("contentUpdateDate")),
            shifted=shifted,
            raw=row,
        )

    def is_valid(self) -> bool:
        # A non-numeric id is the signature of a column-shifted row.
        return bool(self.source_id.isdigit() and self.title)


class OrgRow(BaseModel):
    project_source_id: str
    pic: str | None
    name: str
    country_raw: str | None
    city: str | None
    activity_type: str | None
    website: str | None
    lat: Decimal | None
    lon: Decimal | None
    order_index: int | None
    role: str | None
    ec_contribution: Decimal | None
    realigned: bool
    role_discarded: bool

    @classmethod
    def from_csv(cls, row: dict[str, str]) -> "OrgRow":
        lat: Decimal | None = None
        lon: Decimal | None = None
        geo = (row.get("geolocation") or "").strip().strip("()")
        if "," in geo:
            parts = geo.split(",", 1)
            try:
                lat, lon = Decimal(parts[0].strip()), Decimal(parts[1].strip())
            except ArithmeticError:
                lat = lon = None
        order_raw = (row.get("order") or "").strip()
        role_raw = (row.get("role") or "").strip()
        ec_raw = (row.get("ecContribution") or "").strip()
        rcn_raw = (row.get("rcn") or "").strip()
        # A money value in the role column means the row was split one column
        # early by an unescaped quote in organizationURL. Realign only on the
        # FULL signature — order holds the role word, rcn holds the rank;
        # anything less and the trailing fields stay unknown, never guessed.
        realigned = role_discarded = False
        if role_raw and parse_decimal(role_raw) is not None:
            if _HAS_LETTER.search(order_raw) and not order_raw.isdigit() and rcn_raw.isdigit():
                ec_raw, role_raw, order_raw = role_raw, order_raw, rcn_raw
                realigned = True
            else:
                role_raw, ec_raw = "", ""
                role_discarded = True
        elif role_raw and not _HAS_LETTER.search(role_raw):
            # A role without a single letter is not a role.
            role_raw = ""
            role_discarded = True
        pic = _clean(row.get("organisationID"))
        return cls(
            project_source_id=(row.get("projectID") or "").strip(),
            # A CORDIS PIC is numeric; anything else signals a shifted row.
            pic=pic if pic and pic.isdigit() else None,
            name=(row.get("name") or "").strip(),
            country_raw=_clean_short(row.get("country"), 10),
            city=_clean_short(row.get("city"), 200),
            activity_type=_clean_short(row.get("activityType"), 50),
            website=_clean(row.get("organizationURL")),
            lat=lat,
            lon=lon,
            order_index=int(order_raw) if order_raw.isdigit() else None,
            role=_clean_short(role_raw, 30),
            ec_contribution=parse_decimal(ec_raw),
            realigned=realigned,
            role_discarded=role_discarded,
        )

    def is_valid(self) -> bool:
        return bool(self.project_source_id.isdigit() and self.name)


class LegalBasisIndex(BaseModel):
    """The official legalBasis.csv, read as three things at once: the universe
    of valid programme codes (the ONLY admissible values — project.csv rows
    corrupted by unescaped quotes put DOIs, booleans and keyword lists in the
    legalBasis column, B0.1-A), the code -> title map, and the per-project
    codes that recover the attachment when project.csv is unusable."""

    titles: dict[str, str]
    universe: set[str]
    flagged: dict[str, list[str]]
    all_codes: dict[str, list[str]]

    def resolve(self, project_source_id: str) -> str | None:
        """The project's programme when it can be told honestly, else None.

        One uniqueProgrammePart code -> that code. Several -> their common
        ancestor when it is one of them (the finest attachment that is
        certain). No flag -> the single code if there is only one."""
        candidates = sorted(set(self.flagged.get(project_source_id, [])))
        if not candidates:
            codes = set(self.all_codes.get(project_source_id, []))
            return codes.pop() if len(codes) == 1 else None
        if len(candidates) == 1:
            return candidates[0]
        root = min(candidates, key=len)
        if all(code.startswith(root) for code in candidates):
            return root
        return None


def parse_legal_basis(path: Path | None) -> LegalBasisIndex:
    """Build the LegalBasisIndex from legalBasis.csv when present."""
    titles: dict[str, str] = {}
    universe: set[str] = set()
    flagged: dict[str, list[str]] = {}
    all_codes: dict[str, list[str]] = {}
    if path is not None:
        for row in iter_rows(path):
            code = (row.get("legalBasis") or "").strip()
            if not code:
                continue
            universe.add(code)
            title = (row.get("title") or "").strip()
            if title:
                titles[code] = title
            project_id = (row.get("projectID") or "").strip()
            if project_id:
                all_codes.setdefault(project_id, []).append(code)
                if (row.get("uniqueProgrammePart") or "").strip().lower() == "true":
                    flagged.setdefault(project_id, []).append(code)
    return LegalBasisIndex(titles=titles, universe=universe, flagged=flagged, all_codes=all_codes)


def _find_column(fieldnames: list[str], needle: str) -> str | None:
    return next((c for c in fieldnames if needle.lower() in c.lower()), None)


def iter_euroscivoc(path: Path) -> Iterator[tuple[str, str, str, str | None]]:
    """Yield (project_source_id, code, label, path) from euroSciVoc.csv.

    Column names vary slightly across frameworks, so they are detected.
    """
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=";", quotechar='"')
        fields = reader.fieldnames or []
        project_col = _find_column(fields, "projectid")
        code_col = _find_column(fields, "code")
        title_col = _find_column(fields, "title")
        path_col = _find_column(fields, "path")
        if not (project_col and code_col):
            return
        for row in reader:
            project_id = (row.get(project_col) or "").strip()
            code = (row.get(code_col) or "").strip()
            label = (row.get(title_col) or "").strip() if title_col else ""
            if not label and path_col:
                label = (row.get(path_col) or "").strip().rsplit("/", 1)[-1]
            if project_id and code:
                yield project_id, code, label or code, (row.get(path_col) or None)
