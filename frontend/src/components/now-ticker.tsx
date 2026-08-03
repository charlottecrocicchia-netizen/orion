import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import type { ExplorePoint } from "@/lib/api";
import { formatCompactEur, formatOrgName, themeLabel } from "@/lib/format";
import { useRevealProgress } from "@/hooks/use-reveal-progress";
import { cn } from "@/lib/utils";

/** ACTUALITÉS — the front page (recette 2026-08-02, third pass, after a
 *  live study of Apple Newsroom and Linear's Now page): no more rounded
 *  slab. A full-width BAND between two hairlines — ink text on the page
 *  ground to the left (kicker → huge display title → one exit), the
 *  visual matter on the right only, split by a vertical rule: the
 *  official photo when the feed carries one, a GENERATIVE line drawing
 *  from our own data for computed stories (Linear's lesson — the duel
 *  draws its two bars, the movement its spark, the grant its figure),
 *  a seeded constellation on ultramarine for imageless news. The whole
 *  band is a scroll-snap RAIL — the exact gesture of the Angles decks
 *  (swipe, trackpad, arrows, dots, arrow keys) — with a brisk carousel
 *  cadence, the bottom hairline doubling as a progress fill frozen by
 *  real reader intent, and the section revealing itself on scroll.
 *  Content unchanged: dated official news opening at the source,
 *  interleaved with the computed stories and their honesty floors. */

const ROTATE_MS = 3800;
const MIN_WINDOW_EUR = 500_000;
const DUEL_MAX_GAP = 0.2;
const MOVE_MIN_DELTA = 20;

type Art =
  | { kind: "duel"; a: number; b: number }
  | { kind: "break" }
  | { kind: "contract"; amount: string }
  | { kind: "move"; points: ExplorePoint[] };

interface Story {
  kind: string;
  phrase: React.ReactNode;
  cta: string;
  to: string;
  external?: boolean;
  image?: string | null;
  art?: Art;
  seed?: string;
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

/* ——— The visual matter, drawn from the data (Linear's lesson) ——— */

function seededPoints(seed: string, count: number): { x: number; y: number }[] {
  // Deterministic light constellation from the title — varies per news,
  // never random at render time.
  let h = 2166136261;
  for (const ch of seed) h = (h ^ ch.charCodeAt(0)) * 16777619;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // High bits only — an LCG's low bits repeat fast and draw false
    // alignments in the constellation.
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const x = 8 + ((h >>> 16) % 84);
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const y = 10 + ((h >>> 16) % 80);
    out.push({ x, y });
  }
  return out;
}

function StoryArt({ story }: { story: Story }) {
  const art = story.art;
  if (art?.kind === "duel") {
    const max = Math.max(art.a, art.b, 1);
    const ha = (art.a / max) * 58;
    const hb = (art.b / max) * 58;
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line x1="16" y1="86" x2="84" y2="86" stroke="#8b9aff" strokeOpacity="0.4" strokeWidth="0.5" />
        <rect x="28" y={86 - ha} width="14" height={ha} fill="none" stroke="#aab7ff" strokeWidth="1" />
        <rect x="58" y={86 - hb} width="14" height={hb} fill="none" stroke="#8b9aff" strokeWidth="1" strokeDasharray="2.5 2" />
        <circle cx="35" cy={82 - ha} r="1.5" fill="#aab7ff" />
        <circle cx="65" cy={82 - hb} r="1.5" fill="#8b9aff" />
      </svg>
    );
  }
  if (art?.kind === "break") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {[24, 36, 48, 60, 72].map((y) => (
          <line key={y} x1="14" y1={y} x2="86" y2={y} stroke="#8b9aff" strokeOpacity="0.22" strokeWidth="0.5" />
        ))}
        <polyline
          points="18,78 36,70 54,56 72,34 84,26"
          fill="none"
          stroke="#aab7ff"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="84" cy="26" r="2.4" fill="#aab7ff" />
      </svg>
    );
  }
  if (art?.kind === "move") {
    const points = [...art.points].sort((a, b) => a.year - b.year);
    const max = Math.max(...points.map((p) => p.value ?? 0), 1);
    const path = points
      .map(
        (p, i) =>
          `${(12 + (i * 76) / Math.max(points.length - 1, 1)).toFixed(1)},${(84 - ((p.value ?? 0) / max) * 58).toFixed(1)}`,
      )
      .join(" ");
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <polyline points={path} fill="none" stroke="#aab7ff" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="12" y1="84" x2="88" y2="84" stroke="#8b9aff" strokeOpacity="0.4" strokeWidth="0.5" />
      </svg>
    );
  }
  if (art?.kind === "contract") {
    return (
      <div className="grid h-full w-full place-items-center p-6">
        <span className="display-tight text-center text-[clamp(40px,4.5vw,64px)] font-[540] leading-none tracking-[-0.03em] text-[#aab7ff]">
          {art.amount}
        </span>
      </div>
    );
  }
  // Imageless official news: the seeded constellation, our brand mark.
  const stars = seededPoints(story.seed ?? story.to, 9);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {stars.slice(1).map((p, i) => (
        <line
          key={i}
          x1={stars[i].x}
          y1={stars[i].y}
          x2={p.x}
          y2={p.y}
          stroke="#ffffff"
          strokeOpacity="0.16"
          strokeWidth="0.4"
        />
      ))}
      {stars.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 1.7 : 1.1} fill="#ffffff" fillOpacity="0.5" />
      ))}
    </svg>
  );
}

/* ——— The stage ——— */

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
  const { data: newsItems } = useQuery({
    queryKey: ["now-news"],
    queryFn: api.news,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  const stories: Story[] = useMemo(() => {
    const out: Story[] = [];
    const accent = (content: React.ReactNode) => (
      <b className="tnum font-semibold text-accent">{content}</b>
    );

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
          art: { kind: "duel", a: first.b, b: second.b },
        });
      }
      const topA = new Set(
        [...sums].sort((x, y) => y.a - x.a).slice(0, 10).map((entry) => entry.key),
      );
      const newcomer = sums
        .slice(0, 10)
        .find((entry) => !topA.has(entry.key) && entry.b >= MIN_WINDOW_EUR && entry.a > 0);
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
          art: { kind: "break" },
        });
      }
    }

    const hit = bigProject?.results?.[0];
    if (hit && (hit.funding_amount_eur ?? 0) > 0) {
      out.push({
        kind: t("home.nowKindContract"),
        phrase: (
          <>
            {accent(formatCompactEur(hit.funding_amount_eur, i18n.language))}{" "}
            {t("home.nowContractA", { name: hit.acronym || hit.title, year: lastMature })}
          </>
        ),
        cta: t("home.nowContractCta"),
        to: `/projects/${hit.id}`,
        art: { kind: "contract", amount: formatCompactEur(hit.funding_amount_eur, i18n.language) },
      });
    }

    const themeYears = [
      ...new Set((themeSplit?.series ?? []).flatMap((s) => (s.points ?? []).map((p) => p.year))),
    ];
    const themeWin = matureWindows(themeYears, now);
    if (themeWin && themeSplit) {
      const best = themeSplit.series
        .map((serie) => ({
          key: String(serie.key),
          label: themeLabel(String(serie.key), serie.label, t),
          points: serie.points ?? [],
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
          art: { kind: "move", points: best.points },
        });
      }
    }

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
          seed: item.title,
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

  /* ——— The rail: the Angles decks' exact gesture ——— */

  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const lastPointerMove = useRef(0);
  const elapsed = useRef(0);
  const skipSync = useRef(false);
  const settling = useRef<number | null>(null);
  const reveal = useRevealProgress(true, 900);

  // Programmed alignment (autoplay, arrows, dots): full-width slides make
  // the target trivial — index × rail width. skipSync guards the
  // scroll→index sync until arrival (the Angles decks' lesson).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const target = index * rail.clientWidth;
    if (Math.abs(rail.scrollLeft - target) < 4) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    skipSync.current = true;
    rail.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
    const release = window.setTimeout(() => {
      skipSync.current = false;
    }, reduced ? 60 : 1200);
    return () => window.clearTimeout(release);
  }, [index]);

  const onScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    if (skipSync.current) {
      if (Math.abs(rail.scrollLeft - index * rail.clientWidth) < 6) skipSync.current = false;
      return;
    }
    if (settling.current != null) cancelAnimationFrame(settling.current);
    settling.current = requestAnimationFrame(() => {
      if (!railRef.current || skipSync.current) return;
      const next = Math.round(railRef.current.scrollLeft / railRef.current.clientWidth);
      if (next !== index) {
        elapsed.current = 0;
        setIndex(Math.min(Math.max(next, 0), stories.length - 1));
      }
    });
  };

  // The carousel driver: one rAF for the switch AND the progress fill —
  // frozen together by real reader intent (recent pointer movement over
  // the stage, or focus within), never by phantom hover.
  useEffect(() => {
    if (stories.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const step = (nowTs: number) => {
      const dt = Math.min(nowTs - last, 100);
      last = nowTs;
      const reading = Date.now() - lastPointerMove.current < 8_000;
      const focusedWithin = rootRef.current?.contains(document.activeElement) ?? false;
      if (!reading && !focusedWithin && !skipSync.current) elapsed.current += dt;
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

  return (
    <section
      ref={rootRef}
      aria-label={t("home.newsTitle")}
      onPointerMove={() => {
        lastPointerMove.current = Date.now();
      }}
      className="mt-20"
    >
      <div
        ref={reveal.ref}
        style={{
          opacity: 0.2 + 0.8 * reveal.progress,
          transform: `translateY(${((1 - reveal.progress) * 48).toFixed(1)}px)`,
        }}
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

        {/* The band: full width between two hairlines, no slab. */}
        <div className="mt-5 border-t">
          <div
            ref={railRef}
            onScroll={onScroll}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                goTo(index + 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                goTo(index - 1);
              }
            }}
            className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {stories.map((story, storyIndex) => {
              const surface = story.image ? "photo" : story.external ? "ultramarine" : "ink";
              const near = Math.abs(storyIndex - index) <= 1;
              const body = (
                <div className="grid h-full min-h-[340px] lg:min-h-[400px] lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
                  <div
                    key={storyIndex === index ? "active" : "idle"}
                    className={cn(
                      "order-2 flex flex-col justify-center py-9 lg:order-1 lg:py-12 lg:pr-10",
                      storyIndex === index && "news-in",
                    )}
                  >
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
                      {story.kind}
                    </p>
                    <span className="display-tight mt-4 block max-w-[22ch] text-[clamp(26px,3.3vw,44px)] font-[540] leading-[1.08] tracking-[-0.022em]">
                      {story.phrase}
                    </span>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent">
                      {story.cta}
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform duration-200 ease-out group-hover:translate-x-1"
                      >
                        {story.external ? "↗" : "→"}
                      </span>
                    </span>
                  </div>
                  <div className="relative order-1 min-h-[200px] overflow-hidden border-b border-border-soft lg:order-2 lg:min-h-0 lg:border-b-0 lg:border-l">
                    {surface === "photo" ? (
                      <img
                        src={story.image!}
                        alt=""
                        decoding="async"
                        loading={near ? "eager" : "lazy"}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : surface === "ultramarine" ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#3b5cff] via-[#1c2f9e] to-[#101d5e]">
                        <StoryArt story={story} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#14161c] via-[#151a2e] to-[#101d3f]">
                        <StoryArt story={story} />
                      </div>
                    )}
                  </div>
                </div>
              );
              return (
                <article key={`${story.to}-${storyIndex}`} className="w-full flex-none snap-center">
                  {story.external ? (
                    <a href={story.to} target="_blank" rel="noreferrer" className="group block h-full">
                      {body}
                    </a>
                  ) : (
                    <Link to={story.to} className="group block h-full">
                      {body}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
          {/* The bottom hairline doubles as the cadence: a progress fill
              frozen with the reader's hold. */}
          <div aria-hidden="true" className="relative h-px bg-border">
            {stories.length > 1 ? (
              <div
                ref={barRef}
                className="absolute inset-y-[-1px] left-0 bg-accent"
                style={{ width: "0%" }}
              />
            ) : null}
          </div>
        </div>

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
      </div>
    </section>
  );
}
