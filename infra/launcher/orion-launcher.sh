#!/bin/bash
# Le lanceur Orion du Bureau (2026-08-17) : démarre ce qui manque —
# Colima, puis la pile prod — et ouvre le site dans Firefox. Toute la
# plomberie journalise dans ~/Library/Logs/orion-launcher.log ; en cas
# d'échec, un message court sort sur stderr pour la boîte de dialogue.
set -u
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/charlottecrocicchia/dev/orion"
LOG="$HOME/Library/Logs/orion-launcher.log"
URL="http://localhost:8080"

mkdir -p "$(dirname "$LOG")"
echo "— lancement $(date '+%Y-%m-%d %H:%M:%S') —" >> "$LOG"

notify() { osascript -e "display notification \"$1\" with title \"Orion\"" >/dev/null 2>&1 || true; }
fail() { echo "$1 (journal : $LOG)" >&2; exit 1; }

# 1. Colima — la machine des conteneurs.
if ! colima status >> "$LOG" 2>&1; then
  notify "Démarrage de Colima… (~1 min)"
  colima start >> "$LOG" 2>&1 || fail "Colima n'a pas démarré"
fi

# 2. La pile prod — règle une-pile : la base dev s'efface d'abord.
if ! curl -fs -o /dev/null --max-time 3 "$URL"; then
  notify "Démarrage de la pile Orion…"
  ( cd "$REPO" && docker compose -f compose.dev.yml down --remove-orphans ) >> "$LOG" 2>&1 || true
  ( cd "$REPO/infra" && docker compose --env-file ../.env -f compose.prod.yml up -d --wait ) \
    >> "$LOG" 2>&1 \
    || fail "La pile n'a pas démarré — si les images manquent, lancer « make up » une fois dans $REPO"
fi

# 3. Le site répond ?
for _ in $(seq 1 30); do
  curl -fs -o /dev/null --max-time 3 "$URL" && break
  sleep 2
done
curl -fs -o /dev/null --max-time 3 "$URL" || fail "La pile tourne mais $URL ne répond pas"

# 4. Firefox — le navigateur de recette.
if [ -d "/Applications/Firefox.app" ]; then
  open -a Firefox "$URL"
else
  open "$URL"
  notify "Firefox introuvable — navigateur par défaut utilisé"
fi
echo "ok $(date '+%H:%M:%S')" >> "$LOG"
