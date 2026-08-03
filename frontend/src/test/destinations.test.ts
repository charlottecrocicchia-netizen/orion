import { expect, test } from "vitest";

import i18n from "../i18n";
import { BAR_CAPS, buildDestinations, PALETTE_CAPS } from "../lib/destinations";

/** The shared destination intelligence (recette 2026-08-03): the same
 *  matching serves the palette, the composable bars and the home ask. */

const t = i18n.t.bind(i18n);

const SUGGEST = {
  organisations: [
    { id: 7, name: "SAFRAN SA", country: "FR" },
    { id: 8, name: "SAFRAN ELECTRONICS", country: "FR" },
    { id: 9, name: "SAFRAN HELICOPTER ENGINES", country: "FR" },
  ],
  projects: [{ id: 3, acronym: "SAFE", title: "Safety framework" }],
};
const THEMES = [
  { key: "/23/47", label: "computer and information sciences", points: null, value: 100 },
  { key: "/25/49", label: "environmental engineering", points: null, value: 90 },
];
const COUNTRIES = [
  { code: "DE", name: "Germany", eu_member: true, projects_count: 10, funding_eur: 1e9 },
  { code: "FR", name: "France", eu_member: true, projects_count: 12, funding_eur: 2e9 },
];

const base = {
  idPrefix: "x",
  suggest: SUGGEST,
  themeSeries: THEMES as never,
  countries: COUNTRIES as never,
  t,
  language: "en",
};

test("an organisation name yields its file as a destination", () => {
  const out = buildDestinations({ ...base, query: "safran", caps: PALETTE_CAPS });
  const org = out.find((destination) => destination.group === "organisations");
  expect(org?.label).toMatch(/Safran/i);
  expect(org?.to).toBe("/organisations/7");
});

test("caps bound each group — the inline bars stay tight", () => {
  const out = buildDestinations({ ...base, query: "safran", caps: BAR_CAPS });
  expect(out.filter((destination) => destination.group === "organisations")).toHaveLength(2);
  expect(out.filter((destination) => destination.group === "projects")).toHaveLength(1);
});

test("countries match in every locale and lead to the country file", () => {
  const out = buildDestinations({ ...base, query: "allemagne", caps: PALETTE_CAPS });
  const country = out.find((destination) => destination.group === "countries");
  expect(country?.to).toBe("/explore/countries/DE");
});

test("themes match and open the pre-composed Explorer", () => {
  const out = buildDestinations({ ...base, query: "environ", caps: PALETTE_CAPS });
  const theme = out.find((destination) => destination.group === "themes");
  expect(theme?.to).toContain("/explore?by=theme&split=1&compare=");
});

test("under two characters, nothing fires", () => {
  expect(buildDestinations({ ...base, query: "s", caps: PALETTE_CAPS })).toHaveLength(0);
});
