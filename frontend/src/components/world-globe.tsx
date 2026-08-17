import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CountryFlow, CountryIndexEntry } from "@/lib/api";
import { formatCompactEur } from "@/lib/format";
import { amountStep, REGION_ORDER, regionColor } from "@/lib/regions";

/** The world globe — runtime orthographic projection over the shared Natural
 *  Earth geometries, drag to rotate. Two lives: on the countries page a click
 *  morphs the projection into the flat analysis map (same 900×675 viewBox,
 *  seamless hand-over to WorldMap); on the home's act 3 (`mode="select"`)
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
  /** Micro-territories without a 110m polygon (Malta, Singapore…) —
   *  clickable dots, so no data country can hide behind cartography. */
  points: { code: string; lon: number; lat: number }[];
  world: [number, number][][];
  /** The flat-morph target — the WORLD map's projection, generated with
   *  the geometry (chantier régions: the globe melts into the world). */
  flat: {
    lonMin: number;
    latMax: number;
    k: number;
    latScale: number;
    offsetX: number;
    offsetY: number;
  };
}

const W = 900;
const H = 675;
const R = 292;
const CX = W / 2;
const CY = H / 2 + 6;
const RAD = Math.PI / 180;

// The flat map's projection parameters ride with the geometry
// (world-geo.json `flat`) — one source for the morph target and the
// flat maps, never two constants to drift apart.

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
  speed = 4.2,
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
  /** >1 crops the sphere and frames the covered region — the grey
   *  waiting-world stops dominating; rotation still reveals it. */
  zoom?: number;
  /** Rotation pace, degrees per second — "vive" pinned (recette 2026-08-02). */
  speed?: number;
}) {
  const { t, i18n } = useTranslation();
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [view, setView] = useState({ lonC: 12, latC: zoom > 1 ? 48 : 42 });
  const radius = R * zoom;
  const [hover, setHover] = useState<string | null>(null);
  const [morphT, setMorphT] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; id: number; captured: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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

  // The rotation, PERMANENT by decision (recette 2026-08-02, pace "vive"
  // pinned): the loop never dies and the globe turns whenever visible —
  // it only pauses while a COUNTRY is hovered, a shape holds focus, or a
  // drag is in flight (aiming at a small country stays comfortable), and
  // resumes the moment that ends. The pause deliberately ignores the
  // svg's own pointerenter: hover states go STALE during scroll (the
  // globe slides under a motionless cursor, pointerleave never fires) —
  // that was the "it stops when I scroll back up" bug; a passive scroll
  // listener also clears any phantom hover-pause. Framed (zoom > 1) the
  // old ±16° pendulum remains. None under reduced motion (the CSS
  // kill-switch cannot reach a rAF loop).
  const paused = useRef(false);
  const offscreen = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lon0 = zoom > 1 ? 12 : null;
    let phase = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!paused.current && !offscreen.current) {
        if (lon0 != null) {
          phase += 0.15 * dt * speed;
          setView((current) => ({ ...current, lonC: lon0 + 16 * Math.sin(phase) }));
        } else {
          setView((current) => ({ ...current, lonC: current.lonC + speed * dt }));
        }
      }
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
    const onScroll = () => {
      // Scrolling is never aiming: clear a phantom hover-pause (drags and
      // keyboard focus re-assert theirs through their own handlers).
      if (!drag.current) paused.current = false;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (spin.current != null) cancelAnimationFrame(spin.current);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, speed]);

  // Perf only: no need to advance frames nobody can see. Visibility does
  // not alter the interaction contract.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        offscreen.current = entries[0] ? !entries[0].isIntersecting : false;
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Pause (not kill) the rotation — country hover, focus and drags call
   *  this; releasing resumes through the always-running loop. */
  const stopSpin = () => {
    paused.current = true;
  };
  const resumeSpin = () => {
    paused.current = false;
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
  const flatSpec = geo?.flat;
  const flat = ([lon, lat]: [number, number]): [number, number] => {
    if (!flatSpec) return [CX, CY];
    return [
      flatSpec.offsetX + (lon - flatSpec.lonMin) * flatSpec.k,
      flatSpec.offsetY + (flatSpec.latMax - lat) * flatSpec.k * flatSpec.latScale,
    ];
  };
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
      return [{ code, at, width: 1.2 + 2.4 * Math.sqrt(flow.amount_eur / maxAmount) }];
    });
    return { from, stars };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, flows, centroids, view.lonC, view.latC]);

  const focusEntry = focus ? byCode.get(focus) : null;

  // Le globe devient « conscient de la couverture » exactement comme la
  // carte plate : dès que ses entrées en portent une (recette du
  // 2026-08-17 — la texture avait été livrée sur la carte SEULE, alors
  // que le globe est la vue par défaut ; l'écran le plus vu était donc
  // le seul à taire l'assiette).
  const coverageAware = countries.some((entry) => entry.coverage != null);

  // Les tracés sont calculés UNE fois et servis aux deux couches. Sur un
  // globe qui tourne, reprojeter chaque pays deux fois par image se
  // paierait comptant sur cette machine.
  const drawn = (geo?.countries ?? []).flatMap((country) => {
    const d = country.rings
      .map((ring) => {
        const path = ringToPath(ring, project);
        return path ? `${path}Z` : "";
      })
      .join("");
    return d ? [{ country, d }] : [];
  });
  const uncovered = coverageAware
    ? drawn.filter(({ country }) => (byCode.get(country.code)?.coverage ?? "none") !== "funders")
    : [];

  return (
    <div ref={rootRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={t("explore.globeLabel")}
        onPointerLeave={resumeSpin}
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
          resumeSpin();
        }}
      >
        <defs>
          {/* « Pas encore couvert » — la texture du lot E, reprise au
              trait près de world-map.tsx. Un id distinct parce que les
              deux SVG coexistent le temps du morphing ; la géométrie,
              elle, ne bouge pas d'un pixel. */}
          <pattern
            id="orion-not-covered-globe"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="var(--color-foreground)"
              strokeOpacity="0.22"
              strokeWidth="1.4"
            />
          </pattern>
        </defs>
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
        {drawn.map(({ country, d }) => {
          const isCovered = covered.has(country.code);
          const isSelected = mode === "select" && selected === country.code;
          const entry = byCode.get(country.code);
          const interactive = isCovered && morphT == null;
          // Map rule (fondatrice, 2026-08-02): the first activation
          // explores — the PARENT decides whether a repeat on the selected
          // country leaves for its file. Keyboard rides the same path.
          const activate = () => {
            if (!interactive) return;
            if (mode === "select") {
              onOpenCountry(country.code);
            } else {
              startMorph(country.code);
            }
          };
          return (
            <path
              key={country.code}
              d={d}
              data-code={country.code}
              // The held-open country LIGHTS UP: its REGION's hue at full
              // strength with a background-colored rim that detaches it
              // from its neighbours (ink was tried and rejected — "c'est
              // moche"). Same grammar as the flat maps: region tint,
              // intensity = amount through the named log buckets.
              fill={entry ? regionColor(entry.region) : "var(--color-surface)"}
              fillOpacity={
                isSelected
                  ? 0.92
                  : entry
                    ? hover === country.code
                      ? Math.min(amountStep(entry.funding_eur) + 0.24, 0.95)
                      : amountStep(entry.funding_eur)
                    : 0.9
              }
              stroke={
                isSelected
                  ? "var(--color-background)"
                  : entry
                    ? regionColor(entry.region)
                    : "var(--color-border)"
              }
              strokeOpacity={isSelected ? 1 : isCovered ? 0.6 : 1}
              strokeWidth={isSelected ? 1.8 : 0.8}
              role={interactive ? "button" : undefined}
              aria-pressed={interactive && mode === "select" ? isSelected : undefined}
              aria-label={
                entry
                  ? `${entry.name} — ${formatCompactEur(entry.funding_eur, i18n.language)}`
                  : undefined
              }
              tabIndex={interactive ? 0 : -1}
              className={
                interactive
                  ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  : undefined
              }
              onMouseEnter={() => {
                stopSpin();
                setHover(country.code);
              }}
              onMouseLeave={() => {
                resumeSpin();
                setHover(null);
              }}
              onFocus={() => {
                if (!interactive) return;
                stopSpin();
                setHover(country.code);
              }}
              onBlur={() => {
                resumeSpin();
                setHover(null);
              }}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
            />
          );
        })}
        {/* La couche d'honnêteté, par-dessus les teintes — MÊME texture
            que la carte plate, à dessein : un signal qui change de forme
            d'un écran à l'autre se réapprend à chaque fois. Tout pays
            dont les financements domestiques ne sont pas couverts la
            porte, qu'il ait des chiffres (participations) ou aucun.
            Sans interaction : elle n'attrape jamais le clic du pays, et
            elle disparaît pendant le morphing vers la carte, qui pose
            la sienne à l'arrivée. */}
        {morphT == null
          ? uncovered.map(({ country, d }) => (
              <path
                key={`nc-${country.code}`}
                d={d}
                fill="url(#orion-not-covered-globe)"
                pointerEvents="none"
                data-not-covered={country.code}
              />
            ))
          : null}
        {geo?.points.map((point) => {
          const entry = byCode.get(point.code);
          if (!entry) return null; // no data: a micro-territory stays silent
          const at = project([point.lon, point.lat]);
          if (!at) return null;
          const isSelected = mode === "select" && selected === point.code;
          const interactive = morphT == null;
          const activate = () => {
            if (!interactive) return;
            if (mode === "select") onOpenCountry(point.code);
            else startMorph(point.code);
          };
          return (
            <circle
              key={point.code}
              cx={at[0]}
              cy={at[1]}
              r={isSelected || hover === point.code ? 5 : 3.4}
              data-code={point.code}
              fill={regionColor(entry.region)}
              fillOpacity={Math.max(amountStep(entry.funding_eur), 0.46)}
              stroke="var(--color-background)"
              strokeWidth={isSelected ? 1.6 : 0.9}
              role={interactive ? "button" : undefined}
              aria-pressed={interactive && mode === "select" ? isSelected : undefined}
              aria-label={`${entry.name} — ${formatCompactEur(entry.funding_eur, i18n.language)}`}
              tabIndex={interactive ? 0 : -1}
              className={
                interactive
                  ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  : undefined
              }
              onMouseEnter={() => {
                stopSpin();
                setHover(point.code);
              }}
              onMouseLeave={() => {
                resumeSpin();
                setHover(null);
              }}
              onFocus={() => {
                stopSpin();
                setHover(point.code);
              }}
              onBlur={() => {
                resumeSpin();
                setHover(null);
              }}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
            />
          );
        })}
        {constellation ? (
          <g pointerEvents="none">
            {/* Flow curves, founder's pick over dotted stars: generous arcs
                from the focused country to each partner, width carrying the
                amount, no terminal dots — the blue heart stays. */}
            {constellation.stars.map((star) => {
              const [x1, y1] = constellation.from;
              const [x2, y2] = star.at;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const distance = Math.hypot(dx, dy) || 1;
              const ux = dx / distance;
              const uy = dy / distance;
              const p1 = [x1 + ux * 8, y1 + uy * 8];
              const mid = [(p1[0] + x2) / 2, (p1[1] + y2) / 2];
              const lift = Math.min(distance * 0.18, 34);
              const control = [mid[0] - uy * lift, mid[1] + ux * lift];
              return (
                <path
                  key={`l-${star.code}`}
                  d={`M${p1[0]},${p1[1]} Q${control[0]},${control[1]} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeOpacity="0.55"
                  strokeWidth={star.width}
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
              <text
                key={`t-${star.code}`}
                x={star.at[0] + 7}
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
          {/* La classe au point de contact : c'est ICI que « l'Asie ne
              finance rien » meurt — le pays survolé dit POURQUOI son
              chiffre est petit, au lieu de laisser conclure. */}
          {focusEntry.coverage === "participations" || focusEntry.coverage === "none" ? (
            <span className="block opacity-75">
              {focusEntry.coverage === "participations"
                ? t("coverage.tipParticipations")
                : t("coverage.tipNone")}
            </span>
          ) : null}
          <span className="block opacity-75">{t("home.globeFlowsHint")}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
        {REGION_ORDER.map((region) => (
          <span key={region} className="flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: regionColor(region), opacity: 0.85 }}
            />
            {t(`regions.${region}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-surface ring-1 ring-border" />
          {t("explore.coverageSoon")}
        </span>
        {/* La texture a SA légende ici aussi — même pastille, mêmes mots
            que sur la carte plate. */}
        {uncovered.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
              <rect
                width="14"
                height="10"
                rx="1.5"
                fill="var(--color-surface)"
                stroke="var(--color-border)"
                strokeWidth="0.75"
              />
              <path
                d="M-2,4 L4,-2 M0,10 L10,0 M4,12 L14,2 M10,12 L16,6"
                stroke="var(--color-foreground)"
                strokeOpacity="0.32"
                strokeWidth="1.2"
              />
            </svg>
            {t("coverage.legend")}
          </span>
        ) : null}
        <span>{t("explore.globeHint")}</span>
        <span className="ml-auto">
          <b className="font-semibold text-foreground">{t("explore.coverageNote")}</b>{" "}
          {t("explore.coverageDetail")}
        </span>
      </div>
    </div>
  );
}
