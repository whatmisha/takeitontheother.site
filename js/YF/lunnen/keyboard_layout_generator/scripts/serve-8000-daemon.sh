#!/bin/sh
# Static files on :8000 via nohup — survives closing Cursor/IDE terminal.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${TMPDIR:-/tmp}/keyboard-layout-generator-8000.pid"
LOGFILE="${TMPDIR:-/tmp}/keyboard-layout-generator-8000.log"

if [ -f "$PIDFILE" ]; then
  oldpid=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null; then
    echo "Already running: http://127.0.0.1:8000/ (pid $oldpid)"
    exit 0
  fi
fi

cd "$ROOT"
nohup python3 -m http.server 8000 --bind 127.0.0.1 --directory "$ROOT" >>"$LOGFILE" 2>&1 &
echo $! >"$PIDFILE"
echo "Started: http://127.0.0.1:8000/ (pid $(cat "$PIDFILE"), log: $LOGFILE)"
