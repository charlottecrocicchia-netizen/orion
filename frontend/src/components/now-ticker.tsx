import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import type { ExplorePoint } from "@/lib/api";
import { formatCompactEur, formatOrgName, themeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "En ce moment" — a LIVING news strip (recette 2026-08-02: two static
 *  boxes were dead; the founder wants an elegant feed). One story shows
 *  at a time and the strip rotates softly between them (rise-in/out,
 *  ~7 s each, paused on hover or focus, dots to jump, static under
 *  reduced motion). Every story is COMPUTED from the corpus with the
 *  usual honesty floors — a story that doesn't clear its floor simply
 *  doesn't run. Windows follow the mature-years convention. */

const ROTATE_MS = 7000;
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
  const lastPointerMove = useRef(0);
  useEffect(() => {
    if (stories.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      // The hold is judged at TICK TIME on real INTENT — a pointer that
      // MOVED over the strip recently, or real focus within. Hover state
      // (events or :hover alike) goes stale when the strip slides under a
      // motionless cursor during scroll — the phantom-hover family that
      // froze the globe and then this strip ("it doesn't auto-advance",
      // recette 2026-08-02). A parked cursor never blocks the feed; a
      // reader hovering keeps it held ~10 s past their last movement.
      const reading = Date.now() - lastPointerMove.current < 10_000;
      const focusedWithin = rootRef.current?.contains(document.activeElement) ?? false;
      if (reading || focusedWithin) return;
      setIndex((current) => (current + 1) % stories.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [stories.length]);

  if (stories.length === 0) return null;
  const story = stories[Math.min(index, stories.length - 1)];

  return (
    <section
      ref={rootRef}
      aria-label={t("home.now")}
      onPointerMove={() => {
        lastPointerMove.current = Date.now();
      }}
      className="mt-16"
    >
      <h2 className="text-label uppercase text-muted-foreground">{t("home.now")}</h2>
      <MotionConfig reducedMotion="user">
        <div className="relative mt-3 min-h-[132px] border-t sm:min-h-[112px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${story.to}-${index}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.2, 0.6, 0.2, 1] }}
              className="pt-5"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {story.kind}
              </p>
              {(() => {
                const body = (
                  <span className="display-tight block max-w-[52ch] text-[clamp(19px,2.3vw,26px)] font-[540] leading-[1.25] tracking-[-0.015em]">
                    {story.phrase}
                    <span className="ml-3 whitespace-nowrap text-[15px] font-medium text-accent">
                      {story.cta}
                      <span
                        aria-hidden="true"
                        className="ml-1 inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
                      >
                        {story.external ? "↗" : "→"}
                      </span>
                    </span>
                  </span>
                );
                return story.external ? (
                  <a
                    href={story.to}
                    target="_blank"
                    rel="noreferrer"
                    className="group mt-2 block"
                  >
                    {body}
                  </a>
                ) : (
                  <Link to={story.to} className="group mt-2 block">
                    {body}
                  </Link>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      </MotionConfig>
      {stories.length > 1 ? (
        <div className="mt-4 flex gap-2" role="tablist" aria-label={t("home.now")}>
          {stories.map((entry, dotIndex) => (
            <button
              key={entry.to}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`${t("home.now")} ${dotIndex + 1}/${stories.length}`}
              onClick={() => setIndex(dotIndex)}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                dotIndex === index ? "bg-accent" : "bg-border hover:bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
