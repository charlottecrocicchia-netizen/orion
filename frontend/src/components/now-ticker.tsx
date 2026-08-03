import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import type { ExplorePoint } from "@/lib/api";
import { formatCompactEur, formatOrgName, themeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** ACTUALITÉS — the front-page moment (recette 2026-08-02: the thin
 *  strip was too small, too quiet; the founder wants a magazine cover).
 *  One story at a time fills a tall stage: the official picture under an
 *  ink scrim when the feed carries one, strong display typography on the
 *  deep brand ramps otherwise (computed stories on ink, imageless news
 *  on ultramarine). A brisk 5 s cadence with a progress bar that
 *  freezes while the reader is actually there (pointer intent or focus
 *  — never the phantom hover), arrows and dots to drive, a snapping
 *  rise-and-fade transition, static under reduced motion. Content
 *  unchanged: official news (dated, opening at the source) interleaved
 *  with Orion's computed stories under their honesty floors. */

const ROTATE_MS = 5000;
const MIN_WINDOW_EUR = 500_000;
const DUEL_MAX_GAP = 0.2;
const MOVE_MIN_DELTA = 20;

interface Story {
  kind: string;
  phrase: React.ReactNode;
  cta: string;
  to: string;
  /** Official news open at the SOURCE, in a new tab. */
  external?: boolean;
  /** Official picture when the feed carries one. */
  image?: string | null;
}

function matureWindows(years: number[], now: number): { a: number[]; b: number[] } | null {
  const mature = years.filter((year) => year <= now - 2).sort((x, y) => x - y);
  if (mature.length < 2) return null;
  const k = Math.min(3, Math.floor(mature.length / 2));
  return { a: mature.slice(-2 * k, -k), b: mature.slice(-k) };
}

const winSum = (points: ExplorePoint[], win: number[]) =>
  win.reduce(
    (sum, year) => sum + (points.find((point) => point.year === year)?.value ?? 0),
    0,
  );

const span = (win: number[]) =>
  win.length > 1 ? `${win[0]}–${win[win.length - 1]}` : String(win[0]);

export function NowTicker() {
  const { t, i18n } = useTranslation();
  const now = new Date().getFullYear();

  const { data: orgSplit } = useQuery({
    queryKey: ["now-organisations"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "organisation", split: "true", limit: "50" }),
      ),
  });
  const { data: themeSplit } = useQuery({
    queryKey: ["now-themes"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "theme", split: "true", limit: "50" }),
      ),
  });
  const lastMature = String(now - 2);
  // Official news relayed by the backend (CORS + cache + stale-on-error
  // live there); refetchInterval keeps the strip fresh on its own.
  const { data: newsItems } = useQuery({
    queryKey: ["now-news"],
    queryFn: api.news,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
  const { data: bigProject } = useQuery({
    queryKey: ["now-big-project", lastMature, i18n.language],
    queryFn: () =>
      api.searchProjects(
        new URLSearchParams({
          sort: "amount",
          year_from: lastMature,
          year_to: lastMature,
          lang: i18n.language.startsWith("fr") ? "fr" : "en",
        }),
      ),
  });

  const stories: Story[] = useMemo(() => {
    const out: Story[] = [];
    const accent = (content: React.ReactNode) => (
      <b className="tnum font-semibold text-accent">{content}</b>
    );

    // Orgs: window sums feed both the duel and the breakthrough.
    const orgYears = [
      ...new Set((orgSplit?.series ?? []).flatMap((s) => (s.points ?? []).map((p) => p.year))),
    ];
    const win = matureWindows(orgYears, now);
    if (win && orgSplit) {
      const sums = orgSplit.series
        .map((serie) => ({
          key: serie.key,
          label: formatOrgName(String(serie.label ?? serie.key)),
          a: winSum(serie.points ?? [], win.a),
          b: winSum(serie.points ?? [], win.b),
        }))
        .sort((x, y) => y.b - x.b);
      const [first, second] = sums;
      if (
        first &&
        second &&
        second.b >= MIN_WINDOW_EUR &&
        (first.b - second.b) / first.b <= DUEL_MAX_GAP
      ) {
        out.push({
          kind: t("home.nowKindDuel"),
          phrase: (
            <>
              {t("home.nowDuelA", { a: first.label, b: second.label, window: span(win.b) })}{" "}
              {accent(formatCompactEur(first.b, i18n.language))}
              {t("home.nowDuelVs")}
              {accent(formatCompactEur(second.b, i18n.language))}
            </>
          ),
          cta: t("home.nowDuelCta"),
          to: `/compare?orgs=${first.key}~${second.key}`,
        });
      }
      const topA = new Set(
        [...sums].sort((x, y) => y.a - x.a).slice(0, 10).map((entry) => entry.key),
      );
      const newcomer = sums.slice(0, 10).find(
        (entry) => !topA.has(entry.key) && entry.b >= MIN_WINDOW_EUR && entry.a > 0,
      );
      if (newcomer) {
        out.push({
          kind: t("home.nowKindBreak"),
          phrase: (
            <>
              {t("home.nowBreakA", { name: newcomer.label, window: span(win.b) })}{" "}
              {accent(formatCompactEur(newcomer.b, i18n.language))}
            </>
          ),
          cta: t("home.nowBreakCta"),
          to: `/organisations/${newcomer.key}`,
        });
      }
    }

    // The big grant of the last mature year.
    const hit = bigProject?.results?.[0];
    if (hit && (hit.funding_amount_eur ?? 0) > 0) {
      out.push({
        kind: t("home.nowKindContract"),
        phrase: (
          <>
            {accent(formatCompactEur(hit.funding_amount_eur, i18n.language))}{" "}
            {t("home.nowContractA", {
              name: hit.acronym || hit.title,
              year: lastMature,
            })}
          </>
        ),
        cta: t("home.nowContractCta"),
        to: `/projects/${hit.id}`,
      });
    }

    // The accelerating theme.
    const themeYears = [
      ...new Set((themeSplit?.series ?? []).flatMap((s) => (s.points ?? []).map((p) => p.year))),
    ];
    const themeWin = matureWindows(themeYears, now);
    if (themeWin && themeSplit) {
      const best = themeSplit.series
        .map((serie) => ({
          key: String(serie.key),
          label: themeLabel(String(serie.key), serie.label, t),
          a: winSum(serie.points ?? [], themeWin.a),
          b: winSum(serie.points ?? [], themeWin.b),
        }))
        .filter((entry) => entry.a > 0 && entry.b >= MIN_WINDOW_EUR)
        .map((entry) => ({ ...entry, delta: ((entry.b - entry.a) / entry.a) * 100 }))
        .sort((x, y) => y.delta - x.delta)[0];
      if (best && best.delta >= MOVE_MIN_DELTA) {
        out.push({
          kind: t("home.nowKindMove"),
          phrase: (
            <>
              {t("home.nowMoveA", { theme: best.label })}{" "}
              {accent(`+${Math.round(best.delta)} %`)}{" "}
              {t("home.nowMoveB", { a: span(themeWin.a), b: span(themeWin.b) })}
            </>
          ),
          cta: t("home.nowMoveCta"),
          to: `/explore?by=theme&split=1&compare=${encodeURIComponent(best.key)}`,
        });
      }
    }
    // Official news, newest first, each opening at its SOURCE — mixed in
    // by interleaving so the strip alternates our signature stories and
    // the real "moment" (recette 2026-08-02).
    const newsStories: Story[] = (Array.isArray(newsItems) ? newsItems : [])
      .slice(0, 3)
      .map((item) => {
        const date = item.published
          ? new Date(item.published).toLocaleDateString(i18n.language, {
              day: "numeric",
              month: "short",
            })
          : null;
        return {
          kind: `${t("home.nowKindNews")} · ${item.source}${date ? ` · ${date}` : ""}`,
          phrase: <>{item.title}</>,
          cta: t("home.nowNewsCta"),
          to: item.url,
          external: true,
          image: item.image,
        };
      });
    const mixed: Story[] = [];
    const longest = Math.max(out.length, newsStories.length);
    for (let i = 0; i < longest; i++) {
      if (out[i]) mixed.push(out[i]);
      if (newsStories[i]) mixed.push(newsStories[i]);
    }
    return mixed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSplit, themeSplit, bigProject, newsItems, i18n.language, t]);

  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const lastPointerMove = useRef(0);
  const elapsed = useRef(0);
  useEffect(() => {
    if (stories.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      // Hold judged on real INTENT — a pointer that MOVED over the stage
      // recently, or real focus within. Hover state (events or :hover)
      // goes stale under a motionless scrolled-under cursor (the
      // phantom-hover family that froze the globe, then the strip). The
      // progress bar freezes WITH the hold, so the pause is visible.
      const reading = Date.now() - lastPointerMove.current < 8_000;
      const focusedWithin = rootRef.current?.contains(document.activeElement) ?? false;
      if (!reading && !focusedWithin) elapsed.current += dt;
      if (elapsed.current >= ROTATE_MS) {
        elapsed.current = 0;
        setIndex((current) => (current + 1) % stories.length);
      }
      if (barRef.current) {
        barRef.current.style.width = `${((elapsed.current / ROTATE_MS) * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stories.length]);
  const goTo = (target: number) => {
    elapsed.current = 0;
    setIndex((target + stories.length) % stories.length);
  };

  if (stories.length === 0) return null;
  const story = stories[Math.min(index, stories.length - 1)];
  const surface = story.image ? "photo" : story.external ? "ultramarine" : "ink";

  return (
    <section
      ref={rootRef}
      aria-label={t("home.newsTitle")}
      onPointerMove={() => {
        lastPointerMove.current = Date.now();
      }}
      className="mt-20"
    >
      <div className="flex items-end justify-between gap-6">
        <h2 className="font-display text-title">{t("home.newsTitle")}</h2>
        {stories.length > 1 ? (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t("home.newsPrev")}
              onClick={() => goTo(index - 1)}
              className="grid h-10 w-10 place-items-center rounded-full border text-[16px] transition-colors hover:border-accent hover:text-accent"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t("home.newsNext")}
              onClick={() => goTo(index + 1)}
              className="grid h-10 w-10 place-items-center rounded-full border text-[16px] transition-colors hover:border-accent hover:text-accent"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <MotionConfig reducedMotion="user">
        <div className="dark relative mt-5 min-h-[380px] overflow-hidden rounded-3xl border lg:min-h-[440px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${story.to}-${index}`}
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.5, ease: [0.2, 0.6, 0.2, 1] }}
              className="absolute inset-0"
            >
              {/* The backdrop: the official picture under the ink scrim, or
                  the deep brand ramps — ink for computed stories,
                  ultramarine for imageless news. */}
              <div aria-hidden="true" className="absolute inset-0">
                {surface === "photo" ? (
                  <>
                    <img
                      src={story.image!}
                      alt=""
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[rgba(20,22,28,.28)] via-[rgba(20,22,28,.42)] to-[rgba(20,22,28,.82)]" />
                  </>
                ) : surface === "ultramarine" ? (
                  <div className="h-full w-full bg-gradient-to-br from-[#3b5cff] via-[#1c2f9e] to-[#101d5e]" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#14161c] via-[#151a2e] to-[#101d3f]" />
                )}
              </div>

              <div className="relative flex h-full min-h-[380px] flex-col justify-end p-8 lg:min-h-[440px] lg:p-12">
                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08, ease: [0.2, 0.6, 0.2, 1] }}
                  className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/70"
                >
                  {story.kind}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.14, ease: [0.2, 0.6, 0.2, 1] }}
                >
                  {(() => {
                    const body = (
                      <>
                        <span className="display-tight block max-w-[24ch] text-[clamp(26px,3.6vw,46px)] font-[540] leading-[1.08] tracking-[-0.022em] text-white">
                          {story.phrase}
                        </span>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-[#aab7ff] transition-colors group-hover:text-white">
                          {story.cta}
                          <span
                            aria-hidden="true"
                            className="inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
                          >
                            {story.external ? "↗" : "→"}
                          </span>
                        </span>
                      </>
                    );
                    return story.external ? (
                      <a href={story.to} target="_blank" rel="noreferrer" className="group mt-3 block">
                        {body}
                      </a>
                    ) : (
                      <Link to={story.to} className="group mt-3 block">
                        {body}
                      </Link>
                    );
                  })()}
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* The cadence, visible: a hairline progress bar that freezes
              with the reader's hold. */}
          {stories.length > 1 ? (
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/12">
              <div ref={barRef} className="h-full bg-[#8b9aff]" style={{ width: "0%" }} />
            </div>
          ) : null}
        </div>
      </MotionConfig>

      {stories.length > 1 ? (
        <div className="mt-4 flex gap-2" role="tablist" aria-label={t("home.newsTitle")}>
          {stories.map((entry, dotIndex) => (
            <button
              key={entry.to}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`${t("home.newsTitle")} ${dotIndex + 1}/${stories.length}`}
              onClick={() => goTo(dotIndex)}
              className={cn(
                "h-1.5 w-7 rounded-full transition-colors",
                dotIndex === index ? "bg-accent" : "bg-border hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
