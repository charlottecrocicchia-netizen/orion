# Changelog

All notable changes to Orion are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Multi-country, multi-currency public data schema (ADR 0002): funders,
  programmes, calls, projects, organisations (+ extensible identifiers and
  aliases), participations, topics, countries and exchange-rate reference
  tables; pg_trgm/unaccent enabled, pgvector-ready Postgres image.
- Ingestion core: cached downloads, Pydantic row validation with drift
  guards, idempotent batched upserts, per-run journal, `orion-ingest` CLI
  and a real `make ingest`.
- CORDIS pipelines (Horizon Europe, H2020, FP7) with committed fixtures and
  integration tests — first real load: 84 452 projects, 80 225 raw
  organisations, 463 147 participations.
- `GET /api/sources` (freshness and volumetry per source) and a homepage
  data card showing live totals.
- Data source register (`docs/data-sources.md`) with verified licences.

### Fixed

- Keep the Python venv outside the iCloud-synced tree (iCloud corrupts
  `.pth` files); pin uv to managed interpreters away from Anaconda.

## [0.0.1] - 2026-07-31

### Added

- Modular FastAPI backend skeleton: `/api/health` (API + database checks),
  OpenAPI at `/api/docs`, environment-based settings, Alembic baseline
  migration (`ingestion_runs` journal table), pytest suite.
- React SPA skeleton: Vite + TypeScript, Tailwind CSS v4 with shadcn-style
  components, dark mode, EN/FR i18n, live system-status card, vitest suite.
- Local development stack (`make dev`) and full production-like Docker stack
  (`make up`): Postgres 16, API, static web served by Caddy, Caddy edge with
  automatic TLS support.
- CI on GitHub Actions: ruff + oxlint + pytest + vitest + Docker image
  builds; images published to GHCR on `main`; manually triggered deploy job.
- Generic VPS deployment kit (`infra/deploy.sh` + `infra/README.md`
  runbook) — hosting target intentionally deferred.
- Founding documents: BRIEF (product vision), ADR 0001 (stack), phase 0 plan.
