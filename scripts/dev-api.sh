#!/usr/bin/env bash
# Start the Lumière backend (FastAPI + uvicorn) with auto-reload.
# Usage: ./scripts/dev-api.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Resolve the venv python across Windows (Git Bash) and Unix.
PY="backend/.venv/Scripts/python.exe"
[ -x "$PY" ] || PY="backend/.venv/bin/python"
[ -x "$PY" ] || PY="python"

echo "Starting API on http://127.0.0.1:8000 (--reload)"
exec "$PY" -m uvicorn app.main:app --port 8000 --reload --app-dir backend
