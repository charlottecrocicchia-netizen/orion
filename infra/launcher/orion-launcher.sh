#!/bin/bash
# Le lanceur Orion du Bureau (2026-08-17) : démarre ce qui manque —
# Colima, puis la pile prod — et ouvre le site dans Firefox. Toute la
# plomberie journalise dans ~/Library/Logs/orion-launcher.log ; en cas
# d'échec, un message court sort sur stderr pour la boîte de dialogue.
#
# RÈGLE CARDINALE (recette du 2026-08-17) : ce lanceur n'ouvre JAMAIS
# une version périmée. Sa version d'origine se contentait de tester si
# l'URL répondait ; une pile déjà debout sur une vieille image passait
# donc le test et s'ouvrait en silence — une recette entière menée sur
# le site d'avant, sans le moindre signe. Désormais les images portent
# un tampon de révision (label OCI, posé à la construction depuis
# scripts/source-rev.sh) : on le compare aux sources, on reconstruit
# s'il diffère, et on préfère une erreur franche à un écran trompeur.
set -u
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/charlottecrocicchia/dev/orion"
LOG="$HOME/Library/Logs/orion-launcher.log"
URL="http://localhost:8080"
LABEL="org.opencontainers.image.revision"

mkdir -p "$(dirname "$LOG")"
echo "— lancement $(date '+%Y-%m-%d %H:%M:%S') —" >> "$LOG"

notify() { osascript -e "display notification \"$1\" with title \"Orion\"" >/dev/null 2>&1 || true; }
fail() { echo "$1 (journal : $LOG)" >&2; exit 1; }
log() { echo "$1" >> "$LOG"; }

# Le tampon que porte un conteneur en marche. Vide si le conteneur
# n'existe pas, ou s'il est né d'une image d'avant le tamponnage —
# les deux cas valent « périmé », et c'est le bon réflexe.
stamp_of() {
  docker inspect --format "{{index .Config.Labels \"$LABEL\"}}" "$1" 2>/dev/null || true
}

# Reconstruit et relance la pile. `make up` tient la règle une-pile et
# exporte le tampon : le lanceur et le terminal empruntent le MÊME
# chemin, donc ils ne peuvent pas diverger.
rebuild() {
  log "reconstruction vers $WANT"
  ( cd "$REPO" && make up ) >> "$LOG" 2>&1 \
    || fail "La mise à jour d'Orion a échoué — le site n'a pas été ouvert"
}

# 1. Colima — la machine des conteneurs.
if ! colima status >> "$LOG" 2>&1; then
  notify "Démarrage de Colima… (~1 min)"
  colima start >> "$LOG" 2>&1 || fail "Colima n'a pas démarré"
fi

# 2. Ce que les sources demandent, ce que la pile sert.
WANT=$("$REPO/scripts/source-rev.sh" 2>> "$LOG") || fail "Révision des sources illisible"
HAVE_API=$(stamp_of orion-api-1)
HAVE_WEB=$(stamp_of orion-web-1)
log "sources=$WANT api=${HAVE_API:-∅} web=${HAVE_WEB:-∅}"

if ! curl -fs -o /dev/null --max-time 3 "$URL"; then
  notify "Démarrage de la pile Orion…"
  rebuild
elif [ "$HAVE_API" != "$WANT" ] || [ "$HAVE_WEB" != "$WANT" ]; then
  # Le cas qui a coûté une recette : la pile répond, mais pas avec le
  # bon code. On le DIT, et on reconstruit avant d'ouvrir.
  notify "Mise à jour en cours (${HAVE_WEB:-version inconnue} → $WANT) — quelques minutes"
  rebuild
else
  log "à jour, rien à reconstruire"
fi

# 3. Le site répond ?
for _ in $(seq 1 30); do
  curl -fs -o /dev/null --max-time 3 "$URL" && break
  sleep 2
done
curl -fs -o /dev/null --max-time 3 "$URL" || fail "La pile tourne mais $URL ne répond pas"

# 4. Vérification APRÈS coup : une reconstruction qui réussit sans poser
# le bon tampon reste un écran menteur. Mieux vaut refuser d'ouvrir.
HAVE_API=$(stamp_of orion-api-1)
HAVE_WEB=$(stamp_of orion-web-1)
if [ "$HAVE_API" != "$WANT" ] || [ "$HAVE_WEB" != "$WANT" ]; then
  fail "Orion sert encore api=${HAVE_API:-∅} / web=${HAVE_WEB:-∅} au lieu de $WANT — site NON ouvert"
fi
log "servi : $WANT"

# 5. Firefox — le navigateur de recette.
if [ -d "/Applications/Firefox.app" ]; then
  open -a Firefox "$URL"
else
  open "$URL"
  notify "Firefox introuvable — navigateur par défaut utilisé"
fi
echo "ok $(date '+%H:%M:%S') — version $WANT" >> "$LOG"
