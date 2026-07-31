# Orion

R&D funding intelligence for Europe — deep analytics on funded R&D projects
(CORDIS/Horizon Europe, ANR, ADEME, LIFE) combined with upcoming calls,
natural-language search and alerts.

**Status: Phase 0 — foundations.** Skeleton app, CI and deployment pipeline;
no real data yet.

> Product vision & roadmap: [BRIEF.md](BRIEF.md) (FR) ·
> Architecture decisions: [docs/adr/](docs/adr/) (FR) ·
> Phase plans: [docs/phases/](docs/phases/) (FR)

## Prerequisites

- **Docker** — any runtime: Docker Desktop, OrbStack, or Colima
- **[uv](https://docs.astral.sh/uv/)** — Python toolchain
- **Node.js ≥ 20** and **[pnpm](https://pnpm.io)**

macOS one-liner:

```bash
brew install colima docker docker-compose docker-buildx uv pnpm && colima start
```

(For `docker compose` to work with Homebrew's CLI, add
`"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]` to
`~/.docker/config.json`.)

## Quickstart — development

```bash
make bootstrap   # install backend + frontend dependencies
make dev         # Postgres (Docker) + API :8000 + web :5173, hot reload
```

Open http://localhost:5173 — interactive API docs at
http://localhost:8000/api/docs.

## Full production-like stack (all in Docker)

```bash
make up          # builds images, runs Postgres + API + web + Caddy
```

Open http://localhost:8080. Stop with `make down`.

## Commands

Run `make help` for the full list:

| Command | What it does |
|---|---|
| `make dev` | Hot-reload dev servers + dev database |
| `make test` | Backend (pytest) + frontend (vitest) suites |
| `make lint` | ruff + oxlint checks |
| `make up` / `make down` | Full local production stack |
| `make migrate` | Apply Alembic migrations |
| `make ingest` | Rebuild the database from public sources (phase 1) |
| `make deploy` | Deploy to the configured VPS (see [infra/](infra/README.md)) |

## Repository layout

```
backend/    FastAPI app — core/ api/ models/ ingest/ search/ analytics/
frontend/   React SPA — Vite, TypeScript, Tailwind
infra/      Production compose stack, Caddy, deployment kit
docs/       ADRs and phase plans (FR)
```

## Configuration

Everything is configured through environment variables — see
[.env.example](.env.example). Secrets never live in the repo.

## CI & deployment

Every PR runs lint, tests and image builds. Pushes to `main` publish
`orion-api` and `orion-web` images to GHCR. Deployment to a VPS is a
one-click CI job once a hosting target exists — the full runbook is in
[infra/README.md](infra/README.md).

## License

Proprietary — all rights reserved.
