import { useTranslation } from "react-i18next";

import { Constellation } from "@/components/constellation";
import { Kpi } from "@/components/kpi";
import { useRevealProgress } from "@/hooks/use-reveal-progress";

/** Doctrine step 1 deliverable — the hero figure and its curve as ONE
 *  gesture: a single reveal progress drives the €-count-up, the KPI
 *  count-ups and the constellation's stroke-dashoffset, armed once when
 *  the hero enters the viewport. Reduced motion (or no IntersectionObserver,
 *  e.g. jsdom) renders the final state immediately. */

interface StatHeroProps {
  funding: number | null;
  sub: string;
  kpis: { value: number | null; label: string }[];
  years: { year: number; amount_eur: number }[];
  /** External progress (the home's GSAP pin+scrub). When set, the built-in
   *  viewport reveal never arms — one driver at a time, no race. */
  progress?: number | null;
}

export function StatHero({ funding, sub, kpis, years, progress: external }: StatHeroProps) {
  const { i18n } = useTranslation();
  const { ref, progress: internal } = useRevealProgress(external == null && funding != null);
  const progress = external ?? internal;
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
