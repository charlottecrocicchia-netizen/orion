/**
 * One-shot generator for src/lib/europe-map.json — the pre-projected SVG
 * paths behind the Europe choropleth. Run it only when the geography needs
 * to change:
 *
 *   curl -sL -o /tmp/countries-110m.json https://unpkg.com/world-atlas@2.0.2/countries-110m.json
 *   node scripts/build-europe-map.mjs /tmp/countries-110m.json
 *
 * Source geometry: world-atlas (ISC) derived from Natural Earth (public
 * domain). The TopoJSON is decoded by hand (delta-encoded arcs + transform),
 * countries are filtered to the European scope, projected once with an
 * equirectangular projection centred on Europe, and written as ready-to-use
 * SVG path strings plus a centroid per country — the runtime component does
 * zero geometry math.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ISO 3166-1 numeric → alpha-2, the European scope of the map. Russia and
// Belarus are deliberately out (marginal in the data, they flatten the map).
const EUROPE = {
  40: "AT", 56: "BE", 100: "BG", 191: "HR", 196: "CY", 203: "CZ", 208: "DK",
  233: "EE", 246: "FI", 250: "FR", 276: "DE", 300: "GR", 348: "HU", 352: "IS",
  372: "IE", 380: "IT", 428: "LV", 440: "LT", 442: "LU", 470: "MT", 528: "NL",
  578: "NO", 616: "PL", 620: "PT", 642: "RO", 703: "SK", 705: "SI", 724: "ES",
  752: "SE", 756: "CH", 826: "GB", 8: "AL", 70: "BA", 499: "ME", 807: "MK",
  688: "RS", 498: "MD", 804: "UA", 792: "TR", 383: "XK",
};

// Drawing box and geographic window (equirectangular, centred on Europe).
const LON = [-25, 45];
const LAT = [34, 71.5];
const WIDTH = 900;
const K = WIDTH / (LON[1] - LON[0]);
const LAT_SCALE = 1.4; // ≈ cos(45°)⁻¹, the vertical stretch that keeps shapes honest

function project([lon, lat]) {
  const x = (lon - LON[0]) * K;
  const y = (LAT[1] - lat) * K * LAT_SCALE;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-europe-map.mjs <countries-110m.json>");
  process.exit(1);
}
const topo = JSON.parse(readFileSync(source, "utf8"));
const { scale, translate } = topo.transform;

// Decode the delta-encoded arcs to absolute [lon, lat] pairs.
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

function ringCoordinates(arcRefs) {
  const points = [];
  for (const ref of arcRefs) {
    const reversed = ref < 0;
    const arc = arcs[reversed ? ~ref : ref];
    const oriented = reversed ? [...arc].reverse() : arc;
    // Consecutive arcs share their junction point; skip it after the first.
    points.push(...(points.length > 0 ? oriented.slice(1) : oriented));
  }
  return points;
}

function polygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs];
  if (geometry.type === "MultiPolygon") return geometry.arcs;
  return [];
}

const countries = [];
for (const geometry of topo.objects.countries.geometries) {
  const code = EUROPE[Number(geometry.id)];
  if (!code) continue;

  const paths = [];
  let best = { area: 0, sx: 0, sy: 0, n: 0 };
  for (const polygon of polygons(geometry)) {
    for (const [index, ring] of polygon.entries()) {
      const coords = ringCoordinates(ring);
      // Keep islands inside the window; drop far-flung territories (Guyane…).
      const inside = coords.some(
        ([lon, lat]) => lon >= LON[0] && lon <= LON[1] && lat >= LAT[0] && lat <= LAT[1],
      );
      if (!inside) continue;
      const projected = coords.map(project);
      paths.push(`M${projected.map(([x, y]) => `${x},${y}`).join("L")}Z`);
      if (index === 0) {
        // Shoelace area (projected) to anchor the centroid on the mainland.
        let area = 0;
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < projected.length; i++) {
          const [x1, y1] = projected[i];
          const [x2, y2] = projected[(i + 1) % projected.length];
          const cross = x1 * y2 - x2 * y1;
          area += cross;
          sx += (x1 + x2) * cross;
          sy += (y1 + y2) * cross;
        }
        area /= 2;
        if (Math.abs(area) > Math.abs(best.area)) {
          best = { area, sx: sx / (6 * area), sy: sy / (6 * area), n: projected.length };
        }
      }
    }
  }
  if (paths.length === 0) continue;
  countries.push({
    code,
    path: paths.join(""),
    cx: Math.round(best.sx * 10) / 10,
    cy: Math.round(best.sy * 10) / 10,
  });
}

const height = Math.round((LAT[1] - LAT[0]) * K * LAT_SCALE);
const out = {
  width: WIDTH,
  height,
  attribution: "world-atlas (ISC) / Natural Earth (public domain)",
  countries: countries.sort((a, b) => a.code.localeCompare(b.code)),
};
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "europe-map.json");
writeFileSync(target, JSON.stringify(out));
console.log(`${countries.length} countries → ${target} (${Math.round(JSON.stringify(out).length / 1024)} kB)`);
