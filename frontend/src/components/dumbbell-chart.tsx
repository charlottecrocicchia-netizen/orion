import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { formatValue, seriesLabel, seriesColor } from "@/lib/format";

/** The dumbbell (library form B3) — before/after: two time windows, one
 *  segment per series, sorted by who moved. Replaces the static ranked
 *  bars in temporal decks (fondatrice, 2026-08-02): the delta IS the
 *  message. Windows are derived from the years actually present (the last
 *  k years vs the k before), never hardcoded; the header names them. */

function windows(years: number[], now: number): { a: number[]; b: number[] } | null {
  // Right-censoring guard: recent years are structurally incomplete (signed
  // projects starting in the future), so a naive "last years" window reads
  // as a fake collapse. The recent window ends at the last MATURE year —
  // current year − 2, the watch-post signals convention (lot 2) — unless
  // the data itself stops earlier or holds nothing mature.
  const mature = years.filter((year) => year <= now - 2);
  const usable = mature.length >= 2 ? mature : years.filter((year) => year <= now);
  if (usable.length < 2) return null;
  const k = Math.min(3, Math.floor(usable.length / 2));
  return { a: usable.slice(-2 * k, -k), b: usable.slice(-k) };
}

const windowSum = (serie: ExploreResponse["series"][number], win: number[]) =>
  win.reduce(
    (sum, year) => sum + ((serie.points ?? []).find((point) => point.year === year)?.value ?? 0),
    0,
  );

const span = (win: number[]) =>
  win.length > 1 ? `${win[0]}–${win[win.length - 1]}` : String(win[0]);

export function DumbbellChart({
  series,
  unit,
  ariaLabel,
}: {
  series: ExploreResponse["series"];
  unit: string;
  ariaLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const years = [
    ...new Set(series.flatMap((serie) => (serie.points ?? []).map((point) => point.year))),
  ].sort((a, b) => a - b);
  const win = windows(years, new Date().getFullYear());
  if (!win) return null;

  const rows = series
    .map((serie, index) => ({
      serie,
      index,
      a: windowSum(serie, win.a),
      b: windowSum(serie, win.b),
    }))
    .sort((left, right) => right.b - right.a - (left.b - left.a));
  const max = Math.max(...rows.flatMap((row) => [row.a, row.b]), 1);

  return (
    <div role="img" aria-label={`${ariaLabel} — ${t("explorer.deltaLegend", { a: span(win.a), b: span(win.b) })}`}>
      <p aria-hidden="true" className="flex items-center justify-end gap-1.5 text-[12px] text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-muted-foreground/70 align-middle" />
        {span(win.a)}
        <span className="px-0.5">→</span>
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground align-middle" />
        {span(win.b)}
      </p>
      <div className="mt-2">
        {rows.map(({ serie, index, a, b }) => {
          const label = seriesLabel(serie, t);
          const va = formatValue(a, unit, i18n.language);
          const vb = formatValue(b, unit, i18n.language);
          const pct = a > 0 ? Math.round(((b - a) / a) * 100) : null;
          const delta =
            pct != null
              ? `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)} %`
              : b > 0
                ? t("explorer.deltaNew")
                : "—";
          const xa = (a / max) * 100;
          const xb = (b / max) * 100;
          return (
            <div
              key={String(serie.key)}
              tabIndex={0}
              aria-label={`${label} — ${span(win.a)}: ${va}, ${span(win.b)}: ${vb} (${delta})`}
              className="grid grid-cols-[minmax(140px,210px)_minmax(0,1fr)_76px] items-center gap-4 border-t border-border-soft py-2.5 outline-offset-2 first:border-t-0 hover:bg-surface/60"
            >
              <span className="text-[13px] leading-snug">{label}</span>
              <span aria-hidden="true" className="relative block h-6">
                <span
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                  style={{
                    left: `${Math.min(xa, xb)}%`,
                    width: `${Math.max(Math.abs(xb - xa), 0.4)}%`,
                    background: seriesColor(index),
                    opacity: 0.55,
                  }}
                />
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-background"
                  style={{ left: `${xa}%`, borderColor: seriesColor(index) }}
                />
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${xb}%`, background: seriesColor(index) }}
                />
              </span>
              <span
                className={`tnum text-right text-[13px] font-medium ${
                  pct != null && pct < 0 ? "text-muted-foreground" : "text-accent"
                }`}
              >
                {delta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
