#!/bin/sh
PIDFILE="${TMPDIR:-/tmp}/keyboard-layout-generator-8000.pid"
if [ ! -f "$PIDFILE" ]; then
  echo "No pid file — server may not have been started via serve-8000-daemon.sh"
  exit 1
fi
pid=$(cat "$PIDFILE" 2>/dev/null || true)
if [ -z "$pid" ]; then
  echo "Empty pid"
  rm -f "$PIDFILE"
  exit 1
fi
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo "Stopped pid $pid"
else
  echo "Process $pid not running"
fi
rm -f "$PIDFILE"
