"""L'index couvrant du nœud pays de la chaîne (B1.1, D-B1 tranché le 2026-08-27).

Le nœud pays du moteur de la chaîne (`/api/chain/country/{code}`)
agrège les participations d'un pays par source, projets DISTINCT
compris. Mesuré sur le corpus complet (B1.1,
docs/conception-b-chaine-argent-public.md § 14.5) : après les
réécritures sans index, US restait à 1,23 s — le tri du
count(DISTINCT project_id) sur 626 k lignes déborde work_mem. Cet
index épouse exactement le prédicat et l'ordre nécessaires : égalité
pays, groupement par source, projets pré-triés, colonnes de montants
et d'organisation servies sans retour à la table. US ≈ 420 ms, 58 MB,
création 1,8 s. La vue matérialisée par financeur a été écartée
(duplication et rafraîchissement injustifiés pour un seul point lent).

CONCURRENTLY, via le bloc autocommit documenté d'Alembic : la
construction ne bloque pas les écritures de `participations` — le
rituel de déploiement migre pendant que l'ancienne pile sert encore.
Le DROP préalable nettoie l'index INVALID qu'un échec concurrent
laisserait derrière lui : la migration est rejouable.

Revision ID: 0035
Revises: 0034
Create Date: 2026-08-27

"""

from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None

INDEX = "ix_participations_country_source_project"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX}")
        op.execute(
            f"CREATE INDEX CONCURRENTLY {INDEX} "
            "ON participations (country_code, source, project_id) "
            "INCLUDE (amount, amount_eur, organisation_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX}")
