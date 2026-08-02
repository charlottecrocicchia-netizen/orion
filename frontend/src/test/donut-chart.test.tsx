import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(cleanup);

import "../i18n";
import { DonutChart } from "../components/donut-chart";

const SERIES = [
  { key: 101, label: "Horizon Europe (2021-2027)", value: 60, points: undefined },
  { key: 102, label: "Horizon 2020 (2014-2020)", value: 30, points: undefined },
];

test("the donut shows full labels, an honest others slice, and drills on click", () => {
  const onSlice = vi.fn();
  render(
    <DonutChart
      series={SERIES}
      unit="eur"
      total={100}
      ariaLabel="funding · programme"
      onSlice={onSlice}
    />,
  );
  // Full labels in the legend, never truncated.
  expect(screen.getByText("Horizon Europe (2021-2027)")).toBeInTheDocument();
  // "others" carries the remainder of the view's total (100 − 90).
  expect(screen.getByText("others")).toBeInTheDocument();
  // Slices are legend buttons when drillable; "others" never drills.
  fireEvent.click(screen.getByRole("button", { name: /Zoom into Horizon Europe/ }));
  expect(onSlice).toHaveBeenCalledWith("101", "Horizon Europe (2021-2027)");
  expect(
    screen.queryByRole("button", { name: /Zoom into others/ }),
  ).not.toBeInTheDocument();
});

test("without a total the donut draws only the shown slices", () => {
  render(<DonutChart series={SERIES} unit="eur" total={null} ariaLabel="donut" />);
  expect(screen.queryByText("others")).not.toBeInTheDocument();
  // Not drillable → plain rows, no buttons.
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
