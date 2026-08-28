/** B2.7 — la Constellation Trace contre des réponses B1 fidèles aux
 *  golds : le chemin committé devient une constellation (nœuds HTML
 *  stables + liens SVG), au zoom sémantique réel (focus détaillé,
 *  parent nom+montant+part, ancêtre ancien nom+montant seuls) ; un
 *  clic sur un nœud ancêtre RÉVÈLE ses bifurcations (previews hors du
 *  chemin committé) — « ↩ » remonte, une alternative change de
 *  branche via le moteur b5d4831. Deep-link ≡ descente (UNE requête),
 *  réponses obsolètes ignorées, Back/Forward recomposés, inconnu ≠ 0,
 *  transversal sans ratio, NIH/NSF sans faux niveau, transverse
 *  multi-provenance, EN/FR.
 *
 *  Le mouvement est pur CSS (transitions transform/d + dash des
 *  liens), tué par prefers-reduced-motion — le harnais le simule
 *  actif : les tests vérifient les états finaux et l'absence de toute
 *  couche sortante résiduelle. */

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
      total: 2,
      items: [
        { level: "project", id: 1, label: "BIO-QED", amount: 5335158.39 },
        { level: "project", id: 5, label: "OTHER", amount: 2e6 },
      ],
      coverage: { with_amount: 2, unknown_amount: 0 },
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
/** Les nœuds du chemin committé, dans l'ordre racine → focus. */
function cnodes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-cnode]"));
}

function activeLinks(): Element[] {
  return Array.from(document.querySelectorAll('[data-clink="active"]'));
}

function previews(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-cpreview]"));
}

describe("money trail (B2.7)", () => {
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
    // Aucune constellation tant qu'aucun financeur n'est choisi.
    expect(cnodes()).toHaveLength(0);
  });

  it("profondeur 1 : un seul nœud focus, aucun lien", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    expect(cnodes()).toHaveLength(1);
    expect(activeLinks()).toHaveLength(0);
    const focus = cnodes()[0];
    expect(focus.dataset.distance).toBe("0");
    expect(focus.querySelector('[aria-current="true"]')).toBeTruthy();
    // Le mouvement est pur CSS (transition de transform sur le nœud
    // stable), tué par prefers-reduced-motion : état final instantané.
    expect(focus.className).toContain("const-node");
  });

  it("profondeur 2 : parent compact interactif + focus dominant", async () => {
    mount("/money/programme/10");
    await screen.findByRole("heading", { name: "Horizon Europe", level: 1 });
    expect(cnodes()).toHaveLength(2);
    expect(activeLinks()).toHaveLength(1);
    const parent = cnodes()[0];
    expect(parent.dataset.distance).toBe("1");
    // Le nœud ancêtre est un vrai bouton de bifurcation, au libellé
    // complet (nom, montant, position dans la trace).
    const button = parent.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(button?.getAttribute("aria-label")).toContain("European Commission");
    expect(button?.getAttribute("aria-label")).toContain("step 1 of 2");
    expect(parent.textContent).toContain("European Commission");
    expect(parent.textContent).toContain("€176B");
    // La part du focus est libellée dans le focus.
    expect(
      screen.getByText(/35\.2\s?% of the observed EU contributions of European Commission/),
    ).toBeTruthy();
    // LA question du niveau, juste avant les destinations.
    expect(screen.getByText("Where does this money go next?")).toBeTruthy();
  });

  it("profondeur 5 : ancêtres compressés, parts valides seules, focus dominant", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    expect(cnodes()).toHaveLength(5);
    expect(activeLinks()).toHaveLength(4);
    const all = cnodes();
    // Positions déterministes, strictement croissantes vers le focus.
    const xs = all.map((el) => Number(/translate\((\d+(?:\.\d+)?)px/.exec(el.style.transform)?.[1]));
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    // Zoom sémantique : un ancêtre ancien dit nom + montant, RIEN de
    // plus — sa part (pourtant servie) n'apparaît pas.
    expect(all[1].textContent).toContain("Horizon Europe");
    expect(all[1].textContent).toContain("€62B");
    expect(all[1].textContent).not.toContain("35.2");
    expect(all[0].textContent).toContain("€176B");
    // Le parent immédiat est un appel transversal : liaison
    // structurelle affichée, JAMAIS un ratio inventé.
    expect(all[3].dataset.cnode).toBe("call");
    expect(all[3].dataset.distance).toBe("1");
    expect(all[3].textContent).toContain("Cross-cutting call");
    expect(all[3].textContent).not.toContain("%");
    // Le focus porte sa part libellée.
    expect(
      screen.getByText(/10\.7\s?% of the observed EU contributions of CALL-X/),
    ).toBeTruthy();
  });

  it("clic destination : la répartition se redistribue, l'étape rejoint le contexte", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    expect(cnodes()).toHaveLength(1);
    fireEvent.click(screen.getByText("Programme 0").closest("a")!);
    expect(await screen.findByRole("heading", { name: "Programme 0", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(2);
    expect(activeLinks()).toHaveLength(1);
    expect(cnodes()[0].textContent).toContain("European Commission");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // Reduced-motion (actif dans le harnais) : aucune couche sortante
    // résiduelle, jamais de nœud fantôme.
    expect(document.querySelector("[data-cexit]")).toBeNull();
  });

  it("bifurcations : un clic ancêtre révèle, ↩ remonte, une alternative change de branche", async () => {
    mount("/money/project/1");
    await screen.findByRole("heading", { name: "BIO-QED", level: 1 });
    expect(cnodes()).toHaveLength(5);
    // Révélation : le clic sur HORIZON ouvre ses bifurcations — le
    // chemin committé ne bouge PAS.
    const horizonButton = cnodes()[1].querySelector("button");
    expect(horizonButton).toBeTruthy();
    fireEvent.click(horizonButton!);
    await screen.findByTitle(/Back to Horizon Europe/);
    // self « ↩ » + les alternatives (l'enfant committé Énergie est exclu).
    expect(previews().length).toBeGreaterThan(1);
    expect(previews()[0].dataset.cpreview).toBe("self");
    const previewText = previews().map((el) => el.textContent).join(" ");
    expect(previewText).toContain("Actions Marie Curie");
    expect(previewText).not.toContain("Énergie");
    // Preview ≠ commit : focus et chemin inchangés.
    expect(screen.getByRole("heading", { name: "BIO-QED", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(5);
    // Escape referme la révélation.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(previews()).toHaveLength(0);
    // « ↩ » remonte au niveau : l'écran se recompose autour de lui.
    fireEvent.click(cnodes()[1].querySelector("button")!);
    const self = await screen.findByTitle(/Back to Horizon Europe/);
    fireEvent.click(self);
    expect(await screen.findByRole("heading", { name: "Horizon Europe", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(2);
    expect(document.body.textContent).not.toContain("CALL-X");
    expect(screen.queryByRole("heading", { name: "BIO-QED", level: 1 })).toBeNull();
    // Et une NOUVELLE branche s'ouvre depuis ce niveau.
    fireEvent.click(screen.getByText("Énergie").closest("a")!);
    expect(await screen.findByRole("heading", { name: "Énergie", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(3);
    expect(cnodes()[1].textContent).toContain("Horizon Europe");
    expect(document.querySelector("[data-cexit]")).toBeNull();
  });

  it("appel transversal : liaison structurelle, jamais un ratio invalide", async () => {
    mount("/money/call/20");
    await screen.findByRole("heading", { name: "CALL-X", level: 1 });
    expect(screen.getByText(/Cross-cutting call — no per-programme ratio/)).toBeTruthy();
    // Aucun share_of_parent servi → aucune ligne de part.
    expect(screen.queryByText(/% of the observed EU contributions of/)).toBeNull();
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

  it("NIH : bénéficiaire, jamais une ventilation ; aucune région appel", async () => {
    mount("/money/project/2");
    expect(
      await screen.findByRole("heading", { name: "Rabies therapeutics", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText(/identifies the beneficiary/)).toBeTruthy();
    expect(screen.getByText(/beneficiary marker, not a financial breakdown/)).toBeTruthy();
    expect(cnodes().map((r) => r.dataset.cnode)).toEqual(["funder", "programme", "project"]);
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
    expect(screen.queryByText("Project contribution")).toBeNull();
    expect(screen.queryByText("Participants with unknown share")).toBeNull();
    expect(cnodes().map((r) => r.dataset.cnode)).toEqual(["funder", "programme", "project"]);
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
    // Pas de chemin descendant forcé — mais la constellation
    // multi-provenance : deux branches financeurs convergent.
    expect(cnodes()).toHaveLength(0);
    const provenance = screen.getByRole("navigation", { name: "Funding relations" });
    const hrefs = Array.from(provenance.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/money/funder/ec");
    expect(hrefs).toContain("/money/funder/nsf");
    expect(provenance.querySelector('[aria-current="true"]')?.textContent).toContain(
      "Itaconix corporation",
    );
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
    cleanup();
    mount("/money/programme/10");
    await screen.findByRole("heading", { name: "Horizon Europe", level: 1 });
    expect(screen.getByText("Où va ensuite cet argent ?")).toBeTruthy();
  });

  it("réponse réseau obsolète : clic A → clic B → réponse A après B → B reste le focus", async () => {
    // §E de l'addendum B2.7 — invariant permanent, quelle que soit la
    // composition : une réponse en retard n'écrase jamais une
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
    fireEvent.click(screen.getByText("Programme 0").closest("a")!);
    expect(screen.getByRole("heading", { name: "European Commission", level: 1 })).toBeTruthy();
    // Clic B : il répond immédiatement et prend le focus.
    fireEvent.click(screen.getByText("Programme 1").closest("a")!);
    expect(await screen.findByRole("heading", { name: "Programme 1", level: 1 })).toBeTruthy();
    // La réponse de A arrive APRÈS : elle ne doit rien écraser.
    releaseA!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("heading", { name: "Programme 1", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Programme 0", level: 1 })).toBeNull();
  });

  it("navigation Back/Forward : la pile se recompose sans fantôme", async () => {
    mount("/money/funder/ec");
    await screen.findByRole("heading", { name: "European Commission", level: 1 });
    fireEvent.click(screen.getByText("Programme 0").closest("a")!);
    await screen.findByRole("heading", { name: "Programme 0", level: 1 });
    expect(cnodes()).toHaveLength(2);
    // Back : le financeur reprend le focus, la constellation se
    // recompose par la même logique de LCP — pas un remplacement.
    fireEvent.click(screen.getByRole("button", { name: "test-back" }));
    expect(await screen.findByRole("heading", { name: "European Commission", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Programme 0", level: 1 })).toBeNull();
    // Forward : recomposition identique.
    fireEvent.click(screen.getByRole("button", { name: "test-forward" }));
    expect(await screen.findByRole("heading", { name: "Programme 0", level: 1 })).toBeTruthy();
    expect(cnodes()).toHaveLength(2);
    expect(cnodes()[0].textContent).toContain("European Commission");
    expect(document.querySelector("[data-cexit]")).toBeNull();
  });
});
