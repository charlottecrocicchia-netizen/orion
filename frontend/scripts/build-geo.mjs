/**
 * One-shot generator for the product's WORLDWIDE geometry (chantier
 * régions, 2026-08-04) — replaces build-world-geo.mjs and
 * build-europe-map.mjs, which stopped at a 38-country European scope
 * while 74 % of the corpus in euros had become American.
 *
 *   curl -sL -o /tmp/countries-110m.json https://unpkg.com/world-atlas@2.0.2/countries-110m.json
 *   curl -sL -o /tmp/us-states-albers.json https://unpkg.com/us-atlas@3.0.1/states-albers-10m.json
 *   node scripts/build-geo.mjs /tmp/countries-110m.json /tmp/us-states-albers.json
 *
 * Produces:
 *   src/lib/world-geo.json  — raw lon/lat rings for the globe (runtime
 *                             orthographic projection) + micro-territory
 *                             POINTS + the flat-morph window.
 *   src/lib/flat-maps.json  — pre-projected SVG paths per SCOPE (world +
 *                             the five manager regions), all on a 900×675
 *                             stage; the runtime does zero geometry math.
 *
 * THE FOUNDER'S RULE, enforced at build time: every ISO code must be
 * either a polygon, a point, or the written exception (Antarctica) —
 * the build FAILS on any unaccounted code. No country that ever gains
 * data can silently stay decor (the Vega hardcoded-name lesson applied
 * to geography). Kosovo ships without an id in world-atlas: matched by
 * name. Northern Cyprus and Somaliland are not ISO countries — decor.
 *
 * Source: world-atlas (ISC) / Natural Earth (public domain).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NUM2A2 = JSON.parse(readFileSync(join(HERE, "geo", "iso-numeric.json"), "utf8"));
const MICRO = JSON.parse(readFileSync(join(HERE, "geo", "micro-territories.json"), "utf8"));
// La maille sous le pays (lot D, 2026-08-17) : les États américains
// entrent comme un SCOPE de plus — la carte du monde les rend sans une
// ligne de plus (même bucket LOG, même règle du premier clic).
const FIPS = JSON.parse(readFileSync(join(HERE, "geo", "fips-usps.json"), "utf8"));
const US_MICRO = JSON.parse(readFileSync(join(HERE, "geo", "us-micro.json"), "utf8"));

// The five manager regions' flat windows [lonMin, latMin, lonMax, latMax]
// + vertical stretch. Europe keeps the EXACT parameters of the validated
// map (recette 2026-08-02) — pixel-stable through the migration. Rings
// crossing the antimeridian are unwrapped to 0..360, hence world lonMax
// beyond 180 (Chukotka, Fiji).
const SCOPES = {
  world: { window: [-169, -56, 191, 84], latScale: 1.15 },
  europe: { window: [-25, 34, 45, 71.5], latScale: 1.4 },
  "north-america": { window: [-168, 7, -50, 84], latScale: 1.15 },
  "latin-america": { window: [-118, -57, -30, 33], latScale: 1.05 },
  "asia-pacific": { window: [40, -50, 190, 56], latScale: 1.1 },
  "middle-east-africa": { window: [-20, -36, 64, 42], latScale: 1.02 },
};
const STAGE = { w: 900, h: 675 };

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-geo.mjs <countries-110m.json>");
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

function ringCoordinates(arcRefs) {
  const points = [];
  for (const ref of arcRefs) {
    const reversed = ref < 0;
    const arc = arcs[reversed ? ~ref : ref];
    const oriented = reversed ? [...arc].reverse() : arc;
    points.push(...(points.length > 0 ? oriented.slice(1) : oriented));
  }
  return points;
}

// A ring that jumps across ±180° would streak across every projection:
// unwrap it into 0..360 so it stays contiguous (world window reaches 191°).
function unwrap(points) {
  const crosses = points.some((p, i) => i > 0 && Math.abs(p[0] - points[i - 1][0]) > 180);
  return crosses ? points.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]) : points;
}

function polygons(geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs];
  if (geometry.type === "MultiPolygon") return geometry.arcs;
  return [];
}

// ------------------------------------------------------------------ decode
const countries = []; // { code, rings: [ [ [lon,lat], … ], … ] }
const decor = [];
for (const geometry of topo.objects.countries.geometries) {
  const name = geometry.properties?.name;
  let code = geometry.id != null ? NUM2A2[String(geometry.id).padStart(3, "0")] : null;
  if (!code && name === "Kosovo") code = "XK";
  const rings = polygons(geometry).flatMap((polygon) =>
    polygon.map((ring) => unwrap(ringCoordinates(ring))),
  );
  // Antarctica: the referential's written exception (no funder operates
  // there) — decor, so the globe keeps its outline without a dead
  // surface-grey continent.
  if (!code || code === "AQ") {
    decor.push(...rings.map((ring) => ring.filter((_, index) => index % 2 === 0)));
    continue;
  }
  countries.push({
    code,
    rings: rings.map((ring) => ring.map(([lon, lat]) => [+lon.toFixed(2), +lat.toFixed(2)])),
  });
}

// ------------------------------------------------------ the founder's rule
const polygonCodes = new Set(countries.map((entry) => entry.code));
const pointCodes = new Set(Object.keys(MICRO).filter((code) => !polygonCodes.has(code)));
const allCodes = new Set([...Object.values(NUM2A2), "XK"]);
const unaccounted = [...allCodes].filter(
  (code) => code !== "AQ" && !polygonCodes.has(code) && !pointCodes.has(code),
);
if (unaccounted.length > 0) {
  console.error(`ISO codes with neither polygon nor point: ${unaccounted.sort().join(" ")}`);
  process.exit(1);
}

// ------------------------------------------------------------------ globe
const worldScope = SCOPES.world;
const worldFit = fit(worldScope);
const worldGeo = {
  attribution: "world-atlas (ISC) / Natural Earth (public domain)",
  // The flat-morph target: the globe melts into the WORLD map now.
  flat: {
    lonMin: worldScope.window[0],
    latMax: worldScope.window[3],
    k: worldFit.k,
    latScale: worldScope.latScale,
    offsetX: worldFit.offsetX,
    offsetY: worldFit.offsetY,
  },
  countries,
  points: Object.entries(MICRO)
    .filter(([code]) => pointCodes.has(code))
    .map(([code, [lon, lat]]) => ({ code, lon, lat }))
    .sort((a, b) => a.code.localeCompare(b.code)),
  world: decor,
};
const worldGeoTarget = join(HERE, "..", "src", "lib", "world-geo.json");
writeFileSync(worldGeoTarget, JSON.stringify(worldGeo));

// -------------------------------------------------------------- flat maps
function fit(scope) {
  const [lonMin, latMin, lonMax, latMax] = scope.window;
  const k = Math.min(
    STAGE.w / (lonMax - lonMin),
    STAGE.h / ((latMax - latMin) * scope.latScale),
  );
  const mapW = (lonMax - lonMin) * k;
  const mapH = (latMax - latMin) * k * scope.latScale;
  return { k, offsetX: (STAGE.w - mapW) / 2, offsetY: (STAGE.h - mapH) / 2 };
}

const flatScopes = {};
for (const [slug, scope] of Object.entries(SCOPES)) {
  const [lonMin, latMin, lonMax, latMax] = scope.window;
  const { k, offsetX, offsetY } = fit(scope);
  const project = ([lon, lat]) => [
    Math.round((offsetX + (lon - lonMin) * k) * 100) / 100,
    Math.round((offsetY + (latMax - lat) * k * scope.latScale) * 100) / 100,
  ];
  const inside = ([lon, lat]) => lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax;

  const entries = [];
  for (const { code, rings } of countries) {
    const paths = [];
    let best = { area: 0, sx: 0, sy: 0 };
    for (const ring of rings) {
      if (!ring.some(inside)) continue; // island fully out of the window
      const projected = ring.map(project);
      paths.push(`M${projected.map(([x, y]) => `${x},${y}`).join("L")}Z`);
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
        best = { area, sx: sx / (6 * area), sy: sy / (6 * area) };
      }
    }
    if (paths.length === 0) continue;
    entries.push({
      code,
      path: paths.join(""),
      cx: Math.round(best.sx * 10) / 10,
      cy: Math.round(best.sy * 10) / 10,
    });
  }

  const points = Object.entries(MICRO)
    .filter(([code, lonLat]) => pointCodes.has(code) && inside(lonLat))
    .map(([code, lonLat]) => {
      const [x, y] = project(lonLat);
      return { code, cx: x, cy: y };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  flatScopes[slug] = {
    countries: entries.sort((a, b) => a.code.localeCompare(b.code)),
    points,
  };
}

// ------------------------------------------------ la maille américaine
// us-atlas livre les États DÉJÀ projetés en Albers USA (Alaska et Hawaï
// en médaillons, le standard) : il n'y a donc rien à projeter — on
// remet simplement la planche à notre échelle 900×675. Les codes sont
// ISO 3166-2 (« US-NV ») pour que la carte, l'API et l'URL parlent la
// même langue. Territoires hors planche : pastilles, comme Malte.
const usSource = process.argv[3];
if (usSource) {
  const usTopo = JSON.parse(readFileSync(usSource, "utf8"));
  const usScale = usTopo.transform.scale;
  const usTranslate = usTopo.transform.translate;
  const usArcs = usTopo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * usScale[0] + usTranslate[0], y * usScale[1] + usTranslate[1]];
    });
  });
  const usRing = (arcRefs) => {
    const points = [];
    for (const ref of arcRefs) {
      const reversed = ref < 0;
      const arc = usArcs[reversed ? ~ref : ref];
      const oriented = reversed ? [...arc].reverse() : arc;
      points.push(...(points.length > 0 ? oriented.slice(1) : oriented));
    }
    return points;
  };

  const [bx0, by0, bx1, by1] = usTopo.bbox;
  const usK = Math.min(STAGE.w / (bx1 - bx0), STAGE.h / (by1 - by0)) * 0.96;
  const usOffX = (STAGE.w - (bx1 - bx0) * usK) / 2;
  const usOffY = (STAGE.h - (by1 - by0) * usK) / 2;
  const usProject = ([x, y]) => [
    Math.round((usOffX + (x - bx0) * usK) * 100) / 100,
    Math.round((usOffY + (y - by0) * usK) * 100) / 100,
  ];

  const usEntries = [];
  for (const geometry of usTopo.objects.states.geometries) {
    const usps = FIPS[String(geometry.id).padStart(2, "0")];
    if (!usps) {
      console.error(`FIPS sans code postal : ${geometry.id}`);
      process.exit(1);
    }
    const paths = [];
    let best = { area: 0, sx: 0, sy: 0 };
    for (const polygon of polygons(geometry)) {
      for (const ring of polygon) {
        const projected = usRing(ring).map(usProject);
        paths.push(`M${projected.map(([x, y]) => `${x},${y}`).join("L")}Z`);
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
          best = { area, sx: sx / (6 * area), sy: sy / (6 * area) };
        }
      }
    }
    usEntries.push({
      code: `US-${usps}`,
      path: paths.join(""),
      cx: Math.round(best.sx * 10) / 10,
      cy: Math.round(best.sy * 10) / 10,
    });
  }

  // La règle gravée, appliquée à la maille : tout code du référentiel a
  // son polygone ou sa pastille, sinon le build échoue.
  const usPolygons = new Set(usEntries.map((entry) => entry.code));
  const usPoints = Object.entries(US_MICRO)
    .filter(([code]) => !usPolygons.has(code))
    .map(([code, [x, y]]) => ({ code, cx: x, cy: y }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const expected = Object.values(FIPS).map((usps) => `US-${usps}`);
  const missing = expected.filter(
    (code) => !usPolygons.has(code) && !usPoints.some((point) => point.code === code),
  );
  if (missing.length > 0) {
    console.error(`mailles US sans polygone ni pastille : ${missing.sort().join(" ")}`);
    process.exit(1);
  }

  flatScopes["us-states"] = {
    countries: usEntries.sort((a, b) => a.code.localeCompare(b.code)),
    points: usPoints,
  };
}

const flatMaps = {
  attribution: "world-atlas (ISC) / Natural Earth (public domain) · us-atlas (ISC) / U.S. Census Bureau (public domain)",
  width: STAGE.w,
  height: STAGE.h,
  scopes: flatScopes,
};
const flatTarget = join(HERE, "..", "src", "lib", "flat-maps.json");
writeFileSync(flatTarget, JSON.stringify(flatMaps));

const kb = (path) => Math.round(readFileSync(path, "utf8").length / 1024);
console.log(
  `world-geo: ${countries.length} polygones + ${worldGeo.points.length} pastilles + ${decor.length} anneaux décor (${kb(worldGeoTarget)} kB)`,
);
for (const [slug, scopeData] of Object.entries(flatScopes)) {
  console.log(
    `flat ${slug}: ${scopeData.countries.length} pays, ${scopeData.points.length} pastilles`,
  );
}
console.log(`flat-maps: ${kb(flatTarget)} kB`);
