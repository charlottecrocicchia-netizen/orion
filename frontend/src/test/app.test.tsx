import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).includes("/api/search/projects") ? SEARCH : STATS),
    })) as unknown as typeof fetch,
  );
});

test("home renders nav and the animated hero fed by /api/stats", async () => {
  renderAt("/");

  expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Organisations" })).toBeInTheDocument();
  expect(await screen.findByText("€211B")).toBeInTheDocument();
  expect(await screen.findByText("119,172")).toBeInTheDocument();
  expect(screen.getByText("funded projects")).toBeInTheDocument();
});

test("projects search renders results, count and facets", async () => {
  renderAt("/projects?q=hydrogen");

  expect(await screen.findByText("1,234 results")).toBeInTheDocument();
  expect(screen.getByText("Green hydrogen at scale")).toBeInTheDocument();
  expect(screen.getByText(/European Commission/)).toBeInTheDocument();
  expect(screen.getByText(/searched in English & French/)).toBeInTheDocument();
});
