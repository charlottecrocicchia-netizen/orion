#!/usr/bin/env bash
# La suite Playwright DANS SON HARNAIS (le même que la CI) : base e2e
# DÉDIÉE, recréée et semée (seed_e2e), uvicorn :8000 avec l'auth de
# recette (pivot accès privé 2026-08-22), bundle construit servi par
# vite preview :4173. La suite n'est PAS conçue pour un corpus complet —
# la lentille synthétique test-lens et les comptes exacts n'existent que
# dans la graine (leçon du 2026-08-22 : deux fausses alertes
# « 23 échecs » venaient d'un harnais au mauvais corpus).
#
# ⚠️ ISOLATION (chantier confort local, 2026-08-22) : ce harnais vit
# dans la base `orion_e2e`, qu'il détruit et resème librement à chaque
# run. La base `orion` du même Postgres de dev est la BASE DE RECETTE
# MANUELLE — elle porte le corpus complet restauré par
# scripts/bootstrap-local-review.sh et ce script ne doit JAMAIS y
# toucher. Le DROP ci-dessous vise orion_e2e, exclusivement.
#
# Usage : ./scripts/e2e-local.sh [arguments playwright]
#   ex.   ./scripts/e2e-local.sh e2e/accounts.spec.ts
set -euo pipefail

cd "$(dirname "$0")/.."

# Garde-fou global (incident du 2026-08-24 : un deadlock wait4 de bash —
# SIGCHLD du build perdu — a suspendu le harnais 1 h 34 sans verdict,
# l'API d'arrière-plan le maintenant endormi) : au-delà de 20 minutes,
# le harnais ÉCHOUE bruyamment. Une suite qui peut rester suspendue est
# elle-même un bug — jamais d'attente indéfinie.
WATCHDOG_LIMIT=1200
(
  sleep "$WATCHDOG_LIMIT"
  echo "GARDE-FOU : harnais e2e au-delà de ${WATCHDOG_LIMIT}s — abandon bruyant." >&2
  pkill -TERM -P $$ 2>/dev/null || true
  kill -TERM $$ 2>/dev/null || true
) &
WATCHDOG_PID=$!
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.venvs/orion-backend}"

E2E_DB="orion_e2e"
# La base du harnais, pour TOUTE la chaîne : alembic, la graine, l'API.
export ORION_DATABASE_URL="postgresql+psycopg://orion:orion@localhost:5432/${E2E_DB}"

echo "==> Base e2e dédiée (${E2E_DB}) fraîche + graine"
make db-up >/dev/null
docker exec orion-dev-postgres-1 psql -U orion -d postgres -q \
  -c "DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE);"
docker exec orion-dev-postgres-1 psql -U orion -d postgres -q \
  -c "CREATE DATABASE ${E2E_DB};"
(cd backend && uv run alembic upgrade head >/dev/null && uv run python scripts/seed_e2e.py)

# Refus explicite si un port du harnais est déjà tenu (incident du
# 2026-08-22 : des orphelins d'un run précédent servaient une VIEILLE
# pile au mauvais corpus — l'auth échouait en aveugle). Mieux vaut un
# refus net qu'un verdict menteur ; on ne tue JAMAIS d'office ce qui
# écoute, on le nomme.
for port in 8000 4173; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERREUR : le port $port est déjà occupé — probablement un harnais" >&2
    echo "orphelin d'un run précédent. Identifier : lsof -nP -iTCP:$port -sTCP:LISTEN" >&2
    exit 1
  fi
done

echo "==> API de recette (:8000, auth en mode dev)"
export ORION_AUTH_DEV=1
export ORION_PUBLIC_ORIGIN=http://localhost:4173
export ORION_LOGIN_ALLOWLIST="e2e-a@lensorion.test,e2e-b@lensorion.test,e2e-c@lensorion.test,e2e-d@lensorion.test,e2e-e@lensorion.test,e2e-f@lensorion.test,e2e-g@lensorion.test,e2e-h@lensorion.test"
export ORION_LOGIN_LIMIT_PER_IP_HOUR=1000
export ORION_LOGIN_LIMIT_PER_PAIR_HOUR=200
export ORION_LOGIN_LIMIT_PER_EMAIL_HOUR=400
# Le piège « uv run n'exec pas » : le PID enregistré est le PARENT
# (uv/pnpm), le processus qui ÉCOUTE est son fils — tuer le seul parent
# laissait un orphelin sur le port à chaque run. On abat l'arbre
# entier, feuilles d'abord, et uniquement NOS arbres.
kill_tree() {
  local pid="$1" child
  [ -n "$pid" ] || return 0
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}
# Le trap se pose AVANT tout lancement (incident du 2026-08-24 : posé
# après le build, il laissait un uvicorn orphelin sur :8000 à chaque
# échec de build — le run suivant refusait le port).
API_PID=""
PREVIEW_PID=""
trap 'kill_tree "$API_PID"; kill_tree "$PREVIEW_PID"; kill "$WATCHDOG_PID" 2>/dev/null || true' EXIT

(cd backend && uv run uvicorn orion.main:app --port 8000 >/tmp/orion-e2e-api.log 2>&1) &
API_PID=$!

echo "==> Bundle + vite preview (:4173)"
(cd frontend && pnpm build >/tmp/orion-e2e-build.log 2>&1) || {
  echo "ERREUR : le build a échoué — journal complet :" >&2
  cat /tmp/orion-e2e-build.log >&2
  exit 2
}
(cd frontend && pnpm exec vite preview --port 4173 >/tmp/orion-e2e-preview.log 2>&1) &
PREVIEW_PID=$!

# --max-time : un port zombie qui accepte sans répondre ne suspend
# jamais le harnais — chaque tentative est bornée.
curl -sf --max-time 5 --retry 30 --retry-delay 1 --retry-connrefused http://localhost:8000/api/health >/dev/null
curl -sf --max-time 5 --retry 30 --retry-delay 1 --retry-connrefused http://localhost:4173 -o /dev/null

echo "==> Playwright (verdict au journal COMPLET — jamais un tail)"
cd frontend
E2E_BASE_URL=http://localhost:4173 pnpm exec playwright test "$@"
