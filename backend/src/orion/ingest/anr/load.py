from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.anr.config import DATASETS, SOURCE, AnrDataset, resource_url
from orion.ingest.anr.parse import AnrPartnerRow, AnrProjectRow, iter_rows
from orion.ingest.download import cached_download
from orion.ingest.reference import resolve_country
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
)

BATCH = 1000

PROJECT_UPDATE_COLS = [
    "acronym", "title", "title_lang", "abstract", "abstract_lang",
    "start_date", "funding_amount", "funding_currency", "funding_amount_eur",
    "programme_id", "call_id", "url", "raw",
]  # fmt: skip

PARTICIPATION_UPDATE_COLS = [
    "project_id", "organisation_id", "role", "country_code",
    "amount", "currency", "amount_eur", "order_index",
]  # fmt: skip


def _funder(session: Session) -> Funder:
    funder = session.scalar(select(Funder).where(Funder.code == SOURCE))
    if funder is None:
        raise RuntimeError(f"Funder '{SOURCE}' missing — run `orion-ingest reference` first")
    return funder


def _programme_id(
    session: Session, cache: dict[str, int], funder_id: int, code: str, name: str | None
) -> int:
    if code in cache:
        return cache[code]
    programme = session.scalar(
        select(Programme).where(Programme.funder_id == funder_id, Programme.code == code)
    )
    if programme is None:
        programme = Programme(funder_id=funder_id, code=code, name=name)
        session.add(programme)
        session.flush()
    elif name and not programme.name:
        programme.name = name
    cache[code] = programme.id
    return programme.id


def _call_id(session: Session, cache: dict[str, int], funder_id: int, code: str) -> int:
    if code in cache:
        return cache[code]
    call = session.scalar(select(Call).where(Call.funder_id == funder_id, Call.code == code))
    if call is None:
        call = Call(funder_id=funder_id, code=code)
        session.add(call)
        session.flush()
    cache[code] = call.id
    return call.id


def _load_projects(session: Session, path: Path, funder_id: int, stats: RunStats) -> None:
    programme_cache: dict[str, int] = {}
    call_cache: dict[str, int] = {}
    batch: list[dict] = []

    for raw_row in iter_rows(path):
        try:
            row = AnrProjectRow.from_csv(raw_row)
        except ValidationError:
            stats.add("invalid_projects")
            continue
        if not row.is_valid():
            stats.add("invalid_projects")
            continue

        programme_id = (
            _programme_id(
                session, programme_cache, funder_id, row.programme_code, row.programme_name
            )
            if row.programme_code
            else None
        )
        # ANR has no call identifier of its own: programme + edition year is the
        # closest stable equivalent, and it is what users filter on.
        call_id = (
            _call_id(session, call_cache, funder_id, f"{row.programme_code}-{row.edition}")
            if row.programme_code and row.edition
            else None
        )

        batch.append(
            {
                "source": SOURCE,
                "source_id": row.source_id,
                "acronym": row.acronym,
                "title": row.title,
                "title_lang": row.title_lang,
                "abstract": row.abstract,
                "abstract_lang": row.abstract_lang,
                "start_date": row.start_date,
                "funding_amount": row.funding_amount,
                "funding_currency": "EUR" if row.funding_amount is not None else None,
                "funding_amount_eur": row.funding_amount,
                "funder_id": funder_id,
                "programme_id": programme_id,
                "call_id": call_id,
                "url": f"https://anr.fr/Projet-{row.source_id}",
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


def _resolve_organisation(
    session: Session,
    row: AnrPartnerRow,
    country_code: str | None,
    rnsr_map: dict[str, int],
    alias_map: dict[tuple[str, str], int],
    missing_country: set[int],
    late_countries: dict[int, str],
    stats: RunStats,
) -> int:
    def reuse(organisation_id: int) -> int:
        # An organisation first seen without a country must still get one when a
        # later row supplies it, instead of staying country-less forever.
        if country_code and organisation_id in missing_country:
            late_countries[organisation_id] = country_code
            missing_country.discard(organisation_id)
            stats.add("country_backfilled")
        return organisation_id

    if row.rnsr and row.rnsr in rnsr_map:
        return reuse(rnsr_map[row.rnsr])
    alias_key = (row.name, row.country_raw or "")
    if not row.rnsr and alias_key in alias_map:
        return reuse(alias_map[alias_key])

    organisation = Organisation(
        name=row.name,
        country_code=country_code,
        city=row.city,
        org_type=row.category,
    )
    session.add(organisation)
    session.flush()
    stats.add("organisations_created")
    if country_code is None:
        missing_country.add(organisation.id)
    if row.rnsr:
        session.add(
            OrganisationIdentifier(organisation_id=organisation.id, scheme="rnsr", value=row.rnsr)
        )
        rnsr_map[row.rnsr] = organisation.id
    else:
        alias_map[alias_key] = organisation.id
    return organisation.id


def _load_partners(session: Session, path: Path, stats: RunStats) -> None:
    project_map: dict[str, int] = dict(
        session.execute(select(Project.source_id, Project.id).where(Project.source == SOURCE)).all()
    )
    rnsr_map: dict[str, int] = dict(
        session.execute(
            select(OrganisationIdentifier.value, OrganisationIdentifier.organisation_id).where(
                OrganisationIdentifier.scheme == "rnsr"
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
            ).where(OrganisationAlias.source == SOURCE)
        ).all()
    }

    missing_country: set[int] = set(
        session.scalars(select(Organisation.id).where(Organisation.country_code.is_(None))).all()
    )
    late_countries: dict[int, str] = {}

    participations: list[dict] = []
    aliases: list[dict] = []
    seen: set[str] = set()
    order_by_project: dict[str, int] = {}

    for raw_row in iter_rows(path):
        try:
            row = AnrPartnerRow.from_csv(raw_row)
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
        if row.partner_source_id in seen:
            stats.add("duplicate_participations")
            continue
        seen.add(row.partner_source_id)

        country_code = resolve_country(row.country_raw)
        if row.country_raw and country_code is None:
            stats.add("unresolved_country")
        organisation_id = _resolve_organisation(
            session, row, country_code, rnsr_map, alias_map, missing_country, late_countries, stats
        )

        order_by_project[row.project_source_id] = order_by_project.get(row.project_source_id, 0) + 1
        participations.append(
            {
                "project_id": project_id,
                "organisation_id": organisation_id,
                "role": "coordinator" if row.is_coordinator else "participant",
                "country_code": country_code,
                "amount": row.amount,
                "currency": "EUR" if row.amount is not None else None,
                "amount_eur": row.amount,
                "order_index": order_by_project[row.project_source_id],
                "source": SOURCE,
                "source_uid": row.partner_source_id,
            }
        )
        aliases.append(
            {
                "organisation_id": organisation_id,
                "source": SOURCE,
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

    by_code: dict[str, list[int]] = {}
    for org_id, code in late_countries.items():
        by_code.setdefault(code, []).append(org_id)
    for code, org_ids in by_code.items():
        session.execute(
            update(Organisation)
            .where(Organisation.id.in_(org_ids), Organisation.country_code.is_(None))
            .values(country_code=code)
            .execution_options(synchronize_session=False)
        )
    session.commit()


def load_dataset(
    session: Session, dataset: AnrDataset, files: dict[str, Path], stats: RunStats
) -> None:
    """Load one ANR project/partner file pair. Idempotent."""
    funder = _funder(session)
    _load_projects(session, files["projects"], funder.id, stats)
    _load_partners(session, files["partners"], stats)


def run(force: bool = False) -> dict[str, int]:
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            for dataset in DATASETS:
                files: dict[str, Path] = {}
                for kind, resource in (
                    ("projects", dataset.projects_resource),
                    ("partners", dataset.partners_resource),
                ):
                    path, changed = cached_download(
                        resource_url(resource), f"{SOURCE}-{dataset.key}-{kind}.csv", force=force
                    )
                    files[kind] = path
                    stats.add("download_changed" if changed else "download_cached")
                load_dataset(session, dataset, files, stats)
        finally:
            session.close()
    return stats.counts
