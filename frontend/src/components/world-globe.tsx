import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CountryIndexEntry } from "@/lib/api";

/** The world globe — runtime orthographic projection over the shared Natural
 *  Earth geometries, drag to rotate, click a covered country to morph the
 *  projection into the flat analysis map (same 900×675 viewBox, so the
 *  hand-over to EuropeMap is seamless). Pointer-first by design: the flat map
 *  and the ranked list below stay the keyboard and screen-reader path, and
 *  the visible "map" switch is a real button. */

interface GeoCountry {
  code: string;
  rings: [number, number][][];
}

interface GeoData {
  countries: GeoCountry[];
  world: [number, number][][];
}

const W = 900;
const H = 675;
const R = 292;
const CX = W / 2;
const CY = H / 2 + 6;
const RAD = Math.PI / 180;

// The flat map's projection (identical to build-europe-map.mjs) — the morph target.
const FLAT = { lon0: -25, lat1: 71.5, k: W / 70, latScale: 1.4 };

function flat([lon, lat]: [number, number]): [number, number] {
  return [(lon - FLAT.lon0) * FLAT.k, (FLAT.lat1 - lat) * FLAT.k * FLAT.latScale];
}

function makeOrtho(lonC: number, latC: number) {
  const sinLatC = Math.sin(latC * RAD);
  const cosLatC = Math.cos(latC * RAD);
  return ([lon, lat]: [number, number]): [number, number] | null => {
    const lambda = (lon - lonC) * RAD;
    const phi = lat * RAD;
    const cosc = sinLatC * Math.sin(phi) + cosLatC * Math.cos(phi) * Math.cos(lambda);
    if (cosc < 0.015) return null;
    const x = R * Math.cos(phi) * Math.sin(lambda);
    const y = R * (cosLatC * Math.sin(phi) - sinLatC * Math.cos(phi) * Math.cos(lambda));
    return [CX + x, CY - y];
  };
}

function ringToPath(
  ring: [number, number][],
  project: (p: [number, number]) => [number, number] | null,
): string {
  let d = "";
  let open = false;
  for (const point of ring) {
    const projected = project(point);
    if (projected == null) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${projected[0].toFixed(1)},${projected[1].toFixed(1)}`;
    open = true;
  }
  return d;
}

const ease = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const MORPH_MS = 700;

export function WorldGlobe({
  countries,
  onOpenCountry,
}: {
  countries: CountryIndexEntry[];
  onOpenCountry: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [view, setView] = useState({ lonC: 12, latC: 42 });
  const [hover, setHover] = useState<string | null>(null);
  const [morphT, setMorphT] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const spin = useRef<number | null>(null);
  const covered = useMemo(
    () => new Set(countries.map((entry) => entry.code)),
    [countries],
  );

  useEffect(() => {
    let alive = true;
    void import("@/lib/world-geo.json").then((module) => {
      if (alive) setGeo(module.default as unknown as GeoData);
    });
    return () => {
      alive = false;
    };
  }, []);

  // A slow initial spin, stopped by the first interaction; none under
  // reduced motion (the CSS kill-switch cannot reach a rAF loop).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const step = () => {
      setView((current) => ({ ...current, lonC: current.lonC + 0.018 }));
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
    return () => {
      if (spin.current != null) cancelAnimationFrame(spin.current);
    };
  }, []);

  const stopSpin = () => {
    if (spin.current != null) {
      cancelAnimationFrame(spin.current);
      spin.current = null;
    }
  };

  const startMorph = (code: string) => {
    stopSpin();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onOpenCountry(code);
      return;
    }
    const t0 = performance.now();
    const frame = (now: number) => {
      const u = Math.min((now - t0) / MORPH_MS, 1);
      setMorphT(ease(u));
      if (u < 1) requestAnimationFrame(frame);
      else onOpenCountry(code);
    };
    requestAnimationFrame(frame);
  };

  const ortho = makeOrtho(view.lonC, view.latC);
  const project =
    morphT == null
      ? ortho
      : (point: [number, number]): [number, number] | null => {
          const from = ortho(point);
          const to = flat(point);
          if (from == null) return morphT > 0.55 ? to : null;
          return [from[0] + (to[0] - from[0]) * morphT, from[1] + (to[1] - from[1]) * morphT];
        };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={t("explore.globeLabel")}
        onPointerDown={(event) => {
          stopSpin();
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || morphT != null) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          drag.current = { x: event.clientX, y: event.clientY };
          setView((current) => ({
            lonC: current.lonC - dx * 0.35,
            latC: Math.min(Math.max(current.latC + dy * 0.35, -50), 75),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {morphT == null || morphT < 1 ? (
          <circle
            cx={CX}
            cy={CY}
            r={R + 1}
            fill="var(--color-accent-soft)"
            fillOpacity={morphT == null ? 0.45 : 0.45 * (1 - morphT)}
            stroke="var(--color-border)"
            strokeOpacity={morphT == null ? 1 : 1 - morphT}
          />
        ) : null}
        <g
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="0.7"
          opacity={morphT == null ? 1 : 1 - morphT}
        >
          {geo?.world.map((ring, index) => {
            const d = ringToPath(ring, ortho);
            return d ? <path key={index} d={d} /> : null;
          })}
        </g>
        {geo?.countries.map((country) => {
          const isCovered = covered.has(country.code);
          const d = country.rings
            .map((ring) => {
              const path = ringToPath(ring, project);
              return path ? `${path}Z` : "";
            })
            .join("");
          if (!d) return null;
          return (
            <path
              key={country.code}
              d={d}
              data-code={country.code}
              fill={isCovered ? "var(--color-accent)" : "var(--color-surface)"}
              fillOpacity={isCovered ? (hover === country.code ? 0.6 : 0.32) : 0.9}
              stroke={isCovered ? "var(--color-accent)" : "var(--color-border)"}
              strokeOpacity={isCovered ? 0.6 : 1}
              strokeWidth="0.8"
              className={isCovered && morphT == null ? "cursor-pointer" : undefined}
              onMouseEnter={() => setHover(country.code)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (isCovered && morphT == null) startMorph(country.code);
              }}
            />
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-accent opacity-40" />
          {t("explore.coverageHave")}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-surface ring-1 ring-border" />
          {t("explore.coverageSoon")}
        </span>
        <span>{t("explore.globeHint")}</span>
        <span className="ml-auto">
          <b className="font-semibold text-foreground">{t("explore.coverageNote")}</b>{" "}
          {t("explore.coverageDetail")}
        </span>
      </div>
    </div>
  );
}
