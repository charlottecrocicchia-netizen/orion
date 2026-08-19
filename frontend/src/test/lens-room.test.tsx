import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import "../i18n";
import { LensRoomPage } from "../pages/lens-room";

/** La Lens Room (2026-08-19) : deux objets réels servis par le
 *  registre publié, l'identité composée ORION / <LENTILLE> qui suit le
 *  focus, le focus dans l'URL (chaque état reproductible), et la règle
 *  de la carte — premier clic sélectionne, second descend. */

const LENS = (slug: string, rank: number, core: number, enabling: number) => ({
  slug,
  family_key: "aerospace_mobility",
  rank,
  version: 1,
  changelog: [],
  last_run_at: null,
  rules: { total: 0, programme: 0, theme: 0, text: 0 },
  core,
  enabling,
  core_funding_eur: 1e9,
  funding_eur: 2.5e9,
  organisations: 10,
  groups: 1,
  by_year: [],
});

const STATS = {
  totals: { projects: 1, organisations: 1, participations: 1, funding_eur: 1, countries: 1 },
  funding_by_year: [],
  // Le registre publié : space, aviation — et une lentille synthétique
  // SANS glyphe, qui ne doit pas apparaître dans la salle.
  lenses: [LENS("space", 1, 40, 2), LENS("aviation", 2, 30, 0), LENS("test-lens", 99, 1, 1)],
  overlap_projects: 0,
};

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => STATS })) as unknown as
      typeof fetch,
  );
});

function mount(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/lenses" element={<LensRoomPage />} />
          <Route path="/explore" element={<p>EXPLORER CADRÉ</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test("deux objets réels, jamais une lentille sans glyphe", async () => {
  mount("/lenses");
  expect(await screen.findByRole("button", { name: /Space/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Aviation/ })).toBeInTheDocument();
  // La synthétique est publiée mais n'a pas d'objet : absente (règle ④).
  expect(screen.queryByText(/test-lens/)).toBeNull();
  // Les chiffres sont RÉELS : 42 pour space (cœur + habilitant), 30
  // pour aviation — servis par le registre, jamais écrits en dur.
  expect(screen.getByText(/42/)).toBeInTheDocument();
  expect(screen.getByText(/30/)).toBeInTheDocument();
});

test("le focus vit dans l'URL et bascule l'identité composée", async () => {
  mount("/lenses?focus=space");
  // ORION / SPACE — le second terme est là, en capitales.
  expect(await screen.findByText("SPACE")).toBeInTheDocument();
  // Le premier clic sur l'AUTRE objet déplace le focus.
  fireEvent.click(screen.getByRole("button", { name: /Aviation/ }));
  expect(await screen.findByText("AVIATION")).toBeInTheDocument();
  expect(screen.queryByText("SPACE")).toBeNull();
});

test("la règle de la carte : le second clic descend vers l'explorateur cadré", async () => {
  mount("/lenses?focus=space");
  const space = await screen.findByRole("button", { name: /Space/ });
  // L'objet focalisé porte aria-pressed, et son second clic NAVIGUE.
  expect(space).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(space);
  expect(await screen.findByText("EXPLORER CADRÉ")).toBeInTheDocument();
});
