#!/usr/bin/env bash
# Dump logique quotidien de la base de prod — rotation 7 jours.
#
# Installé en cron sur le VPS (04h00, avant l'heure d'un futur scheduler
# d'ingestion pour ne jamais dumper pendant un replay) :
#   0 4 * * * /home/ubuntu/orion/infra/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Le backup OVH couvre le disque entier ; ce dump couvre le cas où c'est
# la base elle-même qui est abîmée (migration ratée, suppression) et
# permet une restauration ciblée sans rejouer toute la machine.
# La procédure de restauration est dans docs/conception-deploiement.md
# (annexe C) — recette exigée : une restauration d'essai, pas juste
# l'existence du fichier.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ORION_BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS=7

mkdir -p "$DEST"
stamp="$(date +%Y%m%d)"
out="$DEST/orion-$stamp.dump"

cd "$REPO/infra"
docker compose --env-file ../.env -f compose.prod.yml exec -T postgres \
  pg_dump -U orion -Fc orion > "$out.partiel"
mv "$out.partiel" "$out"

find "$DEST" -name "orion-*.dump" -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name "orion-*.dump.partiel" -mtime +1 -delete

echo "$(date -Is) dump ok : $out ($(du -h "$out" | cut -f1))"
