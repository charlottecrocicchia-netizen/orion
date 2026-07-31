#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

trap 'kill 0' EXIT INT TERM

(cd backend && uv run uvicorn orion.main:app --reload --port 8000) &
(cd frontend && pnpm dev) &

echo ""
echo "  Web  → http://localhost:5173"
echo "  API  → http://localhost:8000/api/docs"
echo ""

wait
