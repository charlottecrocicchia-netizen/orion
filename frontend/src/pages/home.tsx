import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { CountryPanel } from "@/components/country-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatHero } from "@/components/stat-hero";
import { WorldGlobe } from "@/components/world-globe";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ExploreResponse } from "@/lib/api";
import { parseIntent } from "@/lib/intent";
import { formatInt, themeLabel } from "@/lib/format";

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

/* ——— Momentum: computed signals, each a reason to enter ——— */

function growthOf(series: ExploreResponse["series"][number]): number | null {
  const value = (year: number) =>
    (series.points ?? []).find((p) => p.year === year)?.value ?? 0;
  const recent = value(2022) + value(2023) + value(2024);
  const before = value(2019) + value(2020) + value(2021);
  if (before <= 0 || recent <= 0) return null;
  return Math.round(((recent - before) / before) * 100);
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const go = useIntentNavigate();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: themeTrend } = useQuery({
    queryKey: ["signal-themes"],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "funding", by: "theme", split: "true", limit: "8" })),
  });
  const { data: hydrogen } = useQuery({
    queryKey: ["signal-hydrogen"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "projects", by: "programme", q: "hydrogen", limit: "3" }),
      ),
  });
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
    go(String(new FormData(event.currentTarget).get("q") ?? ""));
  };

  const themeSignal = (() => {
    const ranked = (themeTrend?.series ?? [])
      .map((serie) => ({ serie, growth: growthOf(serie) }))
      .filter((entry) => entry.growth != null && entry.growth > 0)
      .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0));
    return ranked[0] ?? null;
  })();
  const hydrogenSignal = hydrogen?.series[0] ?? null;
  const examples = [t("home.example1"), t("home.example2"), t("home.example3")];

  const years = stats?.funding_by_year ?? [];
  const from = years[0]?.year;
  const to = years[years.length - 1]?.year;
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
          {stats ? (
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
      <section className="dark bg-surface text-foreground">
        <div className="mx-auto w-full max-w-[1240px] px-6 py-24 text-center">
          <h1 className="font-display text-title">{t("home.ask")}</h1>
          <form onSubmit={submit} role="search" className="mx-auto mt-7 max-w-[660px]">
            <div className="flex items-center gap-3 rounded-2xl border bg-background/60 px-5 py-4 focus-within:ring-2 focus-within:ring-accent">
              <span aria-hidden="true" className="text-muted-foreground">
                ⌕
              </span>
              <input
                name="q"
                type="search"
                placeholder={t("home.freeTextPlaceholder")}
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </div>
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

          <div className="mt-16 text-left">
            <EditorialEntry
              to="/explore?by=theme&split=0&limit=10"
              title={t("home.entryThemes")}
              desc={t("home.entryThemesDesc")}
              figure={t("home.entryThemesFigure", { count: stats?.totals.projects ?? 0 })}
            />
            <EditorialEntry
              to="/compare"
              title={t("home.entryOrgs")}
              desc={t("home.entryOrgsDesc")}
              figure={t("home.entryOrgsFigure", { count: stats?.totals.organisations ?? 0 })}
            />
            <EditorialEntry
              to="/explore/countries"
              title={t("home.entryCountries")}
              desc={t("home.entryCountriesDesc")}
              figure={t("home.entryCountriesFigure", { count: stats?.totals.countries ?? 0 })}
            />
            <p className="border-t pt-6 text-[13px] text-muted-foreground">
              {t("home.callsNote")}{" "}
              <span className="font-mono text-[11.5px]">{t("home.callsBadge")}</span>
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
              "mt-10 lg:items-start lg:gap-10",
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
                  onOpenCountry={setPanelCode}
                  zoom={1.45}
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

        <h2 className="mt-16 text-label uppercase text-muted-foreground">{t("home.now")}</h2>
        <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
          {themeSignal ? (
            <Link
              to={`/explore?by=theme&split=1&compare=${encodeURIComponent(String(themeSignal.serie.key))}`}
              className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-3 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
            >
              <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-3">
                ↑ {themeSignal.growth} %
              </span>
              <span className="text-[13.5px] leading-snug">
                {t("home.signalTheme", {
                  theme: themeLabel(String(themeSignal.serie.key), themeSignal.serie.label, t),
                })}
                <small className="block text-[11.5px] text-muted-foreground">
                  {t("home.signalThemeHint")}
                </small>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-[68px] w-full" />
          )}
          {hydrogenSignal ? (
            <Link
              to="/explore?by=programme&q=hydrogen&view=treemap&limit=12"
              className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-2 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
            >
              <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-2">
                {formatInt(Number(hydrogenSignal.value ?? 0), i18n.language)}
              </span>
              <span className="text-[13.5px] leading-snug">
                {t("home.signalHydrogen", {
                  programme: hydrogenSignal.label ?? String(hydrogenSignal.key),
                })}
                <small className="block text-[11.5px] text-muted-foreground">
                  {t("home.signalHydrogenHint")}
                </small>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-[68px] w-full" />
          )}
        </div>
      </section>
    </div>
  );
}
