#!/usr/bin/env bash
# Pile de dev pour la recette Claude : API en mode auth_dev (le lien
# magique s'écrit dans la réponse JSON, rien ne part) + vite. La base
# est la base de dev docker déjà lancée (make db-up).
set -euo pipefail
cd "$(dirname "$0")/.."

export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.venvs/orion-backend}"
export ORION_AUTH_DEV=1
export ORION_PUBLIC_ORIGIN="http://localhost:5173"
export ORION_LOGIN_ALLOWLIST="dev@lensorion.test"
export ORION_LOGIN_COOLDOWN_SECONDS=0

trap 'kill 0' EXIT INT TERM

(cd backend && uv run uvicorn orion.main:app --port 8000) &
(cd frontend && pnpm dev) &

wait
