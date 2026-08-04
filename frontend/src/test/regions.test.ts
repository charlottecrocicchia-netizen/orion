import { describe, expect, it } from "vitest";

import flatMaps from "@/lib/flat-maps.json";
import worldGeo from "@/lib/world-geo.json";
import {
  AMOUNT_STEPS,
  AMOUNT_THRESHOLDS,
  amountStep,
  bucketLabels,
  REGION_ORDER,
  regionColor,
} from "@/lib/regions";

/** La règle du chantier régions : la géométrie couvre le MONDE — plus
 *  jamais une liste de pays en dur (l'ancienne couche cliquable
 *  s'arrêtait à 38 pays européens pendant que 74 % du corpus en euros
 *  était américain). */

const FLAT = flatMaps as {
  scopes: Record<string, { countries: { code: string }[]; points: { code: string }[] }>;
};
const GEO = worldGeo as {
  countries: { code: string }[];
  points: { code: string }[];
  flat: { k: number; latScale: number };
};

describe("la géométrie mondiale", () => {
  it("le globe porte le monde entier, pas une liste en dur", () => {
    const codes = new Set(GEO.countries.map((entry) => entry.code));
    // 174 polygones — l'ancienne couche en comptait 38.
    expect(codes.size).toBeGreaterThan(150);
    for (const code of ["US", "IL", "TR", "CN", "JP", "BR", "ZA", "AU", "RU", "IN"]) {
      expect(codes.has(code), `${code} doit avoir un polygone`).toBe(true);
    }
  });

  it("les micro-territoires sans polygone ont leur pastille (Malte, Singapour…)", () => {
    const points = new Set(GEO.points.map((entry) => entry.code));
    for (const code of ["MT", "SG", "HK", "MC", "BM", "LI"]) {
      expect(points.has(code), `${code} doit avoir une pastille`).toBe(true);
    }
    // Aucun code des deux couches à la fois.
    const polygons = new Set(GEO.countries.map((entry) => entry.code));
    for (const code of points) expect(polygons.has(code)).toBe(false);
  });

  it("chaque scope plat existe avec le monde en défaut", () => {
    expect(Object.keys(FLAT.scopes).sort()).toEqual(
      ["world", ...REGION_ORDER].sort(),
    );
    expect(FLAT.scopes.world.countries.length).toBeGreaterThan(150);
    // L'Europe garde MT en pastille — elle était invisible avant.
    expect(FLAT.scopes.europe.points.some((p) => p.code === "MT")).toBe(true);
    // La fenêtre de morph du globe vise le monde.
    expect(GEO.flat.k).toBeGreaterThan(0);
  });
});

describe("la grammaire des montants (paliers log nommés en euros)", () => {
  it("cinq paliers, seuils décimaux", () => {
    expect(AMOUNT_STEPS).toHaveLength(5);
    expect(AMOUNT_THRESHOLDS).toEqual([1e7, 1e8, 1e9, 1e10]);
  });

  it("le Brésil ne sort plus aussi foncé que l'Allemagne", () => {
    expect(amountStep(4e8)).toBe(0.46); // Brésil ~0,4 Md€
    expect(amountStep(2.7e10)).toBe(0.88); // Allemagne ~27 Md€
    expect(amountStep(5e6)).toBe(0.12);
    expect(amountStep(5e7)).toBe(0.28);
    expect(amountStep(5e9)).toBe(0.66);
  });

  it("les libellés de légende suivent la locale", () => {
    expect(bucketLabels("fr")[2]).toBe("0,1-1 Md€");
    expect(bucketLabels("en")[4]).toBe(">10 B€");
  });
});

describe("les teintes de régions", () => {
  it("chaque région a sa variable CSS, l'inconnu retombe sur la surface", () => {
    for (const region of REGION_ORDER) {
      expect(regionColor(region)).toBe(`var(--region-${region})`);
    }
    expect(regionColor(null)).toBe("var(--color-surface)");
    expect(regionColor("atlantide")).toBe("var(--color-surface)");
  });
});
