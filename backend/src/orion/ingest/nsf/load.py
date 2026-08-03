"""Load NSF awards (vague 1, étape 2).

Two conventions meet here, and they fold along DIFFERENT axes:

  ① the registry's transverse convention folds YEARS — an award's
    per-fiscal-year obligations are summed into one amount, the calendar
    start date is the time axis, the detail stays in `raw`;

  ② the NSF sibling extension (founder-validated 2026-08-03) folds
    PARTNERS — NSF splits one project across N institutions into N
    awards titled `Collaborative Research: <same title>`. Left alone
    they would be N projects with no collaboration between them. Folded
    under four guards, they become one project with N participations —
    the first American collaboration Orion can show.

Memory stays flat: 22 fiscal years stream through a staging table and
the folds happen in SQL, where the rows already are."""

import json
from collections.abc import Iterator
from itertools import islice
from typing import Any

import httpx
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.download import cached_download
from orion.ingest.nsf import parse
from orion.ingest.nsf.config import (
    AWARD_URL,
    CATALOGUE_URL,
    FIRST_FY,
    MAX_SIBLING_SPREAD_DAYS,
    SOURCE,
)
from orion.ingest.reference import resolve_country
from orion.ingest.runlog import RunStats, record_run
from orion.models import Funder

BATCH = 2_000

STAGING_DDL = """
CREATE UNLOGGED TABLE nsf_awards (
    awd_id text NOT NULL,
    fy integer NOT NULL,
    -- The project this award belongs to: its own id, or the shared key
    -- of its collaborative siblings once the fold has run.
    project_key text NOT NULL,
    collab_key text,
    folded boolean NOT NULL DEFAULT false,
    title text,
    title_clean text,
    abstract text,
    amount numeric(16,2),
    start_date date,
    end_date date,
    instrument text,
    tran_type text,
    cfda text,
    div_code text,
    div_name text,
    dir_name text,
    slices jsonb,
    org_name text,
    org_name_normalized text,
    org_city text,
    org_country text,
    org_uei text,
    org_parent_uei text
)
"""


def select_years(payload: dict[str, Any]) -> list[tuple[int, str]]:
    """The fiscal years inside our window, in order.

    The catalogue also carries `Historical.zip` (pre-1976, no abstracts),
    a `1900` bucket for undated awards and a `timestamp.txt`: the
    announced scope is the loaded scope (convention ⑤), so anything that
    is not a fiscal year in the window is left where it is."""
    years: list[tuple[int, str]] = []
    for entry in payload.get("files") or []:
        stem = str(entry.get("fileName") or "").removesuffix(".zip")
        url = entry.get("downloadUrl")
        if not stem.isdigit() or not url:
            continue
        year = int(stem)
        if year >= FIRST_FY:
            years.append((year, url))
    return sorted(years)


def catalogue() -> list[tuple[int, str]]:
    """Ask the source which years it publishes and where.

    Presigned links are resolved here at EVERY run — never hardcoded,
    whatever the API claims about their lifetime."""
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        response = client.get(CATALOGUE_URL, headers={"Accept": "application/json"})
        response.raise_for_status()
        return select_years(response.json())


def _chunks(rows: Iterator[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    while True:
        chunk = list(islice(rows, size))
        if not chunk:
            return
        yield chunk


def stage_year(session: Session, path, fy: int, stats: RunStats) -> None:
    """Stream one fiscal year's archive into the staging table."""
    columns = (
        "awd_id, fy, project_key, collab_key, title, title_clean, abstract, amount, "
        "start_date, end_date, instrument, tran_type, cfda, div_code, div_name, "
        "dir_name, slices, org_name, org_name_normalized, org_city, org_country, "
        "org_uei, org_parent_uei"
    )
    placeholders = (
        ":awd_id, :fy, :awd_id, :collab_key, :title, :title_clean, :abstract, :amount, "
        ":start_date, :end_date, :instrument, :tran_type, :cfda, :div_code, :div_name, "
        ":dir_name, cast(:slices as jsonb), :org_name, :org_name_normalized, :org_city, "
        ":org_country, :org_uei, :org_parent_uei"
    )
    statement = text(f"INSERT INTO nsf_awards ({columns}) VALUES ({placeholders})")

    for chunk in _chunks(parse.parse_awards(path), BATCH):
        rows = []
        for row in chunk:
            entry = dict(row)
            entry["fy"] = fy
            entry["slices"] = json.dumps(entry.pop("slices"))
            # One normalizer for the whole product: the dedup's.
            entry["org_name_normalized"] = (
                normalize_name(entry["org_name"]) if entry["org_name"] else None
            )
            rows.append(entry)
        session.execute(statement, rows)
        stats.add("awards", len(rows))
        session.commit()


def apply_fold(session: Session, stats: RunStats) -> None:
    """The sibling fold, under its four founder-validated guards.

    A group is folded only if ALL of them hold: NSF's explicit
    collaborative prefix, the same fiscal year, an identical normalised
    title, and institutions that are all distinct and all named. A fifth
    net rejects groups whose start dates stray more than a year apart.
    Everything the guards refuse stays a project of its own, and the
    count of refusals is journalled rather than hidden."""
    # Distinctness is measured on (normalised name, country) — the very
    # key the participation join uses. Measuring it on the UEI instead
    # would be LOOSER than the join and let two siblings land on one
    # organisation, double-counting it inside a single project.
    candidates = """
        SELECT fy, collab_key,
               count(*) AS awards,
               count(DISTINCT (org_name_normalized, org_country)) AS institutions,
               count(*) FILTER (WHERE org_name_normalized IS NULL) AS anonymous,
               coalesce(max(start_date) - min(start_date), 0) AS spread
        FROM nsf_awards
        WHERE collab_key IS NOT NULL
        GROUP BY fy, collab_key
        HAVING count(*) > 1
    """
    kept = f"""
        SELECT * FROM ({candidates}) c
        WHERE c.institutions = c.awards AND c.anonymous = 0
          AND c.spread <= {MAX_SIBLING_SPREAD_DAYS}
    """
    refused = session.execute(
        text(
            f"SELECT count(*) FROM ({candidates}) c WHERE NOT (c.institutions = c.awards "
            f"AND c.anonymous = 0 AND c.spread <= {MAX_SIBLING_SPREAD_DAYS})"
        )
    ).scalar_one()
    if refused:
        stats.add("fold_refused_groups", refused)

    result = session.execute(
        text(f"""
        UPDATE nsf_awards a
           SET project_key = 'c-' || k.fy || '-' || left(md5(k.collab_key), 16),
               folded = true
        FROM ({kept}) k
        WHERE a.fy = k.fy AND a.collab_key = k.collab_key
        """)
    )
    stats.add("folded_awards", result.rowcount or 0)
    groups = session.execute(
        text("SELECT count(DISTINCT project_key) FROM nsf_awards WHERE folded")
    ).scalar_one()
    stats.add("folded_projects", groups)
    session.commit()


def _seed_programmes(session: Session, funder_id: int, stats: RunStats) -> None:
    """One programme per NSF division (founder-validated ④)."""
    session.execute(
        text("""
        INSERT INTO programmes (funder_id, code, name)
        SELECT :funder, div_code, max(div_name)
        FROM nsf_awards WHERE div_code IS NOT NULL
        GROUP BY div_code
        ON CONFLICT (funder_id, code) DO UPDATE SET name = excluded.name
        """),
        {"funder": funder_id},
    )
    stats.add(
        "programmes",
        session.execute(
            text("SELECT count(*) FROM programmes WHERE funder_id = :f"), {"f": funder_id}
        ).scalar_one(),
    )
    session.commit()


def fold_projects(session: Session, funder_id: int, stats: RunStats) -> None:
    """One row per project — a lone award, or a folded sibling group.

    The amount is the sum of the members' obligations, the span is their
    real span, and the EUR figure converts at the ECB annual rate of the
    START YEAR with the native USD kept beside it (convention ④)."""
    result = session.execute(
        text("""
        WITH folded AS (
            SELECT project_key,
                   sum(amount) AS amount,
                   min(start_date) AS start_date,
                   max(end_date) AS end_date,
                   -- The member with the fullest abstract carries both
                   -- title and text: siblings publish near-identical
                   -- ones. Writing the abstract HERE (rather than
                   -- mirroring it afterwards) spares a second pass over
                   -- 235 000 rows — measured at 4 minutes on the first
                   -- real run.
                   (array_agg(title_clean ORDER BY length(coalesce(abstract, '')) DESC, awd_id))[1]
                       AS title,
                   (array_agg(abstract ORDER BY length(coalesce(abstract, '')) DESC, awd_id))[1]
                       AS abstract,
                   (array_agg(div_code ORDER BY awd_id))[1] AS div_code,
                   (array_agg(div_name ORDER BY awd_id))[1] AS div_name,
                   (array_agg(dir_name ORDER BY awd_id))[1] AS dir_name,
                   (array_agg(instrument ORDER BY awd_id))[1] AS instrument,
                   (array_agg(tran_type ORDER BY awd_id))[1] AS tran_type,
                   (array_agg(cfda ORDER BY awd_id))[1] AS cfda,
                   (array_agg(awd_id ORDER BY awd_id))[1] AS first_award,
                   array_agg(awd_id ORDER BY awd_id) AS awards,
                   bool_or(folded) AS collaborative,
                   jsonb_object_agg(awd_id, coalesce(slices, '[]'::jsonb)) AS fiscal_years
            FROM nsf_awards
            GROUP BY project_key
        )
        INSERT INTO projects (
            source, source_id, title, title_lang, abstract, abstract_lang,
            start_date, end_date,
            funding_amount, funding_currency, funding_amount_eur,
            funder_id, programme_id, url, raw, status
        )
        SELECT :source, f.project_key, coalesce(f.title, f.project_key), 'en',
               f.abstract, CASE WHEN f.abstract IS NOT NULL THEN 'en' END,
               f.start_date, f.end_date,
               f.amount, 'USD',
               CASE WHEN f.amount IS NOT NULL AND r.rate_to_eur IS NOT NULL
                    THEN round(f.amount / r.rate_to_eur, 2) END,
               :funder, p.id,
               replace(:award_url, '{award}', f.first_award),
               jsonb_build_object(
                   'awards', to_jsonb(f.awards),
                   'collaborative', f.collaborative,
                   'instrument', f.instrument,
                   'transaction_type', f.tran_type,
                   'cfda', f.cfda,
                   'directorate', f.dir_name,
                   'division', f.div_name,
                   'fiscal_years', f.fiscal_years,
                   'eur_rate_year', extract(year FROM f.start_date),
                   'eur_rate', r.rate_to_eur
               ),
               NULL
        FROM folded f
        LEFT JOIN programmes p ON p.funder_id = :funder AND p.code = f.div_code
        LEFT JOIN exchange_rates r
               ON r.currency = 'USD' AND r.year = extract(year FROM f.start_date)::int
        ON CONFLICT (source, source_id) DO UPDATE SET
            title = excluded.title,
            abstract = excluded.abstract,
            abstract_lang = excluded.abstract_lang,
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
        {"source": SOURCE, "funder": funder_id, "award_url": AWARD_URL},
    )
    stats.add("projects", result.rowcount or 0)
    session.commit()


def _stage_countries(session: Session, stats: RunStats) -> None:
    """Country NAMES → ISO codes, resolved by the shared referential."""
    names = [
        row[0]
        for row in session.execute(
            text("SELECT DISTINCT org_country FROM nsf_awards WHERE org_country IS NOT NULL")
        )
    ]
    mapping = [{"raw": name, "code": resolve_country(name)} for name in names]
    unresolved = [entry["raw"] for entry in mapping if entry["code"] is None]
    if unresolved:
        stats.add("country_unresolved", len(unresolved))
        print(f"    countries left unresolved: {', '.join(sorted(unresolved))}", flush=True)
    # A staging table, NOT a TEMP one: the statements below commit, and
    # ON COMMIT DROP would take the map with them (NIH run finding).
    session.execute(text("DROP TABLE IF EXISTS nsf_countries"))
    session.execute(text("CREATE UNLOGGED TABLE nsf_countries (raw text, code text)"))
    resolved = [entry for entry in mapping if entry["code"]]
    if resolved:
        session.execute(
            text("INSERT INTO nsf_countries (raw, code) VALUES (:raw, :code)"), resolved
        )
    session.commit()


def load_organisations(session: Session, stats: RunStats) -> None:
    """Awardee institutions, then ONE participation per member award.

    Role: a lone award has a sole recipient and reads `coordinator`; a
    folded project's members all read `partner`. NSF does not publish
    which sibling leads, and Orion never invents a hierarchy — the
    choice is stated in the registry."""
    _stage_countries(session, stats)

    session.execute(
        text("""
        WITH named AS (
            SELECT DISTINCT ON (a.org_name_normalized, c.code)
                   a.org_name, a.org_name_normalized, c.code AS country_code, a.org_city
            FROM nsf_awards a
            LEFT JOIN nsf_countries c ON c.raw = a.org_country
            WHERE a.org_name IS NOT NULL AND a.org_name_normalized IS NOT NULL
            ORDER BY a.org_name_normalized, c.code, a.awd_id DESC
        )
        INSERT INTO organisations (name, name_normalized, country_code, city)
        SELECT n.org_name, n.org_name_normalized, n.country_code, n.org_city
        FROM named n
        WHERE NOT EXISTS (
            SELECT 1 FROM organisations o
            WHERE o.name_normalized = n.org_name_normalized
              AND o.country_code IS NOT DISTINCT FROM n.country_code
        )
        """)
    )
    session.commit()

    result = session.execute(
        text("""
        -- Only the five columns the insert needs: the window functions
        -- sort this set, and `a.*` would drag every abstract through it
        -- — 260 000 rows at ~600 bytes instead of ~60 (run finding,
        -- 2026-08-03: five minutes of external merge sort).
        WITH member AS (
            SELECT a.awd_id, a.project_key, a.amount, a.org_name_normalized, a.org_country,
                   count(*) OVER (PARTITION BY a.project_key) AS members,
                   row_number() OVER (PARTITION BY a.project_key ORDER BY a.awd_id) - 1 AS position
            FROM nsf_awards a
            WHERE a.org_name_normalized IS NOT NULL
        )
        INSERT INTO participations (
            project_id, organisation_id, role, country_code,
            amount, currency, amount_eur, order_index, source, source_uid
        )
        -- DISTINCT ON the award: (name_normalized, country) can match
        -- SEVERAL canonical organisations — the dedup keeps entities
        -- apart when their identifiers differ. Without this, one award
        -- would insert twice under the same source_uid (NIH lesson).
        SELECT DISTINCT ON (m.awd_id)
               pr.id, o.id,
               CASE WHEN m.members > 1 THEN 'partner' ELSE 'coordinator' END,
               o.country_code,
               m.amount, 'USD',
               CASE WHEN m.amount IS NOT NULL AND r.rate_to_eur IS NOT NULL
                    THEN round(m.amount / r.rate_to_eur, 2) END,
               m.position, :source, m.awd_id
        FROM member m
        JOIN projects pr ON pr.source = :source AND pr.source_id = m.project_key
        LEFT JOIN nsf_countries c ON c.raw = m.org_country
        JOIN organisations o
          ON o.name_normalized = m.org_name_normalized
         AND o.country_code IS NOT DISTINCT FROM c.code
        -- The project's rate, not the member's: a project's euros must
        -- equal the sum of its participations' euros.
        LEFT JOIN exchange_rates r
               ON r.currency = 'USD' AND r.year = extract(year FROM pr.start_date)::int
        ORDER BY m.awd_id, o.id
        ON CONFLICT (source, source_uid) DO UPDATE SET
            project_id = excluded.project_id,
            organisation_id = excluded.organisation_id,
            role = excluded.role,
            country_code = excluded.country_code,
            amount = excluded.amount,
            amount_eur = excluded.amount_eur,
            order_index = excluded.order_index,
            last_seen_at = now()
        """),
        {"source": SOURCE},
    )
    stats.add("participations", result.rowcount or 0)
    session.commit()


def load_bridges(session: Session, stats: RunStats) -> None:
    """UEI identity, captured while the data passes through.

    The ANR lesson: capture the identifier the day you hold it. NSF is
    the first source to publish American UEIs AND their parent UEI —
    a consolidation link the groups layer has no other way to see for
    US academia, where GLEIF is thin. The pairs are stored raw; the
    groups wave wires them into memberships.

    Shape guard, as for the LEIs: a UEI is twelve alphanumerics. NSF
    published exactly one 16-character value in the three years measured
    (`N49DHX6D3FH60018`, a UEI with a sub-entity suffix). It is REFUSED
    and counted, not widened into the column: a bridge table full of
    identifiers that can never match anything is worse than one that is
    clean about what it dropped."""
    shape = "~ '^[A-Z0-9]{12}$'"
    malformed = session.execute(
        text(f"""
        SELECT count(DISTINCT org_uei) FROM nsf_awards
        WHERE org_uei IS NOT NULL AND NOT (org_uei {shape})
        """)
    ).scalar_one()
    if malformed:
        stats.add("uei_malformed", malformed)

    result = session.execute(
        text(f"""
        WITH bearer AS (
            SELECT DISTINCT ON (a.org_uei)
                   a.org_uei, a.org_name_normalized, c.code AS country_code
            FROM nsf_awards a
            LEFT JOIN nsf_countries c ON c.raw = a.org_country
            WHERE a.org_uei {shape} AND a.org_name_normalized IS NOT NULL
            ORDER BY a.org_uei, a.awd_id DESC
        )
        INSERT INTO organisation_identifiers (organisation_id, scheme, value)
        SELECT DISTINCT ON (b.org_uei) o.id, 'uei', b.org_uei
        FROM bearer b
        JOIN organisations o
          ON o.name_normalized = b.org_name_normalized
         AND o.country_code IS NOT DISTINCT FROM b.country_code
        ORDER BY b.org_uei, o.id
        ON CONFLICT (scheme, value) DO NOTHING
        """)
    )
    stats.add("uei_identifiers", result.rowcount or 0)

    result = session.execute(
        text(f"""
        INSERT INTO uei_links (child_uei, parent_uei, source)
        SELECT DISTINCT a.org_uei, a.org_parent_uei, :source
        FROM nsf_awards a
        WHERE a.org_uei {shape}
          AND a.org_parent_uei {shape}
          AND a.org_parent_uei <> a.org_uei
        ON CONFLICT (child_uei, parent_uei) DO NOTHING
        """),
        {"source": SOURCE},
    )
    stats.add("uei_links", result.rowcount or 0)
    session.commit()


def load_texts(session: Session, stats: RunStats) -> None:
    """The indexed text of each project, read from the project itself.

    The fold already chose the fullest abstract among the siblings and
    wrote it on the project, so there is nothing to sort here — the
    earlier version re-sorted 256 000 staged rows CARRYING their
    abstracts, then mirrored the result back over 235 000 project rows.
    Two heavy passes for a value already in place."""
    result = session.execute(
        text("""
        INSERT INTO project_texts (project_id, lang, title, abstract)
        SELECT p.id, 'en', p.title, p.abstract
        FROM projects p
        WHERE p.source = :source AND p.abstract IS NOT NULL
        ON CONFLICT (project_id, lang) DO UPDATE SET
            title = excluded.title, abstract = excluded.abstract
        """),
        {"source": SOURCE},
    )
    stats.add("texts", result.rowcount or 0)
    session.commit()


def prune_stale(session: Session, stats: RunStats) -> None:
    """Remove what the source no longer publishes.

    Necessary because a project's key can legitimately MOVE: an award
    alone in one run joins a collaborative group in the next, and its
    solitary project must not survive as a ghost. Guarded by the caller,
    which never prunes after a failed year — a missing download would
    otherwise wipe a whole fiscal year."""
    result = session.execute(
        text("""
        DELETE FROM participations pa
        WHERE pa.source = :source
          AND NOT EXISTS (SELECT 1 FROM nsf_awards a WHERE a.awd_id = pa.source_uid)
        """),
        {"source": SOURCE},
    )
    if result.rowcount:
        stats.add("pruned_participations", result.rowcount)
    result = session.execute(
        text("""
        DELETE FROM projects p
        WHERE p.source = :source
          AND NOT EXISTS (SELECT 1 FROM nsf_awards a WHERE a.project_key = p.source_id)
        """),
        {"source": SOURCE},
    )
    if result.rowcount:
        stats.add("pruned_projects", result.rowcount)
    session.commit()


def run(force: bool = False) -> dict[str, int]:
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            funder = session.scalar(select(Funder).where(Funder.code == SOURCE))
            if funder is None:
                raise RuntimeError(f"Funder '{SOURCE}' missing — run `orion-ingest reference`")

            session.execute(text("DROP TABLE IF EXISTS nsf_awards"))
            session.execute(text(STAGING_DDL))
            session.commit()

            years = catalogue()
            stats.add("fiscal_years", len(years))
            for fy, url in years:
                try:
                    path, changed = cached_download(url, f"{SOURCE}-{fy}.zip", force=force)
                except Exception as error:  # noqa: BLE001 — reported, never fatal
                    stats.add("year_missing")
                    print(f"    FY{fy}: {type(error).__name__}: {error}", flush=True)
                    continue
                stats.add("download_changed" if changed else "download_cached")
                stage_year(session, path, fy, stats)

            session.execute(text("CREATE INDEX ON nsf_awards (project_key)"))
            session.execute(text("CREATE INDEX ON nsf_awards (fy, collab_key)"))
            session.execute(text("CREATE INDEX ON nsf_awards (awd_id)"))
            session.execute(text("ANALYZE nsf_awards"))
            session.commit()

            apply_fold(session, stats)
            _seed_programmes(session, funder.id, stats)
            fold_projects(session, funder.id, stats)
            load_organisations(session, stats)
            load_bridges(session, stats)
            load_texts(session, stats)
            if not stats.counts.get("year_missing"):
                prune_stale(session, stats)
            else:
                print("    incomplete run — pruning skipped on purpose", flush=True)
        finally:
            # Roll back first: a failed statement poisons the transaction,
            # and a cleanup running inside it would mask the real error.
            session.rollback()
            session.execute(text("DROP TABLE IF EXISTS nsf_countries"))
            session.execute(text("DROP TABLE IF EXISTS nsf_awards"))
            session.commit()
            session.close()
    return stats.counts
