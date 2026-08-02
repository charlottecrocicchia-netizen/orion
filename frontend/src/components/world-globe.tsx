import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CountryFlow, CountryIndexEntry } from "@/lib/api";
import { formatCompactEur } from "@/lib/format";

/** The world globe — runtime orthographic projection over the shared Natural
 *  Earth geometries, drag to rotate. Two lives: on the countries page a click
 *  morphs the projection into the flat analysis map (same 900×675 viewBox,
 *  seamless hand-over to EuropeMap); on the home's act 3 (`mode="select"`)
 *  hovering a covered country lights its PARTNER CONSTELLATION — real flows
 *  drawn as thin lines to stars sized by amount, the Orion metaphor on the
 *  planet — and a click hands the country to the panel instead of morphing.
 *  Pointer-first by design: the flat map and ranked lists stay the keyboard
 *  and screen-reader path, and every visible switch is a real button. */

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

function makeOrtho(lonC: number, latC: number, radius = R) {
  const sinLatC = Math.sin(latC * RAD);
  const cosLatC = Math.cos(latC * RAD);
  return ([lon, lat]: [number, number]): [number, number] | null => {
    const lambda = (lon - lonC) * RAD;
    const phi = lat * RAD;
    const cosc = sinLatC * Math.sin(phi) + cosLatC * Math.cos(phi) * Math.cos(lambda);
    if (cosc < 0.015) return null;
    const x = radius * Math.cos(phi) * Math.sin(lambda);
    const y = radius * (cosLatC * Math.sin(phi) - sinLatC * Math.cos(phi) * Math.cos(lambda));
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
  mode = "morph",
  flows = [],
  selected = null,
  zoom = 1,
}: {
  countries: CountryIndexEntry[];
  onOpenCountry: (code: string) => void;
  /** "morph" (countries page): click melts into the flat map.
   *  "select" (home act 3): click hands over to the country panel. */
  mode?: "morph" | "select";
  /** Real collaboration flows — fuels the hover constellation. */
  flows?: CountryFlow[];
  /** Country held open by the panel — keeps its constellation lit. */
  selected?: string | null;
  /** >1 crops the sphere and frames the covered region (home act 3) —
   *  the grey waiting-world stops dominating; rotation still reveals it. */
  zoom?: number;
}) {
  const { t, i18n } = useTranslation();
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [view, setView] = useState({ lonC: 12, latC: zoom > 1 ? 48 : 42 });
  const radius = R * zoom;
  const [hover, setHover] = useState<string | null>(null);
  const [morphT, setMorphT] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; id: number; captured: boolean } | null>(null);
  const spin = useRef<number | null>(null);
  const covered = useMemo(
    () => new Set(countries.map((entry) => entry.code)),
    [countries],
  );
  const byCode = useMemo(
    () => new Map(countries.map((entry) => [entry.code, entry])),
    [countries],
  );

  // Approximate centroids (mean of the largest ring) — plenty for anchoring
  // constellation lines and stars.
  const centroids = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const country of geo?.countries ?? []) {
      const ring = country.rings.reduce((a, b) => (b.length > a.length ? b : a));
      let lon = 0;
      let lat = 0;
      for (const [x, y] of ring) {
        lon += x;
        lat += y;
      }
      map.set(country.code, [lon / ring.length, lat / ring.length]);
    }
    return map;
  }, [geo]);

  useEffect(() => {
    let alive = true;
    void import("@/lib/world-geo.json").then((module) => {
      if (alive) setGeo(module.default as unknown as GeoData);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The idle motion, doubled on founder feedback (0.018°/frame was nearly
  // imperceptible) and stopped at first pointer contact. Framed (zoom > 1)
  // it PENDULUMS ±16° around the covered region — a continuous spin would
  // carry Europe out of the crop and parade the grey waiting-world instead.
  // Unframed it keeps the slow full rotation. None under reduced motion
  // (the CSS kill-switch cannot reach a rAF loop).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lon0 = zoom > 1 ? 12 : null;
    let phase = 0;
    const step = () => {
      if (lon0 != null) {
        phase += 0.0025;
        setView((current) => ({ ...current, lonC: lon0 + 16 * Math.sin(phase) }));
      } else {
        setView((current) => ({ ...current, lonC: current.lonC + 0.036 }));
      }
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
    return () => {
      if (spin.current != null) cancelAnimationFrame(spin.current);
    };
  }, [zoom]);

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

  const ortho = makeOrtho(view.lonC, view.latC, radius);
  const project =
    morphT == null
      ? ortho
      : (point: [number, number]): [number, number] | null => {
          const from = ortho(point);
          const to = flat(point);
          if (from == null) return morphT > 0.55 ? to : null;
          return [from[0] + (to[0] - from[0]) * morphT, from[1] + (to[1] - from[1]) * morphT];
        };

  // The partner constellation — the hovered (or panel-held) country becomes
  // the centre of its real collaboration sky: top-5 flows as thin lines to
  // stars sized by amount, labelled at the far end.
  const focus = mode === "select" ? (hover ?? selected) : null;
  const constellation = useMemo(() => {
    if (!focus || flows.length === 0) return null;
    const origin = centroids.get(focus);
    const from = origin ? ortho(origin) : null;
    if (!origin || !from) return null;
    const top = flows
      .filter((flow) => flow.a === focus || flow.b === focus)
      .sort((x, y) => y.amount_eur - x.amount_eur)
      .slice(0, 5);
    const maxAmount = top[0]?.amount_eur ?? 1;
    const stars = top.flatMap((flow) => {
      const code = flow.a === focus ? flow.b : flow.a;
      const centroid = centroids.get(code);
      const at = centroid ? ortho(centroid) : null;
      if (!at) return [];
      return [{ code, at, r: 2.6 + 3.2 * Math.sqrt(flow.amount_eur / maxAmount) }];
    });
    return { from, stars };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, flows, centroids, view.lonC, view.latC]);

  const focusEntry = focus ? byCode.get(focus) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={t("explore.globeLabel")}
        onPointerEnter={stopSpin}
        onPointerDown={(event) => {
          stopSpin();
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
            captured: false,
          };
        }}
        onPointerMove={(event) => {
          if (!drag.current || morphT != null) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          if (!drag.current.captured) {
            // Capturing on pointerdown would retarget the eventual click to
            // this svg (pointer-capture semantics) and silently swallow every
            // country click — only capture once a real drag has begun.
            if (Math.hypot(dx, dy) < 4) return;
            drag.current.captured = true;
            event.currentTarget.setPointerCapture(drag.current.id);
          }
          drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
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
            r={radius + 1}
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
                if (!isCovered || morphT != null) return;
                if (mode === "select") {
                  stopSpin();
                  onOpenCountry(country.code);
                } else {
                  startMorph(country.code);
                }
              }}
            />
          );
        })}
        {constellation ? (
          <g pointerEvents="none">
            {/* Star-chart lines, not scribbles: gently curved, trimmed to the
                stars' edges, in a quiet ultramarine — the founder called the
                straight ink chords "traits bizarres", rightly. */}
            {constellation.stars.map((star) => {
              const [x1, y1] = constellation.from;
              const [x2, y2] = star.at;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const distance = Math.hypot(dx, dy) || 1;
              const ux = dx / distance;
              const uy = dy / distance;
              const p1 = [x1 + ux * 9, y1 + uy * 9];
              const p2 = [x2 - ux * (star.r + 4), y2 - uy * (star.r + 4)];
              const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
              const lift = Math.min(distance * 0.08, 14);
              const control = [mid[0] - uy * lift, mid[1] + ux * lift];
              return (
                <path
                  key={`l-${star.code}`}
                  d={`M${p1[0]},${p1[1]} Q${control[0]},${control[1]} ${p2[0]},${p2[1]}`}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              );
            })}
            <circle
              cx={constellation.from[0]}
              cy={constellation.from[1]}
              r="11"
              fill="var(--color-accent)"
              opacity="0.16"
            />
            <circle
              cx={constellation.from[0]}
              cy={constellation.from[1]}
              r="5.5"
              fill="var(--color-accent)"
            />
            {constellation.stars.map((star) => (
              <g key={star.code}>
                <circle
                  cx={star.at[0]}
                  cy={star.at[1]}
                  r={star.r + 3.5}
                  fill="var(--color-accent)"
                  opacity="0.16"
                />
                <circle cx={star.at[0]} cy={star.at[1]} r={star.r} fill="var(--color-foreground)" />
                <text
                  x={star.at[0] + star.r + 6}
                  y={star.at[1] + 4}
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--color-foreground)"
                  stroke="var(--color-background)"
                  strokeWidth="3.5"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {star.code}
                </text>
              </g>
            ))}
          </g>
        ) : null}
      </svg>

      {mode === "select" && focusEntry ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[6%] top-[5%] rounded-xl bg-foreground px-3.5 py-2 text-[12.5px] leading-relaxed text-background shadow-key"
        >
          <span className="font-semibold">{focusEntry.name}</span>
          <span className="tnum"> · {formatCompactEur(focusEntry.funding_eur, i18n.language)}</span>
          <span className="block opacity-75">{t("home.globeFlowsHint")}</span>
        </div>
      ) : null}

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
