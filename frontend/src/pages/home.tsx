import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { CountryPanel } from "@/components/country-panel";
import { NowTicker } from "@/components/now-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { StatHero } from "@/components/stat-hero";
import { WorldGlobe } from "@/components/world-globe";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { HOME_CAPS, useDestinations } from "@/lib/destinations";
import type { DestinationGroup } from "@/lib/destinations";
import { useDossier } from "@/lib/dossier";
import { parseIntent } from "@/lib/intent";
import { STORIES } from "@/lib/stories";
import { formatCompactEur, formatInt, formatOrgName } from "@/lib/format";
import { useRevealProgress } from "@/hooks/use-reveal-progress";

gsap.registerPlugin(ScrollTrigger);

/** The home in Apple acts (doctrine step 2). Act 1: the pinned hero — the
 *  scroll drives one progress, the figure counts while the curve draws
 *  (GSAP pin + scrub on fine pointers; the step-1 viewport reveal remains
 *  the fallback for mobile, reduced motion and jsdom). Act 2: the ink tile,
 *  edge to edge — the question, free text, and three editorial entries in
 *  place of clicking cards. Act 3: the proof — the Europe map staged full
 *  width with the computed momentum signals. */

/* Scrub floor: the first paint shows the gesture already begun (a quarter
 * of the figure, the curve's first reach) — in tension, never empty. */
const SCRUB_BASE = 0.12;

const pinnable = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 1024px)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useHeroPin(ready: boolean, onScrub: (p: number) => void) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ready || !ref.current) return;
    let st: ScrollTrigger | undefined;
    // Armed after the route's page-enter transform settles — a transformed
    // ancestor would break the pin's fixed-position math.
    const arm = window.setTimeout(() => {
      st = ScrollTrigger.create({
        trigger: ref.current!,
        start: "top top",
        end: "+=120%",
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => onScrub(SCRUB_BASE + (1 - SCRUB_BASE) * self.progress),
      });
    }, 420);
    return () => {
      window.clearTimeout(arm);
      st?.kill();
    };
  }, [ready, onScrub]);

  return ref;
}

function useIntentNavigate() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  return (text: string) => {
    const intent = parseIntent(text, i18n.language);
    if (!intent) return;
    navigate(`/${intent.to === "projects" ? "projects" : intent.to}?${intent.params}`);
  };
}

/* ——— Act 2: one editorial entry — a full-width row, not a card ——— */

function EditorialEntry({
  to,
  title,
  desc,
  figure,
}: {
  to: string;
  title: string;
  desc: string;
  figure: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group grid grid-cols-1 items-baseline gap-x-8 gap-y-1 border-t py-9 transition-colors sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <h2 className="font-display text-[clamp(24px,3vw,34px)] font-[540] tracking-[-0.022em] transition-colors group-hover:text-accent">
        {title}
        <span
          aria-hidden="true"
          className="ml-3 inline-block transition-transform duration-200 ease-out group-hover:translate-x-1.5"
        >
          →
        </span>
      </h2>
      <span className="tnum text-[15px] text-muted-foreground sm:text-right">{figure}</span>
      <p className="mt-1 max-w-[560px] text-[15px] leading-relaxed text-muted-foreground sm:col-start-1">
        {desc}
      </p>
    </Link>
  );
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const go = useIntentNavigate();
  const navigate = useNavigate();
  const dossier = useDossier();
  // The ink tile rises toward the reader as it enters (Apple entrance,
  // recette 2026-08-02); reduced motion lands it instantly.
  const tile = useRevealProgress(true, 850);
  // The ask breathes: the placeholder TYPES the example questions in a
  // loop (recette: "more presence, more alive") — real product examples,
  // static under reduced motion.
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const samples = [t("home.example1"), t("home.example2"), t("home.example3")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(t("home.freeTextPlaceholder"));
      return;
    }
    let sample = 0;
    let length = 0;
    let erasing = false;
    let timer = 0;
    const tick = () => {
      const current = samples[sample % samples.length];
      length += erasing ? -1 : 1;
      setTyped(current.slice(0, Math.max(length, 0)));
      let delay = erasing ? 22 : 46;
      if (!erasing && length >= current.length) {
        erasing = true;
        delay = 2100;
      } else if (erasing && length <= 0) {
        erasing = false;
        sample += 1;
        delay = 420;
      }
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  // The Discover door leads to a REAL file: the corpus' top organisation.
  const { data: topOrgData } = useQuery({
    queryKey: ["top-organisation"],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "funding", by: "organisation", limit: "1" })),
  });
  const topOrg = topOrgData?.series?.[0] ?? null;
  const { data: countryIndex } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const { data: flows } = useQuery({ queryKey: ["country-flows"], queryFn: api.countryFlows });

  // Act 3: the country the panel holds open, and its funding rank.
  const [panelCode, setPanelCode] = useState<string | null>(null);
  const rankedCountries = useMemo(
    () => [...(countryIndex ?? [])].sort((a, b) => b.funding_eur - a.funding_eur),
    [countryIndex],
  );
  const panelEntry = panelCode
    ? rankedCountries.find((candidate) => candidate.code === panelCode)
    : null;
  const panelRank = panelEntry ? rankedCountries.indexOf(panelEntry) + 1 : 0;

  // One decision, made before first paint: pinned scrub or viewport reveal.
  const [scrub, setScrub] = useState<number | null>(() => (pinnable() ? SCRUB_BASE : null));
  const pinRef = useHeroPin(stats != null && scrub != null, setScrub);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(ask);
  };

  // The ask now knows the DESTINATIONS too (recette 2026-08-03) — the
  // same shared intelligence as the palette and the search bars: typing
  // "Safran" proposes the organisation file, "hydrogen" the theme,
  // "Allemagne" the country. The free ask stays the first option, so
  // Enter keeps its reflex.
  const [ask, setAsk] = useState("");
  const [askFocused, setAskFocused] = useState(false);
  const [askActive, setAskActive] = useState(0);
  const askDestinations = useDestinations(ask, {
    enabled: askFocused,
    caps: HOME_CAPS,
    idPrefix: "home-go",
  });
  const askOpen = askFocused && ask.trim().length >= 2 && askDestinations.length > 0;
  const askCount = askDestinations.length + 1;
  const askType = (group: DestinationGroup) =>
    group === "projects"
      ? t("search.composer.typeGoProject")
      : group === "organisations"
        ? t("search.composer.typeGoOrg")
        : group === "themes"
          ? t("search.composer.typeGoTheme")
          : t("search.composer.typeGoCountry");
  const onAskKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && askOpen) {
      event.preventDefault();
      setAskActive((current) => (current + 1) % askCount);
    } else if (event.key === "ArrowUp" && askOpen) {
      event.preventDefault();
      setAskActive((current) => (current - 1 + askCount) % askCount);
    } else if (event.key === "Enter" && askOpen && askActive > 0) {
      event.preventDefault();
      const destination = askDestinations[askActive - 1];
      if (destination) navigate(destination.to);
    } else if (event.key === "Escape" && askOpen) {
      setAskFocused(false);
    }
  };

  const examples = [t("home.example1"), t("home.example2"), t("home.example3")];

  const years = stats?.funding_by_year ?? [];
  const from = years[0]?.year;
  const to = years[years.length - 1]?.year;
  // Le hero spatial (lot 2) : dès que la lentille est chargée, le
  // produit se présente par son sujet — repli général sinon (une base
  // sans lentille reste honnête).
  const spaceHero = (stats?.space?.core ?? 0) > 0;
  const spaceYears = stats?.space?.by_year ?? [];
  const spaceFrom = spaceYears[0]?.year;
  const spaceTo = spaceYears[spaceYears.length - 1]?.year;
  const cueOpacity = scrub == null ? 0 : Math.max(0, 1 - ((scrub - SCRUB_BASE) / 0.3) * 1.2);

  return (
    <div>
      {/* Act 1 — the pinned hero: scroll makes the number count and the curve draw */}
      <section
        ref={pinRef}
        className="flex min-h-[calc(100dvh-64px)] flex-col justify-center bg-background px-6 pb-10 text-center"
      >
        <div className="mx-auto w-full max-w-[1240px]">
          <p className="mb-4 text-sm font-medium text-accent">{t("hero.eyebrow")}</p>
          {stats && spaceHero ? (
            /* Le hero SPATIAL (lot 2, validé 2026-08-17) : le produit se
               présente par son sujet. Le grand chiffre dit son périmètre
               DANS la phrase même — « direct + habilitant » (exigence
               fondatrice ①) — et la courbe se dessine sur les années du
               spatial, jamais sur le corpus entier maquillé. */
            <>
              <StatHero
                funding={stats.space.funding_eur}
                sub={spaceFrom && spaceTo ? t("hero.subSpace", { from: spaceFrom, to: spaceTo }) : " "}
                kpis={[
                  {
                    value: stats.space.core + stats.space.adjacent,
                    label: t("hero.spaceProjects"),
                  },
                  { value: stats.space.organisations, label: t("hero.spaceOrgs") },
                  { value: stats.space.groups, label: t("hero.spaceGroups") },
                ]}
                years={spaceYears}
                progress={scrub}
                basis={t("coverage.heroBasis")}
              />
              <p className="mt-7">
                <Link
                  to="/explore?sector=space&by=country&split=0"
                  className="rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background transition-opacity hover:opacity-90"
                >
                  {t("home.spaceCta")} →
                </Link>
              </p>
            </>
          ) : stats ? (
            <StatHero
              funding={stats.totals.funding_eur}
              sub={from && to ? t("hero.sub", { from, to }) : " "}
              kpis={[
                { value: stats.totals.projects, label: t("hero.projects") },
                { value: stats.totals.organisations, label: t("hero.organisations") },
                { value: stats.totals.countries, label: t("hero.countries") },
              ]}
              years={years}
              progress={scrub}
              /* L'assiette du grand total (lot E, 2026-08-17) : le
                 chiffre du hero dit sur QUOI il porte. */
              basis={t("coverage.heroBasis")}
            />
          ) : (
            <>
              <Skeleton className="mx-auto h-28 w-[420px] max-w-full" />
              <Skeleton className="mx-auto mt-16 h-40 w-full max-w-[1120px]" />
            </>
          )}
          {scrub != null ? (
            <p
              aria-hidden="true"
              className="mt-8 text-[12px] uppercase tracking-[.14em] text-muted-foreground transition-opacity"
              style={{ opacity: cueOpacity }}
            >
              {t("home.scrollCue")} ↓
            </p>
          ) : null}
        </div>
      </section>

      {/* Act 2 — the ink tile: the question, free text, three editorial entries.
          The `dark` class turns the section into an ink island in light mode
          and an elevated tile in dark mode — same tokens, Apple's pulse. */}
      <section className="dark overflow-hidden bg-surface text-foreground">
        <div
          ref={tile.ref}
          style={{
            opacity: 0.25 + 0.75 * tile.progress,
            transform: `translateY(${((1 - tile.progress) * 64).toFixed(1)}px) scale(${(0.98 + 0.02 * tile.progress).toFixed(4)})`,
          }}
          className="mx-auto w-full max-w-[1240px] px-6 py-24 text-center"
        >
          <h1 className="font-display text-title">{t("home.ask")}</h1>
          <form onSubmit={submit} role="search" className="relative mx-auto mt-8 max-w-[720px]">
            <div className="flex items-center gap-3.5 rounded-[20px] border bg-background/60 px-6 py-5 transition-shadow duration-300 focus-within:shadow-key focus-within:ring-2 focus-within:ring-accent">
              <span aria-hidden="true" className="text-[19px] text-muted-foreground">
                ⌕
              </span>
              <input
                name="q"
                type="search"
                role="combobox"
                aria-expanded={askOpen}
                aria-controls="home-ask-listbox"
                aria-activedescendant={
                  askOpen
                    ? askActive === 0
                      ? "home-go-full"
                      : askDestinations[askActive - 1]?.id
                    : undefined
                }
                aria-autocomplete="list"
                autoComplete="off"
                value={ask}
                onChange={(event) => {
                  setAsk(event.target.value);
                  setAskActive(0);
                }}
                onFocus={() => setAskFocused(true)}
                onBlur={() => window.setTimeout(() => setAskFocused(false), 120)}
                onKeyDown={onAskKeyDown}
                placeholder={typed || t("home.freeTextPlaceholder")}
                aria-label={t("home.freeTextPlaceholder")}
                className="w-full bg-transparent text-[18.5px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            {askOpen ? (
              <div
                id="home-ask-listbox"
                role="listbox"
                aria-label={t("home.freeTextPlaceholder")}
                className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-xl border bg-background p-1.5 text-left shadow-key"
              >
                {[
                  {
                    id: "home-go-full",
                    label: t("ck.fullSearch", { q: ask.trim() }),
                    flag: undefined as string | undefined,
                    badge: undefined as string | undefined,
                    type: null as string | null,
                    action: () => go(ask),
                  },
                  ...askDestinations.map((destination) => ({
                    id: destination.id,
                    label: destination.label,
                    flag: destination.flag,
                    // Le badge distinctif des groupes (recette 2026-08-04).
                    badge:
                      destination.group === "groups" ? t("ck.groupBadge") : undefined,
                    type: askType(destination.group),
                    action: () => navigate(destination.to),
                  })),
                ].map((option, index) => (
                  <div
                    key={option.id}
                    id={option.id}
                    role="option"
                    aria-selected={index === askActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setAskActive(index)}
                    onClick={() => option.action()}
                    className={
                      "flex cursor-pointer items-baseline gap-2.5 rounded-lg px-3.5 py-2.5 text-[15px]" +
                      (index === askActive
                        ? " bg-accent-soft text-accent shadow-[inset_2.5px_0_0_var(--color-accent)]"
                        : "")
                    }
                  >
                    {option.flag ? <span aria-hidden="true">{option.flag}</span> : null}
                    <span className="min-w-0 leading-snug">{option.label}</span>
                    {option.badge ? (
                      <span className="self-center whitespace-nowrap rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-accent">
                        {option.badge}
                      </span>
                    ) : null}
                    {option.type ? (
                      <span className="ml-auto whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        → {option.type}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </form>
          <p className="mt-3.5 text-[13px] text-muted-foreground">
            {t("home.try")}{" "}
            {examples.map((example, index) => (
              <button
                key={example}
                type="button"
                onClick={() => go(example)}
                className={
                  "text-accent underline-offset-2 hover:underline" + (index > 0 ? " ml-3" : " ml-1")
                }
              >
                {example}
              </button>
            ))}
          </p>

          {/* La ligne CORPUS (lot 2, validé 2026-08-17) : les rôles
              s'inversent — le hero raconte le spatial, le corpus général
              devient l'assise discrète, avec sa porte vers Toute la R&D.
              Rien n'est retiré : l'avantage généraliste reste dit. */}
          {stats && spaceHero ? (
            <section
              aria-label={t("home.corpusKicker")}
              className="mt-16 border-y border-border-soft py-6 text-left"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
                <div className="max-w-[64ch]">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
                    {t("home.corpusKicker")}
                  </p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {t("home.corpusLead", {
                      projects: formatInt(stats.totals.projects, i18n.language),
                      funding: formatCompactEur(stats.totals.funding_eur, i18n.language),
                    })}
                  </p>
                </div>
                <Link
                  to="/explore?by=country&split=0"
                  className="rounded-full border px-4.5 py-2 text-[13.5px] font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {t("home.corpusCta")} →
                </Link>
              </div>
            </section>
          ) : null}

          {/* Lot D (architecture validated 2026-08-02): the doors say the
              four VERBS, and each carries LIVING content — a real file, a
              real deck, your actual dossier — never a promise (KAILA
              lesson). The future verb stays visible, dated, unlinked. */}
          <div className="mt-16 text-left">
            <EditorialEntry
              to={topOrg ? `/organisations/${topOrg.key}` : "/organisations"}
              title={t("nav.discover")}
              desc={
                topOrg
                  ? t("home.doorDiscoverDesc", { name: formatOrgName(String(topOrg.label ?? "")) })
                  : t("nav.menu.organisationsDesc")
              }
              figure={t("home.doorDiscoverFigure", {
                count: stats?.totals.organisations ?? 0,
              })}
            />
            <EditorialEntry
              to="/explore?angles=hydrogen"
              title={t("nav.analyse")}
              desc={t("home.doorAnalyseDesc")}
              figure={t("home.doorAnalyseFigure", { count: STORIES.length })}
            />
            <EditorialEntry
              to="/dossier"
              title={t("nav.build")}
              desc={
                dossier.items.length > 0
                  ? t("home.doorBuildDescSome", { count: dossier.items.length })
                  : t("home.doorBuildDescEmpty")
              }
              figure={dossier.items.length > 0 ? `▤ ${dossier.items.length}` : null}
            />
            <p className="border-t pt-6 text-[15px] text-muted-foreground">
              <span className="font-display text-[19px] font-[540] tracking-[-0.015em] text-foreground/55">
                {t("home.doorFollow")}
              </span>
              <span className="ml-4">{t("home.doorFollowNote")}</span>
              <span className="ml-3 font-mono text-[11px]">{t("home.callsBadge")}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Act 3 — the proof: the slow globe, partner constellations on hover,
          click slides it left and the country panel opens (validated V1). */}
      <section className="mx-auto w-full max-w-[1240px] px-6 py-24">
        <h2 className="font-display text-title">{t("home.act3Title")}</h2>
        <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">{t("home.act3Lead")}</p>
        <MotionConfig reducedMotion="user">
          <div
            className={cn(
              // Stable height: without it the act shrinks when the globe
              // narrows for the panel, and the page shifts under the click.
              "mt-10 lg:min-h-[620px] lg:items-start lg:gap-10",
              panelEntry ? "lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,34fr)]" : "",
            )}
          >
            <motion.div
              layout
              transition={{ duration: 0.45, ease: [0.2, 0.6, 0.2, 1] }}
              className={panelEntry ? undefined : "mx-auto max-w-[840px]"}
            >
              {countryIndex ? (
                <WorldGlobe
                  countries={countryIndex}
                  flows={flows ?? []}
                  mode="select"
                  selected={panelCode}
                  // Map rule: first click selects and opens the panel; a
                  // second click on the held country leaves for its file
                  // (the panel's CTA is the other door).
                  onOpenCountry={(code) =>
                    code === panelCode
                      ? navigate(`/explore/countries/${code}`)
                      : setPanelCode(code)
                  }
                  // Whole sphere, permanently turning — pace "vive"
                  // pinned (recette 2026-08-02).
                  zoom={1}
                />
              ) : (
                <Skeleton className="h-[420px] w-full" />
              )}
            </motion.div>
            <AnimatePresence>
              {panelEntry ? (
                <motion.div
                  key={panelEntry.code}
                  initial={{ opacity: 0, x: 72 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 72 }}
                  transition={{ duration: 0.38, delay: 0.1, ease: [0.2, 0.6, 0.2, 1] }}
                  className="fixed inset-x-3 bottom-3 top-20 z-30 overflow-y-auto lg:static lg:inset-auto lg:z-auto lg:overflow-visible"
                >
                  <CountryPanel
                    code={panelEntry.code}
                    entry={panelEntry}
                    rank={panelRank}
                    flows={flows ?? []}
                    onClose={() => setPanelCode(null)}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </MotionConfig>

        <NowTicker />
      </section>
    </div>
  );
}
