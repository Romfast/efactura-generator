#!/usr/bin/env bash
# Pornește serverele de dezvoltare pentru testare vizuală manuală.
#   - Node static server  → http://localhost:3000  (frontend)
#   - PHP built-in server → http://localhost:8000  (receiver.php, test-config.php)
# Dacă porturile sunt deja ocupate, procesele existente sunt oprite întâi.
# Ctrl+C oprește ambele.

set -euo pipefail

cd "$(dirname "$0")"

NODE_PORT="${NODE_PORT:-3000}"
PHP_PORT="${PHP_PORT:-8000}"
HOST="${HOST:-localhost}"

command -v node >/dev/null || { echo "Lipsește node."; exit 1; }
command -v php  >/dev/null || { echo "Lipsește php.";  exit 1; }

free_port() {
  local port="$1" label="$2"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  echo "→ port $port ($label) ocupat de PID(s): $pids — opresc..."
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    sleep 0.4
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$pids" ] && return 0
  done
  echo "  procese încăpățânate, kill -9: $pids"
  kill -9 $pids 2>/dev/null || true
  sleep 0.3
}

free_port "$NODE_PORT" "node"
free_port "$PHP_PORT"  "php"

mkdir -p temp logs
LOG_NODE="logs/dev-node.log"
LOG_PHP="logs/dev-php.log"

PORT="$NODE_PORT" node js/server.js >"$LOG_NODE" 2>&1 &
NODE_PID=$!

php -S "${HOST}:${PHP_PORT}" >"$LOG_PHP" 2>&1 &
PHP_PID=$!

cleanup() {
  echo
  echo "→ opresc serverele..."
  kill "$NODE_PID" "$PHP_PID" 2>/dev/null || true
  wait "$NODE_PID" "$PHP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1

cat <<EOF

  efactura-generator — dev servers
  ────────────────────────────────
  ► Testare COMPLETĂ (cu ANAF / receiver.php):
      http://${HOST}:${PHP_PORT}/

  ► Testare DOAR static (ca pe GitHub Pages, fără PHP):
      http://${HOST}:${NODE_PORT}/

  Diagnostic:
    Ping   : http://${HOST}:${PHP_PORT}/receiver.php?action=ping
    Config : http://${HOST}:${PHP_PORT}/test-config.php

  Logs: $LOG_NODE  |  $LOG_PHP
  PIDs: node=$NODE_PID  php=$PHP_PID

  Ctrl+C pentru oprire.

EOF

while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$PHP_PID" 2>/dev/null; do
  sleep 1
done

echo "!! unul din procese s-a oprit — verifică logurile."
exit 1
