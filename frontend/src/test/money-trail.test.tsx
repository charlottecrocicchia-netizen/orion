/** B2.8 — les colonnes proportionnelles contre des réponses B1
 *  fidèles aux golds : le fil d'Ariane textuel dit le chemin (ancêtres
 *  cliquables nom · montant, focus en fort, jamais un ratio), les
 *  colonnes verticales disent la répartition — hauteur = montant,
 *  échelle linéaire commune, tri décroissant, godet « + N autres »
 *  cliquable vers la liste complète, segment « non ventilé » hachuré
 *  jamais caché, hauteur plancher marquée quand le ratio d'échelle
 *  écrase une part. Deep-link ≡ descente (UNE requête), réponses
 *  obsolètes ignorées, Back/Forward recomposés, inconnu ≠ 0 (jamais
 *  une barre), transversal sans ratio, NIH bénéficiaire sans barres,
 *  NSF sans faux niveau, transverse multi-provenance, EN/FR. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import i18n from "i18next";

import { MoneyTrailPage } from "@/pages/money-trail";

const EUR_MEASURE = {
  key: "ec_max_contribution",
  accounting_nature: "commitment_ceiling",
  provenance: "source_fact",
  currency: "EUR",
};

const AGG = (amount: number | null, projects: number, unknown = 0) => ({
  measure: { ...EUR_MEASURE, key: "ec_max_contribution_sum", provenance: "derived" },
  amount,
  projects,
  coverage: { with_amount: projects - unknown, unknown_amount: unknown },
  amount_eur_observed: { amount, excluded_no_rate: 0, provenance: "derived", currency: "EUR" },
});

const USD_AGG = (key: string, amount: number | null, projects: number) => ({
  measure: { key, accounting_nature: "obligations", provenance: "derived", currency: "USD" },
  amount,
  projects,
  coverage: { with_amount: projects, unknown_amount: 0 },
  amount_eur_observed: { amount: null, provenance: "derived", currency: "EUR" },
});

const NAV_EC = {
  down: [
    { level: "programme", status: "allowed", reason: null },
    { level: "call", status: "restricted", reason: "x" },
    { level: "project", status: "allowed", reason: null },
  ],
  up: [],
};
const NAV_NIH = {
  down: [
    { level: "programme", status: "allowed", reason: null },
    { level: "call", status: "not_available", reason: "x" },
    { level: "project", status: "allowed", reason: null },
  ],
  up: [],
};

const EC_CRUMB = {
  level: "funder",
  id: "ec",
  label: "European Commission",
  amount: 176e9,
  currency: "EUR",
  share_of_parent: null,
  comparability: null,
};

const FIXTURES: Record<string, unknown> = {
  "/api/chain/funders": {
    funders: [
      { level: "funder", id: "ec", label: "European Commission", aggregate: AGG(176e9, 84452) },
      { level: "funder", id: "nih", label: "NIH (RePORTER)", aggregate: AGG(642e9, 380275) },
    ],
    cross_funder_total: { available: false, reason: "x" },
  },
  "/api/chain/funder/ec": {
    node: { level: "funder", id: "ec", label: "European Commission", currency: "EUR" },
    aggregate: AGG(176e9, 84452, 1),
    children: {
      level: "programme",
      total: 14,
      items: Array.from({ length: 14 }, (_, i) => ({
        level: "programme",
        id: 100 + i,
        code: `PROG-${i}`,
        label: `Programme ${i}`,
        projects: 10 + i,
        amount: (14 - i) * 1e9,
      })),
    },
    ancestors: [],
    navigation: NAV_EC,
    restrictions: [],
  },
  // 18 instituts ENTIÈREMENT servis : le seuil du filtre local est
  // franchi et le filtre ne peut pas mentir (rien au-delà de la page).
  "/api/chain/funder/nih": {
    node: { level: "funder", id: "nih", label: "NIH (RePORTER)", currency: "USD" },
    aggregate: USD_AGG("nih_obligations_window_sum_sum", 642e9, 380275),
    children: {
      level: "programme",
      total: 18,
      items: [
        { level: "programme", id: 30, code: "AI", label: "NIAID", projects: 40000, amount: 80e9 },
        ...Array.from({ length: 17 }, (_, i) => ({
          level: "programme",
          id: 31 + i,
          code: `IN-${i}`,
          label: `Institute ${i}`,
          projects: 1000 + i,
          amount: (20 - i) * 1e9,
        })),
      ],
    },
    ancestors: [],
    navigation: NAV_NIH,
    restrictions: [],
  },
  "/api/chain/programme/10": {
    node: {
      level: "programme",
      id: 10,
      code: "HORIZON",
      label: "Horizon Europe",
      funder: "ec",
      parent: EC_CRUMB,
    },
    aggregate: AGG(62e9, 15000),
    children: {
      level: "programme",
      total: 2,
      items: [
        {
          level: "programme",
          id: 11,
          code: "H2020-EU.3.3.",
          label: "Énergie",
          projects: 800,
          amount: 10e9,
        },
        {
          level: "programme",
          id: 12,
          code: "HORIZON.1.2",
          label: "Actions Marie Curie",
          projects: 400,
          amount: 5e9,
        },
      ],
    },
    ancestors: [EC_CRUMB],
    share_of_parent: {
      ratio: 0.352,
      comparability: "ok",
      parent: { level: "funder", label: "European Commission" },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/programme/100": {
    node: {
      level: "programme",
      id: 100,
      code: "PROG-0",
      label: "Programme 0",
      funder: "ec",
      parent: EC_CRUMB,
    },
    aggregate: AGG(14e9, 10),
    children: { level: "project", total: 0, items: [] },
    ancestors: [EC_CRUMB],
    share_of_parent: {
      ratio: 14 / 176,
      comparability: "ok",
      parent: { level: "funder", label: "European Commission" },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/programme/101": {
    node: {
      level: "programme",
      id: 101,
      code: "PROG-1",
      label: "Programme 1",
      funder: "ec",
      parent: EC_CRUMB,
    },
    aggregate: AGG(13e9, 11),
    children: { level: "project", total: 0, items: [] },
    ancestors: [EC_CRUMB],
    share_of_parent: {
      ratio: 13 / 176,
      comparability: "ok",
      parent: { level: "funder", label: "European Commission" },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/programme/11": {
    node: {
      level: "programme",
      id: 11,
      code: "H2020-EU.3.3.",
      label: "Énergie",
      funder: "ec",
      parent: EC_CRUMB,
    },
    aggregate: AGG(10e9, 800),
    children: {
      level: "call",
      total: 2,
      items: [
        { level: "call", id: 20, code: "CALL-X", label: "CALL-X", projects: 3, amount: 30e6 },
        { level: "call", id: 21, code: "CALL-Y", label: "CALL-Y", projects: 5, amount: 60e6 },
      ],
    },
    ancestors: [
      EC_CRUMB,
      {
        level: "programme",
        id: 10,
        code: "HORIZON",
        label: "Horizon Europe",
        amount: 62e9,
        currency: "EUR",
        share_of_parent: 0.352,
        comparability: "ok",
      },
    ],
    share_of_parent: {
      ratio: 0.161,
      comparability: "ok",
      parent: { level: "programme", label: "Horizon Europe" },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  // Appel transversal non cadré : liaison structurelle sans ratio.
  "/api/chain/call/20": {
    node: { level: "call", id: 20, code: "CALL-X", label: "CALL-X", funder: "ec" },
    context: null,
    programmes: [
      { level: "programme", id: 11, code: "H2020-EU.3.3.", projects: 3 },
      { level: "programme", id: 12, code: "HORIZON.1.2", projects: 2 },
    ],
    aggregate: AGG(50e6, 5),
    children: {
      level: "project",
      total: 3,
      items: [
        { level: "project", id: 1, label: "BIO-QED", amount: 5335158.39 },
        { level: "project", id: 5, label: "OTHER", amount: 2e6 },
        // Ratio d'échelle extrême : une part réelle mais minuscule —
        // la colonne doit tenir au plancher, marquée, jamais fausse en
        // silence.
        { level: "project", id: 6, label: "MICRO", amount: 3000 },
      ],
      coverage: { with_amount: 3, unknown_amount: 0 },
    },
    ancestors: [EC_CRUMB],
    share_of_parent: null,
    navigation: NAV_EC,
    restrictions: [],
  },
  // Appel paginé concentré : 3 projets servis sur 400 — le godet
  // vaudrait 3× la scène ; B2.9 ③ le plafonne (marqué), l'échelle
  // reste ancrée sur les enfants comparables.
  "/api/chain/call/30": {
    node: { level: "call", id: 30, code: "CALL-BIG", label: "CALL-BIG", funder: "ec" },
    context: null,
    programmes: [{ level: "programme", id: 11, code: "H2020-EU.3.3.", projects: 400 }],
    aggregate: AGG(700e6, 400),
    children: {
      level: "project",
      total: 400,
      items: [
        { level: "project", id: 7, label: "ALPHA", amount: 2.7e6 },
        { level: "project", id: 8, label: "BETA", amount: 2.5e6 },
        { level: "project", id: 9, label: "GAMMA", amount: 2.4e6 },
      ],
      coverage: { with_amount: 400, unknown_amount: 0 },
    },
    ancestors: [EC_CRUMB],
    share_of_parent: null,
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/project/4": {
    ancestors: [
      EC_CRUMB,
      { level: "programme", id: 11, code: "H2020-EU.3.3.", label: "Énergie" },
    ],
    node: {
      level: "project",
      id: 4,
      source: "cordis-horizon",
      source_id: "101052200",
      label: "EUROfusion",
      title: "EUROfusion",
      funder: "ec",
      start_date: null,
      end_date: null,
      parent: { level: "programme", id: 11, code: "H2020-EU.3.3." },
      programme: {
        level: "programme",
        id: 11,
        code: "H2020-EU.3.3.",
        attribution: { provenance: "source_fact", basis: "x" },
      },
    },
    measure: { ...EUR_MEASURE, amount: 549442000 },
    amount_eur_observed: { amount: 549442000, provenance: "derived", currency: "EUR" },
    total_cost: null,
    children: {
      level: "participation",
      total: 2,
      measure: { key: "ec_contribution", provenance: "source_fact", currency: "EUR" },
      items: [
        {
          level: "participation",
          organisation: { level: "organisation", id: 400, label: "EFA" },
          role: "participant",
          country: "DE",
          source_uid: "101052200:0:0",
          semantics: "funding_share",
          amount: 600000000,
        },
        {
          level: "participation",
          organisation: { level: "organisation", id: 401, label: "EFB" },
          role: "participant",
          country: "FR",
          source_uid: "101052200:1:0",
          semantics: "funding_share",
          amount: 64587862.11,
        },
      ],
    },
    reconciliation: {
      status: "children_exceed_parent",
      reason: null,
      parent_amount: 549442000,
      children_known_sum: 664587862.11,
      unallocated: -115145862.11,
      unknown_children: 0,
      coverage: { with_amount: 2, total: 2 },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/project/1": {
    ancestors: [
      EC_CRUMB,
      {
        level: "programme",
        id: 10,
        code: "HORIZON",
        label: "Horizon Europe",
        amount: 62e9,
        currency: "EUR",
        share_of_parent: 0.352,
        comparability: "ok",
      },
      {
        level: "programme",
        id: 11,
        code: "H2020-EU.3.3.",
        label: "Énergie",
        amount: 10e9,
        currency: "EUR",
        share_of_parent: 0.161,
        comparability: "ok",
      },
      {
        level: "call",
        id: 20,
        code: "CALL-X",
        label: "CALL-X",
        amount: 50e6,
        currency: "EUR",
        share_of_parent: null,
        comparability: "transversal_call",
      },
    ],
    share_of_parent: {
      ratio: 5335158.39 / 50e6,
      comparability: "ok",
      parent: { level: "call", label: "CALL-X" },
    },
    node: {
      level: "project",
      id: 1,
      source: "cordis-fp7",
      source_id: "613941",
      label: "BIO-QED",
      title: "Quod Erat Demonstrandum",
      funder: "ec",
      start_date: "2014-01-01",
      end_date: "2017-12-31",
      parent: { level: "call", id: 20, code: "CALL-X" },
      programme: {
        level: "programme",
        id: 11,
        code: "H2020-EU.3.3.",
        attribution: { provenance: "derived", basis: "x" },
      },
    },
    measure: { ...EUR_MEASURE, amount: 5335158.39 },
    amount_eur_observed: { amount: 5335158.39, provenance: "derived", currency: "EUR" },
    total_cost: { amount: null, status: "not_available", provenance_note: "source_published_zero" },
    children: {
      level: "participation",
      total: 2,
      measure: { key: "ec_contribution", provenance: "source_fact", currency: "EUR" },
      items: [
        {
          level: "participation",
          organisation: { level: "organisation", id: 100, label: "COORD SRL" },
          role: "coordinator",
          country: "IT",
          source_uid: "613941:0:0",
          semantics: "funding_share",
          amount: 3000000,
          measure_key: "ec_contribution",
        },
        {
          level: "participation",
          organisation: { level: "organisation", id: 101, label: "ITACONIX CORPORATION" },
          role: "participant",
          country: "US",
          source_uid: "613941:1:0",
          semantics: "funding_share",
          amount: null,
        },
      ],
    },
    reconciliation: {
      status: "gap",
      reason: null,
      parent_amount: 5335158.39,
      children_known_sum: 3000000,
      unallocated: 2335158.39,
      unknown_children: 1,
      coverage: { with_amount: 1, total: 2 },
    },
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/project/2": {
    ancestors: [
      { level: "funder", id: "nih", label: "NIH (RePORTER)" },
      { level: "programme", id: 30, code: "AI", label: "NIAID" },
    ],
    node: {
      level: "project",
      id: 2,
      source: "nih",
      source_id: "R21AI101276",
      label: "Rabies therapeutics",
      title: "Rabies therapeutics",
      funder: "nih",
      start_date: null,
      end_date: null,
      parent: { level: "programme", id: 30, code: "AI" },
      programme: {
        level: "programme",
        id: 30,
        code: "AI",
        attribution: { provenance: "source_fact", basis: "x" },
      },
    },
    measure: {
      key: "nih_obligations_window_sum",
      accounting_nature: "obligations_annual_sum",
      provenance: "derived",
      currency: "USD",
      amount: 441743,
    },
    amount_eur_observed: { amount: 343825.33, provenance: "derived", currency: "EUR" },
    total_cost: null,
    children: {
      level: "beneficiary",
      total: 1,
      measure: { key: null, provenance: null, currency: null, semantics: "beneficiary_marker" },
      items: [
        {
          level: "beneficiary",
          organisation: { level: "organisation", id: 200, label: "PROSETTA CORPORATION" },
          role: "coordinator",
          country: "US",
          source_uid: "R21AI101276",
          semantics: "beneficiary_marker",
          amount: null,
          amount_note: "x",
        },
      ],
    },
    reconciliation: {
      status: "not_applicable",
      reason: "x",
      parent_amount: 441743,
      children_known_sum: null,
      unallocated: null,
      unknown_children: null,
      coverage: null,
    },
    navigation: NAV_NIH,
    restrictions: [],
  },
  "/api/chain/project/3": {
    ancestors: [
      { level: "funder", id: "nsf", label: "NSF" },
      { level: "programme", id: 40, code: "DBI", label: "Biological Infrastructure" },
    ],
    node: {
      level: "project",
      id: 3,
      source: "nsf",
      source_id: "0939454",
      label: "BEACON",
      title: "BEACON Center",
      funder: "nsf",
      start_date: null,
      end_date: null,
      parent: { level: "programme", id: 40, code: "DBI" },
      programme: {
        level: "programme",
        id: 40,
        code: "DBI",
        attribution: { provenance: "source_fact", basis: "x" },
      },
    },
    measure: {
      key: "nsf_obligated_cumulative",
      accounting_nature: "obligations_cumulative",
      provenance: "source_fact",
      currency: "USD",
      amount: 48035209,
    },
    amount_eur_observed: { amount: null, provenance: "derived", currency: "EUR" },
    total_cost: null,
    children: {
      level: "participation",
      total: 1,
      measure: { key: "nsf_award_obligated", provenance: "source_fact", currency: "USD" },
      items: [
        {
          level: "participation",
          organisation: { level: "organisation", id: 300, label: "MICHIGAN STATE UNIVERSITY" },
          role: "coordinator",
          country: "US",
          source_uid: "0939454",
          semantics: "constituent_award",
          amount: 48035209,
          measure_key: "nsf_award_obligated",
        },
      ],
    },
    reconciliation: {
      status: "exact",
      reason: null,
      parent_amount: 48035209,
      children_known_sum: 48035209,
      unallocated: 0,
      unknown_children: 0,
      coverage: { with_amount: 1, total: 1 },
    },
    annual_obligations: {
      measure: {
        key: "nsf_obligation_fy",
        accounting_nature: "obligation_fiscal_year",
        provenance: "source_fact",
        currency: "USD",
      },
      vintage: "2026-08-26",
      fiscal_years: [
        { fy: 2011, amount: 4999892 },
        { fy: 2012, amount: 5199833 },
      ],
      window_sum: 45535633,
      comparability: { with_cumulative_total: "incompatible", reason: "x" },
    },
    navigation: NAV_NIH,
    restrictions: [],
  },
  "/api/chain/organisation/101": {
    ancestors: [],
    node: { level: "organisation", id: 101, label: "ITACONIX CORPORATION", country: "US" },
    by_funder: [
      {
        funder: "ec",
        measure: { key: "ec_contribution_sum", provenance: "derived", currency: "EUR" },
        amount: null,
        projects: 1,
        participations: 1,
        coverage: { with_amount: 0, unknown_amount: 1 },
        amount_eur_observed: { amount: null, provenance: "derived", currency: "EUR" },
      },
      {
        funder: "nsf",
        measure: { key: "nsf_awards_obligated_sum", provenance: "derived", currency: "USD" },
        amount: 1065989,
        projects: 3,
        participations: 3,
        coverage: { with_amount: 3, unknown_amount: 0 },
        amount_eur_observed: { amount: 801094.22, provenance: "derived", currency: "EUR" },
      },
    ],
    cross_funder_total: { available: false, reason: "x" },
    navigation: { down: [], up: [] },
    restrictions: [],
  },
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input).split("?")[0];
      const fixture = FIXTURES[url];
      if (!fixture) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "node_not_found" }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => fixture } as Response;
    }),
  );
}

/** Les gestes navigateur (Back/Forward) dans le harnais — l'addendum
 *  B2.7 §K exige une recomposition cohérente, pas un remplacement. */
function HistoryProbe() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        test-back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        test-forward
      </button>
    </>
  );
}

function mount(path: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <HistoryProbe />
        <Routes>
          <Route path="/money" element={<MoneyTrailPage />} />
          <Route path="/money/:level/:id" element={<MoneyTrailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
/** Le fil d'Ariane textuel du chemin. */
function trail(): HTMLElement {
  return screen.getByRole("navigation", { name: "Trace" });
}

function trailLinks(): { href: string | null; text: string }[] {
  return Array.from(trail().querySelectorAll("a"))
    .filter((a) => a.getAttribute("href") !== "/money")
    .map((a) => ({ href: a.getAttribute("href"), text: a.textContent ?? "" }));
}

function trailCurrent(): HTMLElement {
  return trail().querySelector('[aria-current="page"]') as HTMLElement;
}

/** Les colonnes proportionnelles, dans l'ordre du DOM (tri décroissant). */
function bars(kind?: "child" | "others" | "unallocated"): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(kind ? `[data-bar="${kind}"]` : "[data-bar]"),
  );
}

function heights(els: HTMLElement[]): number[] {
  return els.map((el) => Number.parseFloat(el.style.height));
}

describe("money trail (B2.8)", () => {
  beforeEach(() => {
    stubFetch();
    void i18n.changeLanguage("en");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("racine : la surface de départ, trois portes, sans classement ni total ni région", async () => {
    mount("/money");
    expect(await screen.findByRole("heading", { name: "Where did this money go?" })).toBeTruthy();
    expect(screen.getByText("European Commission")).toBeTruthy();
    expect(screen.getByText("NIH (RePORTER)")).toBeTruthy();
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(screen.getByText("Choose a funder to start following the money.")).toBeTruthy();
    // Ni fil d'Ariane ni colonnes tant qu'aucun financeur n'est
    // choisi : la racine reste la porte typographique, sans barres —
    // trois mesures non comparables ne se dessinent pas ensemble.
    expect(screen.queryByRole("navigation", { name: "Trace" })).toBeNull();
    expect(bars()).toHaveLength(0);
  });

  it("profondeur 1 : colonnes triées, godet exact, non-ventilé hachuré jamais caché", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    // Fil d'Ariane : le focus seul, en fort, avec son montant — aucun
    // ancêtre à remonter.
    expect(trailLinks()).toHaveLength(0);
    expect(trailCurrent().textContent).toContain("European Commission");
    expect(trailCurrent().textContent).toContain("€176B");
    // 14 programmes, 12 emplacements : 10 barres + godet + non-ventilé.
    expect(bars("child")).toHaveLength(10);
    expect(bars("others")).toHaveLength(1);
    expect(bars("unallocated")).toHaveLength(1);
    // Hauteur = montant, tri décroissant, échelle commune : les barres
    // descendent, le non-ventilé (71 sur 176 Md€) domine l'échelle.
    const childHeights = heights(bars("child"));
    for (let i = 1; i < childHeights.length; i += 1) {
      expect(childHeights[i]).toBeLessThanOrEqual(childHeights[i - 1]);
    }
    expect(heights(bars("unallocated"))[0]).toBe(220);
    expect(childHeights[0]).toBeLessThan(220);
    // Chaque barre enfant est un vrai LIEN de descente, nommé.
    const first = bars("child")[0].closest("a")!;
    expect(first.getAttribute("href")).toBe("/money/programme/100");
    expect(first.getAttribute("aria-label")).toContain("Programme 0");
    expect(first.getAttribute("aria-label")).toContain("€14B");
    // Le godet est exact : la somme des 4 programmes cachés.
    expect(screen.getByRole("button", { name: /\+ 4 more · €10B/ })).toBeTruthy();
    // Le non-ventilé est dit dans la forme ET en toutes lettres.
    expect(screen.getByText(/Unallocated: €71B \(40\.3\s?%\)/)).toBeTruthy();
  });

  it("profondeur 2 : ancêtre cliquable au fil d'Ariane, part du focus libellée", async () => {
    mount("/money/programme/10");
    await screen.findByRole("heading", { name: "Horizon Europe", level: 1 });
    // L'ancêtre est un LIEN nom · montant ; le focus ferme la ligne en
    // fort ; aucun ratio dans le fil — la part vit dans le focus.
    const links = trailLinks();
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("/money/funder/ec");
    expect(links[0].text).toContain("European Commission");
    expect(links[0].text).toContain("€176B");
    expect(trailCurrent().textContent).toContain("Horizon Europe");
    expect(trail().textContent).not.toContain("%");
    expect(
      screen.getByText(/35\.2\s?% of the observed EU contributions of European Commission/),
    ).toBeTruthy();
    expect(screen.getByText("Where does this money go next?")).toBeTruthy();
    // Deux enfants seulement : pas de godet ; le non-ventilé
    // (62 − 15 = 47 Md€) reste un segment visible qui domine l'échelle.
    expect(bars("child")).toHaveLength(2);
    expect(bars("others")).toHaveLength(0);
    expect(bars("unallocated")).toHaveLength(1);
    const [h1, h2] = heights(bars("child"));
    expect(h1).toBeGreaterThan(h2);
    expect(heights(bars("unallocated"))[0]).toBe(220);
  });

  it("profondeur 5 : le fil d'Ariane complet, dans l'ordre, sans ratio inventé", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    const links = trailLinks();
    expect(links.map((l) => l.href)).toEqual([
      "/money/funder/ec",
      "/money/programme/10",
      "/money/programme/11",
      "/money/call/20",
    ]);
    // Chaque segment dit nom · montant — y compris l'appel transversal
    // (liaison structurelle : son montant, JAMAIS un ratio).
    expect(links[0].text).toContain("€176B");
    expect(links[1].text).toContain("Horizon Europe");
    expect(links[1].text).toContain("€62B");
    expect(links[3].text).toContain("CALL-X");
    expect(links[3].text).toContain("€50M");
    expect(trail().textContent).not.toContain("%");
    expect(trailCurrent().textContent).toContain("BIO-QED");
    // La part du focus vit dans le focus, libellée par sa famille.
    expect(screen.getByText(/10\.7\s?% of the observed EU contributions of CALL-X/)).toBeTruthy();
  });

  it("clic barre : la descente recompose le focus et le fil d'Ariane", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    fireEvent.click(bars("child")[0].closest("a")!);
    expect(await screen.findByRole("heading", { name: "Programme 0", level: 1 })).toBeTruthy();
    expect(trailLinks().map((l) => l.href)).toEqual(["/money/funder/ec"]);
    expect(trailCurrent().textContent).toContain("Programme 0");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("clic ancêtre : le fil d'Ariane remonte au niveau", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    const horizon = trail().querySelector('a[href="/money/programme/10"]')!;
    fireEvent.click(horizon);
    expect(await screen.findByRole("heading", { name: "Horizon Europe", level: 1 })).toBeTruthy();
    expect(trailLinks().map((l) => l.href)).toEqual(["/money/funder/ec"]);
    expect(screen.queryByRole("heading", { name: "BIO-QED", level: 1 })).toBeNull();
    expect(document.body.textContent).not.toContain("CALL-X");
  });

  it("godet : le clic ouvre la liste complète, le repli revient aux colonnes", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    // Au repos : les colonnes ; le 11e programme n'est pas une barre.
    expect(screen.queryByText("Programme 13")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /\+ 4 more · €10B/ }));
    // La liste complète : TOUTES les destinations, y compris cachées.
    expect(await screen.findByText("Programme 13")).toBeTruthy();
    expect(bars()).toHaveLength(0);
    // 14 enfants ≤ seuil : la liste complète n'invente pas de filtre.
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to the columns" }));
    expect(screen.queryByText("Programme 13")).toBeNull();
    expect(bars("child")).toHaveLength(10);
  });

  it("ratio d'échelle extrême : hauteur plancher marquée, jamais une proportion fausse en silence", async () => {
    mount("/money/call/20");
    await screen.findByRole("heading", { name: "CALL-X", level: 1 });
    // 3 projets servis + non-ventilé, pas de godet.
    expect(bars("child")).toHaveLength(3);
    expect(bars("others")).toHaveLength(0);
    expect(bars("unallocated")).toHaveLength(1);
    // MICRO (3 k€ sur une échelle à 42,7 M€) : plancher 3 px, marqué,
    // la part réelle dite au title — « < 0,1 % », jamais « 0 % ».
    const crushed = document.querySelector<HTMLElement>("[data-crushed]")!;
    expect(crushed).toBeTruthy();
    expect(crushed.style.height).toBe("3px");
    const crushedLink = crushed.closest("a")!;
    expect(crushedLink.getAttribute("title")).toContain("MICRO");
    expect(crushedLink.getAttribute("title")).toContain("visibility floor");
    expect(crushedLink.getAttribute("title")).toContain("< 0.1 %");
    // Les barres non écrasées gardent la proportion vraie.
    const [h1] = heights(bars("child"));
    expect(h1).toBeGreaterThan(20);
  });

  it("godet plafonné : un agrégat ne domine jamais la scène, l'échelle reste aux comparables", async () => {
    mount("/money/call/30");
    await screen.findByRole("heading", { name: "CALL-BIG", level: 1 });
    // Page partielle (3 servis sur 400) : pas de segment résiduel —
    // mais le godet d'un appel est exact (invariant d'agrégation).
    expect(bars("child")).toHaveLength(3);
    expect(bars("unallocated")).toHaveLength(0);
    const others = bars("others");
    expect(others).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /\+ 397 more · €692\.4M/ }),
    ).toBeTruthy();
    // L'échelle s'ancre sur le plus haut enfant COMPARABLE : lui seul
    // touche le plafond ; le godet, pourtant 250× plus gros, se
    // plafonne et se marque — une porte, pas le champion.
    expect(heights(bars("child"))[0]).toBe(220);
    expect(heights(others)[0]).toBe(128);
    expect(others[0].dataset.crushed).toBe("true");
    const link = others[0].closest("button")!;
    expect(link.getAttribute("title")).toContain("Height capped");
    expect(link.getAttribute("title")).toContain("98.9 %");
  });

  it("appel transversal : liaison structurelle, jamais un ratio invalide", async () => {
    mount("/money/call/20");
    await screen.findByRole("heading", { name: "CALL-X", level: 1 });
    expect(screen.getByText(/Cross-cutting call — no per-programme ratio/)).toBeTruthy();
    // Aucun share_of_parent servi → aucune ligne de part.
    expect(screen.queryByText(/% of the observed EU contributions of/)).toBeNull();
  });

  it("filtre local : uniquement sur un ensemble entièrement servi, depuis la liste complète", async () => {
    mount("/money/funder/nih");
    await screen.findByRole("heading", { name: "NIH (RePORTER)", level: 1 });
    // Au repos : les colonnes, sans filtre — le filtre appartient à la
    // liste complète.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(bars("child")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: /\+ 8 more · \$60B/ }));
    const input = await screen.findByRole("searchbox");
    fireEvent.change(input, { target: { value: "NIAID" } });
    expect(screen.getByText("NIAID")).toBeTruthy();
    expect(screen.queryByText("Institute 3")).toBeNull();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Nothing here matches.")).toBeTruthy();
  });

  it("URL profonde CORDIS : gap dit, inconnu ≠ 0 (jamais une barre), D7 respecté", async () => {
    mount("/money/project/1");
    expect(await screen.findByRole("heading", { name: "BIO-QED", level: 1 })).toBeTruthy();
    expect(screen.getAllByText("source fact").length).toBeGreaterThan(0);
    expect(screen.getByText(/do not cover the whole project total/)).toBeTruthy();
    expect(screen.getByText("Not broken down")).toBeTruthy();
    expect(screen.getByText(/43\.8\s?% of the amount is not broken down/)).toBeTruthy();
    // Colonnes des participants : la part connue en barre, le
    // non-ventilé du MOTEUR en segment hachuré — et JAMAIS de barre
    // pour ITACONIX, dont le montant est inconnu, pas nul.
    expect(bars("child")).toHaveLength(1);
    expect(bars("child")[0].closest("a")!.getAttribute("href")).toBe("/money/organisation/100");
    expect(bars("unallocated")).toHaveLength(1);
    const row = screen.getByText("Itaconix corporation").closest("div.border-b");
    expect(row?.textContent).toContain("unknown");
    expect(row?.textContent).not.toContain("€0");
    expect(screen.getByText("not available")).toBeTruthy();
  });

  it("dépassement de plafond : lecture comptable signée, jamais un segment résiduel", async () => {
    mount("/money/project/4");
    await screen.findByRole("heading", { name: "EUROfusion", level: 1 });
    expect(screen.getByText(/exceed the project ceiling/)).toBeTruthy();
    expect(screen.getByText("Project ceiling")).toBeTruthy();
    expect(screen.getByText("Gap")).toBeTruthy();
    expect(screen.getByText("+€115.1M")).toBeTruthy();
    // Les parts dépassent le plafond : deux barres, PAS de
    // « non ventilé » — un résiduel négatif serait un mensonge.
    expect(bars("child")).toHaveLength(2);
    expect(bars("unallocated")).toHaveLength(0);
  });

  it("NIH : bénéficiaire, jamais une ventilation — aucune barre, aucune région appel", async () => {
    mount("/money/project/2");
    expect(
      await screen.findByRole("heading", { name: "Rabies therapeutics", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText(/identifies the beneficiary/)).toBeTruthy();
    expect(screen.getByText(/beneficiary marker, not a financial breakdown/)).toBeTruthy();
    // L'étage absent n'est pas synthétisé : financeur → institut →
    // projet, sans appel.
    expect(trailLinks().map((l) => l.href)).toEqual(["/money/funder/nih", "/money/programme/30"]);
    expect(screen.getByText(/skips it rather than inventing it/)).toBeTruthy();
    // Le moteur ne ventile pas : AUCUNE colonne.
    expect(bars()).toHaveLength(0);
  });

  it("NSF : deux systèmes de mesure, réconciliation exacte compacte et calme", async () => {
    mount("/money/project/3");
    expect(await screen.findByRole("heading", { name: "BEACON", level: 1 })).toBeTruthy();
    expect(screen.getByText(/never added, never interchanged/)).toBeTruthy();
    expect(screen.getByText(/not a decomposition of one another/)).toBeTruthy();
    expect(screen.getByText("$45.5M")).toBeTruthy();
    expect(screen.getAllByText("$48M").length).toBeGreaterThan(0);
    expect(screen.getByText(/vintage 2026-08-26/)).toBeTruthy();
    expect(screen.getByText("Exact reconciliation")).toBeTruthy();
    expect(screen.getByText("No unallocated amount.")).toBeTruthy();
    expect(screen.queryByText("Project contribution")).toBeNull();
    expect(screen.queryByText("Participants with unknown share")).toBeNull();
    expect(trailLinks().map((l) => l.href)).toEqual(["/money/funder/nsf", "/money/programme/40"]);
    // Exact : la barre unique remplit sa mesure, sans segment résiduel.
    expect(bars("child")).toHaveLength(1);
    expect(bars("unallocated")).toHaveLength(0);
  });

  it("organisation : relations de financement, aucun morphing forcé, refus du total", async () => {
    mount("/money/organisation/101");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Itaconix corporation");
    expect(screen.getByText("Funding relations")).toBeTruthy();
    expect(screen.getAllByText("$1.1M").length).toBeGreaterThan(0);
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(
      screen.getAllByText(/one combined figure would be an invented number/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/publishes no amount for this participation/)).toBeTruthy();
    // Pas de chemin descendant forcé, pas de fil d'Ariane, et JAMAIS
    // de colonnes entre financeurs : deux mesures, deux devises — des
    // hauteurs communes seraient un total inventé.
    expect(screen.queryByRole("navigation", { name: "Trace" })).toBeNull();
    expect(bars()).toHaveLength(0);
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/money/funder/ec");
    expect(hrefs).toContain("/money/funder/nsf");
  });

  it("méthodologie : l'inspecteur s'ouvre à la demande, se referme, focus restitué", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Methodology & sources/ }));
    const dialog = await screen.findByRole("dialog", { name: "Methodology & sources" });
    expect(dialog.textContent).toContain("cordis-fp7");
    expect(dialog.textContent).toContain("common-ancestor rule");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("404 : refus nommé, jamais une page blanche", async () => {
    mount("/money/project/999");
    expect(await screen.findByText("This node does not exist.")).toBeTruthy();
    expect(screen.getByText("Back to the money trail")).toBeTruthy();
  });

  it("niveau inconnu dans l'URL : impasse traitée", () => {
    mount("/money/galaxy/42");
    expect(screen.getByText("This node does not exist.")).toBeTruthy();
  });

  it("FR : la même vue parle français, godet et non-ventilé compris", async () => {
    await i18n.changeLanguage("fr");
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    expect(screen.getByText("Contribution maximale UE")).toBeTruthy();
    expect(screen.getAllByText("Non ventilé").length).toBeGreaterThan(0);
    expect(screen.getByText(/pas une erreur/)).toBeTruthy();
    cleanup();
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    expect(screen.getByText("Où va ensuite cet argent ?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /\+ 4 autres · €10B/ })).toBeTruthy();
  });

  it("réponse réseau obsolète : clic A → clic B → réponse A après B → B reste le focus", async () => {
    // Invariant permanent (hérité de l'addendum B2.7 §E), quelle que
    // soit la composition : une réponse en retard n'écrase jamais une
    // sélection plus récente, et le panneau n'est jamais vidé pendant
    // le chargement.
    let releaseA: (() => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input).split("?")[0];
        const fixture = FIXTURES[url];
        const ok = { ok: true, status: 200, json: async () => fixture } as Response;
        if (url.endsWith("/programme/100")) {
          return new Promise<Response>((resolve) => {
            releaseA = () => resolve(ok);
          });
        }
        if (!fixture) {
          return { ok: false, status: 404, json: async () => ({}) } as Response;
        }
        return ok;
      }),
    );
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    // Clic A : les données chargent — l'état visuel courant est
    // conservé, le panneau analytique n'est pas vidé.
    fireEvent.click(bars("child")[0].closest("a")!);
    expect(screen.getByRole("heading", { name: "European Commission", level: 1 })).toBeTruthy();
    // Clic B (depuis le fil encore rendu de l'ancien focus, via la
    // liste : les barres appartiennent au focus servi) — Programme 1
    // répond immédiatement et prend le focus.
    fireEvent.click(bars("child")[1].closest("a")!);
    expect(await screen.findByRole("heading", { name: "Programme 1", level: 1 })).toBeTruthy();
    // La réponse de A arrive APRÈS : elle ne doit rien écraser.
    releaseA!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("heading", { name: "Programme 1", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Programme 0", level: 1 })).toBeNull();
    expect(trailCurrent().textContent).toContain("Programme 1");
  });

  it("navigation Back/Forward : le chemin se recompose sans fantôme", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    fireEvent.click(bars("child")[0].closest("a")!);
    await screen.findByRole("heading", { name: "Programme 0", level: 1 });
    expect(trailLinks()).toHaveLength(1);
    // Back : le financeur reprend le focus, le fil se recompose.
    fireEvent.click(screen.getByRole("button", { name: "test-back" }));
    expect(
      await screen.findByRole("heading", { name: "European Commission", level: 1 }),
    ).toBeTruthy();
    expect(trailLinks()).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Programme 0", level: 1 })).toBeNull();
    // Forward : recomposition identique.
    fireEvent.click(screen.getByRole("button", { name: "test-forward" }));
    expect(await screen.findByRole("heading", { name: "Programme 0", level: 1 })).toBeTruthy();
    expect(trailLinks().map((l) => l.href)).toEqual(["/money/funder/ec"]);
    expect(trailCurrent().textContent).toContain("Programme 0");
  });
});
