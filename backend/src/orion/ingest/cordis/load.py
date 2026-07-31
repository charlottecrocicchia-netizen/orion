import hashlib
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.config import get_settings
from orion.core.db import SessionLocal
from orion.ingest.cordis.config import FRAMEWORKS, Framework
from orion.ingest.cordis.parse import (
    OrgRow,
    ProjectRow,
    extract_members,
    iter_euroscivoc,
    iter_rows,
    parse_legal_basis_titles,
)
from orion.ingest.download import cached_download
from orion.ingest.reference import normalize_country
from orion.ingest.runlog import RunStats, record_run
from orion.ingest.upsert import upsert
from orion.models import (
    Call,
    Funder,
    Organisation,
    OrganisationAlias,
    OrganisationIdentifier,
    Participation,
    Programme,
    Project,
    ProjectText,
    ProjectTopic,
    Topic,
)

BATCH = 1000

PROJECT_UPDATE_COLS = [
    "acronym", "title", "title_lang", "abstract", "abstract_lang", "status",
    "start_date", "end_date", "total_cost", "total_cost_currency",
    "funding_amount", "funding_currency", "funding_amount_eur",
    "programme_id", "call_id", "url", "content_updated_at", "raw",
]  # fmt: skip

PARTICIPATION_UPDATE_COLS = [
    "project_id", "organisation_id", "role", "country_code",
    "amount", "currency", "amount_eur", "order_index",
]  # fmt: skip

CSV_MEMBERS = ["project.csv", "organization.csv", "euroSciVoc.csv", "legalBasis.csv"]


def _acceptable_code(code: str, max_len: int) -> bool:
    """Real programme/call codes are short space-free tokens; free text means a shifted row."""
    return len(code) <= max_len and " " not in code


def _fail_on_abnormal_invalid_rate(fw: Framework, kind: str, stats: RunStats) -> None:
    """Tolerate stray malformed rows, fail loudly on likely schema drift (ADR 0002)."""
    invalid = stats.counts.get(f"invalid_{kind}", 0)
    valid = stats.counts.get(kind if kind != "projects" else "projects", 0)
    if invalid > 50 and invalid > 0.05 * max(valid, 1):
        raise RuntimeError(f"{fw.source}: {invalid} invalid {kind} rows — schema drift?")


def _get_or_create_funder(session: Session) -> Funder:
    funder = session.scalar(select(Funder).where(Funder.code == "ec"))
    if funder is None:
        raise RuntimeError("Funder 'ec' missing — run `orion-ingest reference` first")
    return funder


def _get_or_create_programme(
    session: Session,
    cache: dict[str, int],
    funder_id: int,
    code: str,
    name: str | None,
    parent_id: int | None,
) -> int:
    if code in cache:
        return cache[code]
    existing = session.scalar(
        select(Programme).where(Programme.funder_id == funder_id, Programme.code == code)
    )
    if existing is None:
        existing = Programme(funder_id=funder_id, code=code, name=name, parent_id=parent_id)
        session.add(existing)
        session.flush()
    elif name and not existing.name:
        existing.name = name
    cache[code] = existing.id
    return existing.id


def _get_or_create_call(session: Session, cache: dict[str, int], funder_id: int, code: str) -> int:
    if code in cache:
        return cache[code]
    existing = session.scalar(select(Call).where(Call.funder_id == funder_id, Call.code == code))
    if existing is None:
        existing = Call(funder_id=funder_id, code=code)
        session.add(existing)
        session.flush()
    cache[code] = existing.id
    return existing.id


def _load_projects(
    session: Session,
    fw: Framework,
    files: dict[str, Path],
    funder_id: int,
    stats: RunStats,
) -> dict[str, int]:
    legal_titles = parse_legal_basis_titles(files.get("legalBasis.csv"))
    programme_cache: dict[str, int] = {}
    call_cache: dict[str, int] = {}
    framework_programme_id = _get_or_create_programme(
        session, programme_cache, funder_id, fw.programme_code, fw.programme_name, None
    )

    batch: list[dict] = []
    texts: list[tuple[str, str, str | None]] = []
    for raw_row in iter_rows(files["project.csv"]):
        try:
            row = ProjectRow.from_csv(raw_row)
        except ValidationError:
            stats.add("invalid_projects")
            continue
        if not row.is_valid():
            stats.add("invalid_projects")
            continue
        texts.append((row.source_id, row.title, row.objective))

        programme_id = framework_programme_id
        if row.legal_basis and row.legal_basis != fw.programme_code:
            if _acceptable_code(row.legal_basis, 100):
                programme_id = _get_or_create_programme(
                    session,
                    programme_cache,
                    funder_id,
                    row.legal_basis,
                    legal_titles.get(row.legal_basis),
                    framework_programme_id,
                )
            else:
                stats.add("suspect_legal_basis")
        call_code = row.sub_call or row.master_call
        if call_code and not _acceptable_code(call_code, 200):
            stats.add("suspect_call_code")
            call_code = None
        call_id = (
            _get_or_create_call(session, call_cache, funder_id, call_code) if call_code else None
        )

        batch.append(
            {
                "source": fw.source,
                "source_id": row.source_id,
                "acronym": row.acronym,
                "title": row.title,
                "title_lang": "en",
                "abstract": row.objective,
                "abstract_lang": "en" if row.objective else None,
                "status": row.status,
                "start_date": row.start_date,
                "end_date": row.end_date,
                "total_cost": row.total_cost,
                "total_cost_currency": "EUR" if row.total_cost is not None else None,
                "funding_amount": row.ec_max_contribution,
                "funding_currency": "EUR" if row.ec_max_contribution is not None else None,
                # All CORDIS amounts are EUR, so the EUR counter-value is direct.
                "funding_amount_eur": row.ec_max_contribution,
                "funder_id": funder_id,
                "programme_id": programme_id,
                "call_id": call_id,
                "url": f"https://cordis.europa.eu/project/id/{row.source_id}",
                "content_updated_at": row.content_updated_at,
                "raw": row.raw,
            }
        )
        stats.add("projects")
        if len(batch) >= BATCH:
            upsert(session, Project, batch, ["source", "source_id"], PROJECT_UPDATE_COLS, True)
            batch = []
    if batch:
        upsert(session, Project, batch, ["source", "source_id"], PROJECT_UPDATE_COLS, True)
    session.commit()
    _fail_on_abnormal_invalid_rate(fw, "projects", stats)

    pairs = session.execute(
        select(Project.source_id, Project.id).where(Project.source == fw.source)
    )
    project_map = dict(pairs.all())

    text_rows = [
        {"project_id": project_map[sid], "lang": "en", "title": title, "abstract": abstract}
        for sid, title, abstract in texts
        if sid in project_map
    ]
    upsert(session, ProjectText, text_rows, ["project_id", "lang"], ["title", "abstract"])
    stats.add("texts", len(text_rows))
    session.commit()
    return project_map


def _resolve_organisation(
    session: Session,
    row: OrgRow,
    pic_map: dict[str, int],
    alias_map: dict[tuple[str, str], int],
    stats: RunStats,
) -> int:
    if row.pic and row.pic in pic_map:
        return pic_map[row.pic]
    # Empty string, not NULL: the aliases unique constraint must match on re-runs.
    alias_key = (row.name, row.country_raw or "")
    if not row.pic and alias_key in alias_map:
        return alias_map[alias_key]

    organisation = Organisation(
        name=row.name,
        country_code=normalize_country(row.country_raw),
        city=row.city,
        org_type=row.activity_type,
        website=row.website,
        lat=row.lat,
        lon=row.lon,
    )
    session.add(organisation)
    session.flush()
    stats.add("organisations_created")
    if row.pic:
        session.add(
            OrganisationIdentifier(organisation_id=organisation.id, scheme="pic", value=row.pic)
        )
        pic_map[row.pic] = organisation.id
    else:
        alias_map[alias_key] = organisation.id
    return organisation.id


def _load_participations(
    session: Session,
    fw: Framework,
    files: dict[str, Path],
    project_map: dict[str, int],
    stats: RunStats,
) -> None:
    pic_map: dict[str, int] = dict(
        session.execute(
            select(OrganisationIdentifier.value, OrganisationIdentifier.organisation_id).where(
                OrganisationIdentifier.scheme == "pic"
            )
        ).all()
    )
    alias_map: dict[tuple[str, str], int] = {
        (name, country): org_id
        for name, country, org_id in session.execute(
            select(
                OrganisationAlias.name_raw,
                OrganisationAlias.country_raw,
                OrganisationAlias.organisation_id,
            ).where(OrganisationAlias.source == fw.source)
        ).all()
    }

    participations: list[dict] = []
    aliases: list[dict] = []
    seen_uids: set[str] = set()
    for raw_row in iter_rows(files["organization.csv"]):
        try:
            row = OrgRow.from_csv(raw_row)
        except ValidationError:
            stats.add("invalid_participations")
            continue
        if not row.is_valid():
            stats.add("invalid_participations")
            continue
        project_id = project_map.get(row.project_source_id)
        if project_id is None:
            stats.add("orphan_participations")
            continue

        organisation_id = _resolve_organisation(session, row, pic_map, alias_map, stats)

        org_key = row.pic or "h" + hashlib.sha1(row.name.encode()).hexdigest()[:12]
        source_uid = f"{row.project_source_id}:{org_key}:{row.order_index or 0}"
        if source_uid in seen_uids:
            stats.add("duplicate_participations")
            continue
        seen_uids.add(source_uid)

        participations.append(
            {
                "project_id": project_id,
                "organisation_id": organisation_id,
                "role": row.role,
                "country_code": normalize_country(row.country_raw),
                "amount": row.ec_contribution,
                "currency": "EUR" if row.ec_contribution is not None else None,
                "amount_eur": row.ec_contribution,
                "order_index": row.order_index,
                "source": fw.source,
                "source_uid": source_uid,
            }
        )
        aliases.append(
            {
                "organisation_id": organisation_id,
                "source": fw.source,
                "name_raw": row.name,
                "country_raw": row.country_raw or "",
            }
        )
        stats.add("participations")

        if len(participations) >= BATCH:
            upsert(
                session,
                Participation,
                participations,
                ["source", "source_uid"],
                PARTICIPATION_UPDATE_COLS,
                True,
            )
            upsert(session, OrganisationAlias, aliases, ["source", "name_raw", "country_raw"])
            participations, aliases = [], []
    if participations:
        upsert(
            session,
            Participation,
            participations,
            ["source", "source_uid"],
            PARTICIPATION_UPDATE_COLS,
            True,
        )
        upsert(session, OrganisationAlias, aliases, ["source", "name_raw", "country_raw"])
    session.commit()
    _fail_on_abnormal_invalid_rate(fw, "participations", stats)


def _load_topics(
    session: Session, files: dict[str, Path], project_map: dict[str, int], stats: RunStats
) -> None:
    path = files.get("euroSciVoc.csv")
    if path is None:
        stats.add("missing_euroscivoc_file")
        return

    links: list[tuple[str, str]] = []
    topics: dict[str, dict] = {}
    for project_source_id, code, label, topic_path in iter_euroscivoc(path):
        topics[code] = {"scheme": "euroscivoc", "code": code, "label": label, "path": topic_path}
        links.append((project_source_id, code))
    if not topics:
        return

    upsert(session, Topic, list(topics.values()), ["scheme", "code"], ["label", "path"])
    topic_map: dict[str, int] = dict(
        session.execute(select(Topic.code, Topic.id).where(Topic.scheme == "euroscivoc")).all()
    )

    rows = [
        {"project_id": project_map[pid], "topic_id": topic_map[code]}
        for pid, code in links
        if pid in project_map and code in topic_map
    ]
    unique_rows = list({(r["project_id"], r["topic_id"]): r for r in rows}.values())
    upsert(session, ProjectTopic, unique_rows, ["project_id", "topic_id"])
    stats.add("topic_links", len(unique_rows))
    session.commit()


def load_framework(
    session: Session, fw: Framework, files: dict[str, Path], stats: RunStats
) -> None:
    """Load one CORDIS framework from extracted CSV files. Idempotent."""
    funder = _get_or_create_funder(session)
    project_map = _load_projects(session, fw, files, funder.id, stats)
    _load_participations(session, fw, files, project_map, stats)
    _load_topics(session, files, project_map, stats)


def run(framework_key: str, force: bool = False) -> dict[str, int]:
    fw = FRAMEWORKS[framework_key]
    with record_run(fw.source) as stats:
        zip_path, changed = cached_download(fw.url, f"{fw.source}.zip", force=force)
        stats.add("download_changed" if changed else "download_cached", 1)
        extract_dir = Path(get_settings().data_dir) / "extracted" / fw.source
        files = extract_members(zip_path, extract_dir, CSV_MEMBERS)
        if "project.csv" not in files or "organization.csv" not in files:
            raise RuntimeError(f"{fw.source}: project.csv/organization.csv missing from archive")
        session = SessionLocal()
        try:
            load_framework(session, fw, files, stats)
        finally:
            session.close()
    return stats.counts
