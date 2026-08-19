import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

import { AppRoutes } from "../App";

/** M1.3 — le hero est GÉNÉRIQUE : il raconte la lentille de rang 1 du
 *  registre, ses chiffres et ses mots. Ici la vedette n'est PAS
 *  l'espace : les composants doivent afficher un autre nom et d'autres
 *  métriques sans une seule condition sur « space ». (La lentille de ce
 *  test est synthétique — elle ne vit ni en curation ni en production.) */

const LEAD = {
  slug: "test-lens",
  family_key: "zz_seed_family",
  rank: 1,
  last_run_at: null,
  rules: { total: 0, programme: 0, theme: 0, text: 0 },
  core: 40,
  enabling: 2,
  core_funding_eur: 1e9,
  funding_eur: 7.7e9,
  organisations: 314,
  groups: 9,
  by_year: [
    { year: 2018, amount_eur: 1e9 },
    { year: 2022, amount_eur: 2e9 },
  ],
};

const STATS = {
  totals: {
    projects: 119172,
    organisations: 103457,
    participations: 581006,
    funding_eur: 211e9,
    countries: 170,
  },
  funding_by_year: [{ year: 2023, amount_eur: 18.3e9 }],
  lenses: [LEAD],
  overlap_projects: 0,
};

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
        ? { series: [], meta: {} }
        : path.includes("/api/countries")
          ? []
          : STATS;
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );
});

test("le hero raconte la lentille vedette, quelle qu'elle soit", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  // Ses chiffres : le grand total de LA lentille, et ses 42 projets
  // (cœur + habilitant) — jamais ceux du corpus.
  expect(await screen.findByText("€8B")).toBeInTheDocument();
  expect(await screen.findByText("42")).toBeInTheDocument();
  // Ses mots : sans curation, les motifs génériques la NOMMENT — jamais
  // une clé nue, jamais le mot « space ».
  expect(screen.getByText("test-lens projects")).toBeInTheDocument();
  expect(screen.getByText(/public test-lens funding/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Explore test-lens/ })).toBeInTheDocument();
});
