"""Load NIH RePORTER (vague 1, étape 1).

The registry's transverse convention (2026-08-03) is applied HERE, in
readable SQL: award-year rows land in a staging table, then one GROUP BY
folds them onto their CORE_PROJECT_NUM — the sum of the yearly slices is
the project's amount, the calendar start date is the time axis, the
fiscal-year detail stays in `raw`, and the EUR figure is converted at
the ECB annual rate of the start year (USD kept native).

Memory stays flat whatever the volume: 22 fiscal years × ~85 000 rows
never sit in Python at once, and abstracts stream into batched upserts."""

from collections.abc import Iterator
from itertools import islice
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.download import cached_download
from orion.ingest.nih import parse
from orion.ingest.nih.config import ABSTRACTS_URL, PROJECTS_URL, SOURCE, fiscal_years
from orion.ingest.reference import resolve_country
from orion.ingest.runlog import RunStats, record_run
from orion.models import Funder

BATCH = 5_000

STAGING_DDL = """
CREATE UNLOGGED TABLE nih_awards (
    core_num text NOT NULL,
    application_id text NOT NULL,
    fy integer,
    is_subproject boolean NOT NULL,
    total_cost numeric(16,2),
    project_start date,
    project_end date,
    title text,
    activity text,
    ic_code text,
    ic_name text,
    org_name text,
    org_name_normalized text,
    org_city text,
    org_country text,
    org_ipf text
)
"""


def _chunks(rows: Iterator[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    while True:
        chunk = list(islice(rows, size))
        if not chunk:
            return
        yield chunk


def stage_year(session: Session, path, stats: RunStats) -> None:
    """Stream one fiscal year's CSV into the staging table."""
    columns = (
        "core_num, application_id, fy, is_subproject, total_cost, project_start, "
        "project_end, title, activity, ic_code, ic_name, org_name, "
        "org_name_normalized, org_city, org_country, org_ipf"
    )
    placeholders = (
        ":core_num, :application_id, :fy, :is_subproject, :total_cost, :project_start, "
        ":project_end, :title, :activity, :ic_code, :ic_name, :org_name, "
        ":org_name_normalized, :org_city, :org_country, :org_ipf"
    )
    statement = text(f"INSERT INTO nih_awards ({columns}) VALUES ({placeholders})")
    for chunk in _chunks(parse.parse_awards(path), BATCH):
        rows = [
            {
                "core_num": row["core_num"],
                "application_id": row["application_id"],
                "fy": row["fy"],
                "is_subproject": row["is_subproject"],
                # A sub-project row carries its share in its own column;
                # the core row already includes it (convention ②).
                "total_cost": row["total_cost"],
                "project_start": row["project_start"],
                "project_end": row["project_end"],
                "title": row["title"],
                "activity": row["activity"],
                "ic_code": row["ic_code"],
                "ic_name": row["ic_name"],
                "org_name": row["org_name"],
                # One normalizer for the whole product: the dedup's, run
                # here while streaming (there is no SQL twin to drift from).
                "org_name_normalized": normalize_name(row["org_name"]),
                "org_city": row["org_city"],
                "org_country": row["org_country"],
                "org_ipf": row["org_ipf"],
            }
            for row in chunk
        ]
        session.execute(statement, rows)
        stats.add("award_years", len(rows))
        session.commit()


def _seed_programmes(session: Session, funder_id: int, stats: RunStats) -> None:
    """One programme per awarding institute (founder-validated choice)."""
    session.execute(
        text("""
        INSERT INTO programmes (funder_id, code, name)
        SELECT DISTINCT :funder, ic_code, max(ic_name)
        FROM nih_awards WHERE ic_code IS NOT NULL
        GROUP BY ic_code
        ON CONFLICT (funder_id, code) DO UPDATE SET name = excluded.name
        """),
        {"funder": funder_id},
    )
    count = session.execute(
        text("SELECT count(*) FROM programmes WHERE funder_id = :f"), {"f": funder_id}
    ).scalar_one()
    stats.add("programmes", count)
    session.commit()


def _fold_projects(session: Session, funder_id: int, stats: RunStats) -> None:
    """THE convention, in one statement (registry, 2026-08-03).

    One row per CORE_PROJECT_NUM: the amount is the SUM of its yearly
    slices, the dates are the real span, the fiscal-year detail is kept
    in `raw`, and the EUR figure converts at the ECB annual rate of the
    START YEAR — native USD preserved beside it."""
    result = session.execute(
        text("""
        WITH folded AS (
            SELECT core_num,
                   sum(total_cost) FILTER (WHERE NOT is_subproject) AS amount,
                   min(project_start) AS start_date,
                   max(project_end) AS end_date,
                   (array_agg(title ORDER BY fy DESC NULLS LAST))[1] AS title,
                   (array_agg(activity ORDER BY fy DESC NULLS LAST))[1] AS activity,
                   (array_agg(ic_code ORDER BY fy DESC NULLS LAST))[1] AS ic_code,
                   array_agg(DISTINCT fy) AS fiscal_years,
                   count(*) AS award_years
            FROM nih_awards
            GROUP BY core_num
        )
        INSERT INTO projects (
            source, source_id, title, title_lang, start_date, end_date,
            funding_amount, funding_currency, funding_amount_eur,
            funder_id, programme_id, url, raw, status
        )
        SELECT :source, f.core_num, coalesce(f.title, f.core_num), 'en',
               f.start_date, f.end_date,
               f.amount, 'USD',
               CASE WHEN f.amount IS NOT NULL AND r.rate_to_eur IS NOT NULL
                    THEN round(f.amount / r.rate_to_eur, 2) END,
               :funder, p.id,
               'https://reporter.nih.gov/project-details/' || f.core_num,
               jsonb_build_object(
                   'activity', f.activity,
                   'fiscal_years', to_jsonb(f.fiscal_years),
                   'award_years', f.award_years,
                   'eur_rate_year', extract(year FROM f.start_date),
                   'eur_rate', r.rate_to_eur
               ),
               NULL
        FROM folded f
        LEFT JOIN programmes p ON p.funder_id = :funder AND p.code = f.ic_code
        LEFT JOIN exchange_rates r
               ON r.currency = 'USD' AND r.year = extract(year FROM f.start_date)::int
        ON CONFLICT (source, source_id) DO UPDATE SET
            title = excluded.title,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            funding_amount = excluded.funding_amount,
            funding_currency = excluded.funding_currency,
            funding_amount_eur = excluded.funding_amount_eur,
            programme_id = excluded.programme_id,
            url = excluded.url,
            raw = excluded.raw,
            last_seen_at = now()
        """),
        {"source": SOURCE, "funder": funder_id},
    )
    stats.add("projects", result.rowcount or 0)
    session.commit()


def _fold_organisations(session: Session, stats: RunStats) -> None:
    """Awardee organisations, then one participation per project.

    RePORTER names ONE awardee per award-year: the participation role is
    `coordinator` — honest, and consistent with how CORDIS marks the
    project's holder. Country names are resolved through the shared
    referential; the IPF code is kept as an identifier (the US bridge,
    like the SIREN for France)."""
    # Country names → ISO codes, resolved in Python (the referential
    # knows English and French names) and applied as a small map.
    names = [
        row[0]
        for row in session.execute(
            text("SELECT DISTINCT org_country FROM nih_awards WHERE org_country IS NOT NULL")
        )
    ]
    mapping = [{"raw": name, "code": resolve_country(name)} for name in names]
    unresolved = [entry["raw"] for entry in mapping if entry["code"] is None]
    if unresolved:
        stats.add("country_unresolved", len(unresolved))
    # A staging table, NOT a TEMP one: the statements below commit, and
    # ON COMMIT DROP would take the map with them (real-run finding).
    session.execute(text("DROP TABLE IF EXISTS nih_countries"))
    session.execute(text("CREATE UNLOGGED TABLE nih_countries (raw text, code text)"))
    if mapping:
        session.execute(
            text("INSERT INTO nih_countries (raw, code) VALUES (:raw, :code)"),
            [entry for entry in mapping if entry["code"]],
        )

    session.execute(
        text("""
        WITH latest AS (
            SELECT DISTINCT ON (core_num) core_num, org_name, org_name_normalized,
                   org_city, org_country, org_ipf
            FROM nih_awards
            WHERE org_name IS NOT NULL AND org_name_normalized IS NOT NULL
            ORDER BY core_num, fy DESC NULLS LAST
        )
        INSERT INTO organisations (name, name_normalized, country_code, city)
        SELECT DISTINCT ON (l.org_name_normalized, c.code)
               l.org_name, l.org_name_normalized, c.code, l.org_city
        FROM latest l LEFT JOIN nih_countries c ON c.raw = l.org_country
        WHERE NOT EXISTS (
            SELECT 1 FROM organisations o
            WHERE o.name_normalized = l.org_name_normalized
              AND o.country_code IS NOT DISTINCT FROM c.code
        )
        """)
    )
    session.commit()

    result = session.execute(
        text("""
        WITH latest AS (
            SELECT DISTINCT ON (core_num) core_num, org_name_normalized, org_country
            FROM nih_awards
            WHERE org_name IS NOT NULL AND org_name_normalized IS NOT NULL
            ORDER BY core_num, fy DESC NULLS LAST
        )
        INSERT INTO participations (
            project_id, organisation_id, role, country_code,
            amount, currency, amount_eur, order_index, source, source_uid
        )
        SELECT pr.id, o.id, 'coordinator', o.country_code,
               pr.funding_amount, pr.funding_currency, pr.funding_amount_eur, 0,
               :source, l.core_num
        FROM latest l
        JOIN projects pr ON pr.source = :source AND pr.source_id = l.core_num
        LEFT JOIN nih_countries c ON c.raw = l.org_country
        JOIN organisations o
          ON o.name_normalized = l.org_name_normalized
         AND o.country_code IS NOT DISTINCT FROM c.code
        ON CONFLICT (source, source_uid) DO UPDATE SET
            organisation_id = excluded.organisation_id,
            amount = excluded.amount,
            amount_eur = excluded.amount_eur,
            country_code = excluded.country_code,
            last_seen_at = now()
        """),
        {"source": SOURCE},
    )
    stats.add("participations", result.rowcount or 0)

    session.execute(
        text("""
        WITH latest AS (
            SELECT DISTINCT ON (core_num) core_num, org_name_normalized, org_country, org_ipf
            FROM nih_awards
            WHERE org_ipf IS NOT NULL AND org_name_normalized IS NOT NULL
            ORDER BY core_num, fy DESC NULLS LAST
        )
        INSERT INTO organisation_identifiers (organisation_id, scheme, value)
        SELECT DISTINCT o.id, 'ipf', l.org_ipf
        FROM latest l
        LEFT JOIN nih_countries c ON c.raw = l.org_country
        JOIN organisations o
          ON o.name_normalized = l.org_name_normalized
         AND o.country_code IS NOT DISTINCT FROM c.code
        ON CONFLICT (scheme, value) DO NOTHING
        """)
    )
    session.commit()


def load_abstracts(session: Session, stats: RunStats, force: bool) -> None:
    """Stream every year's abstracts, keeping the one attached to each
    core project's most recent award-year (the abstract the reader
    expects). Memory holds the application→core map, never the texts."""
    wanted: dict[str, str] = {
        row[0]: row[1]
        for row in session.execute(
            text("""
            SELECT DISTINCT ON (core_num) application_id, core_num
            FROM nih_awards ORDER BY core_num, fy DESC NULLS LAST
            """)
        )
    }
    statement = text("""
        INSERT INTO project_texts (project_id, lang, title, abstract)
        SELECT p.id, 'en', p.title, :abstract
        FROM projects p WHERE p.source = :source AND p.source_id = :core
        ON CONFLICT (project_id, lang) DO UPDATE SET
            abstract = excluded.abstract, title = excluded.title
    """)
    for fy in fiscal_years():
        try:
            path, _ = cached_download(
                ABSTRACTS_URL.format(fy=fy), f"{SOURCE}-abstracts-{fy}.zip", force=force
            )
        except Exception as error:  # noqa: BLE001 — must not sink the load
            stats.add("abstracts_year_missing")
            print(f"    abstracts FY{fy}: {type(error).__name__}: {error}", flush=True)
            continue
        buffer: list[dict[str, str]] = []
        for application_id, abstract in parse.parse_abstracts(path):
            core = wanted.get(application_id)
            if core is None:
                continue
            buffer.append({"core": core, "abstract": abstract, "source": SOURCE})
            if len(buffer) >= 1_000:
                session.execute(statement, buffer)
                stats.add("abstracts", len(buffer))
                session.commit()
                buffer = []
        if buffer:
            session.execute(statement, buffer)
            stats.add("abstracts", len(buffer))
            session.commit()

    # The project's own abstract column mirrors the English text, as for
    # every other source (the search reads project_texts).
    session.execute(
        text("""
        UPDATE projects p SET abstract = t.abstract, abstract_lang = 'en'
        FROM project_texts t
        WHERE t.project_id = p.id AND t.lang = 'en' AND p.source = :source
          AND p.abstract IS DISTINCT FROM t.abstract
        """),
        {"source": SOURCE},
    )
    session.commit()


def run(force: bool = False) -> dict[str, int]:
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            funder = session.scalar(select(Funder).where(Funder.code == SOURCE))
            if funder is None:
                raise RuntimeError(f"Funder '{SOURCE}' missing — run `orion-ingest reference`")

            session.execute(text("DROP TABLE IF EXISTS nih_awards"))
            session.execute(text(STAGING_DDL))
            session.commit()

            for fy in fiscal_years():
                try:
                    path, changed = cached_download(
                        PROJECTS_URL.format(fy=fy), f"{SOURCE}-projects-{fy}.zip", force=force
                    )
                except Exception as error:  # noqa: BLE001 — reported, not fatal
                    stats.add("year_missing")
                    print(f"    FY{fy}: {type(error).__name__}: {error}", flush=True)
                    continue
                stats.add("download_changed" if changed else "download_cached")
                stage_year(session, path, stats)

            session.execute(text("CREATE INDEX ON nih_awards (core_num)"))
            session.commit()

            _seed_programmes(session, funder.id, stats)
            _fold_projects(session, funder.id, stats)
            _fold_organisations(session, stats)
            load_abstracts(session, stats, force)
        finally:
            # Roll back first: a failed statement poisons the transaction,
            # and a cleanup running inside it would mask the real error.
            session.rollback()
            session.execute(text("DROP TABLE IF EXISTS nih_countries"))
            session.execute(text("DROP TABLE IF EXISTS nih_awards"))
            session.commit()
            session.close()
    return stats.counts
