import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import App from "../App";

const HEALTH = { status: "ok", version: "0.0.1", checks: { database: "ok" } };
const SOURCES = {
  totals: { projects: 42, organisations: 7, participations: 99 },
  sources: [{ source: "cordis-horizon", projects: 42, last_success_at: "2026-07-31T10:00:00Z" }],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).includes("/api/sources") ? SOURCES : HEALTH),
    })) as unknown as typeof fetch,
  );
});

test("renders the brand, system status and data freshness", async () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /r&d funding intelligence/i })).toBeInTheDocument();
  expect(await screen.findAllByText(/operational/i)).toHaveLength(2);
  expect(screen.getByText("0.0.1")).toBeInTheDocument();
  expect(await screen.findByText("Horizon Europe")).toBeInTheDocument();
  expect(screen.getByText("Funded projects")).toBeInTheDocument();
});
