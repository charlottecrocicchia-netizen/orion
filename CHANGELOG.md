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

- The act-3 globe (validated V1): slow world rotation stopping at first
  hover, real partner constellations on hover (top-5 flows as stars sized
  by amount), click slides the globe left and opens the country panel —
  the country's photo under an ink→ultramarine duotone (per-image
  Wikimedia licence audit in country-photos.json: FR public domain,
  ES/IT/NL CC0; abstract duotone fallback elsewhere), plain-language
  figures, top themes, main partners, one full CTA to the country file.

- Doctrine step 4, the record pages: organisation and country files lead
  with a display-size hero figure and their trajectory drawing itself on
  entry, body sections on the left, the quiet Attio metadata sidebar on
  the right (at-a-glance figures, momentum delta, mono identifiers, the
  page's single full CTA); the benchmark opens on "Totals, compared" —
  horizontal bars in each column's series color, length as the
  perceptual encoding.

- Lot 1 of the journeys chantier — the palette suggests as you type
  (Vega lesson U7): a real APG combobox over ⌘K — projects by acronym,
  organisations typo-tolerant (server trigram, bounded cache), themes and
  countries matched locally (accent-insensitive, localized via i18n and
  Intl.DisplayNames), grouped options, arrow-key active descendant, and
  plain Enter keeping the old full-text reflex. Brand hygiene (U2): the
  visible name now lives in one place (VITE_APP_BRAND → BRAND constant,
  i18n {{brand}}, %VITE_APP_BRAND% in index.html).

- Lot 2, the watch-post: organisation files gain their thematic profile
  (top-5 level-2 themes over the organisation's own participation
  amounts, share of portfolio, the multi-theme counting rule stated) and
  thresholded Signals — an accelerating theme only speaks when both
  windows carry ≥ €500k and ≥ 5 projects (2022-24 vs 2019-21), new
  partners only when a first shared project is under 24 months old, and
  the count says "50+" at the server cap instead of posing as a total;
  below the floors, nothing shows. The sidebar states "consolidated
  file — N source names merged" from the aliases (the group layer's UI
  precursor).

- Lot 3, the Angles: a ready-made analysis now opens as a DECK — the
  same question under several looks, slid horizontally (CSS scroll-snap,
  the next slide peeking Apple-style, arrows, arrow keys, dots), every
  angle a real Explorer state and URL (?angles=story&angle=n deep-links,
  guarded against smooth-scroll downgrades), the composer mirroring the
  active angle so any edit hands over cleanly. The bump chart joins the
  library (ranks over time, gap-safe, halo direct labels) as the "Ranks"
  view of every split temporal state; the Explorer's state grammar and
  twin table are extracted into shared modules on the way.

- Lot 3 recette (validated, three retouches): the dumbbell joins the
  library (B3) as the "Before / after" view of split temporal states —
  two windows summed per series, sorted by who moved, windows derived
  from MATURE years only (current year − 2, the watch-post convention)
  so right-censored recent commitments never read as a fake collapse;
  the theme-race deck trades its static standings for it, and the
  hydrogen deck's country angle now leads with the map.

- The interactive donut (deck recette, doctrine amendment): part-of-whole
  now reads as a DESIGNED donut — at most seven slices (top six plus an
  honest "others" computed from the view's full server-side total), fixed
  series colors with a neutral for the remainder, a living center (view
  total at rest, the hovered slice otherwise), and the legend as the
  accessible surface (full labels, real buttons). On the programme
  dimension a click DRILLS into the slice: a new whitelisted `programme`
  parameter groups a framework by its direct children (additive metrics
  only, Python fold over the cached hierarchy, the parent's own projects
  kept as a "directly on the programme" slice, `programme_label` returned
  for the composer chip) — the URL carries the drill, "‹ back" leads out,
  and a childless programme says so instead of drawing a one-slice ring.

- Lot 4, the dossier (mockup v2 validated): collect → assemble → take
  away. "+ Add to dossier" on the Explorer board and on every deck's
  active angle; a discreet "▤ Dossier · N" counter appears in the header;
  /dossier assembles the collected views as an EDITORIAL page — display
  title with a smart default, every block a LIVING Explorer view over its
  mono provenance line (request sentence, data date, licences, "open the
  living view"), quiet per-block actions (reorder, rename, annotate as an
  accent-edged margin voice, remove), ONE "Take away" CTA printing one
  section per page. A session object by decision: localStorage, the same
  view never collected twice, accounts (P6) will make it durable — the
  page says so.

- Site architecture, lots A-C (principle validated on the mockup): the
  header navigates by INTENT — Discover, Analyse, Build, Workspace —
  four short disclosure menus (APG pattern: Escape, outside click, route
  change close) where every entry carries its one-line description and
  future doors wear a dated mono badge. The ready-made analyses get
  their own library page (/analyses, decks first as editorial rows, the
  Explorer keeps a short renvoi); /calls and /workspace are ELEGANT
  dated placeholders — display title with gradient accent words over a
  faint ultramarine wash, hairline feature lines, staggered soft
  reveals, the bridge to what already exists, one honest closing line,
  no form. The header scope pill is hidden while a single zone exists
  (the URL mechanics stay for wave 1 and the P6 zone subscriptions);
  the footer sitemap gains the new pages.

### Changed

- On a map, the first click explores — it never teleports (founder rule):
  everywhere a country shape is clickable (the countries page's globe AND
  flat map, the home globe, every Explorer map view), the first
  activation SELECTS — highlight, pinned flows, the summary beside (the
  full country panel on the countries page and the home, a compact
  summary bar with "Open the country file" in Explorer views) — and the
  file opens only on a distinct gesture: the panel's CTA, or a second
  activation of the already-selected country (which keeps the cinematic
  zoom). Keyboard rides the same path: globe countries are now focusable
  buttons (Enter/Space, focus stops the spin and lights the flows), map
  shapes carry aria-pressed, and the legend hint says the rule.

- No label is ever truncated (new recette rule): SVG direct labels wrap
  to two lines (bump ends, line ends, with the cascade reserving the
  extra height), treemap cells show their label in full or not at all
  (never sliced mid-word), list rows and palette options wrap instead of
  `truncate`, composer chips carry full programme and theme names. The
  breadcrumb keeps a sanctioned short form (full name in the h1 below);
  the partner constellation keeps short radial labels cut at word
  boundaries with a visible ellipsis (the adjacent list carries full
  names).
- Static horizontal bars are never a default view anymore (founder
  rule): geographic euro views lead with the map, summable metrics lead
  with the designed donut when the view fits it (limit ≤ 7 — a
  deliberate long ranking leads as bars), and part-of-whole is never
  offered for rates and averages (it would lie); bars stay available as
  an explicit choice.
- Treemaps have left the product (founder decision at the deck recette):
  the component is deleted, every treemap view and URL now renders the
  donut — the hydrogen programme angle drills into the frameworks, the
  Brexit programme angle follows, and "who gets funded" reads as
  trajectories (split lines) instead of a static ranking.
- In angles mode the interactive composer steps aside: the deck presents
  itself — the question as title, the active angle as one read-only
  sentence, and a single "Open in the composer" exit at deck level
  (the per-slide links are gone).
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
