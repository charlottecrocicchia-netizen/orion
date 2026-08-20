import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi, afterEach } from "vitest";

import { AppRoutes } from "../App";

const STATS = {
  totals: {
    projects: 119172,
    organisations: 103457,
    participations: 581006,
    funding_eur: 211e9,
    countries: 170,
  },
  funding_by_year: [
    { year: 2005, amount_eur: 0.2e9 },
    { year: 2023, amount_eur: 18.3e9 },
    { year: 2027, amount_eur: 0.9e9 },
  ],
  // Le registre publié — ce que l'API sert vraiment depuis M0.
  lenses: [
    {
      slug: "space",
      family_key: "aerospace_mobility",
      rank: 1,
      core: 812,
      enabling: 2140,
      core_funding_eur: 3.1e9,
      funding_eur: 5.2e9,
      organisations: 1450,
      groups: 21,
      by_year: [
        { year: 2019, amount_eur: 1.1e9 },
        { year: 2024, amount_eur: 2.3e9 },
      ],
    },
  ],
};

const SEARCH = {
  total: 1234,
  results: [
    {
      id: 1,
      acronym: "H2FUTURE",
      title: "Green hydrogen at scale",
      source: "cordis-horizon",
      funding_amount_eur: 12e6,
      start_year: 2023,
      end_year: 2026,
      programme_root: "Horizon Europe",
      programme_root_id: 1,
      participations_count: 8,
      countries: ["FR", "DE"],
      snippet: "…green <b>hydrogen</b> electrolysis…",
    },
  ],
  facets: {
    funders: [{ code: "EC", label: "European Commission", count: 1200 }],
    programmes: [{ id: 1, code: "HORIZON", label: "Horizon Europe", count: 900 }],
    countries: [{ code: "FR", count: 400 }],
    years: [],
  },
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const EXPLORE = {
  metric: "funding",
  by: "country",
  split: true,
  unit: "eur",
  basis: "participants",
  series: [
    {
      key: "FR",
      label: "France",
      points: [
        { year: 2021, value: 1.8e9 },
        { year: 2023, value: 2.77e9 },
      ],
    },
    {
      key: "DE",
      label: "Germany",
      points: [
        { year: 2021, value: 1.7e9 },
        { year: 2023, value: 2.47e9 },
      ],
    },
  ],
  total: null,
  meta: { limit: 5, compare: null, q: null, country: null },
};

const COUNTRIES = [
  { code: "FR", name: "France", eu_member: true, projects_count: 55973, funding_eur: 32.4e9 },
];

afterEach(cleanup);

beforeEach(() => {
  // Révision D4 (2026-08-20) : la racine nue passe par la porte. Ces
  // tests regardent la HOME — on simule un visiteur qui a déjà choisi
  // le corpus entier.
  window.localStorage.setItem("orion.lens.entry", "all");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      const body = path.includes("/api/explore/aggregate")
        ? EXPLORE
        : path.includes("/api/countries")
          ? COUNTRIES
          : path.includes("/api/search/projects")
            ? SEARCH
            : STATS;
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );
});

test("home leads with the hero, acts follow below", async () => {
  // ⓪ (2026-08-20) : la vitrine spatiale vit sur la home CADRÉE — la
  // home nue, elle, raconte le corpus (testée plus bas).
  renderAt("/?sector=space");

  // Header nav: the four intents (the dense footer repeats the product
  // links; page links live inside the disclosure panels).
  const banner = within(screen.getByRole("banner"));
  for (const intent of ["Discover", "Analyse", "Build", "Workspace"]) {
    expect(banner.getByRole("button", { name: intent })).toBeInTheDocument();
  }
  // Act 1 — the hero is SPATIAL (lot 2, 2026-08-17): the big figure is
  // the lens total and its phrase says the perimeter; the general corpus
  // becomes the quiet line below (jsdom: reduced motion → final state).
  expect(await screen.findByText("€5B")).toBeInTheDocument();
  expect(screen.getByText(/direct \+ enabling/)).toBeInTheDocument();
  expect(await screen.findByText("2,952")).toBeInTheDocument();
  expect(screen.getByText("space projects")).toBeInTheDocument();
  expect(screen.getByText("industrial groups")).toBeInTheDocument();
  expect(screen.getByText(/Backed by a corpus/)).toBeInTheDocument();
  // Act 2 — the ink tile: the question and the three editorial entries.
  expect(
    screen.getByRole("heading", { name: "What are you looking for?" }),
  ).toBeInTheDocument();
  // Lot D: the doors say the verbs, with living content behind them.
  expect(screen.getByRole("link", { name: /Discover/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Analyse.*space money/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Build/ })).toBeInTheDocument();
  expect(screen.getByText(/alerts and follows/)).toBeInTheDocument();
  expect(screen.getByText("Phase 5 · autumn 2026")).toBeInTheDocument();
  // Act 3 — the proof: the staged globe.
  expect(screen.getByRole("heading", { name: "The world of funding" })).toBeInTheDocument();
});

test("the explorer composes a view and renders its chart and table", async () => {
  renderAt("/explore");

  expect(await screen.findByRole("button", { name: "Show" })).toHaveTextContent("funding");
  expect(await screen.findByText("participants' share")).toBeInTheDocument();
  const chart = await screen.findByRole("img", { name: /funding · country/ });
  expect(chart.tagName.toLowerCase()).toBe("svg");
  // The ready-made analyses moved to their library; the renvoi stays.
  expect(
    screen.getByRole("link", { name: /Ready-made analyses — the library/ }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Table" }));
  expect(await screen.findByRole("columnheader", { name: "France" })).toBeInTheDocument();
  expect(screen.getAllByText("€2.8B").length).toBeGreaterThan(0);
});

test("projects search renders results, count and facets", async () => {
  renderAt("/projects?q=hydrogen");

  expect(await screen.findByText("1,234 results")).toBeInTheDocument();
  expect(screen.getByText("Green hydrogen at scale")).toBeInTheDocument();
  expect(screen.getByText(/European Commission/)).toBeInTheDocument();
  expect(screen.getByText(/searched in English & French/)).toBeInTheDocument();
});

test("⓪ la home NUE raconte le corpus — aucun monde par défaut", async () => {
  renderAt("/");
  // Le grand chiffre est celui du CORPUS (211 Md€ du mock), le CTA dit
  // « The whole corpus », et rien ne parle d'un monde particulier.
  expect(await screen.findByText("€211B")).toBeInTheDocument();
  // (le CTA du hero — le socle en a un second : les deux disent le corpus)
  expect(screen.getAllByRole("link", { name: /The whole corpus/ }).length).toBeGreaterThan(0);
  expect(screen.queryByText("space projects")).toBeNull();
});
