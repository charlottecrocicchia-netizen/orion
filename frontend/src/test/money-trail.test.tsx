/** B2 — la surface « Où est passé cet argent ? » contre des réponses
 *  B1 fidèles aux golds : réconciliation `gap`, part inconnue ≠ 0,
 *  bénéficiaire NIH sans fausse ventilation, axe annuel NSF déclaré
 *  incompatible, organisation sans total unique, profondeur d'URL
 *  reproductible, EN/FR. */

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
  "/api/chain/project/4": {
    ancestors: [
      { level: "funder", id: "ec", label: "European Commission" },
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
      {
        level: "funder",
        id: "ec",
        label: "European Commission",
        amount: 176e9,
        currency: "EUR",
        share_of_parent: null,
        comparability: null,
      },
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

describe("money trail (B2)", () => {
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
  });

  it("URL profonde CORDIS : fil d'ancêtres réel, gap dit, inconnu ≠ 0", async () => {
    mount("/money/project/1");
    expect(await screen.findByRole("heading", { name: "BIO-QED" })).toBeTruthy();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs.textContent).toContain("Horizon Europe");
    expect(crumbs.textContent).toContain("CALL-X");
    // La mesure est nommée, avec sa nature.
    expect(screen.getAllByText("EU maximum contribution (grant agreement)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("source fact").length).toBeGreaterThan(0);
    // Réconciliation : un gap est une propriété des données, pas une erreur.
    expect(screen.getByText(/do not cover the whole project total/)).toBeTruthy();
    expect(screen.getByText("Not broken down")).toBeTruthy();
    // La part ITACONIX est inconnue — jamais « €0 ».
    const row = screen.getByText("Itaconix corporation").closest("div.border-b");
    expect(row?.textContent).toContain("unknown");
    expect(row?.textContent).not.toContain("€0");
    // total_cost = 0 source → non disponible (D7).
    expect(screen.getByText("not available")).toBeTruthy();
  });

  it("NIH : bénéficiaire, jamais une ventilation ; pas d'étage appel", async () => {
    mount("/money/project/2");
    expect(await screen.findByRole("heading", { name: "Rabies therapeutics" })).toBeTruthy();
    expect(screen.getByText(/identifies the beneficiary/)).toBeTruthy();
    expect(screen.getByText(/beneficiary marker, not a financial breakdown/)).toBeTruthy();
    // Pas de colonne montant côté bénéficiaire.
    expect(screen.queryByRole("columnheader", { name: "Amount" })).toBeNull();
    // Le fil ne contient aucun étage appel.
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs.textContent).not.toContain("CALL");
    // L'absence d'appels est dite, pas devinée.
    expect(screen.getByText(/skips it rather than inventing it/)).toBeTruthy();
  });

  it("NSF : l'axe annuel est un second système, déclaré incompatible", async () => {
    mount("/money/project/3");
    expect(await screen.findByRole("heading", { name: "BEACON" })).toBeTruthy();
    expect(screen.getByText(/never added, never interchanged/)).toBeTruthy();
    expect(screen.getByText(/not a decomposition of one another/)).toBeTruthy();
    expect(screen.getByText("$45.5M")).toBeTruthy();
    expect(screen.getAllByText("$48M").length).toBeGreaterThan(0);
    expect(screen.getByText(/vintage 2026-08-26/)).toBeTruthy();
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
    expect((await screen.findAllByText("Contribution maximale UE (convention de subvention)")).length).toBeGreaterThan(0);
    expect(screen.getByText("Non ventilé")).toBeTruthy();
    expect(screen.getByText(/pas une erreur/)).toBeTruthy();
  });

  it("rail : la chaîne est matérialisée, ancêtres cliquables, nœud actif", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED" });
    const rails = screen.getAllByRole("navigation", { name: "Trail" });
    expect(rails.length).toBeGreaterThan(0);
    const rail = rails[0];
    // Les ancêtres sont des liens vers leur vue.
    const links = Array.from(rail.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/money/funder/ec");
    expect(links).toContain("/money/programme/10");
    expect(links).toContain("/money/call/20");
    // Le nœud courant est marqué actif, pas un lien.
    const active = rail.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("BIO-QED");
  });

  it("rail NIH : l'étage appel sauté ne casse pas le parcours", async () => {
    mount("/money/project/2");
    await screen.findByRole("heading", { name: "Rabies therapeutics" });
    const rail = screen.getAllByRole("navigation", { name: "Trail" })[0];
    const text = rail.textContent ?? "";
    expect(text).toContain("NIH (RePORTER)");
    expect(text).toContain("NIAID");
    expect(text).not.toContain("Call");
  });

  it("racine : trois portes d'entrée, mesure courte, sans total commun", async () => {
    mount("/money");
    await screen.findByRole("heading", { name: "Where did this money go?" });
    expect(screen.getAllByText("Explore").length).toBe(2);
    expect(screen.getAllByText("EU maximum contribution (observed sum)").length).toBeGreaterThan(0);
    expect(screen.getByText("No single total.")).toBeTruthy();
  });

  it("longue liste : top 12 par défaut, dépli dans l'URL", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission" });
    // 12 visibles sur 14, bouton de dépli.
    expect(screen.getByText("Programme 0")).toBeTruthy();
    expect(screen.queryByText("Programme 13")).toBeNull();
    const more = screen.getByRole("button", { name: "Show the 2 others" });
    fireEvent.click(more);
    expect(await screen.findByText("Programme 13")).toBeTruthy();
    // Et l'état est dans l'URL (rejouable) : remonter au top 12.
    expect(screen.getByRole("button", { name: "Back to top 12" })).toBeTruthy();
  });

  it("méthodologie : panneau à la demande, accessible, refermable", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED" });
    fireEvent.click(screen.getAllByRole("button", { name: /Methodology & sources/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Methodology & sources" });
    expect(dialog.textContent).toContain("cordis-fp7");
    expect(dialog.textContent).toContain("common-ancestor rule");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("dépassement de plafond : deux barres comparatives, jamais un 100 % empilé", async () => {
    mount("/money/project/4");
    await screen.findByRole("heading", { name: "EUROfusion" });
    expect(screen.getAllByText(/exceed the project ceiling/).length).toBeGreaterThan(0);
    // Lecture comptable : Plafond / Somme des parts / Écart signé —
    // aucune barre, aucune conservation suggérée.
    expect(screen.getByText("Project ceiling")).toBeTruthy();
    expect(screen.getByText("Gap")).toBeTruthy();
    expect(screen.getByText("+€115.1M")).toBeTruthy();
  });

  it("trace : le deep-link porte montants et parts servis par le moteur", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED" });
    const rail = screen.getAllByRole("navigation", { name: "Trail" })[0];
    const text = rail.textContent ?? "";
    // Montants d'ancêtres SANS navigation préalable ni cache.
    expect(text).toContain("€176B");
    expect(text).toContain("€62B");
    // Part du parent sur les relations valides…
    expect(text).toContain("35.2");
    // …et RIEN sur l'appel transversal (liaison structurelle seule) :
    // exactement deux relations chiffrées (HORIZON et Énergie).
    expect((text.match(/↓/g) ?? []).length).toBe(2);
  });

  it("hero : la part du parent est libellée, la question est posée", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission" });
    expect(screen.getByText(/Where do these .* go next\?/)).toBeTruthy();
    expect(screen.getByText(/12 main destinations out of 14/)).toBeTruthy();
    expect(screen.getByText(/the top 12 account for/)).toBeTruthy();
    // Ligne de destination : label accessible « suivre le financement ».
    expect(screen.getAllByText(/Follow the funding to/).length).toBeGreaterThan(0);
  });

  it("gap : le pourcentage non ventilé est dit en toutes lettres", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED" });
    expect(screen.getByText(/43\.8\s?% of the amount is not broken down/)).toBeTruthy();
    // Et la part du projet dans son appel, libellée dans le hero.
    expect(screen.getByText(/10\.7\s?% of the observed EU contributions of CALL-X/)).toBeTruthy();
  });
});
