import { describe, expect, it } from "vitest";

import type { ExploreResponse } from "@/lib/api";
import {
  applyTrend,
  clipSeriesSegments,
  indexBaseCandidates,
  niceTicks,
  resolveIndexBase,
  robustDomain,
} from "@/lib/trend";

/** Les tests-or TREND (R2) — cas calculables à la main, verrouillés. */

const response = (
  series: { key: string; points: [number, number | null][] }[],
): ExploreResponse =>
  ({
    metric: "funding",
    by: "year",
    split: false,
    unit: "eur",
    basis: "projects",
    total: 999,
    series: series.map((s) => ({
      key: s.key,
      label: s.key,
      value: 999,
      points: s.points.map(([year, value]) => ({ year, value })),
    })),
    meta: { limit: 5, compare: null, q: null, country: null },
  }) as ExploreResponse;

const points = (result: ReturnType<typeof applyTrend>, key = "A") =>
  Object.fromEntries(
    (result.data.series.find((s) => s.key === key)?.points ?? []).map((p) => [p.year, p.value]),
  );

describe("trend · index 100", () => {
  it("test-or : 200/250/180 en base 2015 → 100/125/90", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, 250], [2017, 180]] }]),
      "index",
      2015,
    );
    expect(points(out)).toEqual({ 2015: 100, 2016: 125, 2017: 90 });
    expect(out.nonIndexable).toEqual([]);
    expect(out.data.unit).toBe("index");
  });

  it("les agrégats sommés disparaissent : value et total à null", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, 250]] }]),
      "index",
      2015,
    );
    expect(out.data.total).toBeNull();
    expect(out.data.series[0].value).toBeNull();
  });

  it("base absente de la série → non indexable, jamais rebasée en silence", () => {
    const out = applyTrend(
      response([
        { key: "A", points: [[2015, 200], [2016, 250]] },
        { key: "B", points: [[2016, 50], [2017, 60]] },
      ]),
      "index",
      2015,
    );
    expect(out.nonIndexable).toEqual(["B"]);
    expect(points(out, "B")).toEqual({ 2016: null, 2017: null });
    expect(points(out, "A")[2016]).toBe(125);
  });

  it("base à zéro → non indexable, jamais de division par zéro", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 0], [2016, 250]] }]),
      "index",
      2015,
    );
    expect(out.nonIndexable).toEqual(["A"]);
  });

  it("un trou reste un trou : l'année réelle absente reste null", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, null], [2017, 300]] }]),
      "index",
      2015,
    );
    expect(points(out)).toEqual({ 2015: 100, 2016: null, 2017: 150 });
  });

  it("test-or EUR/USD : un scalaire commun s'annule — indices identiques", () => {
    const eur = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, 250], [2017, 180]] }]),
      "index",
      2015,
    );
    const usd = applyTrend(
      response([{ key: "A", points: [[2015, 200 * 1.13], [2016, 250 * 1.13], [2017, 180 * 1.13]] }]),
      "index",
      2015,
    );
    for (const year of [2015, 2016, 2017]) {
      expect(points(usd)[year]).toBeCloseTo(points(eur)[year] as number, 10);
    }
  });
});

describe("trend · annual growth", () => {
  it("test-or : 200/250/200 → null / +25 % / −20 %", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, 250], [2017, 200]] }]),
      "growth",
      null,
    );
    expect(points(out)[2015]).toBeNull();
    expect(points(out)[2016]).toBeCloseTo(25, 10);
    expect(points(out)[2017]).toBeCloseTo(-20, 10);
    expect(out.data.unit).toBe("growth");
  });

  it("année précédente absente ou nulle → null, jamais d'interpolation", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 200], [2016, null], [2017, 300], [2019, 500]] }]),
      "growth",
      null,
    );
    // 2017 suit un trou, 2019 suit une année absente de l'axe → null.
    expect(points(out)).toEqual({ 2015: null, 2016: null, 2017: null, 2019: null });
  });

  it("zéro au dénominateur → null, jamais transformé en silence", () => {
    const out = applyTrend(
      response([{ key: "A", points: [[2015, 0], [2016, 250]] }]),
      "growth",
      null,
    );
    expect(points(out)[2016]).toBeNull();
  });

  it("plusieurs séries : chacune sur son propre axe précédent", () => {
    const out = applyTrend(
      response([
        { key: "A", points: [[2015, 100], [2016, 110]] },
        { key: "B", points: [[2015, 50], [2016, 40]] },
      ]),
      "growth",
      null,
    );
    expect(points(out, "A")[2016]).toBeCloseTo(10, 10);
    expect(points(out, "B")[2016]).toBeCloseTo(-20, 10);
  });

  it("EUR/USD : le scalaire commun s'annule aussi en croissance", () => {
    const eur = applyTrend(response([{ key: "A", points: [[2015, 200], [2016, 250]] }]), "growth", null);
    const usd = applyTrend(
      response([{ key: "A", points: [[2015, 200 * 1.13], [2016, 250 * 1.13]] }]),
      "growth",
      null,
    );
    expect(points(usd)[2016]).toBeCloseTo(points(eur)[2016] as number, 10);
  });
});

describe("trend · base canonique et fenêtre", () => {
  const data = response([
    { key: "A", points: [[2014, null], [2015, 200], [2016, 250], [2020, 300], [2021, 320]] },
  ]);

  it("les candidates sont les années VALIDES de la fenêtre visible", () => {
    expect(indexBaseCandidates(data, null, null)).toEqual([2015, 2016, 2020, 2021]);
    expect(indexBaseCandidates(data, 2020, 2025)).toEqual([2020, 2021]);
  });

  it("base dans la fenêtre et exploitable → conservée", () => {
    expect(resolveIndexBase(data, null, null, 2016)).toBe(2016);
  });

  it("changement de fenêtre : base 2015 hors de 2020-2025 → ré-ancrée sur la première année pleine valide", () => {
    expect(resolveIndexBase(data, 2020, 2025, 2015)).toBe(2020);
  });

  it("base absente ou inexploitable (année sans valeur valide) → première candidate", () => {
    expect(resolveIndexBase(data, null, null, null)).toBe(2015);
    expect(resolveIndexBase(data, null, null, 2014)).toBe(2015);
  });

  it("aucune année exploitable → null (le mode se refuse, jamais un à-peu-près)", () => {
    expect(resolveIndexBase(response([{ key: "A", points: [[2015, null]] }]), null, null, 2015)).toBeNull();
  });
});

describe("trend · domaine d'affichage robuste (clôtures de Tukey)", () => {
  it("cas-or à la main : un débordement haut est exclu, le domaine reste exact", () => {
    // sorted [-10,-5,0,5,10,5000] : Q1=-3.75, Q3=8.75, IQR=12.5,
    // clôtures [-22.5, 27.5] ∩ [min,max] → [-10, 27.5].
    expect(robustDomain([5000, -5, 10, 0, -10, 5])).toEqual({ min: -10, max: 27.5 });
  });

  it("débordement bas symétrique", () => {
    // sorted [-5000,-10,0,5,10,20] : Q1=-7.5, Q3=8.75, IQR=16.25,
    // clôtures [-31.875, 33.125] → [-31.875, 20].
    expect(robustDomain([-5000, 20, 5, 0, -10, 10])).toEqual({ min: -31.875, max: 20 });
  });

  it("zéro toujours inclus, même pour des valeurs toutes positives", () => {
    // [10,12,14,16,500] : Q1=12, Q3=16, clôtures [6,22] → [0, 22].
    expect(robustDomain([10, 12, 14, 16, 500])).toEqual({ min: 0, max: 22 });
  });

  it("les clôtures ne mordent pas → null (échelle complète, aucun contrôle)", () => {
    expect(robustDomain([1, 2, 3, 4])).toBeNull();
  });

  it("IQR nul ou trop peu d'observations → null, jamais un domaine inventé", () => {
    expect(robustDomain([5, 5, 5, 5, 100])).toBeNull();
    expect(robustDomain([1, 2, 1000])).toBeNull();
  });

  it("déterministe : le même jeu donne le même domaine, ordre indifférent", () => {
    const a = robustDomain([3, -8, 900, 12, 0, -2, 7]);
    const b = robustDomain([900, 7, -2, 0, 12, -8, 3]);
    expect(a).toEqual(b);
  });
});

describe("trend · segments coupés au domaine (rendu)", () => {
  const pts = (list: [number, number][]) => list.map(([year, value]) => ({ year, value }));

  it("tout dedans → un seul segment intact", () => {
    expect(clipSeriesSegments(pts([[2015, 10], [2016, 20], [2017, -5]]), -30, 30)).toEqual([
      [{ year: 2015, value: 10 }, { year: 2016, value: 20 }, { year: 2017, value: -5 }],
    ]);
  });

  it("sortie par le haut : le segment s'arrête À la frontière, interpolé", () => {
    // 2015=10 → 2016=90, plafond 50 : croisement à mi-chemin (année 2015.5).
    const segments = clipSeriesSegments(pts([[2015, 10], [2016, 90]]), -50, 50);
    expect(segments).toEqual([[{ year: 2015, value: 10 }, { year: 2015.5, value: 50 }]]);
  });

  it("ré-entrée : la courbe reprend au croisement, la portion hors champ n'existe pas", () => {
    // 90 → 10 : rentre à 2016.5 ; deux hors-champ consécutifs mêmes côtés → rien.
    const segments = clipSeriesSegments(pts([[2015, 90], [2016, 90], [2017, 10]]), -50, 50);
    expect(segments).toEqual([[{ year: 2016.5, value: 50 }, { year: 2017, value: 10 }]]);
  });

  it("deux hors-champ du même côté → AUCUN trait (le trait vertical d'avant)", () => {
    expect(clipSeriesSegments(pts([[2015, 90], [2016, 120]]), -50, 50)).toEqual([]);
  });

  it("traversée plafond → plancher : seule la portion visible se dessine", () => {
    // 150 → -150, domaine [-50, 50] : croise 50 à 1/3, -50 à 2/3.
    const [segment] = clipSeriesSegments(pts([[2015, 150], [2018, -150]]), -50, 50);
    expect(segment[0].value).toBe(50);
    expect(segment[0].year).toBeCloseTo(2016, 10);
    expect(segment[1].value).toBe(-50);
    expect(segment[1].year).toBeCloseTo(2017, 10);
  });
});

describe("trend · graduations humaines (rendu)", () => {
  it("cas recette : domaine −28,6 → +58,1 → multiples de 20, zéro présent", () => {
    expect(niceTicks(-28.6, 58.1)).toEqual([-20, 0, 20, 40]);
  });

  it("cas recette : domaine −43,1 → +41,2 → zéro présent, pas rond", () => {
    expect(niceTicks(-43.1, 41.2)).toEqual([-40, -20, 0, 20, 40]);
  });

  it("le zéro est toujours une graduation d'un domaine qui l'encadre", () => {
    for (const [lo, hi] of [[-7.3, 12.9], [-120, 480], [0, 22]] as [number, number][]) {
      expect(niceTicks(lo, hi)).toContain(0);
    }
  });
});
