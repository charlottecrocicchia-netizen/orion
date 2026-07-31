#!/usr/bin/env bash
# Generic deployment to any Docker-capable VPS over SSH.
#
# Required environment: DEPLOY_HOST, DEPLOY_USER
# Optional: DEPLOY_PATH (default /home/$DEPLOY_USER/orion)
#
# One-time server setup (Docker, .env, ghcr.io login) is documented in
# infra/README.md. No hosting target is configured yet — this script is
# ready for the day one exists.
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST is not set — no deployment target configured yet (see infra/README.md)}"
: "${DEPLOY_USER:?DEPLOY_USER is not set (see infra/README.md)}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/${DEPLOY_USER}/orion}"

target="${DEPLOY_USER}@${DEPLOY_HOST}"
here="$(cd "$(dirname "$0")" && pwd)"

echo "==> Syncing compose files to ${target}:${DEPLOY_PATH}"
ssh "$target" "mkdir -p '${DEPLOY_PATH}'"
scp "${here}/compose.prod.yml" "${here}/Caddyfile" "${target}:${DEPLOY_PATH}/"

echo "==> Pulling images and restarting services"
ssh "$target" "cd '${DEPLOY_PATH}' && docker compose -f compose.prod.yml pull && docker compose -f compose.prod.yml up -d --wait"

echo "==> Smoke test"
ssh "$target" "curl -fsS http://localhost:8080/api/health || curl -fsS http://localhost/api/health"
echo ""
echo "==> Deployed."
