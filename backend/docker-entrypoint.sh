#!/bin/sh
set -e

if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  uv run --no-sync alembic upgrade head
fi

exec uv run --no-sync uvicorn orion.main:app --host 0.0.0.0 --port 8000
