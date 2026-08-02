import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ExploreView } from "@/components/explore-view";
import { cn } from "@/lib/utils";

/** The Angles — one question, several looks, slid horizontally (lot 3).
 *  Pure CSS scroll-snap does the positioning; each slide peeks the next
 *  (Apple's cue that there is more), arrows and arrow keys drive it, dots
 *  deep-link, and the URL carries ?angle=N. Every slide is a real Explorer
 *  view — a URL, hence shareable. Never auto-advances. */

export interface AngleSlideResolved {
  query: string;
  title: string;
}

export function AnglesDeck({
  slides,
  active,
  onActive,
}: {
  slides: AngleSlideResolved[];
  active: number;
  onActive: (index: number) => void;
}) {
  const { t } = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);
  const settling = useRef<number | null>(null);
  // Guards the scroll→index sync while a PROGRAMMED scroll is in flight —
  // without it, a deep-linked ?angle=4 gets downgraded to 0 the instant the
  // still-unscrolled rail reports its position.
  const skipSync = useRef(false);

  // snap-center geometry, from REAL positions: step arithmetic lies at the
  // rail's ends (the last slide can never put 4×step behind it).
  const slideEls = () =>
    [...(railRef.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [])];
  const targetLeft = (index: number) => {
    const rail = railRef.current;
    const el = slideEls()[index];
    if (!rail || !el) return null;
    const centered = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    return Math.min(Math.max(centered, 0), rail.scrollWidth - rail.clientWidth);
  };
  const nearestIndex = () => {
    const rail = railRef.current;
    if (!rail) return 0;
    const center = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    slideEls().forEach((el, index) => {
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  // External active (arrows, dots, deep-link) → scroll there. On mount the
  // rail may not be laid out yet: retry on the next frame.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = 0;
    let release = 0;
    const align = () => {
      const target = targetLeft(active);
      if (target == null || rail.scrollWidth === 0) {
        raf = requestAnimationFrame(align);
        return;
      }
      if (Math.abs(rail.scrollLeft - target) < 4) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      skipSync.current = true;
      rail.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
      // Arrival is detected in onScroll; this is only the safety net for
      // an interrupted smooth scroll.
      release = window.setTimeout(() => {
        skipSync.current = false;
      }, reduced ? 60 : 1500);
    };
    align();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(release);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // User scroll → active index (debounced to the frame).
  const onScroll = () => {
    if (skipSync.current) {
      // A programmed scroll is in flight: release the guard the moment we
      // actually arrive (a long smooth scroll outlives any fixed timer).
      const rail = railRef.current;
      const target = targetLeft(active);
      if (rail && target != null && Math.abs(rail.scrollLeft - target) < 6) {
        skipSync.current = false;
      }
      return;
    }
    if (settling.current != null) cancelAnimationFrame(settling.current);
    settling.current = requestAnimationFrame(() => {
      if (!railRef.current || skipSync.current) return;
      const index = nearestIndex();
      if (index !== active) onActive(index);
    });
  };

  const go = (delta: number) =>
    onActive(Math.min(Math.max(active + delta, 0), slides.length - 1));

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={t("explorer.angles.label")}
      className="relative mt-9"
    >
      <button
        type="button"
        aria-label={t("explorer.angles.previous")}
        onClick={() => go(-1)}
        disabled={active === 0}
        className="absolute -left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-background text-[17px] shadow-key transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={t("explorer.angles.next")}
        onClick={() => go(1)}
        disabled={active === slides.length - 1}
        className="absolute -right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-background text-[17px] shadow-key transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground"
      >
        ›
      </button>

      <div
        ref={railRef}
        onScroll={onScroll}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(-1);
          }
        }}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <section
            key={slide.query}
            data-slide
            role="group"
            aria-roledescription="slide"
            aria-label={t("explorer.angles.slideLabel", {
              n: index + 1,
              total: slides.length,
              title: slide.title,
            })}
            // The 86% width leaves the next slide PEEKING — the cue that
            // the question has more angles.
            className="w-[86%] flex-none snap-center rounded-[20px] border p-6 pb-4"
          >
            <h2 className="text-[16px] font-semibold">{slide.title}</h2>
            <div className="mt-4">
              <ExploreView
                query={slide.query}
                title={slide.title}
                active={Math.abs(index - active) <= 1}
              />
            </div>
          </section>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-2.5" role="tablist" aria-label={t("explorer.angles.label")}>
        {slides.map((slide, index) => (
          <button
            key={slide.query}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={t("explorer.angles.slideLabel", {
              n: index + 1,
              total: slides.length,
              title: slide.title,
            })}
            onClick={() => onActive(index)}
            className={cn(
              "h-1.5 w-7 rounded-full transition-colors",
              index === active ? "bg-accent" : "bg-border hover:bg-muted-foreground/40",
            )}
          />
        ))}
      </div>
    </section>
  );
}
