#!/bin/bash
# Arrêt propre d'Orion local : l'API (:8000) et le frontend (:5173)
# démarrés par le lanceur — et EUX SEULS. La base Postgres de dev reste
# allumée (coût négligeable, redémarrage instantané) sauf --db.
# Jamais de kill sur un processus étranger, jamais Docker entier,
# jamais un volume.
#
# Usage : ./scripts/orion-local-stop.sh [--db]
set -u
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/charlottecrocicchia/dev/orion"
STATE_DIR="$HOME/Library/Application Support/Orion"
LOG="$HOME/Library/Logs/Orion/launcher.log"

log() { echo "$(date '+%H:%M:%S') [stop] $1" >> "$LOG" 2>/dev/null || true; }

stop_pid() {
  kill "$1" 2>/dev/null || return 0
  for _ in $(seq 1 10); do
    kill -0 "$1" 2>/dev/null || return 0
    sleep 0.5
  done
  kill -9 "$1" 2>/dev/null || true
}

stopped=0
for pair in "8000|orion.main:app|api.pid" "5173|$REPO/frontend/node_modules/.bin/vite|web.pid"; do
  port="${pair%%|*}"; rest="${pair#*|}"; marker="${rest%%|*}"; pid_file="$STATE_DIR/${rest#*|}"
  pid="$(lsof -nP -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | head -1)"
  if [ -z "$pid" ]; then
    rm -f "$pid_file"
    continue
  fi
  cmd="$(ps -o command= -p "$pid" 2>/dev/null)"
  owner=""
  [ -f "$pid_file" ] && owner="$(cat "$pid_file")"
  ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  if { [ -n "$owner" ] && { [ "$pid" = "$owner" ] || [ "$ppid" = "$owner" ]; }; } \
     || { case "$cmd" in *"$marker"*) true ;; *) false ;; esac }; then
    log "arrêt :$port (pid $pid)"
    stop_pid "$pid"
    # `uv run` n'exec pas : le parent enregistré peut survivre au fils.
    [ -n "$owner" ] && stop_pid "$owner"
    rm -f "$pid_file"
    stopped=$((stopped + 1))
  else
    echo "Le port $port est utilisé par « ${cmd:-processus inconnu} » — pas un service Orion, laissé intact." >&2
  fi
done

if [ "${1:-}" = "--db" ]; then
  log "arrêt de la base de dev (--db)"
  (cd "$REPO" && make db-down) >> "$LOG" 2>&1 || true
  echo "Orion local arrêté (base comprise)."
else
  echo "Orion local arrêté ($stopped service(s)) — la base de dev reste allumée."
fi
