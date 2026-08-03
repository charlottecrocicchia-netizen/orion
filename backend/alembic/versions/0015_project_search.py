"""project_search: the condensed search matter (chantier performance, O3a).

Spike measured 2026-08-03 on 464 727 projects, caches warm on both
sides, terms alternated:

    term         project_texts   project_search   gain
    turbine          209 ms           66 ms       ×3.2
    microbiome       469 ms           77 ms       ×6.1
    vaccine        1 275 ms          119 ms      ×10.7

The founder's adoption criterion (≥ ×5) is met on the median, and the
gain grows with how common the term is — the queries that hurt gain the
most. Recall measured at 98.4 % (103 841 → 102 216 matches on
"protein"): the accepted price, stated in the registry.

Size: 1 331 MB against 2 542 MB. That ratio is the real reason to keep
it beyond today's budget — at wave-1's tripled corpus the full texts
(~7.6 GB) stop fitting in RAM while the condensed matter (~4 GB) still
does.

A materialised view, not a hand-filled table: it inherits the chain's
REFRESH and the equality test that guards every aggregate.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Title carries weight A, the abstract's opening weight B — the same
# grammar as project_texts, over 2 800 characters (~400 words).
ABSTRACT_CHARS = 2800


def upgrade() -> None:
    # NEUTRALISED. 0016 drops this view immediately after; leaving the
    # creation live made every fresh database (and the VPS on day one)
    # spend ~2,6 minutes building 1,3 GB only to delete it. The SQL below
    # is kept, unexecuted, as the record of what was measured — the
    # numbers in this docstring are the point, not the object.
    return

    op.execute(f"""
        CREATE MATERIALIZED VIEW project_search AS
        SELECT t.project_id,
               t.lang,
               setweight(
                   to_tsvector(
                       CASE WHEN t.lang = 'fr' THEN 'orion_fr'::regconfig
                            ELSE 'orion_en'::regconfig END,
                       coalesce(t.title, '')),
                   'A')
               || setweight(
                   to_tsvector(
                       CASE WHEN t.lang = 'fr' THEN 'orion_fr'::regconfig
                            ELSE 'orion_en'::regconfig END,
                       coalesce(substring(t.abstract from 1 for {ABSTRACT_CHARS}), '')),
                   'B') AS search_vector
        FROM project_texts t
    """)
    op.execute("CREATE UNIQUE INDEX ix_project_search_pk ON project_search (project_id, lang)")
    op.execute("CREATE INDEX ix_project_search_vector ON project_search USING gin (search_vector)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS project_search")
