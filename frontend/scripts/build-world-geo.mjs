/**
 * One-shot generator for src/lib/world-geo.json — raw lon/lat rings for the
 * globe (runtime orthographic projection, morphing into the flat map).
 *
 *   node scripts/build-world-geo.mjs /path/to/countries-110m.json
 *
 * Two layers: `countries` (the coverage scope, precise rings, alpha-2 coded,
 * clickable) and `world` (every other landmass, thinned 1-in-2, grey decor).
 * Source: world-atlas (ISC) / Natural Earth (public domain).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EUROPE = {
  40: "AT", 56: "BE", 100: "BG", 191: "HR", 196: "CY", 203: "CZ", 208: "DK",
  233: "EE", 246: "FI", 250: "FR", 276: "DE", 300: "GR", 348: "HU", 352: "IS",
  372: "IE", 380: "IT", 428: "LV", 440: "LT", 442: "LU", 470: "MT", 528: "NL",
  578: "NO", 616: "PL", 620: "PT", 642: "RO", 703: "SK", 705: "SI", 724: "ES",
  752: "SE", 756: "CH", 826: "GB", 8: "AL", 70: "BA", 499: "ME", 807: "MK",
  688: "RS", 498: "MD", 804: "UA", 792: "TR", 383: "XK",
};

// The flat map's window: rings fully outside are overseas territories that
// would fly across the screen during the morph — kept out of the clickable
// layer (they stay in the grey world decor).
const LON = [-25, 45];
const LAT = [34, 71.5];

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-world-geo.mjs <countries-110m.json>");
  process.exit(1);
}
const topo = JSON.parse(readFileSync(source, "utf8"));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

const round = (v) => Math.round(v * 10) / 10;

function ringCoordinates(refs) {
  const pts = [];
  for (const ref of refs) {
    const arc = arcs[ref < 0 ? ~ref : ref];
    const oriented = ref < 0 ? [...arc].reverse() : arc;
    pts.push(...(pts.length ? oriented.slice(1) : oriented));
  }
  return pts.map(([lon, lat]) => [round(lon), round(lat)]);
}

function polygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs];
  if (geometry.type === "MultiPolygon") return geometry.arcs;
  return [];
}

const countries = [];
const world = [];
for (const geometry of topo.objects.countries.geometries) {
  const code = EUROPE[Number(geometry.id ?? -1)];
  for (const polygon of polygons(geometry)) {
    for (const refs of polygon) {
      const ring = ringCoordinates(refs);
      const inWindow = ring.some(
        ([lon, lat]) => lon >= LON[0] && lon <= LON[1] && lat >= LAT[0] && lat <= LAT[1],
      );
      if (code && inWindow) {
        countries.push({ code, ring });
      } else if (ring.length > 8) {
        world.push(ring.filter((_, index) => index % 2 === 0));
      }
    }
  }
}

// Merge multi-ring countries under one entry.
const byCode = new Map();
for (const { code, ring } of countries) {
  if (!byCode.has(code)) byCode.set(code, { code, rings: [] });
  byCode.get(code).rings.push(ring);
}

const out = {
  attribution: "world-atlas (ISC) / Natural Earth (public domain)",
  window: { lon: LON, lat: LAT },
  countries: [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)),
  world,
};
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "world-geo.json");
writeFileSync(target, JSON.stringify(out));
console.log(
  `${out.countries.length} coded countries, ${world.length} decor rings → ${Math.round(JSON.stringify(out).length / 1024)} kB`,
);
