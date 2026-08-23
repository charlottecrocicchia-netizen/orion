# Infrastructure

Orion runs as a small Docker Compose stack: Caddy (TLS + reverse proxy) in
front of a static web container, the FastAPI container, and Postgres. The
same [compose.prod.yml](compose.prod.yml) powers both the local
production-like stack (`make up`) and a future VPS.

**No hosting target is configured yet** (decision of 2026-07-31: local-only
for now). Everything below is ready so that going live is a formality.

## Going live on a VPS — runbook

Any Docker-capable VPS works (Hetzner CX32-class recommended, Scaleway if
"data hosted in France" matters commercially; 4 vCPU / 8 GB is comfortable).

1. **Create the server** (Ubuntu LTS), add your SSH key, note the IP.
2. **Install Docker**: `curl -fsSL https://get.docker.com | sh`, then
   `usermod -aG docker <user>`.
3. **Create the app directory and `.env`**: copy [.env.example](../.env.example)
   to `~/orion/.env` on the server and set:
   - `POSTGRES_PASSWORD` — a strong random value
   - `SITE_ADDRESS` — your domain (Caddy then obtains TLS automatically);
     keep `:80` until DNS exists
   - `HTTP_PORT=80`, `HTTPS_PORT=443`
4. **Clone the repo** on the server with a read-only deploy key
   (docs/conception-deploiement.md, D2) — the server BUILDS its images
   from the clone (D1). No registry pull: GHCR stays dormant until the
   CI publishes fresh images again — that day, re-enabling it is a
   separate decision, and the gesture will be `docker login ghcr.io`
   with a GitHub PAT holding `read:packages` (minted by Charlotte,
   never stored in the repo or a conversation).
5. **DNS**: point an A record of your domain at the server IP.
6. **Deploy**: `DEPLOY_HOST=<ip> DEPLOY_USER=<user> ./infra/deploy.sh`
   — which is exactly `ssh … 'git pull --ff-only && make up'` (the
   étape 9 runbook), plus the revision stamp and a smoke test.
   Rollback: `ssh … 'git checkout <rev> && make up'` ; data → dump
   restore (annexe C) ; machine → OVH snapshot.
7. **Backups**: enable provider snapshots; a `pg_dump` cron ships in phase 1
   together with real data.

## Scaling path (in order, no rewrites)

1. Bigger VPS (vertical).
2. Managed Postgres (move `ORION_DATABASE_URL`).
3. Split services across machines / move behind a load balancer.

## Local production-like stack

```bash
make up      # builds images locally, serves http://localhost:8080
make down
```

`make up` generates a root `.env` with a random database password if none
exists. The API applies Alembic migrations on start (`MIGRATE_ON_START`,
default `true`).

## Scheduled refresh

The `scheduler` container replays the full ingestion weekly (Monday 03:00
UTC by default — `ORION_INGEST_CRON`, crontab syntax). Downloads are cached
in the `ingest_data` volume and skipped when sources are unchanged; every
run is journaled in `ingestion_runs` and visible through `/api/sources`.
Set `ORION_INGEST_ON_START=true` to populate a fresh deployment on boot.
