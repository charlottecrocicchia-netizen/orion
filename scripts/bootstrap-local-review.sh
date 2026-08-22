#!/usr/bin/env bash
# Initialise UNE FOIS la base locale de recette manuelle (`orion`, sur
# le Postgres de dev) avec le corpus complet — copié depuis le volume
# local `orion_pgdata` (la photographie du 2026-08-21 qui a semé le
# VPS ; le volume source n'est JAMAIS modifié : pg_dump seulement).
#
# Chaîne : gardes (local, volume source, disque hôte ET VM Docker) →
# dump réutilisable dans ~/orion-dumps/ → restauration dans `orion` →
# alembic upgrade head → orion-ingest calls → invariants.
#
# DESTRUCTIF pour la seule base de dev `orion` (confirmation exigée,
# ou --yes). Ne touche ni au VPS, ni à la production, ni au volume
# source, ni à la base e2e (`orion_e2e`), ni à `orion_test`.
#
# Usage : ./scripts/bootstrap-local-review.sh [--yes]
set -euo pipefail

cd "$(dirname "$0")/.."
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.venvs/orion-backend}"

DUMP_DIR="$HOME/orion-dumps"
DUMP_FILE="$DUMP_DIR/orion-corpus-20260821.dump"
# Le seuil qui distingue le corpus complet (699 798 projets) de la
# graine e2e (16) ou d'une base vide — large des deux côtés.
FULL_CORPUS_MIN=600000
ASSUME_YES="${1:-}"

say()  { echo "==> $*"; }
fail() { echo "ERREUR : $*" >&2; exit 1; }

# ---------------------------------------------------------------- gardes
[ -f "infra/compose.prod.yml" ] || fail "à lancer depuis le dépôt orion"
command -v docker >/dev/null || fail "docker introuvable"
docker info >/dev/null 2>&1 || fail "le moteur Docker ne répond pas (colima start ?)"
# Strictement local : aucun contexte docker distant.
ctx="$(docker context show 2>/dev/null || echo default)"
case "$ctx" in
  default|colima|desktop-linux) : ;;
  *) fail "contexte docker inattendu « $ctx » — ce script est strictement local" ;;
esac
docker volume inspect orion_pgdata >/dev/null 2>&1 \
  || fail "volume source orion_pgdata introuvable — le corpus local n'existe pas sur cette machine"

free_host_gb="$(df -g "$HOME" | tail -1 | awk '{print $4}')"
[ "$free_host_gb" -ge 5 ] || fail "moins de 5 Go libres sur le disque hôte (dump ~1,3 Go)"

# ------------------------------------------------- déjà fait ? on sort.
say "Base de dev"
make db-up >/dev/null 2>&1
existing="$(docker exec orion-dev-postgres-1 psql -U orion -d postgres -tAc \
  "SELECT count(*) FROM pg_database WHERE datname='orion'")"
if [ "$existing" = "1" ]; then
  projects="$(docker exec orion-dev-postgres-1 psql -U orion -d orion -tAc \
    'SELECT count(*) FROM projects' 2>/dev/null || echo 0)"
  if [ "${projects:-0}" -ge "$FULL_CORPUS_MIN" ]; then
    say "Corpus complet déjà présent ($projects projets) — rien à faire."
    exit 0
  fi
  say "Base actuelle : ${projects:-0} projets (graine e2e ou base vide)."
fi

# Le disque de la VM Docker (là où vivra la base restaurée, ~10 Go).
vm_free_gb="$(docker exec orion-dev-postgres-1 df -BG /var/lib/postgresql/data | tail -1 | awk '{gsub("G","",$4); print $4}')"
[ "${vm_free_gb:-0}" -ge 12 ] || fail "seulement ${vm_free_gb} Go libres dans la VM Docker — il en faut ~12 (colima : agrandir le disque, ou docker builder prune -af)"

# ------------------------------------------------------- confirmation
if [ "$ASSUME_YES" != "--yes" ]; then
  echo
  echo "La base de dev « orion » va être DÉTRUITE puis remplacée par le"
  echo "corpus complet (699 798 projets, ~10 Go, 10-20 minutes)."
  echo "La base e2e (orion_e2e), la base de tests (orion_test) et le"
  echo "volume source orion_pgdata ne sont pas touchés."
  printf "Continuer ? [oui/N] "
  read -r answer
  [ "$answer" = "oui" ] || { echo "Abandon — rien n'a été modifié."; exit 1; }
fi

# ------------------------------------------------------- dump (réutilisé)
mkdir -p "$DUMP_DIR"
if [ -s "$DUMP_FILE" ]; then
  say "Dump déjà présent : $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1)) — réutilisé."
else
  say "Dump du corpus depuis le volume local orion_pgdata (~3 min)"
  # Une pile à la fois (règle du Makefile) : on rend la main au
  # Postgres prod-local le temps du dump, puis on la reprend.
  make db-down >/dev/null 2>&1 || true
  docker compose --env-file .env -f infra/compose.prod.yml up -d --wait postgres >/dev/null
  docker compose --env-file .env -f infra/compose.prod.yml exec -T postgres \
    pg_dump -U orion -Fc orion > "$DUMP_FILE.part"
  mv "$DUMP_FILE.part" "$DUMP_FILE"
  docker compose --env-file .env -f infra/compose.prod.yml stop postgres >/dev/null
  make db-up >/dev/null 2>&1
  say "Dump écrit : $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
fi

# ------------------------------------------------------- restauration
say "Restauration dans la base de dev « orion » (10-20 min)"
docker exec orion-dev-postgres-1 psql -U orion -d postgres -q \
  -c "DROP DATABASE IF EXISTS orion WITH (FORCE);"
docker exec orion-dev-postgres-1 psql -U orion -d postgres -q \
  -c "CREATE DATABASE orion;"
docker exec -i orion-dev-postgres-1 pg_restore -U orion -d orion --no-owner < "$DUMP_FILE"

say "Migrations récentes (le corpus date d'avant les tables calls)"
(cd backend && uv run alembic upgrade head)

say "Moisson des appels Funding & Tenders (~30 s)"
(cd backend && uv run orion-ingest calls)

# ---------------------------------------------------------- invariants
say "Invariants"
check() {
  local label="$1" query="$2" expected="$3"
  local got
  got="$(docker exec orion-dev-postgres-1 psql -U orion -d orion -tAc "$query")"
  if [ "$got" = "$expected" ] || { [ "$expected" = ">1000" ] && [ "$got" -gt 1000 ]; }; then
    echo "    ✓ $label : $got"
  else
    fail "$label : attendu $expected, obtenu $got"
  fi
}
check "projets (photographie du 2026-08-21)" "SELECT count(*) FROM projects" "699798"
check "lentilles publiées" \
  "SELECT string_agg(slug, ',' ORDER BY rank) FROM lenses WHERE status='published'" "space,aviation"
check "appels Funding & Tenders" "SELECT count(*) FROM call_topics" ">1000"

echo
say "La base locale de recette est prête. Double-clic sur Orion.app,"
say "connexion avec dev@lensorion.test — bon courage pour la recette."
