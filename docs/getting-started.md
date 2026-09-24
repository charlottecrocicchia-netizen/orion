# Run Orion locally

[Repository home](../README.md) · [Documentation](README.md) · [Architecture](architecture.md)

This guide starts a development instance on your machine. It does not provide access to hosted accounts or private service data.

## 1. Prepare your tools

| Tool | Purpose |
|---|---|
| Git | Clone the repository. |
| Docker and Docker Compose | Run PostgreSQL 16 with pgvector. |
| [uv](https://docs.astral.sh/uv/) | Install Python and backend dependencies; Python ≥ 3.12. |
| Node.js 24 and pnpm 11 | Install and run the frontend, matching CI. |

Make sure your Docker engine is running and that `docker compose version`, `uv --version`, `node --version` and `pnpm --version` work.

On macOS, keep the repository outside iCloud-synced folders, for example in `~/dev/orion`. The Makefile places the Python environment in `~/.venvs/orion-backend` to avoid virtual-environment synchronisation problems.

## 2. Install and start

In a terminal:

```bash
git clone https://github.com/charlottecrocicchia-netizen/orion.git
cd orion
make bootstrap
make migrate
./scripts/claude-dev.sh
```

`make migrate` starts the database and applies migrations. The script then starts the API on port **8000** and the frontend on **5173**, with local sign-in configured.

These commands stop Orion's other local Docker stack before starting the development database. Do not run both modes at the same time.

## 3. Sign in

1. Open [localhost:5173/login](http://localhost:5173/login).
2. Enter **`dev@lensorion.test`**, the fictitious address approved by the script.
3. Submit the form and click the displayed **development link**.
4. Confirm sign-in on the next page if prompted.

Development mode sends no email. The server returns the link in `dev_link` and the interface displays it. Use `localhost` consistently rather than mixing it with `127.0.0.1`.

If the button does not appear, check that the API was started with `./scripts/claude-dev.sh`. Running `make dev` alone does not configure the approved-account list, so sign-in is closed by default.

## 4. Understand the empty database

A clone includes code and migrations, **not the full corpus**. Pages may therefore be empty after a successful installation.

To load public data into the development database:

```bash
make ingest
```

This can take several hours and use tens of GB across downloads, caches and the database. It is not required to read the code. Some sources depend on the availability of external services.

To list available loaders without starting ingestion:

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend" uv run orion-ingest --help
```

NSF annual obligations use a separate loader, excluded from `all`: see the [NSF runbook](runbook-nsf-obligations.md) (French). Automated journeys use their own test dataset through `./scripts/e2e-local.sh`; that harness recreates its `orion_e2e` database on each run.

## 5. Useful addresses and commands

| Address or command | Purpose |
|---|---|
| `http://localhost:5173` | Development interface. |
| `http://localhost:8000/api/health` | API health endpoint. |
| `http://localhost:5173/api/docs` | Interactive API documentation through the frontend proxy, after sign-in. |
| `make help` | List available commands. |
| `make lint` | Static analysis and formatting checks. |
| `make test` | Backend and frontend tests; requires Docker. |
| `Ctrl+C` in the script's terminal | Stop the development servers. |
| `make db-down` | Stop the development database. |

Before running end-to-end tests, stop servers using ports 8000 and 4173, then install the browsers and start the harness:

```bash
(cd frontend && pnpm exec playwright install chromium firefox)
./scripts/e2e-local.sh
```

On Linux, Playwright may also require system dependencies. The harness uses Bash, `lsof` and the PostgreSQL tools inside the container.

## Configuration

The backend reads **`ORION_*`** environment variables. [.env.example](../.env.example) describes Docker stack and authentication settings. A root `.env` file is not automatically loaded by every Python command.

| Variable | Purpose |
|---|---|
| `ORION_DATABASE_URL` | PostgreSQL connection; the local default is in `core/config.py`. |
| `ORION_PUBLIC_ORIGIN` | Origin used to build sign-in links. |
| `ORION_LOGIN_ALLOWLIST` | Approved addresses, separated by commas; empty means no access. |
| `ORION_AUTH_DEV` | Return links to the interface without sending email; development only. |
| `ORION_SMTP_*` | Email delivery settings for a hosted instance. |

Do not commit real account lists, secrets or `.env` files. Use fictitious addresses in examples and issues.

## Alternative: the complete Docker stack

To run PostgreSQL, the API, the built frontend and Caddy together:

```bash
make up
# Website: http://localhost:8080
make down
```

`make up` creates a `.env` with a random database password if needed. Application sign-in remains closed until accounts are configured; this mode is separate from the development shortcut above. Read the [operations runbook](../infra/README.md) before configuring or deploying an instance.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Docker does not respond | Start Docker Desktop, OrbStack or Colima, then rerun `make migrate`. |
| `docker compose` is missing | Install the Compose plugin for your Docker installation. |
| The frontend will not start | Use Node.js 24 and pnpm 11, then rerun `make bootstrap`. |
| No sign-in link appears | Use the fictitious address and the script above; check the terminal for errors. |
| Results are empty | The database has no corpus yet: see step 4. |
| A port is already in use | Stop the previous instance before restarting; do not run multiple harnesses. |
| Python cannot find modules | Use `make`, or set `UV_PROJECT_ENVIRONMENT="$HOME/.venvs/orion-backend"` when running `uv`. |

If the problem persists, [open an issue](https://github.com/charlottecrocicchia-netizen/orion/issues/new/choose) with the command, your operating system and a log excerpt with personal data removed.
