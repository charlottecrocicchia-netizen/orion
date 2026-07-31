import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import App from "../App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", version: "0.0.1", checks: { database: "ok" } }),
    })) as unknown as typeof fetch,
  );
});

test("renders the brand and the live system status", async () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /r&d funding intelligence/i })).toBeInTheDocument();
  expect(await screen.findAllByText(/operational/i)).toHaveLength(2);
  expect(screen.getByText("0.0.1")).toBeInTheDocument();
});
