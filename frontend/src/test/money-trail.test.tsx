/** B2.3 — le navigateur de trace contre des réponses B1 fidèles aux
 *  golds : colonnes reconstruites depuis le fil enrichi (deep-link ≡
 *  descente), sélection épinglée hors page servie, changement de
 *  branche par l'URL, réconciliation `gap`/exacte compacte, part
 *  inconnue ≠ 0, bénéficiaire NIH sans fausse ventilation, axe annuel
 *  NSF incompatible, organisation sans total unique, EN/FR.
 *
 *  Sous jsdom les deux branches (séquentielle + colonnes) rendent
 *  toutes deux : les assertions utilisent getAll* quand le contenu
 *  existe légitimement en double. */

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
  measure: {
    key,
    accounting_nature: "obligations",
    provenance: "derived",
    currency: "USD",
  },
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
  "/api/chain/funder/nih": {
    node: { level: "funder", id: "nih", label: "NIH (RePORTER)", currency: "USD" },
    aggregate: USD_AGG("nih_obligations_window_sum_sum", 642e9, 380275),
    children: {
      level: "programme",
      total: 1,
      items: [
        { level: "programme", id: 30, code: "AI", label: "NIAID", projects: 40000, amount: 80e9 },
      ],
    },
    ancestors: [],
    navigation: NAV_NIH,
    restrictions: [],
  },
  "/api/chain/funder/nsf": {
    node: { level: "funder", id: "nsf", label: "NSF", currency: "USD" },
    aggregate: USD_AGG("nsf_obligated_cumulative_sum", 300e9, 200000),
    children: {
      level: "programme",
      total: 1,
      items: [
        {
          level: "programme",
          id: 40,
          code: "DBI",
          label: "Biological Infrastructure",
          projects: 9000,
          amount: 12e9,
        },
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
      total: 2,
      items: [
        { level: "project", id: 1, label: "BIO-QED", projects: undefined, amount: 5335158.39 },
        { level: "project", id: 5, label: "OTHER", projects: undefined, amount: 2e6 },
      ],
      coverage: { with_amount: 2, unknown_amount: 0 },
    },
    ancestors: [EC_CRUMB],
    navigation: NAV_EC,
    restrictions: [],
  },
  "/api/chain/programme/30": {
    node: {
      level: "programme",
      id: 30,
      code: "AI",
      label: "NIAID",
      funder: "nih",
      parent: { level: "funder", id: "nih", label: "NIH (RePORTER)" },
    },
    aggregate: USD_AGG("nih_obligations_window_sum_sum", 80e9, 40000),
    children: { level: "project", total: 0, items: [] },
    ancestors: [{ level: "funder", id: "nih", label: "NIH (RePORTER)" }],
    navigation: NAV_NIH,
    restrictions: [],
  },
  "/api/chain/programme/40": {
    node: {
      level: "programme",
      id: 40,
      code: "DBI",
      label: "Biological Infrastructure",
      funder: "nsf",
      parent: { level: "funder", id: "nsf", label: "NSF" },
    },
    aggregate: USD_AGG("nsf_obligated_cumulative_sum", 12e9, 9000),
    children: { level: "project", total: 0, items: [] },
    ancestors: [{ level: "funder", id: "nsf", label: "NSF" }],
    navigation: NAV_NIH,
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

describe("money trail (B2.3)", () => {
  beforeEach(() => {
    stubFetch();
    void i18n.changeLanguage("en");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("racine : les financeurs viennent du moteur, sans total unique", async () => {
    mount("/money");
    expect(await screen.findByRole("heading", { name: "Where did this money go?" })).toBeTruthy();
    expect(screen.getByText("European Commission")).toBeTruthy();
    expect(screen.getByText("NIH (RePORTER)")).toBeTruthy();
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(screen.getAllByText("Explore").length).toBe(2);
  });

  it("URL profonde CORDIS : gap dit, inconnu ≠ 0, D7 respecté", async () => {
    mount("/money/project/1");
    expect((await screen.findAllByRole("heading", { name: "BIO-QED" })).length).toBeGreaterThan(0);
    const crumbs = screen.getAllByRole("navigation", { name: "Breadcrumb" })[0];
    expect(crumbs.textContent).toContain("Horizon Europe");
    expect(crumbs.textContent).toContain("CALL-X");
    // La mesure est nommée, avec sa nature.
    expect(
      screen.getAllByText("EU maximum contribution (grant agreement)").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("source fact").length).toBeGreaterThan(0);
    // Réconciliation : un gap est une propriété des données, pas une erreur.
    expect(screen.getAllByText(/do not cover the whole project total/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not broken down").length).toBeGreaterThan(0);
    // La part ITACONIX est inconnue — jamais « €0 ».
    const row = screen.getAllByText("Itaconix corporation")[0].closest("div.border-b");
    expect(row?.textContent).toContain("unknown");
    expect(row?.textContent).not.toContain("€0");
    // total_cost = 0 source → non disponible (D7).
    expect(screen.getAllByText("not available").length).toBeGreaterThan(0);
  });

  it("colonnes : le deep-link reconstruit tout le chemin, sélection à chaque étage", async () => {
    mount("/money/project/1");
    await screen.findAllByRole("heading", { name: "BIO-QED" });
    // Colonne racine : le financeur du chemin est sélectionné.
    const funders = await screen.findByRole("region", { name: "Funders" });
    const ecLink = Array.from(funders.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("European Commission"),
    );
    expect(ecLink?.getAttribute("aria-current")).toBe("true");
    // Colonne du financeur : « Horizon Europe » est hors de la liste
    // servie (PROG-0…13) — épinglé depuis le fil enrichi, avec sa part.
    const ecColumn = await screen.findByRole("region", {
      name: "Programmes — European Commission",
    });
    const pinned = ecColumn.querySelector('[aria-current="true"]');
    expect(pinned?.textContent).toContain("Horizon Europe");
    expect(pinned?.textContent).toContain("35.2");
    // Colonne HORIZON : « Énergie » sélectionnée dans la liste servie.
    const horizonColumn = await screen.findByRole("region", {
      name: "Programmes — Horizon Europe",
    });
    expect(horizonColumn.querySelector('[aria-current="true"]')?.textContent).toContain("Énergie");
    // Colonne de l'appel : le projet est sélectionné, la fiche reste à droite.
    const callColumn = await screen.findByRole("region", { name: "Projects — CALL-X" });
    expect(callColumn.querySelector('[aria-current="true"]')?.textContent).toContain("BIO-QED");
    // Le référent des % est déclaré dans l'en-tête de colonne.
    expect(ecColumn.textContent).toContain("% : share of European Commission");
  });

  it("branche : cliquer un autre programme remplace les colonnes descendantes", async () => {
    mount("/money/project/1");
    await screen.findAllByRole("heading", { name: "BIO-QED" });
    const ecColumn = await screen.findByRole("region", {
      name: "Programmes — European Commission",
    });
    const other = Array.from(ecColumn.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Programme 0"),
    );
    expect(other).toBeTruthy();
    fireEvent.click(other!);
    // Nouvelle branche : PROG-0 devient le niveau courant…
    expect((await screen.findAllByRole("heading", { name: "Programme 0" })).length).toBeGreaterThan(
      0,
    );
    // …et l'ancienne descendance (appel, projet) a disparu.
    expect(screen.queryByRole("region", { name: "Projects — CALL-X" })).toBeNull();
    expect(screen.queryAllByRole("heading", { name: "BIO-QED" })).toHaveLength(0);
  });

  it("NIH : bénéficiaire, jamais une ventilation ; pas d'étage appel", async () => {
    mount("/money/project/2");
    expect(
      (await screen.findAllByRole("heading", { name: "Rabies therapeutics" })).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/identifies the beneficiary/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/beneficiary marker, not a financial breakdown/).length,
    ).toBeGreaterThan(0);
    // Le fil ne contient aucun étage appel — la chaîne saute, n'invente pas.
    const crumbs = screen.getAllByRole("navigation", { name: "Breadcrumb" })[0];
    expect(crumbs.textContent).not.toContain("CALL");
    expect(screen.getAllByText(/skips it rather than inventing it/).length).toBeGreaterThan(0);
  });

  it("NSF : deux systèmes de mesure, réconciliation exacte compacte", async () => {
    mount("/money/project/3");
    expect((await screen.findAllByRole("heading", { name: "BEACON" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/never added, never interchanged/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a decomposition of one another/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$45.5M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$48M").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/vintage 2026-08-26/).length).toBeGreaterThan(0);
    // Réconciliation exacte sans part inconnue : la forme compacte,
    // sans tableau détaillé — et jamais « contribution » pour une
    // obligation NSF (les natures ne s'interchangent pas).
    expect(screen.getAllByText("Exact reconciliation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No unallocated amount.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Project contribution")).toBeNull();
    expect(screen.queryByText("Participants with unknown share")).toBeNull();
  });

  it("organisation : blocs par financeur, refus du total unique", async () => {
    mount("/money/organisation/101");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Itaconix corporation");
    expect(screen.getByText("$1.1M")).toBeTruthy();
    expect(screen.getByText("No single total.")).toBeTruthy();
    expect(
      screen.getAllByText(/one combined figure would be an invented number/).length,
    ).toBeGreaterThan(0);
    // Le bloc EC à part inconnue reste inconnu.
    expect(screen.getByText(/publishes no amount for this participation/)).toBeTruthy();
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
    expect(
      (await screen.findAllByText("Contribution maximale UE (convention de subvention)")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Non ventilé").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pas une erreur/).length).toBeGreaterThan(0);
  });

  it("trace : mémoire du chemin sans nœud fictif, parts servies par le moteur", async () => {
    mount("/money/project/1");
    await screen.findAllByRole("heading", { name: "BIO-QED" });
    const rail = screen.getAllByRole("navigation", { name: "Trail" })[0];
    const text = rail.textContent ?? "";
    // La trace commence au financeur — « Money trail » est le nom de
    // la fonctionnalité, pas un nœud (il reste dans le breadcrumb).
    expect(text).not.toContain("Money trail");
    expect(
      screen.getAllByRole("navigation", { name: "Breadcrumb" })[0].textContent,
    ).toContain("Money trail");
    // Montants d'ancêtres SANS navigation préalable ni cache.
    expect(text).toContain("€176B");
    expect(text).toContain("€62B");
    // Les ancêtres sont des liens vers leur vue, le courant est actif.
    const links = Array.from(rail.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/money/funder/ec");
    expect(links).toContain("/money/programme/10");
    expect(links).toContain("/money/call/20");
    expect(rail.querySelector('[aria-current="true"]')?.textContent).toContain("BIO-QED");
    // Parts sur les relations valides (HORIZON, Énergie, projet)…
    expect(text).toContain("35.2");
    expect(text).toContain("16.1");
    expect(text).toContain("10.7");
    // …et RIEN sur l'appel transversal : exactement trois séparateurs chiffrés.
    expect((text.match(/› \d|› </g) ?? []).length).toBe(3);
    // La convention des % est établie explicitement.
    expect(text).toContain("share of the previous step");
  });

  it("trace NIH : l'étage appel sauté ne casse pas le parcours", async () => {
    mount("/money/project/2");
    await screen.findAllByRole("heading", { name: "Rabies therapeutics" });
    const rail = screen.getAllByRole("navigation", { name: "Trail" })[0];
    const text = rail.textContent ?? "";
    expect(text).toContain("NIH (RePORTER)");
    expect(text).toContain("NIAID");
    expect(text).not.toContain("Call");
  });

  it("longue liste : top 10 par défaut, dépli dans l'URL", async () => {
    mount("/money/funder/ec");
    await screen.findAllByRole("heading", { name: "European Commission" });
    // 10 visibles sur 14, bouton de dépli.
    expect(screen.getAllByText("Programme 0").length).toBeGreaterThan(0);
    expect(screen.queryByText("Programme 13")).toBeNull();
    expect(screen.getAllByText(/10 main destinations out of 14/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the top 10 account for/).length).toBeGreaterThan(0);
    const more = screen.getAllByRole("button", { name: "Show the 4 others" })[0];
    fireEvent.click(more);
    expect((await screen.findAllByText("Programme 13")).length).toBeGreaterThan(0);
    // Et l'état est dans l'URL (rejouable) : remonter au top 10.
    expect(screen.getAllByRole("button", { name: "Back to top 10" }).length).toBeGreaterThan(0);
  });

  it("question : la dernière colonne demande où va l'argent, lignes suivables", async () => {
    mount("/money/funder/ec");
    await screen.findAllByRole("heading", { name: "European Commission" });
    expect(screen.getAllByText(/Where do these .* go next\?/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Follow the funding to/).length).toBeGreaterThan(0);
  });

  it("méthodologie : panneau à la demande, accessible, refermable", async () => {
    mount("/money/project/1");
    await screen.findAllByRole("heading", { name: "BIO-QED" });
    fireEvent.click(screen.getAllByRole("button", { name: /Methodology & sources/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Methodology & sources" });
    expect(dialog.textContent).toContain("cordis-fp7");
    expect(dialog.textContent).toContain("common-ancestor rule");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dépassement de plafond : lecture comptable signée, jamais un 100 % empilé", async () => {
    mount("/money/project/4");
    await screen.findAllByRole("heading", { name: "EUROfusion" });
    expect(screen.getAllByText(/exceed the project ceiling/).length).toBeGreaterThan(0);
    // Plafond / Somme des parts / Écart signé — aucune barre.
    expect(screen.getAllByText("Project ceiling").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gap").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+€115.1M").length).toBeGreaterThan(0);
  });

  it("gap : le pourcentage non ventilé est dit, la part du projet est libellée", async () => {
    mount("/money/project/1");
    await screen.findAllByRole("heading", { name: "BIO-QED" });
    expect(
      screen.getAllByText(/43\.8\s?% of the amount is not broken down/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/10\.7\s?% of the observed EU contributions of CALL-X/).length,
    ).toBeGreaterThan(0);
  });
});
