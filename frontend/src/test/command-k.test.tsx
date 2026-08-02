import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

import "../i18n";
import { CommandK } from "../components/command-k";

const SUGGEST = {
  organisations: [{ id: 7, name: "FRAUNHOFER GESELLSCHAFT", country: "DE" }],
  projects: [{ id: 3, acronym: "FRAME", title: "Framework for advanced materials" }],
};
const THEMES = {
  series: [{ key: "/23/47", label: "computer and information sciences", points: null, value: 100 }],
};
const COUNTRIES = [
  { code: "FR", name: "France", eu_member: true, projects_count: 10, funding_eur: 1e9 },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      const body = path.includes("/api/search/suggest")
        ? SUGGEST
        : path.includes("/api/explore/aggregate")
          ? THEMES
          : COUNTRIES;
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );
});

function renderPalette() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommandK open onOpenChange={onOpenChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onOpenChange;
}

test("typing surfaces grouped suggestions with combobox semantics", async () => {
  renderPalette();
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "fra" } });

  // Organisations arrive from the server stub; countries match locally
  // (accent-insensitive "France"); full-text stays the first option.
  expect(await screen.findByRole("option", { name: /Fraunhofer/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /France/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Search “fra”/ })).toBeInTheDocument();
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(input.getAttribute("aria-activedescendant")).toBe("ck-opt-full");

  // Arrow keys drive the active descendant.
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input.getAttribute("aria-activedescendant")).toMatch(/^ck-opt-/);
});

test("escape closes the palette", () => {
  const onOpenChange = renderPalette();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
