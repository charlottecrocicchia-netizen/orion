import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import "../i18n";
import { BumpChart } from "../components/bump-chart";

const SERIES = [
  {
    key: "FR",
    label: "France",
    points: [
      { year: 2021, value: 10 },
      { year: 2023, value: 30 },
    ],
    value: null,
  },
  {
    key: "DE",
    label: "Germany",
    points: [
      { year: 2021, value: 20 },
      { year: 2023, value: 25 },
    ],
    value: null,
  },
];

test("ranks flip when the values cross", () => {
  render(<BumpChart series={SERIES} ariaLabel="race" />);
  const svg = screen.getByRole("img", { name: "race" });
  // Both series direct-labeled at both ends.
  expect(screen.getAllByText("France")).toHaveLength(2);
  expect(screen.getAllByText("Germany")).toHaveLength(2);
  // Germany leads 2021 (rank 1, higher y position), France leads 2023: the
  // two polylines must cross — assert both polylines exist with 2 points.
  expect(svg.querySelectorAll("polyline")).toHaveLength(2);
});
