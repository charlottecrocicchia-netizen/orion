import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import "../i18n";
import { LensRoomPage } from "../pages/lens-room";

/** La scène optique (feu vert 2026-08-20) : la salle est la PORTE.
 *  Un clic ENTRE — la mémoire s'écrit (raccourci de racine seulement),
 *  la navigation part vers la vraie home cadrée. Le focus intermédiaire
 *  du premier jet a disparu avec l'arbitrage ③. */

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
  totals: { projects: 699798, organisations: 1, participations: 1, funding_eur: 1, countries: 1 },
  funding_by_year: [],
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

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/lenses"]}>
        <Routes>
          <Route path="/lenses" element={<LensRoomPage />} />
          <Route path="/" element={<p>HOME RÉELLE</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test("trois objets réels — les deux mondes dessinés, et le corpus entier de plein droit", async () => {
  mount();
  expect(await screen.findByRole("button", { name: /Space/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Aviation/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /whole corpus/ })).toBeInTheDocument();
  // Jamais une lentille sans glyphe (la synthétique de la graine).
  expect(screen.queryByText(/test-lens/)).toBeNull();
  // Les chiffres du corpus sont SERVIS : 699 798 vient du mock, pas du code.
  expect(await screen.findByText(/699[,\u202f\u00a0 ]?798/)).toBeInTheDocument();
});

test("un clic ENTRE : la mémoire s'écrit, la vraie home cadrée rend", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: /Aviation/ }));
  expect(window.localStorage.getItem("orion.lens.entry")).toBe("aviation");
  // La navigation est partie vers la home réelle (ici sa doublure de route).
  expect(await screen.findByText("HOME RÉELLE")).toBeInTheDocument();
});

test("« Toute la R&D » mémorise le choix du corpus entier", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: /whole corpus/ }));
  expect(window.localStorage.getItem("orion.lens.entry")).toBe("all");
  expect(await screen.findByText("HOME RÉELLE")).toBeInTheDocument();
});
