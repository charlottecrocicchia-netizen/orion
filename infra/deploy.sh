#!/usr/bin/env bash
# Déploiement ATOMIQUE — le geste documenté (docs/conception-deploiement.md,
# étape 9, durci au verrou R1 du 2026-08-23) : le serveur met à jour son
# clone git et construit les images sur place (décision D1 — aucune image
# tirée d'un registre tant que la CI n'en publie pas de fraîches).
#
# L'ordre est le verrou : AUCUNE fenêtre où la nouvelle révision est
# servie sans son schéma ni ses données de référence.
#   1. git pull --ff-only                 (le code, rien ne bouge encore)
#   2. make build                         (images neuves, tamponnées GIT_REV,
#                                          la pile courante continue de servir)
#   3. migration via `compose run --rm`   (la NOUVELLE image migre la base
#                                          AVANT toute bascule ; migrations
#                                          additives ⇒ l'ancienne API n'en
#                                          souffre pas, le nominal reste servi)
#   4. [manuel, si le lot l'exige] charger les données de référence de la
#      révision par la même voie, puis les VÉRIFIER — ex. R1 :
#        compose run --rm --no-deps api uv run --no-sync orion-ingest prices
#        compose run --rm --no-deps api uv run --no-sync orion-ingest rates
#   5. make up                            (bascule des conteneurs — quelques
#                                          secondes, schéma et données déjà là)
#
# Requis : DEPLOY_HOST, DEPLOY_USER. Optionnel : DEPLOY_PATH.
# Rappels : migration de schéma → dump manuel AVANT (le cron de la nuit ne
# suffit pas) et rituel snapshot ; Caddyfile modifié → `restart caddy` ;
# rollback applicatif : `git checkout <rev précédente> && make up`.
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST is not set (see infra/README.md)}"
: "${DEPLOY_USER:?DEPLOY_USER is not set (see infra/README.md)}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/${DEPLOY_USER}/orion}"

target="${DEPLOY_USER}@${DEPLOY_HOST}"
compose="docker compose --env-file ../.env -f compose.prod.yml"

echo "==> 1/5 Mise à jour du clone sur ${target}:${DEPLOY_PATH}"
ssh "$target" "cd '${DEPLOY_PATH}' && git pull --ff-only"

echo "==> 2/5 Construction des images (la pile courante continue de servir)"
ssh "$target" "cd '${DEPLOY_PATH}' && make build"

echo "==> 3/5 Migration AVANT bascule (nouvelle image, base de prod)"
ssh "$target" "cd '${DEPLOY_PATH}/infra' && ${compose} run --rm --no-deps api \
  uv run --no-sync alembic upgrade head"

echo "==> 4/5 Données de référence : gestes manuels du lot, puis vérification"
echo "    (voir l'en-tête de ce script — rien n'est chargé automatiquement)"

echo "==> 5/5 Bascule"
ssh "$target" "cd '${DEPLOY_PATH}' && make up"

echo "==> Tampon de révision servi"
ssh "$target" "docker inspect ghcr.io/charlottecrocicchia-netizen/orion-api:latest \
  --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}'"

echo "==> Smoke test"
# Le port vient du .env de prod (HTTP_PORT=80 depuis la mise en ligne
# publique) — jamais en dur : l'incident B0.1 (2026-08-27) était un
# smoke qui visait :8080 après une bascule réussie.
ssh "$target" "cd '${DEPLOY_PATH}' && port=\$(grep -E '^HTTP_PORT=' .env | cut -d= -f2); curl -fsS \"http://localhost:\${port:-8080}/api/health\""
echo ""
echo "==> Déployé."
