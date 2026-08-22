import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { seriesLabel, wrapLabel } from "@/lib/format";

/** The bump chart (library form B1) — ranks over time: who climbs, who
 *  slips. Position IS the message; values live in the twin table. Fixed
 *  series colors by data order (never re-painted on filter), direct labels
 *  on both ends with a background halo — wrapped to two lines when long,
 *  never truncated — gaps where a series leaves the ranking. Quiet by
 *  doctrine: no grid, three year ticks. */

const W = 900;
const H = 380;
const PAD_X = 172;
const PAD_Y = 34;

export function BumpChart({
  series,
  ariaLabel,
  colorOf,
}: {
  series: ExploreResponse["series"];
  ariaLabel: string;
  /** La couleur suit l'entité, jamais son rang : quand la page masque
   *  des séries (légende interactive), elle fournit la couleur
   *  d'origine de chaque clé — un masquage ne repeint rien. */
  colorOf?: (key: string) => string;
}) {
  const { t } = useTranslation();
  const years = [
    ...new Set(series.flatMap((serie) => (serie.points ?? []).map((point) => point.year))),
  ].sort((a, b) => a - b);
  if (years.length < 2 || series.length < 2) return null;

  // Rank per year on value, descending; absent series leave a gap.
  const ranks = new Map<string, Map<number, number>>();
  for (const year of years) {
    const present = series
      .map((serie) => ({
        key: String(serie.key),
        value: (serie.points ?? []).find((point) => point.year === year)?.value ?? null,
      }))
      .filter((entry) => entry.value != null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    present.forEach((entry, index) => {
      if (!ranks.has(entry.key)) ranks.set(entry.key, new Map());
      ranks.get(entry.key)!.set(year, index + 1);
    });
  }

  const n = series.length;
  const xs = (year: number) =>
    PAD_X + ((years.indexOf(year) ?? 0) * (W - 2 * PAD_X)) / Math.max(years.length - 1, 1);
  const ys = (rank: number) => PAD_Y + ((rank - 1) * (H - 2 * PAD_Y)) / Math.max(n - 1, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="block w-full" role="img" aria-label={ariaLabel}>
      {series.map((serie, index) => {
        const key = String(serie.key);
        const own = ranks.get(key);
        if (!own) return null;
        const color = colorOf?.(key) ?? `var(--color-series-${(index % 6) + 1})`;
        const label = seriesLabel(serie, t);
        // Split the path on gaps so a missing year breaks the line.
        const segments: string[][] = [[]];
        for (const year of years) {
          const rank = own.get(year);
          if (rank == null) {
            if (segments[segments.length - 1].length > 0) segments.push([]);
            continue;
          }
          segments[segments.length - 1].push(`${xs(year).toFixed(1)},${ys(rank).toFixed(1)}`);
        }
        const firstYear = years.find((year) => own.has(year))!;
        const lastYear = [...years].reverse().find((year) => own.has(year))!;
        const lines = wrapLabel(label);
        return (
          <g key={key}>
            {segments
              .filter((segment) => segment.length > 1)
              .map((segment, si) => (
                <polyline
                  key={si}
                  points={segment.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeOpacity="0.85"
                  strokeLinecap="round"
                />
              ))}
            {years
              .filter((year) => own.has(year))
              .map((year) => (
                <circle key={year} cx={xs(year)} cy={ys(own.get(year)!)} r="3.5" fill={color} />
              ))}
            <text
              x={xs(firstYear) - 8}
              y={ys(own.get(firstYear)!) + 4 - (lines.length - 1) * 6}
              textAnchor="end"
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-foreground)"
              stroke="var(--color-background)"
              strokeWidth="3.5"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {lines.map((line, li) => (
                <tspan key={li} x={xs(firstYear) - 8} dy={li === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={xs(lastYear) + 8}
              y={ys(own.get(lastYear)!) + 4 - (lines.length - 1) * 6}
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-foreground)"
              stroke="var(--color-background)"
              strokeWidth="3.5"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {lines.map((line, li) => (
                <tspan key={li} x={xs(lastYear) + 8} dy={li === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <text x={PAD_X} y={H + 14} fontSize="11" fill="var(--color-muted-foreground)">
        {years[0]}
      </text>
      <text
        x={W / 2}
        y={H + 14}
        textAnchor="middle"
        fontSize="11"
        fill="var(--color-muted-foreground)"
      >
        {years[Math.floor(years.length / 2)]}
      </text>
      <text
        x={W - PAD_X}
        y={H + 14}
        textAnchor="end"
        fontSize="11"
        fill="var(--color-muted-foreground)"
      >
        {years[years.length - 1]}
      </text>
      {/* Corner rank cue sits above the label column — two-line direct
          labels reach the left margin. */}
      <text x="8" y="13" fontSize="10.5" fill="var(--color-muted-foreground)">
        {t("explorer.bumpTop")}
      </text>
    </svg>
  );
}
