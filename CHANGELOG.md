# Changelog

All notable changes to Orion are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed

- **The ANR corpus leaves Orion, permanently** (founder decision,
  2026-08-03): its ODbL 1.0 share-alike clause is a legal risk a
  commercial SaaS does not take, and the target market is international.
  Migration `0010_remove_anr` deletes 34 720 projects, 117 859
  participations, 59 957 texts, 450 programmes and the organisations
  left orphaned; the loader, its tests, its fixtures and its download
  cache leave the repository in the same commit — keeping a loader for a
  banned source would be a trap. The ODbL isolation study is cancelled,
  and the go-live blocker it carried disappears with it. Corpus after
  removal: 464 727 projects, 96 670 organisations, 842 493
  participations, €615.7B.

- The LICENCE RULE is engraved in the registry, opposable to every
  future source: only public domain, CC0, CC-BY, Licence Ouverte, OGL or
  an equally limpid licence enters Orion; any share-alike clause, any
  legal grey zone, any non-commercial or negotiated-redistribution
  licence is a permanent exclusion — verified at the source on loading
  day, every time. The wave-1 sources were re-screened: NIH, NSF, SBIR,
  USAspending, UKRI, Grants.gov and OpenAIRE pass; SNSF, NWO and Vinnova
  are marked conditional — a grey zone will mean exclusion, not
  arbitration.

### Added

- Vague 1, étape 1 — NIH RePORTER is loaded (380 275 projects, 379 346
  participations, 358 911 abstracts indexed, 77 institutes as
  programmes, 1 722 398 yearly slices folded; FY2005-2025, FY2026 not
  published yet). The registry's TRANSVERSE CONVENTION is written first
  and applied here in readable SQL — a yearly slice is not a project,
  the amount is the sum of the slices with sub-projects folded, the time
  axis stays the calendar date, the native currency is kept and the EUR
  figure converts at the ECB annual rate of the start year (new `rates`
  loader: 198 yearly rates, 9 currencies ready for UKRI/SNSF/Vinnova).
  Personal data (investigators, program officers) is dropped at the
  door, as for the ANR. The corpus grows from €211B to ~€650B and every
  "EU + FR" label became "public R&D" — a displayed promise must stay
  true the day the data changes.

- Vague 1, étape 0 — the identity layer runs FOR REAL: the groups
  schema (canonical layering — dated, weighted, JV-flagged memberships;
  entities never merged), the GLEIF Golden Copy mirror (3 391 838 LEI,
  258 260 ACTIVE consolidation links, CC0 re-verified), Wikidata parent
  pairs (3 098, ISO-17442-guarded), and the three-pass builder:
  conservative name+country bridges (11 030 organisations bridged,
  ~10.7 %), reporting exceptions for bridged LEIs (17 208), and 1 457
  groups with 2 638 memberships — Siemens 56 entities, Thales 27,
  Airbus 17, Safran with its Goodrich/Crompton acquisitions. Curation
  survives every rebuild (tested); `make identity` and the weekly
  scheduler replay the chain. Real-run lessons folded in: free-text
  registry ids, strict LEI shape, bridges rebuilt whole. Instruction
  findings on the registry: the ANR publishes no SIREN (LEI→SIREN
  captured on the GLEIF side, ready); JVs and state heads queued for
  the curation pass.

## [0.4.0] - 2026-08-03

The UI chantier, closed. Orion carries its design doctrine end to end:
the intent navigation and the home in acts, the Explorer's designed
forms (interactive donut, before/after, maps that select first), the
composable search with shared destination intelligence, the session
dossier fillable from every rich page, the ACTUALITÉS front page on the
decks' gesture, and the organisation file as the demo page. Every
founder recette of the wave is validated — including the Firefox
carousel freeze, closed for good on her console.

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

- The composable search ships (principle validated on the mockup): on
  /projects and /organisations one bar turns free typing into TYPED
  TAGS — country, funder, programme, years — with the bilingual free
  text for the rest; APG combobox on the palette's keyboard language,
  Backspace pops the last tag, tags pop in with a micro-entrance, the
  whole state lives in the URL so the existing facets pose tags for
  free; the empty state teaches the gesture with three one-click
  examples instead of showing the directory.
- Home ambiance (grande recette): the ink tile rises toward the reader
  on entry; the ask's placeholder TYPES the product's example questions
  in a loop (static under reduced motion); the globe shows the WHOLE
  sphere and visibly keeps turning — pausing on hover/focus/drag and
  resuming after, selection included — with three trial rotation paces
  under it (the founder compares live, the winner gets pinned).
- Programmes reorganize by SOURCE: the root lists funding agencies as
  editorial rows; a source's programmes only unfold inside
  (?funder=code) with an instant filter — a new agency lands as one
  more row, never a redesign.
- Seven more curated country photos in one pass (CC0/public domain
  strict, per-image API licence check, one-by-one visual review with
  named rejections): BE, DK, SE, PL, GR, IE, FI — 13 countries covered;
  uncurated countries now show their own SILHOUETTE as a light
  watermark over the deep ultramarine ramp — an owned composition, not
  a gap.
- The Discover pages stop being directories (grande recette): the
  programmes page regroups by frame — the three EC framework programmes
  as editorial rows, the ANR's 450 national programmes as a dense list
  sorted by funding, one instant filter over both, no more uniform
  cartouches; the themes index (/explore/themes) opens the missing door —
  the 41 euroSciVoc disciplines with their weight, corpus share,
  twenty-year spark and mature-windows movement, sortable by funding or
  momentum, every row opening the Explorer pre-composed on that
  discipline (the aggregate limit cap rises to 50 to serve all 41 in one
  call); the home ink tile says the four VERBS with living content
  behind each — the corpus' top organisation's file, the hydrogen deck,
  your actual session dossier — and the future verb stays visible,
  dated, unlinked.

- Official news join the home strip: a backend relay (/api/news)
  aggregates the institutional RSS feeds server-side — the European
  Commission's DG R&I news feed (the one rich official source; CORDIS
  retired its public news RSS and the ANR's feed is currently an empty
  shell, kept configured so items appear the day it fills) — short
  per-feed timeout, 30-minute cache, STALE-ON-ERROR (a dead feed serves
  the last good read, an empty roster yields an honest empty list).
  The strip interleaves them with Orion's computed stories, each news
  opening AT ITS SOURCE in a new tab, dated, refreshed automatically.
- Country matching goes MULTI-LOCALE (recette: "Allemagne" under an
  English interface returned 404 text hits): a shared matcher carries
  every country's names in all match locales (fr, en — extensible)
  plus the corpus name, wired into the composable bar AND the ⌘K
  palette; the displayed label stays the interface language. Locked by
  an e2e test in the founder's exact gesture (EN interface, FR typing).
- The news strip auto-advances for real: the hold is judged at tick
  time on actual pointer INTENT (a recent move over the strip, or real
  focus) — hover state, whether events or :hover, goes stale when the
  strip slides under a motionless cursor during scroll, the same
  phantom-hover family that froze the globe.

- The news strip becomes ACTUALITÉS, a front-page stage (recette: the
  thin band was too small, too quiet): one story at a time fills a tall
  frame — the official picture under the ink scrim when the feed
  carries one (the relay now extracts image enclosures), strong display
  typography on the deep brand ramps otherwise (ink for computed
  stories, ultramarine for imageless news) — with a clear "Actualités"
  section title, arrows, dots, a brisk 5-second cadence and a hairline
  progress bar that freezes with the reader's real hold; the snapping
  rise-and-fade transition stays static under reduced motion.

- Every search bar proposes DESTINATIONS while typing (recette
  2026-08-03: "I type Safran in the projects bar and there is no obvious
  path to the Safran page"): the ⌘K palette's matching is extracted into
  ONE shared intelligence (lib/destinations — server trigram for
  organisation and project files, local multi-locale vocabularies for
  themes and countries) and consumed by the palette, the composable
  bars ("Aller à" group below the filters — plain Enter keeps its
  validated meaning) and the home ask (now a real combobox; the free
  ask stays the first option). "Safran → the organisation file",
  "hydrogen → the theme", "Allemagne → the country", from anywhere.

- "+ Add to dossier" on the rich pages (same recette: "the dossier is
  only worth it if you can fill it from everywhere"): the organisation
  file collects its funding trajectory, the country file its years, the
  benchmark its compared trajectories — each as a LIVING Explorer view
  with an honest default title, through one shared CollectButton wearing
  the Explorer's own pill and acknowledgement.

- The organisation file becomes THE demo page (lot 4 bis, enlarged by
  the founder: "beautiful and rich, not merely complete"): the record
  hero now opens onto numbered ACTS in the decks' grammar — 01 · the
  yearly timeline with the ROLE SPLIT (coordinated stacked under
  participated, series colors, one readout line spelling the hovered
  year role by role; the API's funding_by_year now carries
  coordinated_eur and project counts) with three stat tiles; 02 · the
  COLLABORATORS MAP (new /partner-countries endpoint — every partner
  country, distinct partners and shared projects; Europe choropleth in
  sequential accent steps, select-first rule and keyboard intact,
  beyond-the-map countries listed honestly) beside the recurring
  partners list. The abstract partner graph gives its slot to the map.

- The freeze had a name: FIREFOX (caught by the joint console
  diagnostic — 37–51 px "moves" from an untouched mouse are Firefox
  re-emitting pointermoves on scroll with page-relative offsets).
  Pointer intent is now measured in SCREEN coordinates, the one frame
  scrolling can never move; the hold window drops from 8 s to 4 s (a
  carousel's courtesy, not a parking brake); and the ticker e2e suite
  runs on BOTH engines (a firefox Playwright project, installed in CI).
  Honest limit: synthetic wheel events cannot reproduce Firefox's
  re-emission, so the founder's console remains the final judge — the
  diagnostic mode stays available.

- The news carousel explains itself (the founder's freeze survives our
  fixes, so the component becomes debuggable in her real conditions):
  localStorage `orion.debug.ticker=1` turns on a throttled console
  diagnostic — driver started/inactive (reduced-motion, story count),
  WHY the feed is held (pointer intent with event counters and last
  delta, keyboard focus with the focused element, rail in motion) and
  every advance. Hardening: pointer intent now requires a REAL move
  (> 1.5 px per event) — an idle mouse's sub-pixel drift and Chrome's
  synthetic post-scroll pointermoves no longer count.

- ACTUALITÉS v2, the newspaper front (recette: the big rounded slab was
  ugly; studied live on Apple Newsroom and Linear's Now): a full-width
  BAND between two hairlines — mono kicker, huge ink title and one exit
  on the page ground to the left, the visual matter filling the right
  pane behind a vertical rule. Imageless stories now carry GENERATIVE
  drawings from our own data (Linear's lesson): the duel draws its two
  compared bars, the breakthrough its rising line, the big grant its
  giant figure, the movement its real twenty-year spark, and imageless
  official news a constellation seeded by the title. The band is a
  scroll-snap RAIL — the Angles decks' exact gesture (swipe, trackpad,
  arrows, arrow keys, dots) with their skipSync/arrival grammar — at a
  true carousel cadence (3.8 s), the bottom hairline doubling as the
  progress fill, and the whole section revealing itself on scroll
  (rise-and-settle, reduced-motion safe).

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

- PostgreSQL ran on its defaults while the corpus quadrupled: searches
  matching many rows fell to seconds (9.4 s for "cancer"). Tuned in both
  compose files (shared_buffers 1 GB, effective_cache_size 3 GB,
  work_mem 64 MB) — measured 9.4 s → 1.9 s, "quantum" 1.7 s → 0.22 s.
  The tuning then exposed Docker's 64 MB /dev/shm cap, which made a big
  organisation's partners endpoint answer 500 ("No space left on
  device"): `shm_size: 1gb` added. Remaining gap over the 300 ms budget
  (facets over huge match sets) is documented as its own chantier.

- The news band's progress bar froze mid-flight (recette 2026-08-03,
  third of the phantom family): ANY focus inside the section held the
  carousel, and in Chrome a click — an arrow, a dot, the rail itself —
  parks focus there until you click elsewhere. Only KEYBOARD focus
  (:focus-visible) counts as reading intent now; and pointer intent is
  stamped only when the cursor's viewport position actually changed,
  killing Chrome's synthetic post-scroll pointermoves. The e2e plays
  the real gesture: click the arrow, leave the page alone, demand two
  consecutive auto-advances.

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
