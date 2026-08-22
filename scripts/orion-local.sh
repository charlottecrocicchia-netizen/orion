#!/bin/bash
# Le cerveau d'Orion.app (chantier confort local, 2026-08-22) : un
# double-clic → Docker prêt → Postgres de dev → corpus vérifié →
# ports 8000/5173 arbitrés sans jamais tuer un étranger → API + vite
# en mode dev (le VRAI flux d'auth : dev_link à l'écran, session
# normale) → attente des healthchecks réels → Firefox sur /login.
#
# Idempotent : un second double-clic réutilise les services SAINS que
# CE lanceur a démarrés (provenance prouvée par pidfile), rouvre le
# navigateur, ne duplique rien. Strictement local : aucun SSH, aucun
# contexte docker distant, aucun geste vers le VPS.
#
# Journaux : ~/Library/Logs/Orion/ (launcher, api, web, calls-refresh).
# Les liens magiques n'y figurent jamais (ils restent dans la réponse
# HTTP, comme en dev depuis toujours).
set -u
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/charlottecrocicchia/dev/orion"
LOG_DIR="$HOME/Library/Logs/Orion"
STATE_DIR="$HOME/Library/Application Support/Orion"
LOG="$LOG_DIR/launcher.log"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
CALLS_LOG="$LOG_DIR/calls-refresh.log"
API_PID_FILE="$STATE_DIR/api.pid"
WEB_PID_FILE="$STATE_DIR/web.pid"
URL="http://localhost:5173/login"
FULL_CORPUS_MIN=600000
CALLS_MAX_AGE_SECONDS=86400
export UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend"

mkdir -p "$LOG_DIR" "$STATE_DIR"
echo "— lancement $(date '+%Y-%m-%d %H:%M:%S') —" >> "$LOG"

log()    { echo "$(date '+%H:%M:%S') $1" >> "$LOG"; }
notify() { osascript -e "display notification \"$1\" with title \"Orion local\"" >/dev/null 2>&1 || true; }
fail()   { log "ÉCHEC : $1"; echo "$1 (journal : $LOG)" >&2; exit 1; }

# ------------------------------------------------------- A. le dépôt
[ -d "$REPO" ] || fail "Dépôt introuvable : $REPO"
cd "$REPO"

# -------------------------------------------------------- B. Docker
if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    notify "Démarrage de Colima… (~1 min)"
    log "colima start"
    colima start >> "$LOG" 2>&1 || fail "Colima n'a pas démarré"
  elif [ -d "/Applications/Docker.app" ]; then
    notify "Démarrage de Docker Desktop…"
    open -a Docker
  else
    fail "Docker ne répond pas et ni Colima ni Docker Desktop ne sont installés"
  fi
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || fail "Docker n'a pas démarré dans les 2 minutes"
fi
# Strictement local : jamais un contexte docker distant.
ctx="$(docker context show 2>/dev/null || echo default)"
case "$ctx" in
  default|colima|desktop-linux) : ;;
  *) fail "Contexte docker « $ctx » inattendu — Orion local ne pilote que le Docker de cette machine" ;;
esac

# ------------------------------------------- C/D. Postgres + corpus
log "make db-up"
make db-up >> "$LOG" 2>&1 || fail "La base de développement n'a pas démarré (make db-up)"

projects="$(docker exec orion-dev-postgres-1 psql -U orion -d orion -tAc \
  'SELECT count(*) FROM projects' 2>/dev/null || echo 0)"
projects="${projects:-0}"
log "corpus : ${projects} projets"
if [ "$projects" -lt "$FULL_CORPUS_MIN" ]; then
  choice="$(osascript <<'EOF' 2>/dev/null || echo "Annuler"
button returned of (display dialog "La base locale complète n'est pas initialisée (graine de test ou base vide).

Voulez-vous préparer Orion local maintenant ? L'opération copie le corpus complet (699 798 projets) : environ 10 à 20 minutes et ~10 Go.

« Démarrer quand même » ouvre Orion sur la petite base — les compteurs seront ceux de la graine, pas du produit." buttons {"Annuler", "Démarrer quand même", "Préparer"} default button "Préparer" with title "Orion local" with icon caution)
EOF
)"
  log "corpus incomplet — choix : $choice"
  case "$choice" in
    "Préparer")
      notify "Préparation du corpus local (10-20 min)…"
      "$REPO/scripts/bootstrap-local-review.sh" --yes >> "$LOG" 2>&1 \
        || fail "L'initialisation du corpus a échoué"
      notify "Corpus local prêt."
      ;;
    "Démarrer quand même")
      notify "Corpus incomplet : Orion démarre sur la petite base."
      ;;
    *)
      log "abandon utilisateur"
      exit 0
      ;;
  esac
fi

# --------------------------------------- E. l'arbitrage des ports
# Qui écoute ? Provenance en trois classes : démarré par CE lanceur
# (pidfile → réutilisable s'il est sain), un processus Orion de ce
# dépôt (arrêt propre puis relance — jamais réutilisé : un uvicorn e2e
# sur la mauvaise base serait invisible de l'extérieur), ou un
# étranger (JAMAIS arrêté : message et stop).
listener_pid() { lsof -nP -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null | head -1; }
command_of()   { ps -o command= -p "$1" 2>/dev/null; }
parent_of()    { ps -o ppid= -p "$1" 2>/dev/null | tr -d ' '; }

# Le service appartient-il au pidfile ? `uv run` n'exec pas uvicorn :
# le listener est le FILS du pid enregistré (constaté au premier
# démarrage réel) — la provenance accepte donc pid et fils direct.
owned_by_pidfile() {
  local pid="$1" pid_file="$2" owner
  [ -f "$pid_file" ] || return 1
  owner="$(cat "$pid_file")"
  [ "$pid" = "$owner" ] && return 0
  [ "$(parent_of "$pid")" = "$owner" ]
}

stop_pid() {
  kill "$1" 2>/dev/null || return 0
  for _ in $(seq 1 10); do
    kill -0 "$1" 2>/dev/null || return 0
    sleep 0.5
  done
  kill -9 "$1" 2>/dev/null || true
  sleep 0.5
}

REUSE_API=0
claim_port() {
  local port="$1" pid_file="$2" marker="$3" health_url="$4"
  local pid cmd
  pid="$(listener_pid "$port")"
  [ -n "$pid" ] || return 0
  cmd="$(command_of "$pid")"
  if owned_by_pidfile "$pid" "$pid_file"; then
    if curl -sf --max-time 3 "$health_url" >/dev/null 2>&1; then
      log "port $port : service du lanceur sain (pid $pid) — réutilisé"
      [ "$port" = "8000" ] && REUSE_API=1
      return 0
    fi
    log "port $port : service du lanceur mal en point (pid $pid) — relancé"
    stop_pid "$pid"; stop_pid "$(cat "$pid_file")"; rm -f "$pid_file"; return 0
  fi
  case "$cmd" in
    *"$marker"*)
      log "port $port : processus Orion hors lanceur (pid $pid) — arrêt propre"
      stop_pid "$pid"
      return 0
      ;;
  esac
  fail "Le port $port est utilisé par « ${cmd:-processus inconnu} » (pid $pid) ; Orion ne l'a pas arrêté."
}

# Les marqueurs de provenance : `orion.main:app` ne peut être que
# l'API Orion (uv la lance depuis ~/.venvs — le chemin du dépôt
# n'apparaît PAS dans sa commande, constaté en recette) ; le vite
# d'Orion, lui, court depuis node_modules du dépôt.
claim_port 8000 "$API_PID_FILE" "orion.main:app" "http://localhost:8000/api/health"
claim_port 5173 "$WEB_PID_FILE" "$REPO/frontend/node_modules/.bin/vite" "http://localhost:5173"

# ------------------------------------ F. démarrage (le vrai mode dev)
if [ -z "$(listener_pid 8000)" ]; then
  log "démarrage API :8000 (auth dev)"
  nohup bash -c "cd '$REPO/backend' && exec env \
    UV_PROJECT_ENVIRONMENT='$UV_PROJECT_ENVIRONMENT' \
    ORION_AUTH_DEV=1 \
    ORION_PUBLIC_ORIGIN='http://localhost:5173' \
    ORION_LOGIN_ALLOWLIST='dev@lensorion.test' \
    ORION_LOGIN_COOLDOWN_SECONDS=0 \
    uv run --no-sync uvicorn orion.main:app --port 8000" >> "$API_LOG" 2>&1 &
  echo $! > "$API_PID_FILE"
fi
if [ -z "$(listener_pid 5173)" ]; then
  log "démarrage web :5173"
  nohup bash -c "cd '$REPO/frontend' && exec ./node_modules/.bin/vite" >> "$WEB_LOG" 2>&1 &
  echo $! > "$WEB_PID_FILE"
fi

# --------------------------------------------- H. l'attente réelle
curl -sf --retry 45 --retry-delay 2 --retry-all-errors --retry-connrefused \
  http://localhost:8000/api/health >/dev/null \
  || fail "L'API ne répond pas sur :8000 (journal : $API_LOG)"
curl -sf --retry 30 --retry-delay 1 --retry-all-errors --retry-connrefused \
  http://localhost:5173 -o /dev/null \
  || fail "Le frontend ne répond pas sur :5173 (journal : $WEB_LOG)"

# ------------------------------- fraîcheur des appels, sans bloquer
age="$(docker exec orion-dev-postgres-1 psql -U orion -d orion -tAc \
  "SELECT coalesce(extract(epoch FROM now() - max(finished_at))::bigint::text, '') \
   FROM ingestion_runs WHERE source='calls' AND status='succeeded'" 2>/dev/null || echo '')"
if [ -z "$age" ] || [ "${age:-0}" -gt "$CALLS_MAX_AGE_SECONDS" ]; then
  log "appels absents ou vieux de ${age:-∅} s — rafraîchissement en arrière-plan"
  notify "Rafraîchissement des appels en arrière-plan…"
  nohup bash -c "cd '$REPO/backend' && exec env \
    UV_PROJECT_ENVIRONMENT='$UV_PROJECT_ENVIRONMENT' \
    uv run --no-sync orion-ingest calls" >> "$CALLS_LOG" 2>&1 &
fi

# ------------------------------------------------------ I. Firefox
if [ "$REUSE_API" = "1" ]; then
  notify "Orion local est déjà en marche."
else
  notify "Orion local est prêt."
fi
log "ouverture $URL"
open -a Firefox "$URL" 2>/dev/null || open "$URL"
log "terminé"
