# Changelog

All notable changes to Orion are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Orientation & identity: the home orients around intents (free-text ask,
  doors, computed momentum signals) below the restored hero; the world globe
  greets on the countries page with the flat map a toggle away (projection
  morph between the two, honest coverage note); the Explorer names its
  ready-made analyses, accepts free text, and wires the Map view for euro
  country views.
- The design doctrine (docs/design-doctrine.md) — the project's canonical
  design reference, applied in validated steps.
- Doctrine step 1, foundations: the full type scale as tokens (Inter
  tightened at display sizes, cv01/ss03, weights capped at 600), global
  tabular figures, hairline borders, ONE elevation shadow (`shadow-key`),
  Geist Mono for technical labels, and the StatHero — hero figure, KPIs and
  constellation drawn by one shared reveal (IntersectionObserver, once,
  reduced-motion safe). Motion and GSAP installed for step 2.

- Doctrine step 2, the signature hero in acts: the pinned hero (GSAP
  ScrollTrigger pin + scrub — the figure counts and the curve draws under
  the reader's thumb; mobile and reduced motion fall back to the step-1
  viewport reveal), the ink tile with three editorial entries replacing the
  four clicking cards (free-text ask kept, Phase 5 calls note kept), the
  proof act staging the Europe map with the momentum signals, and the dense
  parchment footer exposing the whole information architecture.

### Changed

- Display face: Instrument Sans retired; Inter (tightened, alternate glyphs)
  is the single family, with the hero at clamp(80-120px)/500/−0.032em.
- The hero gradient leaves violet for a deep-ultramarine ramp (doctrine trap
  #2), widened light-to-deep on its own tokens; the constellation line wears
  the accent.
- page-enter now fills backwards, not both — `both` kept an identity
  transform on <main>, silently re-parenting fixed descendants (the hero
  pin) to the scrolling flow.

## [0.3.0] - 2026-08-01

Phase 3 — analytics and geography.

### Added

- The theme dimension: euroSciVoc level-2 rollup (41 themes, French labels
  in the FR interface) across the Explorer, with trend stories and the
  multi-theme counting rule stated on the view.
- Recurring partners on every organisation hub — a collaboration
  constellation beside the ranked list — plus cross-border country flows.
- The Europe choropleth as the geographic entry: 38 pre-projected countries
  (17 kB, no runtime dependency), sequential funding scale, per-country
  collaboration arcs on hover, cinematic zoom into the country hubs.
- The organisation benchmark (/compare): up to four organisations side by
  side — KPIs, superposed funding lines, top themes and partners — with a
  type-to-add picker and a Compare action on every hub.
- The phase-3 demo journey (map → hub → partners → benchmark → theme trend
  → CSV export) automated in CI.

### Fixed

- ANR programme referential: case duplicates merged (Blanc/BLANC…) and
  year-as-code rows resolved through their names (SATT existed as «2010»
  and «2025») — 474 → 453 roots, loader canonicalizes from now on.

## [0.2.0] - 2026-08-01

Phase 2 — search and navigation. Orion becomes a product you can walk
through: the five-minute demo journey (bilingual search → filters →
project → organisation → country hub → back) runs end to end on the
« Lumière » design direction, and the Explorer turns the dataset into
composable, shareable views.

### Added

- Bilingual full-text search (English and French analysed side by side,
  typo-tolerant organisation search) with facets, URL-driven filters and
  highlighted snippets.
- The full « Lumière » interface: home with the animated funding
  constellation, project pages, the unified hub template for organisations,
  countries and programmes, explore-from-here exits everywhere, FR/EN,
  light and dark themes, ⌘K search palette. Lists carry a visual spine:
  results grouped under their funding frame, best-match organisation card,
  activity sparklines, and a six-hue series palette validated for
  colorblind separation and contrast in both themes.
- The Explorer: composed views (metric × dimension × comparison × filters)
  behind one whitelisted aggregate endpoint — auto-selected charts with an
  accessible table twin, shareable canonical URLs, CSV export with licence
  attribution, and six curated story cards.
- The five-minute demo journey is automated with Playwright and runs in CI
  against a seeded database.

### Changed

- Search latency: the FTS match set is materialized once per query and every
  aggregate is cached by ingestion stamp ("hydrogen" 695 → ~100 ms cold on
  the full stack; hubs and repeat views serve in single-digit milliseconds).
- Organisation types from the two source taxonomies collapse into eight
  canonical labels; CORDIS activity codes now take precedence over ANR
  free-text categories at merge and re-ingestion time (the CEA is a research
  organisation again), with a scripted repair for rows merged before the rule.

### Fixed

- Deduplication now keys on names in any script. The comparison key kept
  only ASCII characters, so Greek, Cyrillic and CJK names collapsed to an
  empty key and were silently excluded from deduplication — harmless today
  (20 organisations) but blocking as soon as non-Latin sources are added.
- A name wrapped entirely in parentheses is no longer erased by the
  qualifier-stripping rule.

### Removed

- Organisations left with no participation at all are dropped at the end of
  the deduplication pass (192 on the current data): Orion only describes an
  organisation through the projects it took part in.

## [0.1.0] - 2026-07-31

Phase 1 — past funded projects. The database now rebuilds from scratch with
one command (`make ingest`): 119 172 projects, ~103 500 deduplicated
organisations and 581 006 participations across CORDIS (Horizon Europe,
H2020, FP7) and ANR, refreshed weekly by a scheduler container.

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
- ANR pipeline (DGDS 2005-2009, DGDS 2010+, DGPIE): 34 720 projects and
  117 859 participations, with RNSR as the organisation pivot identifier,
  French/English title tagging, and country names resolved to ISO codes.
- Data source register (`docs/data-sources.md`) with verified licences,
  including the ANR ODbL share-alike alert and the ADEME scope finding.

- Organisation deduplication (`orion-ingest dedup`): a normalized-name key,
  an exact merge on country plus that key, then a cautious trigram pass —
  guarded so organisations holding different strong identifiers (PIC, SIREN,
  RNSR…) are never merged, and short names never matched fuzzily. First real
  run: 8 142 merges (7 293 exact + 849 fuzzy), 3 234 blocked by the
  identifier guard; 111 791 → 103 649 organisations.
- Weekly refresh scheduler container (Monday 03:00 UTC, `ORION_INGEST_CRON`)
  replaying the full pipeline with cached downloads; every run journaled.

### Changed

- Tests now create and migrate their own database instead of reusing the
  development one, so assertions no longer depend on what has been ingested
  locally (and the suite runs in seconds).

### Fixed

- Keep the Python venv outside the iCloud-synced tree (iCloud corrupts
  `.pth` files); pin uv to managed interpreters away from Anaconda. The
  repository itself moved to `~/dev/orion`, outside iCloud, on 2026-07-31.
- Declare the trigram indexes on the models so autogenerated migrations stop
  proposing to drop the indexes the dedup step relies on.
- Backfill an organisation's country when a later row supplies one, instead
  of leaving it unset from its first, country-less sighting.

### Security

- ANR partner files carry personal data (scientific lead name, first name,
  ORCID). Those columns are dropped while reading the file, so they never
  reach the database or the raw payload — enforced by a test.

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
