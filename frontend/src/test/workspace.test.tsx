/** B2.4 — la route-outil : sur `/money` le Layout ne rend pas le
 *  footer éditorial (la surface est un outil qui tient dans la
 *  fenêtre) ; partout ailleurs le footer demeure. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import i18n from "i18next";

import { AppRoutes } from "../App";
import { isWorkspaceRoute } from "@/lib/workspace";

const ME = {
  email: "suite@orion.test",
  display_name: null,
  workspaces: [{ id: 1, name: "suite@orion.test", role: "owner" }],
};

const FUNDERS = {
  funders: [
    {
      level: "funder",
      id: "ec",
      label: "European Commission",
      aggregate: {
        measure: {
          key: "ec_max_contribution_sum",
          accounting_nature: "commitment_ceiling",
          provenance: "derived",
          currency: "EUR",
        },
        amount: 176e9,
        projects: 84452,
        coverage: { with_amount: 84452, unknown_amount: 0 },
        amount_eur_observed: { amount: 176e9, provenance: "derived", currency: "EUR" },
      },
    },
  ],
  cross_funder_total: { available: false, reason: "x" },
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

describe("workspace routes (B2.4)", () => {
  beforeEach(() => {
    void i18n.changeLanguage("en");
    window.localStorage.setItem("orion.lens.entry", "all");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url);
        const body = path.includes("/api/me")
          ? ME
          : path.includes("/api/chain/funders")
            ? FUNDERS
            : {};
        return { ok: true, status: 200, json: async () => body };
      }) as unknown as typeof fetch,
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("le prédicat couvre la chaîne de l'argent, et elle seule", () => {
    expect(isWorkspaceRoute("/money")).toBe(true);
    expect(isWorkspaceRoute("/money/project/26403")).toBe(true);
    expect(isWorkspaceRoute("/moneyx")).toBe(false);
    expect(isWorkspaceRoute("/projects")).toBe(false);
    expect(isWorkspaceRoute("/")).toBe(false);
  });

  it("sur /money : pas de footer — la surface est un outil", async () => {
    renderAt("/money");
    expect(
      await screen.findByRole("heading", { name: "Where did this money go?" }),
    ).toBeTruthy();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("ailleurs : le footer éditorial demeure", async () => {
    renderAt("/about-data");
    expect(await screen.findByRole("contentinfo")).toBeTruthy();
  });
});
