"""Triple the corpus in place, to prove the budgets hold at wave-1 scale.

The instruction promises the 300 ms targets survive the tripling wave 1
will bring. Arguing it from complexity is not the same as measuring it,
so this script duplicates projects, participations and texts twice over
(×3 total) in a THROWAWAY database, refreshes the aggregates, and hands
the bench a corpus of the size we expect to reach.

    uv run python scripts/triple_corpus.py --rounds 1   # ×2
    uv run python scripts/bench_api.py --passes 5 --seed 1
    uv run python scripts/triple_corpus.py --cleanup    # back to normal

Copies are marked `x3-` on their source, so --cleanup removes exactly
what this script added and nothing else. Rounds are limited by disk:
one round doubles the corpus, two triple it.
"""

import sys
import time

from sqlalchemy import text

from orion.core.db import SessionLocal


def duplicate_round(session, suffix: str) -> dict[str, int]:
    """One duplication round: every project (and its participations and
    texts) gets a copy under a new source_id, keeping every foreign key
    consistent so the aggregates stay computable."""
    counts: dict[str, int] = {}
    session.execute(
        text("""
        CREATE TEMPORARY TABLE _dup (old_id integer PRIMARY KEY, new_id integer)
        ON COMMIT DROP
        """)
    )
    inserted = session.execute(
        text("""
        WITH src AS (SELECT * FROM projects WHERE source NOT LIKE 'x3-%'),
        ins AS (
            INSERT INTO projects (
                source, source_id, acronym, title, title_lang, abstract, abstract_lang,
                status, start_date, end_date, total_cost, total_cost_currency,
                funding_amount, funding_currency, funding_amount_eur,
                funder_id, programme_id, call_id, url, raw
            )
            SELECT 'x3-' || source, :suffix || '-' || source_id, acronym, title, title_lang,
                   abstract, abstract_lang, status, start_date, end_date, total_cost,
                   total_cost_currency, funding_amount, funding_currency, funding_amount_eur,
                   funder_id, programme_id, call_id, url, raw
            FROM src
            RETURNING id, source_id
        )
        INSERT INTO _dup (old_id, new_id)
        SELECT s.id, i.id FROM ins i
        JOIN src s ON (:suffix || '-' || s.source_id) = i.source_id
        """),
        {"suffix": suffix},
    )
    counts["projects"] = inserted.rowcount or 0

    result = session.execute(
        text("""
        INSERT INTO participations (
            project_id, organisation_id, role, country_code,
            amount, currency, amount_eur, order_index, source, source_uid
        )
        SELECT d.new_id, pa.organisation_id, pa.role, pa.country_code,
               pa.amount, pa.currency, pa.amount_eur, pa.order_index,
               'x3-' || pa.source, :suffix || '-' || pa.source_uid
        FROM participations pa JOIN _dup d ON d.old_id = pa.project_id
        """),
        {"suffix": suffix},
    )
    counts["participations"] = result.rowcount or 0

    result = session.execute(
        text("""
        INSERT INTO project_texts (project_id, lang, title, abstract)
        SELECT d.new_id, t.lang, t.title, t.abstract
        FROM project_texts t JOIN _dup d ON d.old_id = t.project_id
        """)
    )
    counts["texts"] = result.rowcount or 0
    session.commit()
    return counts


def cleanup(session) -> None:
    """Remove every synthetic copy — the marker makes it exact."""
    for table, column in (
        ("participations", "source"),
        ("project_texts", None),
        ("projects", "source"),
    ):
        if column is None:
            session.execute(
                text("""
                DELETE FROM project_texts t USING projects p
                WHERE p.id = t.project_id AND p.source LIKE 'x3-%'
                """)
            )
        else:
            session.execute(text(f"DELETE FROM {table} WHERE {column} LIKE 'x3-%'"))
        session.commit()


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(prog="triple_corpus")
    parser.add_argument("--rounds", type=int, default=2, help="1 doubles, 2 triples")
    parser.add_argument("--cleanup", action="store_true", help="remove the copies and exit")
    args = parser.parse_args()

    session = SessionLocal()
    if args.cleanup:
        cleanup(session)
        remaining = session.execute(text("SELECT count(*) FROM projects")).scalar_one()
        print(f"copies removed — projects: {remaining:,}")
        session.close()
        return 0
    try:
        before = session.execute(text("SELECT count(*) FROM projects")).scalar_one()
        print(f"projects before: {before:,}")
        for suffix in ("a", "b")[: args.rounds]:
            started = time.perf_counter()
            counts = duplicate_round(session, suffix)
            print(
                f"round {suffix}: +{counts['projects']:,} projects, "
                f"+{counts['participations']:,} participations, "
                f"+{counts['texts']:,} texts "
                f"({time.perf_counter() - started:.0f}s)"
            )
        after = session.execute(text("SELECT count(*) FROM projects")).scalar_one()
        print(f"projects after: {after:,} (×{after / before:.1f})")

        print("refreshing aggregates and statistics…")
        session.close()
        from orion.ingest.dedup.merge import refresh_organisation_stats

        refresh_organisation_stats()
        session = SessionLocal()
        session.execute(text("ANALYZE"))
        session.commit()
        print("done.")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
