import csv
import zipfile
from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from pydantic import BaseModel

from orion.ingest.reference import parse_decimal

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
    raw: dict[str, str]

    @classmethod
    def from_csv(cls, row: dict[str, str]) -> "ProjectRow":
        return cls(
            source_id=(row.get("id") or "").strip(),
            acronym=_clean_short(row.get("acronym"), 100),
            status=_clean_short(row.get("status"), 30),
            title=(row.get("title") or "").strip(),
            start_date=_parse_date(row.get("startDate")),
            end_date=_parse_date(row.get("endDate")),
            total_cost=parse_decimal(row.get("totalCost")),
            ec_max_contribution=parse_decimal(row.get("ecMaxContribution")),
            legal_basis=_clean(row.get("legalBasis")),
            master_call=_clean(row.get("masterCall")),
            sub_call=_clean(row.get("subCall")),
            objective=_clean(row.get("objective")),
            content_updated_at=_parse_datetime(row.get("contentUpdateDate")),
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
            role=_clean_short(row.get("role"), 30),
            ec_contribution=parse_decimal(row.get("ecContribution")),
        )

    def is_valid(self) -> bool:
        return bool(self.project_source_id.isdigit() and self.name)


def parse_legal_basis_titles(path: Path | None) -> dict[str, str]:
    """Map legalBasis code -> human title, from legalBasis.csv when present."""
    if path is None:
        return {}
    titles: dict[str, str] = {}
    for row in iter_rows(path):
        code = (row.get("legalBasis") or "").strip()
        title = (row.get("title") or "").strip()
        if code and title:
            titles[code] = title
    return titles


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
