# Infrastructure

Orion runs as a small Docker Compose stack: Caddy (TLS + reverse proxy) in
front of a static web container, the FastAPI container, and Postgres. A
`scheduler` container sits behind a profile. The same
[compose.prod.yml](compose.prod.yml) powers both the local
production-like stack (`make up`) and the VPS — one file, two `.env`.

## Production today (2026-08-24)

| | |
| --- | --- |
| Site | **https://lensorion.com** — HTTPS via Let's Encrypt, obtained and renewed by Caddy; `www` redirects to the apex (`CANONICAL_HOST`) |
| Host | OVH VPS, Ubuntu 26.04 LTS, 4 vCPU / 7.6 GiB RAM / 72 GB disk — live since 2026-08-21 |
| Access | `ssh orion-vps` (key only; password auth disabled). The clone lives at `~/orion`, the stack is driven from `~/orion/infra` |
| Images | **Built on the server from its own clone** (docs/conception-deploiement.md, D1). GHCR stays dormant: nothing is pulled from a registry |
| Application access | private — closed by an approved-email allowlist, see below |

The host address, the database password and the SMTP credentials live in
the server's `.env` (mode `600`, never committed) and nowhere else.
Nothing in this repo should ever carry them.

## Deploying a revision

The procedure is **atomic** and lives in [deploy.sh](deploy.sh) (hardened
by lock R1, 2026-08-23). It is no longer `git pull && make up`: the
ordering IS the guarantee — no window ever serves a new revision without
its schema.

```bash
DEPLOY_HOST=<host> DEPLOY_USER=<user> ./infra/deploy.sh
```

1. `git pull --ff-only` on the server — code only, nothing switches yet.
2. `make build` — fresh images, stamped with `GIT_REV`; the running stack
   keeps serving throughout.
3. Alembic `upgrade head` through `compose run --rm` — the **new** image
   migrates the production database **before** any switch. Migrations are
   additive, so the still-running old API does not suffer from it.
4. Reference data for the lot, when it requires any (manual — the script
   loads nothing by itself). Lot R1 for instance:
   `compose run --rm --no-deps api uv run --no-sync orion-ingest prices`,
   then `… orion-ingest rates`. **Verify before continuing.**
5. `make up` — containers switch over in seconds, schema and data already
   in place.

The script then prints the revision stamp actually served and runs a
smoke test. After any manual deploy, check both by hand:

```bash
ssh orion-vps 'docker inspect ghcr.io/charlottecrocicchia-netizen/orion-api:latest --format "{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'
curl -fsS https://lensorion.com/api/health
```

### `GIT_REV` — the revision stamp

`make build` and `make up` export `GIT_REV` from
[scripts/source-rev.sh](../scripts/source-rev.sh); both `api` and
`scheduler` take it as a build arg (the scheduler builds last and would
otherwise overwrite the api's stamp), and the image carries it as the
`org.opencontainers.image.revision` label. The Desktop launcher compares
it and rebuilds rather than silently opening a stale stack. Two
consequences worth knowing:

- building outside the Makefile leaves the stamp at `inconnu`, which the
  launcher treats as stale — in doubt it rebuilds;
- the stamp describes the **images**, not the server's clone. A commit
  with no effect at runtime — tests, documentation, or a pure
  reformatting — is pulled without a rebuild, so the clone legitimately
  sits ahead of the stamp, and that gap is not a bug to chase.

  Before concluding that a build was skipped, measure instead of reading
  the diff: parse each changed file at both revisions and compare the
  syntax trees (`ast.dump(ast.parse(source))`). Identical trees mean
  identical behaviour however large the textual diff — that is how the
  2026-08-24 reformatting was cleared without redeploying. A tree that
  really differs on application code is the signal to rebuild.

### Two traps verified in production

- **The Caddyfile is a bind mount.** `docker compose up -d` does not
  recreate the container when only that file changes, and Caddy keeps
  serving the old configuration. After editing it:
  `docker compose --env-file ../.env -f compose.prod.yml restart caddy`.
- **A variable absent from `compose.prod.yml` does not exist in the
  container**, whatever the `.env` says. Adding a setting means adding
  the line to the compose file too (learned on `CANONICAL_HOST`,
  2026-08-21).

### Migrations

`deploy.sh` migrates explicitly before switching (step 3). The entrypoint
also migrates on start (`MIGRATE_ON_START`, default `true`) — that is the
safety net, not the plan. **Before any deploy that migrates the schema,
take a manual dump**: the nightly cron does not help when the morning's
commit is the thing that breaks.

### Rollback

- Application: `ssh orion-vps 'cd ~/orion && git checkout <rev> && make up'`
  — rebuilds and switches back to that revision.
- Data: restore the day's dump (docs/conception-deploiement.md, annexe C).
- Machine: OVH snapshot.

## Backups

Two independent layers, because they fail differently:

- **Logical dump, nightly.** [backup-db.sh](backup-db.sh) runs at 04:00
  from the `ubuntu` crontab, writes `~/backups/orion-<date>.dump`
  (`pg_dump -Fc`, ~1.4 GB today) and keeps 7 days. It covers a damaged
  *database* — a failed migration, a deletion — and allows a targeted
  restore without replaying the whole machine. Milestone dumps taken by
  hand before a risky lot sit beside them under explicit names
  (`orion-pre-r1-…`, `orion-pre-r3-…`); they are outside the rotation and
  must be pruned by hand.
- **OVH snapshots**, which cover the whole disk — the machine.

04:00 is chosen so the dump never overlaps the 05:00 calls refresh. A
backup that has never been restored is a hypothesis: the recette requires
a trial restore, not the existence of a file.

## Scheduled refresh — what actually runs

The `scheduler` container sits **behind the `scheduler` profile**, so
`make up` leaves it off on the laptop (a weekly full replay waking at 3am
on an 8 GB machine is a hosting job, not a laptop job). The VPS turns it
on with `COMPOSE_PROFILES=scheduler` in its `.env`.

There, it carries **only** the light job: `ORION_SCHEDULER_JOBS=calls` —
the EU Funding & Tenders calls, daily at **05:00 UTC**
(`ORION_CALLS_CRON`). The weekly full corpus replay (`ORION_INGEST_CRON`,
Monday 03:00 UTC) stays **off** by decision D5: the heavy corpus keeps
the "Mac + dump" regime. Setting `ORION_SCHEDULER_JOBS=all` on the server
would wake it up — a hosting decision, not a default to flip.

`ORION_INGEST_ON_START` is `false` in production (`true` populates a
fresh deployment on boot). Every run is journaled in `ingestion_runs` and
visible through `/api/sources`; downloads are cached in the `ingest_data`
volume and skipped when sources are unchanged.

## Approved emails — adding or removing one

Access is closed by an allowlist of approved emails
(docs/conception-workspace.md, amendment of 2026-08-21). There is no table
and no admin screen while the list fits on one hand: the list IS
`ORION_LOGIN_ALLOWLIST` in the SERVER's `.env`, comma-separated, compared
case-insensitively (both sides are lowercased), and **empty = door closed
for everyone**.

The gesture, on the server:

```bash
cd ~/orion/infra
# edit ../.env: ORION_LOGIN_ALLOWLIST=first@example.com,second@example.com
docker compose --env-file ../.env -f compose.prod.yml up -d --no-deps api
```

Recreating the `api` container is what makes the new value exist inside it:
settings are read at process start (`get_settings` is cached), so a running
container keeps the list it booted with. Only `api` is recreated — Postgres,
web and Caddy keep serving, and no session is dropped (sessions live in the
database). `make up` works too but rebuilds the whole stack, which this
change does not need: no code moves.

Removing an email closes the door to NEW magic links only; an existing
session survives until it expires. To cut access now, delete that user's
rows from `sessions` as well.

## Local production-like stack

```bash
make up      # builds images locally, serves http://localhost:8080
make down
```

`make up` generates a root `.env` with a random database password if none
exists, and stops the development database first — **one stack at a
time**: two Postgres instances on one 8 GB laptop compete for a VM macOS
is already paging out (measured 2026-08-04, docs/hebergement.md).

## Provisioning another server from scratch

The gestures that brought the current VPS up, kept so the machine stays
reproducible. Any Docker-capable VPS works; 4 vCPU / 8 GB is comfortable.

1. **Create the server** (Ubuntu LTS), add your SSH key, note its address.
2. **Install Docker**: `curl -fsSL https://get.docker.com | sh`, then
   `usermod -aG docker <user>`.
3. **Harden it**: full upgrade, SSH password auth off, firewall limited to
   22/80/443, and a swapfile if the provider ships none (OVH did not — an
   OOM-killer as the only recourse is not a plan). Each gesture with its
   proof is in docs/conception-deploiement.md, annexe A.
4. **Clone the repo** with a read-only deploy key (D2) — the server builds
   its own images (D1). Re-enabling GHCR would be a separate decision;
   the gesture is `docker login ghcr.io` with a GitHub PAT holding
   `read:packages`, minted by Charlotte and never stored in the repo or
   in a conversation.
5. **Create `~/orion/.env`** from [.env.example](../.env.example):
   `POSTGRES_PASSWORD` (strong, random), `SITE_ADDRESS` (list both apex
   and www so the certificate covers them), `CANONICAL_HOST`,
   `HTTP_PORT=80`, `HTTPS_PORT=443`, `ORION_PUBLIC_ORIGIN`,
   `ORION_LOGIN_ALLOWLIST`, the SMTP settings, and
   `COMPOSE_PROFILES=scheduler`.
6. **DNS**: an A record — and AAAA, the current host answers on IPv6.
7. **Deploy** with `./infra/deploy.sh`, then install the backup cron.
8. **Restore the R5-NSF raw archive** — it is NOT in git and NOT
   re-downloadable (the official series is restated without archives).
   Copy it from the old server or from the workstation, then verify:
   `rsync -av <source>/r5-nsf/ /home/ubuntu/archives/r5-nsf/` and
   `sha256sum -c SHA256SUMS` inside each vintage directory (manifests are
   also versioned in `infra/checksums/`). Without this step the server
   cannot replay the R5 ingestion (docs/runbook-nsf-obligations.md, § 1).

## Scaling path (in order, no rewrites)

1. Bigger VPS (vertical).
2. Managed Postgres (move `ORION_DATABASE_URL`).
3. Split services across machines / move behind a load balancer.

There is deliberately **no CI/CD**: deployment is manual and documented
(the Actions quota is exhausted until 2026-09-01, and a deployment one
understands comes before a deployment one automates). No external
monitoring either — the healthcheck and the OVH backup carry lot 1, to be
revisited when there are users to warn.
