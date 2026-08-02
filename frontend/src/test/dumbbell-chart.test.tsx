import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import "../i18n";
import { DumbbellChart } from "../components/dumbbell-chart";
import { resolveView, readState } from "../lib/explore-state";
import { wrapLabel } from "../lib/format";

const point = (year: number, value: number) => ({ year, value });

const SERIES = [
  {
    key: "/25",
    label: "energy engineering",
    points: [point(2019, 10), point(2020, 10), point(2021, 10), point(2022, 20), point(2023, 20), point(2024, 20)],
    value: null,
  },
  {
    key: "/29",
    label: "climate research",
    points: [point(2019, 30), point(2020, 30), point(2021, 30), point(2022, 15), point(2023, 15), point(2024, 15)],
    value: null,
  },
  {
    key: "/31",
    label: "artificial intelligence",
    points: [point(2022, 5), point(2023, 5), point(2024, 5)],
    value: null,
  },
];

test("windows derive from the years present and the delta reads honestly", () => {
  render(<DumbbellChart series={SERIES} unit="eur" ariaLabel="before after" />);
  // Windows named from the data: 2019–2021 vs 2022–2024.
  const chart = screen.getByRole("img", { name: /2019–2021.*2022–2024/ });
  expect(chart).toBeInTheDocument();
  // Full labels, never truncated.
  expect(screen.getByText("energy engineering")).toBeInTheDocument();
  // +100 % for the gainer, −50 % for the loser, "new" for the series with
  // an empty first window.
  expect(screen.getByText("+100 %")).toBeInTheDocument();
  expect(screen.getByText("−50 %")).toBeInTheDocument();
  expect(screen.getByText("new")).toBeInTheDocument();
  // Sorted by movement: the gainer's row comes before the loser's.
  const rows = screen.getAllByText(/engineering|climate|artificial/);
  expect(rows[0]).toHaveTextContent("energy engineering");
});

test("static bars are never the default view (fondatrice rule)", () => {
  // Geographic euros → the map leads.
  const geo = resolveView(readState(new URLSearchParams("metric=funding&by=country&split=0")));
  expect(geo.view).toBe("map");
  // Summable non-geographic → the designed donut leads when the view fits
  // it (limit ≤ 7); bars stay available.
  const orgs = resolveView(readState(new URLSearchParams("metric=funding&by=organisation&split=0")));
  expect(orgs.view).toBe("donut");
  expect(orgs.availableViews).toContain("bars");
  // A deliberate long ranking (limit > 7) leads as bars, donut still offered.
  const long = resolveView(
    readState(new URLSearchParams("metric=funding&by=organisation&split=0&limit=10")),
  );
  expect(long.view).toBe("bars");
  expect(long.availableViews).toContain("donut");
  // Rates keep bars (honest ranked length) and never get part-of-whole.
  const rate = resolveView(readState(new URLSearchParams("metric=coordination&by=country&split=0")));
  expect(rate.view).toBe("bars");
  expect(rate.availableViews).not.toContain("donut");
  // Temporal split states gain the before/after view.
  const split = resolveView(readState(new URLSearchParams("metric=funding&by=theme&split=1")));
  expect(split.availableViews).toContain("delta");
});

test("wrapLabel breaks long labels at word boundaries, never mid-word", () => {
  expect(wrapLabel("computer and information sciences")).toEqual([
    "computer and information",
    "sciences",
  ]);
  // Very long names take as many lines as they need — never a cut.
  expect(
    wrapLabel("Commissariat a l energie atomique et aux energies alternatives", 22).join(" "),
  ).toBe("Commissariat a l energie atomique et aux energies alternatives");
  expect(wrapLabel("France")).toEqual(["France"]);
});
