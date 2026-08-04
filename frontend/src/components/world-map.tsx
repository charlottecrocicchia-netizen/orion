import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import type { CountryFlow, CountryIndexEntry } from "@/lib/api";
import { useFlatMaps } from "@/lib/flat-geo";
import { formatCompactEur, formatInt } from "@/lib/format";
import {
  AMOUNT_STEPS,
  amountStep,
  bucketLabels,
  regionColor,
  type RegionSlug,
} from "@/lib/regions";

/** The flat analysis map, WORLDWIDE (chantier régions, 2026-08-04 —
 *  formerly EuropeMap, whose 38-country scope had become a lie once
 *  74 % of the corpus in euros turned American). One pre-projected
 *  geometry per scope (world + the five manager regions), countries
 *  tinted by their region, intensity encoding the amount through the
 *  named LOG buckets (decision ⑤), micro-territories as clickable dots
 *  (Malta was invisible before — it never had a 110m polygon).
 *
 *  THE RULE, founder-engraved: every country present in the corpus is
 *  coloured, hoverable and clickable; grey is reserved for countries
 *  without any data. Interactivity derives from the `countries` prop —
 *  the corpus — never from a hardcoded list.
 *
 *  The map rule holds (fondatrice, 2026-08-02): first activation
 *  selects, only a second activation of the selected country leaves
 *  for its file; keyboard rides the same path. */

const ZOOM_MS = 450;
const STAGE = { width: 900, height: 675 };

export function WorldMap({
  countries,
  flows,
  legendLabel,
  selected = null,
  onSelect,
  scope = "world",
}: {
  countries: CountryIndexEntry[];
  flows: CountryFlow[];
  /** Override the legend label (the Explorer maps its current euro metric). */
  legendLabel?: string;
  /** The currently selected country (select-first interaction). */
  selected?: string | null;
  /** First activation selects; a second activation of the selected
   *  country zooms into its file. */
  onSelect?: (code: string) => void;
  /** Geographic frame: the world, or one manager region. */
  scope?: RegionSlug | "world";
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const flatData = useFlatMaps();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState(`0 0 ${STAGE.width} ${STAGE.height}`);
  const [zooming, setZooming] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const geo = flatData?.scopes[scope] ?? flatData?.scopes.world ?? { countries: [], points: [] };
  const byCode = new Map(countries.map((entry) => [entry.code, entry]));
  const centroids = new Map(geo.countries.map((entry) => [entry.code, entry]));

  // Flows follow the hovered country, or stay pinned on the selection.
  const arcSource = hover ?? (onSelect ? selected : null);
  const hoverArcs =
    arcSource == null
      ? []
      : flows
          .filter((flow) => flow.a === arcSource || flow.b === arcSource)
          .sort((x, y) => y.amount_eur - x.amount_eur)
          .slice(0, 5)
          .flatMap((flow) => {
            const from = centroids.get(arcSource);
            const to = centroids.get(flow.a === arcSource ? flow.b : flow.a);
            if (!from || !to) return [];
            const maxAmount = Math.max(...flows.map((f) => f.amount_eur), 1);
            return [
              {
                key: `${flow.a}-${flow.b}`,
                d: `M${from.cx},${from.cy} Q${(from.cx + to.cx) / 2},${
                  Math.min(from.cy, to.cy) - 36
                } ${to.cx},${to.cy}`,
                width: 1 + (flow.amount_eur / maxAmount) * 2.6,
              },
            ];
          });

  const openCountry = (code: string, target: SVGGraphicsElement) => {
    if (zooming) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      navigate(`/explore/countries/${code}`);
      return;
    }
    setZooming(true);
    setTip(null);
    const box = target.getBBox();
    const pad = Math.max(box.width, box.height, 14) * 0.45;
    const goal = [box.x - pad, box.y - pad, box.width + 2 * pad, box.height + 2 * pad];
    const start = [0, 0, STAGE.width, STAGE.height];
    const t0 = performance.now();
    const ease = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
    const frame = (now: number) => {
      const u = Math.min((now - t0) / ZOOM_MS, 1);
      const e = ease(u);
      setViewBox(start.map((s, i) => (s + (goal[i] - s) * e).toFixed(1)).join(" "));
      if (u < 1) requestAnimationFrame(frame);
      else navigate(`/explore/countries/${code}`);
    };
    requestAnimationFrame(frame);
  };

  // First activation selects; the second — on the already-selected
  // country — leaves for its file. Click and keyboard share this path.
  const activate = (code: string, target: SVGGraphicsElement) => {
    if (onSelect && code !== selected) {
      setTip(null);
      onSelect(code);
      return;
    }
    openCountry(code, target);
  };

  const moveTip = (event: React.MouseEvent, entry: CountryIndexEntry | undefined, code: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      lines: entry
        ? [
            entry.name,
            entry.projects_count > 0
              ? `${formatCompactEur(entry.funding_eur, i18n.language)} · ${t("search.projectsCount", { count: entry.projects_count })}`
              : formatCompactEur(entry.funding_eur, i18n.language),
          ]
        : [code],
    });
  };

  const interactionProps = (code: string, entry: CountryIndexEntry | undefined) => ({
    "data-code": code,
    role: (onSelect ? "button" : "link") as "button" | "link",
    "aria-pressed": onSelect ? selected === code : undefined,
    tabIndex: zooming ? -1 : 0,
    "aria-label": entry
      ? `${entry.name} — ${formatCompactEur(entry.funding_eur, i18n.language)}`
      : code,
    className:
      "cursor-pointer transition-[fill-opacity] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
    onMouseEnter: (event: React.MouseEvent) => {
      setHover(code);
      moveTip(event, entry, code);
    },
    onMouseMove: (event: React.MouseEvent) => moveTip(event, entry, code),
    onMouseLeave: () => {
      setHover(null);
      setTip(null);
    },
    onClick: (event: React.MouseEvent<SVGGraphicsElement>) =>
      activate(code, event.currentTarget),
    onKeyDown: (event: React.KeyboardEvent<SVGGraphicsElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(code, event.currentTarget);
      }
    },
  });

  const buckets = bucketLabels(i18n.language);

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={viewBox} className="w-full" role="group" aria-label={t("explore.mapLabel")}>
        {geo.countries.map((country) => {
          const entry = byCode.get(country.code);
          const opacity = entry ? amountStep(entry.funding_eur) : 0;
          const isSelected = onSelect != null && selected === country.code;
          // No data: quiet surface. With data: the REGION's tint (from
          // the API entry, never guessed here), stepped by amount.
          const fill = entry ? regionColor(entry.region) : "var(--color-surface)";
          return (
            <path
              key={country.code}
              d={country.path}
              fill={fill}
              fillOpacity={entry ? (isSelected ? Math.min(opacity + 0.2, 0.95) : opacity) : 1}
              stroke={
                isSelected || hover === country.code ? fill : "var(--color-background)"
              }
              strokeWidth={isSelected ? 2 : hover === country.code ? 1.6 : 0.75}
              {...(entry
                ? interactionProps(country.code, entry)
                : { "data-code": country.code })}
            />
          );
        })}
        {geo.points.map((point) => {
          const entry = byCode.get(point.code);
          if (!entry) return null; // no data: a micro-territory stays silent
          const isSelected = onSelect != null && selected === point.code;
          return (
            <circle
              key={point.code}
              cx={point.cx}
              cy={point.cy}
              r={isSelected || hover === point.code ? 6.5 : 5}
              fill={regionColor(entry.region)}
              fillOpacity={Math.max(amountStep(entry.funding_eur), 0.46)}
              stroke="var(--color-background)"
              strokeWidth={isSelected ? 2 : 1}
              {...interactionProps(point.code, entry)}
            />
          );
        })}
        {hoverArcs.map((arc) => (
          // Flow arcs keep their halo so they read on every choropleth step.
          <g key={arc.key} pointerEvents="none">
            <path
              d={arc.d}
              fill="none"
              stroke="var(--color-background)"
              strokeWidth={arc.width + 2.2}
              strokeOpacity="0.85"
              strokeLinecap="round"
            />
            <path
              d={arc.d}
              fill="none"
              stroke="var(--color-series-2)"
              strokeWidth={arc.width}
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>

      {tip ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-lg bg-foreground px-3 py-2 text-[12px] leading-relaxed text-background shadow-key"
          style={{
            left: tip.x,
            top: tip.y - 12,
            transform: `translate(${tip.x > 460 ? "calc(-100% - 10px)" : "12px"}, -100%)`,
          }}
        >
          {tip.lines.map((line) => (
            <div key={line} className="whitespace-nowrap">
              {line}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span>{legendLabel ?? t("explore.mapLegend")}</span>
        <span aria-hidden="true" className="ml-1 flex items-center gap-1">
          {AMOUNT_STEPS.map((step, index) => (
            <span
              key={step}
              title={buckets[index]}
              className="h-2.5 w-6 rounded-sm bg-foreground"
              style={{ opacity: 0.12 + step * 0.75 }}
            />
          ))}
        </span>
        {/* The named euro buckets — an absolute legend a manager reads. */}
        <span className="tnum">
          {buckets[0]} → {buckets[buckets.length - 1]}
        </span>
        <span className="ml-5 flex items-center gap-1.5">
          <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
            <path
              d="M1,9 Q11,-3 21,9"
              fill="none"
              stroke="var(--color-series-2)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {t("explore.mapFlows")}
        </span>
        <span className="ml-auto hidden sm:block">{t("explore.mapHint")}</span>
      </div>
      <span className="sr-only">{formatInt(countries.length, i18n.language)}</span>
    </div>
  );
}
