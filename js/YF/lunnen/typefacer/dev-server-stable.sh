#!/usr/bin/env bash
# Локальный HTTP-сервер с автоперезапуском при падении процесса.
# Запуск: ./dev-server-stable.sh   или   PORT=9000 ./dev-server-stable.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-8765}"
HOST="${HOST:-127.0.0.1}"

echo "Root: $ROOT"
echo "URL:  http://${HOST}:${PORT}/index.html"
echo "Остановка: закрой терминал или Ctrl+C. При сбое сервер перезапустится через 2 с."
echo ""

while true; do
  echo "[$(date '+%H:%M:%S')] Starting http.server on ${HOST}:${PORT}..."
  python3 -m http.server "$PORT" --bind "$HOST" 2>/dev/null || python3 -m http.server "$PORT" || true
  echo "[$(date '+%H:%M:%S')] Server stopped, restarting in 2s..."
  sleep 2
done
