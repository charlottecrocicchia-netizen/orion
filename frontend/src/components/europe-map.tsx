import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import mapData from "@/lib/europe-map.json";
import type { CountryFlow, CountryIndexEntry } from "@/lib/api";
import { formatCompactEur, formatInt } from "@/lib/format";

/** The Europe choropleth — pre-projected SVG paths (zero runtime geometry),
 *  a sequential single-hue scale on funding, per-country flow arcs on hover,
 *  and a cinematic viewBox zoom before opening the country hub. The list
 *  below the map stays the canonical, accessible path; every country shape
 *  is still a focusable link. */

interface MapCountry {
  code: string;
  path: string;
  cx: number;
  cy: number;
}

const MAP = mapData as {
  width: number;
  height: number;
  countries: MapCountry[];
};

// Sequential scale: one hue, stepped by opacity — monotone by construction.
const STEPS = [0.12, 0.28, 0.46, 0.66, 0.88];

function stepFor(value: number, thresholds: number[]): number {
  let index = 0;
  while (index < thresholds.length && value > thresholds[index]) index++;
  return STEPS[Math.min(index, STEPS.length - 1)];
}

const ZOOM_MS = 450;

export function EuropeMap({
  countries,
  flows,
}: {
  countries: CountryIndexEntry[];
  flows: CountryFlow[];
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState(`0 0 ${MAP.width} ${MAP.height}`);
  const [zooming, setZooming] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const byCode = new Map(countries.map((entry) => [entry.code, entry]));
  const centroids = new Map(MAP.countries.map((entry) => [entry.code, entry]));
  const funded = countries
    .filter((entry) => centroids.has(entry.code))
    .map((entry) => entry.funding_eur)
    .sort((a, b) => a - b);
  const thresholds = [0.2, 0.4, 0.6, 0.8].map(
    (q) => funded[Math.floor(q * (funded.length - 1))] ?? 0,
  );
  const maxFunding = funded[funded.length - 1] ?? 0;

  const hoverArcs =
    hover == null
      ? []
      : flows
          .filter((flow) => flow.a === hover || flow.b === hover)
          .sort((x, y) => y.amount_eur - x.amount_eur)
          .slice(0, 5)
          .flatMap((flow) => {
            const from = centroids.get(hover);
            const to = centroids.get(flow.a === hover ? flow.b : flow.a);
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

  const openCountry = (code: string, target: SVGPathElement) => {
    if (zooming) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      navigate(`/explore/countries/${code}`);
      return;
    }
    setZooming(true);
    setTip(null);
    const box = target.getBBox();
    const pad = Math.max(box.width, box.height) * 0.45;
    const goal = [box.x - pad, box.y - pad, box.width + 2 * pad, box.height + 2 * pad];
    const start = [0, 0, MAP.width, MAP.height];
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

  const moveTip = (event: React.MouseEvent, entry: CountryIndexEntry | undefined, code: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      lines: entry
        ? [
            entry.name,
            `${formatCompactEur(entry.funding_eur, i18n.language)} · ${t("search.projectsCount", { count: entry.projects_count })}`,
          ]
        : [code],
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={viewBox}
        className="w-full"
        role="group"
        aria-label={t("explore.mapLabel")}
      >
        {MAP.countries.map((country) => {
          const entry = byCode.get(country.code);
          const opacity = entry ? stepFor(entry.funding_eur, thresholds) : 0;
          return (
            <path
              key={country.code}
              d={country.path}
              role="link"
              tabIndex={zooming ? -1 : 0}
              aria-label={
                entry
                  ? `${entry.name} — ${formatCompactEur(entry.funding_eur, i18n.language)}`
                  : country.code
              }
              fill={entry ? "var(--color-accent)" : "var(--color-surface)"}
              fillOpacity={entry ? opacity : 1}
              stroke={
                hover === country.code ? "var(--color-accent)" : "var(--color-background)"
              }
              strokeWidth={hover === country.code ? 1.6 : 0.75}
              className="cursor-pointer transition-[fill-opacity] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              onMouseEnter={(event) => {
                setHover(country.code);
                moveTip(event, entry, country.code);
              }}
              onMouseMove={(event) => moveTip(event, entry, country.code)}
              onMouseLeave={() => {
                setHover(null);
                setTip(null);
              }}
              onClick={(event) => openCountry(country.code, event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCountry(country.code, event.currentTarget);
                }
              }}
            />
          );
        })}
        {hoverArcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.d}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={arc.width}
            strokeOpacity="0.55"
            strokeLinecap="round"
            pointerEvents="none"
          />
        ))}
      </svg>

      {tip ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-lg bg-foreground px-3 py-2 text-[12px] leading-relaxed text-background shadow-lg"
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

      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>{t("explore.mapLegend")}</span>
        <span aria-hidden="true" className="ml-1 flex items-center gap-1">
          {STEPS.map((step) => (
            <span
              key={step}
              className="h-2.5 w-6 rounded-sm bg-accent"
              style={{ opacity: step }}
            />
          ))}
        </span>
        <span className="tnum">
          0 → {formatCompactEur(maxFunding, i18n.language)}
        </span>
        <span className="ml-auto hidden sm:block">{t("explore.mapHint")}</span>
      </div>
      <span className="sr-only">{formatInt(countries.length, i18n.language)}</span>
    </div>
  );
}
