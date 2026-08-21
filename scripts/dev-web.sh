#!/usr/bin/env bash
# Start the Lumière frontend (Vite / TanStack Start dev server).
# Usage: ./scripts/dev-web.sh
set -euo pipefail
cd "$(dirname "$0")/../lumiere-the-index-codebase"

echo "Starting web on http://127.0.0.1:8080"
exec npm run dev
