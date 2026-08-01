import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Constellation } from "@/components/constellation";
import { Kpi } from "@/components/kpi";

/** Doctrine step 1 deliverable — the hero figure and its curve as ONE
 *  gesture: a single reveal progress drives the €-count-up, the KPI
 *  count-ups and the constellation's stroke-dashoffset, armed once when
 *  the hero enters the viewport. Reduced motion (or no IntersectionObserver,
 *  e.g. jsdom) renders the final state immediately. */

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

function useRevealProgress(ready: boolean, duration = 1600) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const armed = useRef(false);

  useEffect(() => {
    if (!ready || armed.current) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (reduced || typeof IntersectionObserver === "undefined" || !el) {
      armed.current = true;
      setProgress(1);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || armed.current) return;
        armed.current = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const u = Math.min((t - t0) / duration, 1);
          setProgress(easeOutCubic(u));
          if (u < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ready, duration]);

  return { ref, progress };
}

interface StatHeroProps {
  funding: number | null;
  sub: string;
  kpis: { value: number | null; label: string }[];
  years: { year: number; amount_eur: number }[];
}

export function StatHero({ funding, sub, kpis, years }: StatHeroProps) {
  const { i18n } = useTranslation();
  const { ref, progress } = useRevealProgress(funding != null);
  const figure =
    funding == null
      ? "—"
      : `€${((funding * progress) / 1e9).toLocaleString(i18n.language, {
          maximumFractionDigits: 0,
        })}B`;

  return (
    <div ref={ref}>
      <div className="font-display text-hero hero-gradient tnum">{figure}</div>
      <p className="mt-4 text-lead text-muted-foreground">{sub}</p>
      <div className="mt-8 flex justify-center gap-11">
        {kpis.map((kpi) => (
          <Kpi key={kpi.label} value={kpi.value} label={kpi.label} hero progress={progress} />
        ))}
      </div>
      <div className="mt-7">
        <Constellation data={years} progress={progress} />
      </div>
    </div>
  );
}
