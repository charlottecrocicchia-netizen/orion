# Orion

Public R&D funding, traced and made legible. Orion ingests funded-project
corpora from the world's major public funders — **CORDIS** (FP7, H2020,
Horizon Europe), **NIH RePORTER** and **NSF** (awards and official
obligation series) — resolves organisations and corporate groups
(GLEIF, Wikidata), and serves curated *lenses* (space, aviation) over an
explorer, country/organisation/programme hubs, a money-trail chain, and
open-call tracking.

**Status: in production at [lensorion.com](https://lensorion.com).**
The application is **private** (magic-link sign-in over an allowlist;
the landing page is public). Corpus at the 2026-08-21 reference state:
**699 798 projects · 110 116 organisations · 1 102 270 participations**,
majority-US by value since NIH/NSF ingestion. Amounts can be viewed in
current euros, constant euros, index-100, growth, % of GDP, per-capita
and PPP terms (the Reference Engine, backed by World Bank/Eurostat/BLS
series).

> Living documentation: [CHANGELOG.md](CHANGELOG.md) ·
> design docs & runbooks: [docs/](docs/) (FR) ·
> ADRs: [docs/adr/](docs/adr/) (FR) ·
> founding brief, kept as an archive: [BRIEF.md](BRIEF.md) (FR)

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

> **Keep this repo out of iCloud-synced folders** (`~/Documents`,
> `~/Desktop` with Desktop & Documents sync): iCloud corrupts Python venvs
> (hidden flags on `.pth` files, " 2" conflict copies). The canonical
> location on the founder's machine is **`~/dev/orion`**. As belt and
> braces, the Makefile keeps the venv outside the repo in
> `~/.venvs/orion-backend`; if you call `uv` directly instead of `make`,
> set `UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend"` first.

## Quickstart — development

Orion is a **private application**: with no auth configuration the door
is closed for everyone (empty allowlist = nobody signs in). The dev
scripts configure it for you — use them, not bare `make dev`:

```bash
make bootstrap            # install backend + frontend dependencies
make db-up migrate        # dev Postgres (Docker) + schema
./scripts/claude-dev.sh   # API :8000 + web :5173, auth in dev mode
```

Open http://localhost:5173/login and sign in as `dev@lensorion.test`:
in dev mode (`ORION_AUTH_DEV=1`) no email is sent — the magic link is
returned in the HTTP response (visible in the network tab or `curl`).
Interactive API docs: http://localhost:8000/api/docs.

`make dev` starts the same stack **without** auth configuration — fine
for API-only work, but the web app will refuse every sign-in.

The database starts empty. To load the corpus, either ingest from the
public sources (`make ingest` — hours, tens of GB) or restore a
production dump (see `docs/outillage-local.md` and
`docs/conception-deploiement.md`, annexe C). On the founder's machine,
`infra/launcher/install-local.sh` installs **Orion.app** / **Stop
Orion.app** for a one-double-click local stack.

## Tests and local acceptance

```bash
make test               # backend (pytest) + frontend (vitest)
./scripts/e2e-local.sh  # the full Playwright suite in its own harness
                        # (dedicated seeded orion_e2e database — never
                        # touches your dev data)
```

## Full production-like stack (all in Docker)

```bash
make up          # builds images, runs Postgres + API + web + Caddy
```

Open http://localhost:8080. Stop with `make down`.

## Commands

Run `make help` for the full list:

| Command | What it does |
|---|---|
| `make dev` | Hot-reload dev servers + dev database (no auth config) |
| `make test` | Backend (pytest) + frontend (vitest) suites |
| `make lint` | ruff + oxlint checks |
| `make up` / `make down` | Full local production stack |
| `make migrate` | Apply Alembic migrations |
| `make ingest` | Rebuild the database from public sources |
| `make deploy` | Deploy to the VPS via `infra/deploy.sh` (manual, behind the snapshot gate — see [infra/](infra/README.md)) |

## Repository layout

```
backend/    FastAPI app — src/orion/{core,api,models,ingest,search}, alembic/, tests/
frontend/   React SPA — Vite, TypeScript, Tailwind; e2e/ (Playwright)
infra/      Production compose stack, Caddy, deploy.sh, backup, launcher
scripts/    Local harnesses: dev, claude-dev, orion-local, e2e-local
docs/       Design docs, runbooks, ADRs, audits (FR)
```

## Configuration

Everything is configured through environment variables — see
[.env.example](.env.example). Secrets never live in the repo. The auth
door is governed by `ORION_LOGIN_ALLOWLIST` (empty = closed for
everyone) and `ORION_AUTH_DEV` (dev mode: links returned, no email).

## CI & deployment

CI (GitHub Actions) runs lint, tests, the Playwright journeys and image
builds on every push and PR — with hard timeouts on every job.
**Deployment is deliberately manual**: `./infra/deploy.sh` performs an
atomic update on the VPS (pull → build → migrate → switch), always
behind the founder's snapshot gate. The full runbook is in
[infra/README.md](infra/README.md).

## License

Proprietary — all rights reserved. Source-data licences and
attributions are listed in-app (`/about-data`) and in
[docs/data-sources.md](docs/data-sources.md).
