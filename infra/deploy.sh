#!/usr/bin/env bash
# Déploiement — LE geste documenté (docs/conception-deploiement.md,
# étape 9) : le serveur met à jour son clone git et reconstruit les
# images sur place (décision D1 — aucune image tirée d'un registre tant
# que la CI n'en publie pas de fraîches ; le jour où GHCR revient,
# c'est une décision séparée, voir infra/README.md).
#
# Requis : DEPLOY_HOST, DEPLOY_USER. Optionnel : DEPLOY_PATH
# (défaut /home/$DEPLOY_USER/orion). Équivalent manuel :
#   ssh orion-vps 'cd ~/orion && git pull --ff-only && make up'
#
# Rappels du runbook :
# - migration de schéma → dump manuel AVANT (le cron de la nuit ne
#   suffit pas si le commit du matin casse) et snapshot selon le rituel ;
# - Caddyfile modifié → `docker compose … restart caddy` (monté en
#   volume, `up -d` ne le recharge pas) ;
# - rollback applicatif : `git checkout <rev précédente> && make up`.
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST is not set (see infra/README.md)}"
: "${DEPLOY_USER:?DEPLOY_USER is not set (see infra/README.md)}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/${DEPLOY_USER}/orion}"

target="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "==> Mise à jour du clone et reconstruction sur ${target}:${DEPLOY_PATH}"
ssh "$target" "cd '${DEPLOY_PATH}' && git pull --ff-only && make up"

echo "==> Tampon de révision servi"
ssh "$target" "docker inspect ghcr.io/charlottecrocicchia-netizen/orion-api:latest \
  --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}'"

echo "==> Smoke test"
ssh "$target" "curl -fsS http://localhost:8080/api/health"
echo ""
echo "==> Déployé."
