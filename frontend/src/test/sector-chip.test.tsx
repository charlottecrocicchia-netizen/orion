import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Le composant parle par i18n : sans l'init, les clés sortent nues.
import "../i18n";
import { SectorChip } from "../components/sector-chip";

/** La règle de l'entrée unique (2026-08-19, générique à toutes les
 *  lentilles) : une lentille sans AUCUN projet habilitant n'offre au
 *  menu que son nom nu — on ne montre jamais une capacité vide parce
 *  que l'architecture sait la gérer. Les deux entrées (« direct » /
 *  « + habilitant ») réapparaissent d'elles-mêmes au premier projet
 *  habilitant, et `sector=<slug>-direct` reste une URL valide dans
 *  tous les cas : le contrat ne change pas, seul l'affichage suit le
 *  contenu. */

const LENS = (slug: string, rank: number, enabling: number) => ({
  slug,
  family_key: "zz_seed_family",
  rank,
  version: 1,
  changelog: [],
  last_run_at: null,
  rules: { total: 0, programme: 0, theme: 0, text: 0 },
  core: 40,
  enabling,
  core_funding_eur: 1e9,
  funding_eur: 1e9,
  organisations: 10,
  groups: 1,
  by_year: [],
});

const STATS = {
  totals: { projects: 1, organisations: 1, participations: 1, funding_eur: 1, countries: 1 },
  funding_by_year: [],
  // Aviation ne porte AUCUN habilitant ; test-lens en porte.
  lenses: [LENS("aviation", 1, 0), LENS("test-lens", 2, 2)],
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

function mount(sector: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SectorChip sector={sector} onChange={() => {}} />
    </QueryClientProvider>,
  );
}

test("une lentille sans habilitant n'offre qu'une entrée, son nom nu", async () => {
  mount("aviation");
  // Le bouton actif dit le nom nu — jamais « + habilitant » pour une
  // capacité vide. (Son aria-label est le chipLabel générique : on le
  // trouve par son TEXTE.)
  const label = await screen.findByText("Aviation");
  const button = label.closest("button")!;
  // Ni « direct » ni « + habilitant » : le nom nu, rien d'autre.
  expect(button.textContent).not.toMatch(/direct|\+/);
  fireEvent.click(button);
  // Aviation : UNE entrée, au nom nu.
  const single = await screen.findByRole("menuitemradio", { name: /^Aviation$/ });
  expect(single).toBeInTheDocument();
  expect(screen.queryByRole("menuitemradio", { name: /Aviation direct/ })).toBeNull();
  expect(screen.queryByRole("menuitemradio", { name: /Aviation \+/ })).toBeNull();
  // test-lens, elle, garde ses DEUX entrées : le premier habilitant a
  // suffi à les faire apparaître.
  expect(screen.getByRole("menuitemradio", { name: /test-lens direct/i })).toBeInTheDocument();
  expect(screen.getByRole("menuitemradio", { name: /test-lens \+/i })).toBeInTheDocument();
});

test("sector=<slug>-direct reste une URL valide — l'affichage seul suit le contenu", async () => {
  mount("aviation-direct");
  // L'URL au suffixe -direct est comprise ; le bouton dit le nom nu.
  const label = await screen.findByText("Aviation");
  fireEvent.click(label.closest("button")!);
  // L'entrée unique est bien COCHÉE pour cette forme d'URL aussi.
  const single = await screen.findByRole("menuitemradio", { name: /^Aviation$/ });
  expect(single).toHaveAttribute("aria-checked", "true");
});
