#!/usr/bin/env bash
# Run the whole Lumière stack locally as one unit: backend + frontend.
# Ctrl-C (or exit) stops BOTH processes — no orphans.
# Usage: ./scripts/dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$PWD"
API_PID=""

cleanup() {
  echo
  echo "Stopping backend (pid ${API_PID:-unknown})..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  echo "Done. All processes stopped."
}
trap cleanup EXIT INT TERM

# Start the backend in the background; the frontend runs in the foreground so
# Ctrl-C lands here first and cleanup() tears the whole tree down.
bash scripts/dev-api.sh &
API_PID=$!

bash scripts/dev-web.sh
