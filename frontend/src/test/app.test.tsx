import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

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

beforeEach(() => {
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

test("home is an orientation hall: the question, the doors, the context line", async () => {
  renderAt("/");

  expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "What are you looking for?" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Explore a theme/ })).toBeInTheDocument();
  expect(screen.getByText("See open calls")).toBeInTheDocument();
  expect(screen.getByText("Phase 5 · autumn 2026")).toBeInTheDocument();
  expect(await screen.findByText("€211B")).toBeInTheDocument();
  expect(await screen.findByText("119,172")).toBeInTheDocument();
});

test("the explorer composes a view and renders its chart and table", async () => {
  renderAt("/explore");

  expect(await screen.findByRole("button", { name: "Show" })).toHaveTextContent("funding");
  expect(await screen.findByText("participants' share")).toBeInTheDocument();
  const chart = await screen.findByRole("img", { name: /funding · country/ });
  expect(chart.tagName.toLowerCase()).toBe("svg");
  expect(screen.getByText("Where does hydrogen money go?")).toBeInTheDocument();

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
