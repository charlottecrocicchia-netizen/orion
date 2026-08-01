"""Merge ANR programme duplicates onto canonical codes.

The ANR files vary the case across editions (Blanc/BLANC, LabCom/LABCOM)
and sometimes ship the edition year as the code with the real name aside
(code «2010», name «SATT»). The loader now canonicalizes at ingestion;
this migration repairs rows created before that rule. The ANR referential
is flat (no parents), which makes the merge per (funder, canonical key)
safe against the (funder_id, code) unique constraint.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-01

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(r"""
        CREATE TEMPORARY TABLE _prog_canon ON COMMIT DROP AS
        SELECT p.id, p.funder_id, p.code, p.name,
               upper(trim(CASE WHEN p.code ~ '^\d{4}$'
                                    AND coalesce(trim(p.name), '') <> ''
                               THEN p.name ELSE p.code END)) AS key
        FROM programmes p
        JOIN funders f ON f.id = p.funder_id AND f.code = 'anr'
    """)
    op.execute("""
        CREATE TEMPORARY TABLE _prog_keeper ON COMMIT DROP AS
        SELECT funder_id, key, min(id) AS keeper
        FROM _prog_canon GROUP BY funder_id, key
    """)

    op.execute("""
        UPDATE projects pr SET programme_id = k.keeper
        FROM _prog_canon c
        JOIN _prog_keeper k ON k.funder_id = c.funder_id AND k.key = c.key
        WHERE pr.programme_id = c.id AND c.id <> k.keeper
    """)

    # The most informative label of each group survives on the keeper: an
    # explicit name if any, else a mixed-case code spelling, longest first.
    op.execute("""
        UPDATE programmes p SET name = best.label
        FROM (
            SELECT k.keeper,
                   (array_agg(coalesce(nullif(trim(c.name), ''),
                              CASE WHEN c.code <> upper(c.code) THEN trim(c.code) END)
                    ORDER BY length(coalesce(nullif(trim(c.name), ''), trim(c.code))) DESC)
                   ) AS labels
            FROM _prog_canon c
            JOIN _prog_keeper k ON k.funder_id = c.funder_id AND k.key = c.key
            GROUP BY k.keeper
        ) best_raw,
        LATERAL (SELECT label FROM unnest(best_raw.labels) AS label
                 WHERE label IS NOT NULL LIMIT 1) best
        WHERE p.id = best_raw.keeper
          AND coalesce(trim(p.name), '') = ''
          AND best.label IS NOT NULL
    """)

    op.execute("""
        DELETE FROM programmes p
        USING _prog_canon c, _prog_keeper k
        WHERE p.id = c.id
          AND k.funder_id = c.funder_id AND k.key = c.key
          AND c.id <> k.keeper
    """)

    # Safe rename: one survivor per (funder, key) after the delete.
    op.execute("""
        UPDATE programmes p SET code = c.key
        FROM _prog_canon c
        WHERE p.id = c.id AND p.code <> c.key
    """)


def downgrade() -> None:
    # The merge folds duplicates that carried no extra information; there is
    # nothing meaningful to restore.
    pass
