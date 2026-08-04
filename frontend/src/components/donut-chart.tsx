import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ExploreSeries } from "@/lib/api";
import { formatValue, seriesLabel, seriesColor } from "@/lib/format";

/** The interactive donut — the doctrine amendment of 2026-08-02: the pie
 *  ban stands, the DESIGNED donut is allowed. Designed means: at most
 *  seven slices (top six + an honest "others" computed from the view's
 *  full total), fixed series colors, a living center (total at rest, the
 *  hovered slice's reading otherwise), and — where the dimension has a
 *  hierarchy — click drills into a slice. The legend is the accessible
 *  surface: full labels, real buttons; the arcs are its shadow. */

const SIZE = 320;
const C = SIZE / 2;
const R = 118;
const STROKE = 36;
const STROKE_ACTIVE = 42;
const GAP_DEG = 2.4;
const SHOWN_MAX = 6;

const polar = (deg: number, radius: number): [number, number] => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
};

const arcPath = (from: number, to: number): string => {
  const [x0, y0] = polar(from, R);
  const [x1, y1] = polar(to, R);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  others: boolean;
}

export function DonutChart({
  series,
  colorOf,
  unit,
  total,
  ariaLabel,
  onSlice,
}: {
  series: ExploreSeries[];
  unit: string;
  /** The view's FULL total (server-side, all ranked rows) — feeds the
   *  honest "others" slice. Null → only the shown slices, no remainder. */
  total: number | null;
  ariaLabel: string;
  /** Present when a slice can be drilled into (programme hierarchy). */
  onSlice?: (key: string, label: string) => void;
  /** Fixed colour per KEY (the region donut wears the region tints —
   *  never index colours, which would reshuffle with the sort). */
  colorOf?: (key: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<number | null>(null);

  const shown = series
    .filter((serie) => (serie.value ?? 0) > 0)
    .slice(0, SHOWN_MAX)
    .map((serie, index) => ({
      key: String(serie.key),
      label: seriesLabel(serie, t),
      value: serie.value ?? 0,
      color: colorOf ? colorOf(String(serie.key)) : seriesColor(index),
      others: false,
    }));
  const shownSum = shown.reduce((sum, slice) => sum + slice.value, 0);
  const rest = total != null ? total - shownSum : 0;
  const slices: Slice[] =
    rest > shownSum * 0.001
      ? [
          ...shown,
          {
            key: "__others__",
            label: t("explorer.donutOthers"),
            value: rest,
            color: "var(--color-donut-others)",
            others: true,
          },
        ]
      : shown;
  const sum = shown.reduce((acc, slice) => acc + slice.value, 0) + Math.max(rest, 0);
  if (slices.length === 0 || sum <= 0) return null;

  const activeSlice = active != null ? slices[active] : null;
  const share = (slice: Slice) => (100 * slice.value) / sum;
  const pct = (slice: Slice) =>
    `${share(slice).toLocaleString(i18n.language, { maximumFractionDigits: share(slice) < 1 ? 1 : 0 })} %`;

  // True angles, single slice drawn as a full ring; slivers under the gap
  // width are skipped in the drawing (the legend still carries them).
  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.value / sum) * 360;
    const from = cursor;
    cursor += sweep;
    return { slice, from, sweep };
  });

  return (
    <div className="grid items-center gap-x-12 gap-y-6 md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <div className="relative mx-auto w-full max-w-[320px]" role="img" aria-label={ariaLabel}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full" aria-hidden="true">
          {arcs.map(({ slice, from, sweep }, index) =>
            slices.length === 1 ? (
              <circle
                key={slice.key}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={slice.color}
                strokeWidth={index === active ? STROKE_ACTIVE : STROKE}
              />
            ) : sweep <= GAP_DEG * 1.2 ? null : (
              <path
                key={slice.key}
                d={arcPath(from + GAP_DEG / 2, from + sweep - GAP_DEG / 2)}
                fill="none"
                stroke={slice.color}
                strokeWidth={index === active ? STROKE_ACTIVE : STROKE}
                className="transition-[stroke-width] duration-200 ease-out"
                style={{ cursor: onSlice && !slice.others ? "pointer" : undefined }}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onClick={onSlice && !slice.others ? () => onSlice(slice.key, slice.label) : undefined}
              />
            ),
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-[190px] text-center">
            <div className="tnum text-[clamp(20px,2vw,26px)] font-semibold tracking-[-0.02em]">
              {formatValue(activeSlice ? activeSlice.value : sum, unit, i18n.language)}
            </div>
            <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
              {activeSlice
                ? `${activeSlice.label} · ${pct(activeSlice)}`
                : t("explorer.donutTotal")}
            </div>
          </div>
        </div>
      </div>

      <ul className="min-w-0">
        {slices.map((slice, index) => {
          const drillable = Boolean(onSlice) && !slice.others;
          const Row = drillable ? "button" : "div";
          return (
            <li key={slice.key} className="border-t border-border-soft first:border-t-0">
              <Row
                {...(drillable
                  ? {
                      type: "button" as const,
                      onClick: () => onSlice!(slice.key, slice.label),
                      "aria-label": t("explorer.donutEnter", { label: slice.label }),
                    }
                  : {})}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className={`grid w-full grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 text-left outline-offset-2 transition-colors ${
                  drillable ? "cursor-pointer hover:bg-surface/70" : ""
                } ${index === active ? "bg-surface/70" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 self-center rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="text-[13.5px] leading-snug">
                  {slice.label}
                  {drillable ? (
                    <span aria-hidden="true" className="ml-1.5 text-[11px] text-muted-foreground">
                      ›
                    </span>
                  ) : null}
                </span>
                <span className="tnum whitespace-nowrap text-right text-[13px]">
                  <b className="font-semibold">{formatValue(slice.value, unit, i18n.language)}</b>
                  <span className="ml-2 text-muted-foreground">{pct(slice)}</span>
                </span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
