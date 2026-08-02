import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { useMeasure } from "@/hooks/use-measure";
import type { ExploreSeries } from "@/lib/api";
import { formatValue, seriesLabel, wrapLabel } from "@/lib/format";

/* Categorical series palette — six distinct hues in a fixed order, anchored on
   the brand ultramarine, validated per theme (CVD separation + contrast) with
   the dataviz validator. Color follows the entity, never its rank. */
const SERIES_COLORS = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
  "var(--color-series-6)",
];

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg bg-foreground px-3 py-2 text-[12px] leading-relaxed text-background shadow-key"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.x > 480 ? "calc(-100% - 10px)" : "10px"}, -50%)`,
      }}
    >
      {tip.lines.map((line) => (
        <div key={line} className="whitespace-nowrap">
          {line}
        </div>
      ))}
    </div>
  );
}

function ChartShell({
  children,
  height,
}: {
  children: (width: number) => ReactNode;
  height: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  return (
    <div ref={ref} className="relative w-full" style={{ minHeight: height }}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

/* ————— Horizontal bars (HTML: native truncation, native a11y) ————— */

export function BarsChart({
  series,
  unit,
  ariaLabel,
}: {
  series: ExploreSeries[];
  unit: string;
  ariaLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const max = Math.max(...series.map((s) => s.value ?? 0), 1);
  return (
    <div role="img" aria-label={ariaLabel}>
      {series.map((serie) => {
        const label = seriesLabel(serie, t);
        const value = formatValue(serie.value, unit, i18n.language);
        return (
          <div
            key={String(serie.key)}
            tabIndex={0}
            aria-label={`${label} — ${value}`}
            className="group flex items-center gap-4 rounded-md px-1 py-2 outline-offset-2 hover:bg-surface/60"
          >
            <span className="w-[220px] shrink-0 text-[13.5px] leading-snug">{label}</span>
            <span className="relative h-[14px] min-w-0 flex-1 overflow-hidden rounded-[4px] bg-surface">
              <span
                className="absolute inset-y-0 left-0 rounded-[4px] bg-gradient-to-r from-accent to-gradient-to transition-[width] duration-700"
                style={{ width: `${Math.max(((serie.value ?? 0) / max) * 100, 0.8)}%` }}
              />
            </span>
            <span className="tnum w-24 shrink-0 text-right text-[13.5px] font-medium">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ————— Multi-line / area chart ————— */

export function LinesChart({
  series,
  unit,
  ariaLabel,
}: {
  series: ExploreSeries[];
  unit: string;
  ariaLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const [tip, setTip] = useState<Tip | null>(null);
  const H = 380;
  const PAD = { top: 16, right: 130, bottom: 28, left: 64 };

  const years = [
    ...new Set(series.flatMap((s) => (s.points ?? []).map((p) => p.year))),
  ].sort((a, b) => a - b);
  const maxValue = Math.max(
    ...series.flatMap((s) => (s.points ?? []).map((p) => p.value ?? 0)),
    1,
  );
  if (years.length < 2) return null;

  return (
    <ChartShell height={H}>
      {(width) => {
        const single = series.length === 1;
        const padRight = single ? 24 : PAD.right;
        const x = (year: number) =>
          PAD.left +
          ((year - years[0]) * (width - PAD.left - padRight)) /
            Math.max(years[years.length - 1] - years[0], 1);
        const y = (value: number) => H - PAD.bottom - (value / maxValue) * (H - PAD.top - PAD.bottom);
        const byYear = (year: number) =>
          series
            .map((serie) => ({
              serie,
              value: (serie.points ?? []).find((p) => p.year === year)?.value ?? null,
            }))
            .filter((entry) => entry.value != null);

        // End-of-line labels anchor on each series' recent peak (the last data
        // year is usually a near-zero stub), then cascade apart and clamp.
        // Long labels wrap to two lines — never truncated — and the cascade
        // reserves the extra line's height.
        const anchor = (serie: ExploreSeries) => {
          const values = (serie.points ?? []).filter((p) => p.value != null).slice(-6);
          return Math.max(...values.map((p) => p.value ?? 0), 0);
        };
        const endLabels = series
          .map((serie, index) => ({
            serie,
            index,
            y: y(anchor(serie)),
            lines: wrapLabel(seriesLabel(serie, t), 22),
          }))
          .sort((a, b) => a.y - b.y);
        for (let i = 1; i < endLabels.length; i++) {
          const need = 15 + (endLabels[i - 1].lines.length - 1) * 12;
          if (endLabels[i].y - endLabels[i - 1].y < need) endLabels[i].y = endLabels[i - 1].y + need;
        }
        const last = endLabels[endLabels.length - 1];
        const overflow = (last ? last.y + (last.lines.length - 1) * 12 : 0) - (H - PAD.bottom - 6);
        if (overflow > 0) for (const label of endLabels) label.y -= overflow;

        const tickLabel = (value: number) =>
          unit === "eur" && maxValue >= 995e6
            ? `€${(value / 1e9).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}B`
            : formatValue(value, unit, i18n.language);

        const step = years.length > 1 ? (x(years[1]) - x(years[0])) : 24;

        return (
          <>
            <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={ariaLabel}>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1={PAD.left}
                    x2={width - padRight}
                    y1={y(maxValue * fraction)}
                    y2={y(maxValue * fraction)}
                    stroke="var(--color-border-soft)"
                  />
                  <text
                    x={PAD.left - 8}
                    y={y(maxValue * fraction) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--color-muted-foreground)"
                    className="tnum"
                  >
                    {tickLabel(maxValue * fraction)}
                  </text>
                </g>
              ))}
              {years
                .filter((_, index) => index % Math.ceil(years.length / 8) === 0)
                .map((year) => (
                  <text
                    key={year}
                    x={x(year)}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-muted-foreground)"
                    className="tnum"
                  >
                    {year}
                  </text>
                ))}

              {series.map((serie, index) => {
                const color = SERIES_COLORS[index % SERIES_COLORS.length];
                const pts = (serie.points ?? []).filter((p) => p.value != null);
                const path = pts.map((p) => `${x(p.year).toFixed(1)},${y(p.value ?? 0).toFixed(1)}`);
                return (
                  <g key={String(serie.key)}>
                    {single ? (
                      <polygon
                        points={`${PAD.left},${y(0)} ${path.join(" ")} ${x(pts[pts.length - 1]?.year ?? years[0])},${y(0)}`}
                        fill="var(--color-accent-soft)"
                      />
                    ) : null}
                    <polyline
                      points={path.join(" ")}
                      fill="none"
                      stroke={color}
                      strokeWidth={index === 0 ? 2.4 : 1.8}
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}

              {!single &&
                endLabels.map(({ serie, index, y: labelY, lines }) => (
                  <text
                    key={String(serie.key)}
                    x={width - padRight + 10}
                    y={labelY + 4}
                    fontSize="12"
                    fontWeight={index === 0 ? 600 : 400}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                  >
                    {lines.map((line, li) => (
                      <tspan key={li} x={width - padRight + 10} dy={li === 0 ? 0 : 12}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                ))}

              {/* one focusable hover column per year — the a11y + tooltip layer */}
              {years.map((year) => (
                <rect
                  key={year}
                  x={x(year) - step / 2}
                  y={PAD.top}
                  width={step}
                  height={H - PAD.top - PAD.bottom}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${year} — ${byYear(year)
                    .map(
                      (entry) =>
                        `${seriesLabel(entry.serie, t)} ${formatValue(entry.value, unit, i18n.language)}`,
                    )
                    .join(", ")}`}
                  onMouseEnter={() =>
                    setTip({
                      x: x(year),
                      y: 130,
                      lines: [
                        String(year),
                        ...byYear(year).map(
                          (entry) =>
                            `${seriesLabel(entry.serie, t)} · ${formatValue(entry.value, unit, i18n.language)}`,
                        ),
                      ],
                    })
                  }
                  onFocus={() =>
                    setTip({
                      x: x(year),
                      y: 130,
                      lines: [
                        String(year),
                        ...byYear(year).map(
                          (entry) =>
                            `${seriesLabel(entry.serie, t)} · ${formatValue(entry.value, unit, i18n.language)}`,
                        ),
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                  onBlur={() => setTip(null)}
                />
              ))}
              {tip ? (
                <line
                  x1={tip.x}
                  x2={tip.x}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="var(--color-border)"
                  strokeDasharray="3 4"
                />
              ) : null}
            </svg>
            <TipBox tip={tip} />
          </>
        );
      }}
    </ChartShell>
  );
}

/* ————— Squarified treemap ————— */

interface TreeRect {
  serie: ExploreSeries;
  x: number;
  y: number;
  w: number;
  h: number;
  rank: number;
}

function squarify(series: ExploreSeries[], width: number, height: number): TreeRect[] {
  const total = series.reduce((sum, serie) => sum + (serie.value ?? 0), 0);
  if (total <= 0) return [];
  const scaled = series.map((serie, rank) => ({
    serie,
    rank,
    area: ((serie.value ?? 0) / total) * width * height,
  }));
  const rects: TreeRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: typeof scaled = [];
  let queue = scaled.filter((entry) => entry.area > 0);

  const worst = (row: typeof scaled, side: number) => {
    const sum = row.reduce((acc, entry) => acc + entry.area, 0);
    const max = Math.max(...row.map((entry) => entry.area));
    const min = Math.min(...row.map((entry) => entry.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = (row: typeof scaled) => {
    const sum = row.reduce((acc, entry) => acc + entry.area, 0);
    const horizontal = w < h;
    const side = horizontal ? w : h;
    const thickness = sum / side;
    let offset = 0;
    for (const entry of row) {
      const length = entry.area / thickness;
      rects.push(
        horizontal
          ? { serie: entry.serie, rank: entry.rank, x: x + offset, y, w: length, h: thickness }
          : { serie: entry.serie, rank: entry.rank, x, y: y + offset, w: thickness, h: length },
      );
      offset += length;
    }
    if (horizontal) {
      y += thickness;
      h -= thickness;
    } else {
      x += thickness;
      w -= thickness;
    }
  };

  while (queue.length > 0) {
    const side = Math.min(w, h);
    const next = queue[0];
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
      row.push(next);
      queue = queue.slice(1);
    } else {
      layoutRow(row);
      row = [];
    }
  }
  if (row.length > 0) layoutRow(row);
  return rects;
}

export function TreemapChart({
  series,
  unit,
  ariaLabel,
}: {
  series: ExploreSeries[];
  unit: string;
  ariaLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const [tip, setTip] = useState<Tip | null>(null);
  const H = 400;

  return (
    <ChartShell height={H}>
      {(width) => {
        const rects = squarify(series, width, H);
        return (
          <>
            <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={ariaLabel}>
              {rects.map(({ serie, x, y, w, h, rank }) => {
                const label = seriesLabel(serie, t);
                const value = formatValue(serie.value, unit, i18n.language);
                const opacity = Math.max(0.92 - rank * 0.11, 0.22);
                // A cell shows its label IN FULL (word-wrapped) or not at
                // all — never sliced mid-word. Small cells keep the value;
                // the tooltip and the twin table carry their full reading.
                const labelLines = (() => {
                  const perLine = Math.floor((w - 28) / 7.2);
                  if (perLine < 4) return null;
                  const lines: string[] = [];
                  let current = "";
                  for (const word of label.split(" ")) {
                    if (word.length > perLine) return null;
                    const candidate = current ? `${current} ${word}` : word;
                    if (candidate.length <= perLine) current = candidate;
                    else {
                      lines.push(current);
                      current = word;
                    }
                  }
                  lines.push(current);
                  return 26 + lines.length * 15 + 6 <= h ? lines : null;
                })();
                return (
                  <g
                    key={String(serie.key)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${label} — ${value}`}
                    onMouseEnter={() => setTip({ x: x + w / 2, y: y + h / 2, lines: [label, value] })}
                    onFocus={() => setTip({ x: x + w / 2, y: y + h / 2, lines: [label, value] })}
                    onMouseLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    <rect
                      x={x + 1.5}
                      y={y + 1.5}
                      width={Math.max(w - 3, 0)}
                      height={Math.max(h - 3, 0)}
                      rx="8"
                      fill="var(--color-accent)"
                      fillOpacity={opacity}
                    />
                    {w > 110 && h > 52 ? (
                      labelLines ? (
                        <>
                          <text x={x + 14} y={y + 26} fontSize="12.5" fontWeight="600" fill="#fff">
                            {labelLines.map((line, li) => (
                              <tspan key={li} x={x + 14} dy={li === 0 ? 0 : 15}>
                                {line}
                              </tspan>
                            ))}
                          </text>
                          <text
                            x={x + 14}
                            y={y + 26 + labelLines.length * 15 + 3}
                            fontSize="12"
                            fill="#fff"
                            fillOpacity="0.85"
                            className="tnum"
                          >
                            {value}
                          </text>
                        </>
                      ) : (
                        <text x={x + 14} y={y + 26} fontSize="12" fill="#fff" fillOpacity="0.85" className="tnum">
                          {value}
                        </text>
                      )
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <TipBox tip={tip} />
          </>
        );
      }}
    </ChartShell>
  );
}
