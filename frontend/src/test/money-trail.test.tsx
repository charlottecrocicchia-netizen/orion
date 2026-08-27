/** B2.4 — le Focus Trace Workspace contre des réponses B1 fidèles aux
 *  golds : trace typographique reconstruite du fil enrichi (deep-link
 *  ≡ descente, UNE requête), focus unique par niveau, clic destination
 *  → nouveau focus sans région supplémentaire, clic ancêtre → retour
 *  au niveau, filtre local honnête, réconciliation progressive,
 *  inconnu ≠ 0, bénéficiaire NIH, double système NSF, transverse sans
 *  total unique, EN/FR. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

function mount(path: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/money" element={<MoneyTrailPage />} />
          <Route path="/money/:level/:id" element={<MoneyTrailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Les deux formes de la trace (panneau ≥ md + ligne compacte) — la
 *  première est le panneau typographique. */
function tracePanel() {
  return screen.getAllByRole("navigation", { name: "Trace" })[0];
}

describe("money trail (B2.4)", () => {
  beforeEach(() => {
    stubFetch();
    void i18n.changeLanguage("en");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("racine : trois portes typographiques, sans classement ni total", async () => {
    mount("/money");
    expect(await screen.findByRole("heading", { name: "Where did this money go?" })).toBeTruthy();
    expect(screen.getByText("European Commission")).toBeTruthy();
    expect(screen.getByText("NIH (RePORTER)")).toBeTruthy();
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(screen.getByText("Choose a funder to start following the money.")).toBeTruthy();
    // Aucun panneau de trace vide à la racine.
    expect(screen.queryByRole("navigation", { name: "Trace" })).toBeNull();
  });

  it("focus : UN seul niveau développé, la question unique, lignes suivables", async () => {
    mount("/money/funder/ec");
    expect(await screen.findByRole("heading", { name: "European Commission", level: 1 })).toBeTruthy();
    // Un seul h1 : une seule région de focus, pas d'empilement.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Where does this money go next?")).toBeTruthy();
    expect(screen.getAllByText(/Follow the funding to/).length).toBeGreaterThan(0);
    // Top adaptatif (8 en environnement non contraint) sur 14.
    expect(screen.getByText("Programme 0")).toBeTruthy();
    expect(screen.queryByText("Programme 13")).toBeNull();
    expect(screen.getByText(/8 main destinations out of 14/)).toBeTruthy();
    expect(screen.getByText(/the top 8 account for/)).toBeTruthy();
    const more = screen.getByRole("button", { name: "Show the 6 others" });
    fireEvent.click(more);
    expect(await screen.findByText("Programme 13")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to top 8" })).toBeTruthy();
  });

  it("clic destination : le focus change, aucune région ne s'ajoute", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    const navsBefore = screen.getAllByRole("navigation", { name: "Trace" }).length;
    fireEvent.click(screen.getByText("Programme 0").closest("a")!);
    // Le nouveau niveau prend le centre — un seul h1, autant de
    // régions qu'avant, l'étape précédente rejoint la trace.
    expect(await screen.findByRole("heading", { name: "Programme 0", level: 1 })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("navigation", { name: "Trace" }).length).toBe(navsBefore);
    const trace = tracePanel();
    expect(trace.textContent).toContain("European Commission");
    expect(trace.querySelector('[aria-current="true"]')?.textContent).toContain("Programme 0");
  });

  it("trace : reconstruite du fil enrichi, sans faux nœud, parts valides seules", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    const trace = tracePanel();
    const text = trace.textContent ?? "";
    // Pas de nœud « Money trail » : la trace commence au financeur.
    expect(text).not.toContain("Money trail");
    // Montants d'ancêtres SANS navigation préalable ni cache.
    expect(text).toContain("€176B");
    expect(text).toContain("€62B");
    // Ancêtres cliquables, courant marqué.
    const links = Array.from(trace.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/money/funder/ec");
    expect(links).toContain("/money/programme/10");
    expect(links).toContain("/money/call/20");
    expect(trace.querySelector('[aria-current="true"]')?.textContent).toContain("BIO-QED");
    // Parts sur les relations valides (HORIZON, Énergie, projet)…
    expect(text).toContain("35.2");
    expect(text).toContain("16.1");
    expect(text).toContain("10.7");
    // …et RIEN sur l'appel transversal : 4 relations, 3 chiffrées.
    expect((text.match(/└/g) ?? []).length).toBe(4 + 1); // + la légende
    expect((text.match(/└ \d|└ </g) ?? []).length).toBe(3);
    expect(text).toContain("share of the level above");
  });

  it("ancêtre : cliquer Horizon Europe ramène le focus, les descendants quittent la trace", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    const horizon = Array.from(tracePanel().querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Horizon Europe"),
    );
    expect(horizon).toBeTruthy();
    fireEvent.click(horizon!);
    expect(await screen.findByRole("heading", { name: "Horizon Europe", level: 1 })).toBeTruthy();
    // Les descendants (appel, projet) ont quitté la trace.
    const text = tracePanel().textContent ?? "";
    expect(text).not.toContain("CALL-X");
    expect(text).not.toContain("BIO-QED");
    expect(screen.queryByRole("heading", { name: "BIO-QED", level: 1 })).toBeNull();
    // Et les destinations du niveau sont immédiatement là.
    expect(screen.getByText("Énergie")).toBeTruthy();
  });

  it("filtre local : uniquement sur un ensemble entièrement servi, et honnête", async () => {
    mount("/money/funder/nih");
    await screen.findByRole("heading", { name: "NIH (RePORTER)", level: 1 });
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "NIAID" } });
    expect(screen.getByText("NIAID")).toBeTruthy();
    expect(screen.queryByText("Institute 3")).toBeNull();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Nothing here matches.")).toBeTruthy();
  });

  it("filtre local : jamais proposé pour une courte liste", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("URL profonde CORDIS : gap dit, inconnu ≠ 0, D7 respecté", async () => {
    mount("/money/project/1");
    expect(await screen.findByRole("heading", { name: "BIO-QED", level: 1 })).toBeTruthy();
    expect(screen.getAllByText("source fact").length).toBeGreaterThan(0);
    expect(screen.getByText(/do not cover the whole project total/)).toBeTruthy();
    expect(screen.getByText("Not broken down")).toBeTruthy();
    expect(screen.getByText(/43\.8\s?% of the amount is not broken down/)).toBeTruthy();
    expect(screen.getByText(/10\.7\s?% of the observed EU contributions of CALL-X/)).toBeTruthy();
    const row = screen.getByText("Itaconix corporation").closest("div.border-b");
    expect(row?.textContent).toContain("unknown");
    expect(row?.textContent).not.toContain("€0");
    expect(screen.getByText("not available")).toBeTruthy();
  });

  it("dépassement de plafond : lecture comptable signée, jamais un 100 % empilé", async () => {
    mount("/money/project/4");
    await screen.findByRole("heading", { name: "EUROfusion", level: 1 });
    expect(screen.getByText(/exceed the project ceiling/)).toBeTruthy();
    expect(screen.getByText("Project ceiling")).toBeTruthy();
    expect(screen.getByText("Gap")).toBeTruthy();
    expect(screen.getByText("+€115.1M")).toBeTruthy();
  });

  it("NIH : bénéficiaire, jamais une ventilation ; pas d'étage appel", async () => {
    mount("/money/project/2");
    expect(await screen.findByRole("heading", { name: "Rabies therapeutics", level: 1 })).toBeTruthy();
    expect(screen.getByText(/identifies the beneficiary/)).toBeTruthy();
    expect(screen.getByText(/beneficiary marker, not a financial breakdown/)).toBeTruthy();
    const text = tracePanel().textContent ?? "";
    expect(text).toContain("NIH (RePORTER)");
    expect(text).toContain("NIAID");
    expect(text).not.toContain("Call");
    expect(screen.getByText(/skips it rather than inventing it/)).toBeTruthy();
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
    // Jamais « contribution » pour une obligation NSF, jamais le
    // tableau détaillé pour un cas trivial.
    expect(screen.queryByText("Project contribution")).toBeNull();
    expect(screen.queryByText("Participants with unknown share")).toBeNull();
  });

  it("organisation : relations de financement, refus du total unique", async () => {
    mount("/money/organisation/101");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Itaconix corporation");
    expect(screen.getByText("Funding relations")).toBeTruthy();
    expect(screen.getByText("$1.1M")).toBeTruthy();
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(
      screen.getAllByText(/one combined figure would be an invented number/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/publishes no amount for this participation/)).toBeTruthy();
    // Pas de trace descendante forcée sur une entité transverse.
    expect(screen.queryByRole("navigation", { name: "Trace" })).toBeNull();
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

  it("FR : la même vue parle français", async () => {
    await i18n.changeLanguage("fr");
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    expect(screen.getByText("Contribution maximale UE")).toBeTruthy();
    expect(screen.getByText("Non ventilé")).toBeTruthy();
    expect(screen.getByText(/pas une erreur/)).toBeTruthy();
    expect(tracePanel().textContent).toContain("part du niveau au-dessus");
  });
});
