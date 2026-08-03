import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import type { CountryIndexEntry, ExploreResponse, SuggestResponse } from "@/lib/api";
import { buildCountryNames, countryMatches, stripAccents } from "@/lib/country-match";
import { countryFlag, formatOrgName, themeLabel } from "@/lib/format";

/** The ONE destination intelligence (recette 2026-08-03: "I type Safran
 *  in the projects bar and there is no obvious path to the Safran
 *  page"). The command palette knew how to turn typing into
 *  destinations — organisation files, project files, themes, countries;
 *  the visible bars did not. This module is that knowledge extracted:
 *  the palette, the composable search bars and the home ask all consume
 *  the same matching (server trigram for organisations and projects,
 *  local multi-locale vocabularies for themes and countries), so typing
 *  anywhere finds the same places. */

export type DestinationGroup = "projects" | "organisations" | "themes" | "countries";

export interface Destination {
  id: string;
  group: DestinationGroup;
  label: string;
  sub?: string;
  flag?: string;
  to: string;
}

export interface DestinationCaps {
  projects: number;
  organisations: number;
  themes: number;
  countries: number;
}

/** Every surface states how much room it has; the palette is generous,
 *  the inline bars stay tight. */
export const PALETTE_CAPS: DestinationCaps = {
  projects: 99,
  organisations: 99,
  themes: 3,
  countries: 3,
};
export const BAR_CAPS: DestinationCaps = { projects: 1, organisations: 2, themes: 1, countries: 1 };
export const HOME_CAPS: DestinationCaps = { projects: 2, organisations: 3, themes: 2, countries: 2 };

interface BuildInput {
  query: string;
  idPrefix: string;
  caps: DestinationCaps;
  suggest: SuggestResponse | undefined;
  themeSeries: ExploreResponse["series"] | undefined;
  countries: CountryIndexEntry[] | undefined;
  t: (key: string, opts?: Record<string, unknown>) => string;
  language: string;
}

/** Pure — all the matching in one testable place. Group order is the
 *  palette's: projects, organisations, themes, countries. */
export function buildDestinations(input: BuildInput): Destination[] {
  const { query, idPrefix, caps, suggest, themeSeries, countries, t, language } = input;
  const needle = stripAccents(query.trim());
  if (needle.length < 2) return [];
  const out: Destination[] = [];

  for (const project of (suggest?.projects ?? []).slice(0, caps.projects)) {
    out.push({
      id: `${idPrefix}-p-${project.id}`,
      group: "projects",
      label: project.acronym ?? project.title,
      sub: project.acronym ? project.title : undefined,
      to: `/projects/${project.id}`,
    });
  }

  for (const org of (suggest?.organisations ?? []).slice(0, caps.organisations)) {
    out.push({
      id: `${idPrefix}-o-${org.id}`,
      group: "organisations",
      label: formatOrgName(org.name),
      flag: org.country ? countryFlag(org.country) : undefined,
      to: `/organisations/${org.id}`,
    });
  }

  const themeMatches = (themeSeries ?? [])
    .map((serie) => ({
      key: String(serie.key),
      label: themeLabel(String(serie.key), serie.label, t),
      source: serie.label ?? "",
    }))
    .filter((theme) => stripAccents(theme.label).includes(needle) || stripAccents(theme.source).includes(needle))
    .slice(0, caps.themes);
  for (const theme of themeMatches) {
    out.push({
      id: `${idPrefix}-t-${theme.key.replace(/[^a-z0-9]/gi, "_")}`,
      group: "themes",
      label: theme.label,
      to: `/explore?by=theme&split=1&compare=${encodeURIComponent(theme.key)}`,
    });
  }

  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames([language || "en"], { type: "region" });
  } catch {
    displayNames = null;
  }
  // Multi-locale matching (recette 2026-08-02): "Allemagne" under an
  // English interface still finds Germany — display stays localized.
  const names = buildCountryNames(countries ?? []);
  const matchedCountries = (countries ?? [])
    .map((entry) => ({
      code: entry.code,
      label: displayNames?.of(entry.code) ?? entry.name,
    }))
    .filter((entry) => countryMatches(names.get(entry.code), needle))
    .sort(
      (a, b) =>
        Number(stripAccents(b.label).startsWith(needle)) -
        Number(stripAccents(a.label).startsWith(needle)),
    )
    .slice(0, caps.countries);
  for (const country of matchedCountries) {
    out.push({
      id: `${idPrefix}-c-${country.code}`,
      group: "countries",
      label: country.label,
      flag: countryFlag(country.code),
      to: `/explore/countries/${country.code}`,
    });
  }

  return out;
}

export function useDebouncedValue(value: string, delay = 180): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    // No timer when already in sync — mounting must not schedule state
    // updates for later (they fire after teardown in tests).
    if (value === debounced) return;
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay, debounced]);
  return debounced;
}

/** The shared hook: give it the raw typing, get destinations. Sources
 *  load lazily (closed vocabularies cached forever, organisations and
 *  projects debounced through the server suggest). */
export function useDestinations(
  rawQuery: string,
  { enabled, caps, idPrefix }: { enabled: boolean; caps: DestinationCaps; idPrefix: string },
): Destination[] {
  const { t, i18n } = useTranslation();
  const debounced = useDebouncedValue(rawQuery);
  const ready = debounced.trim().length >= 2;

  const { data: suggest } = useQuery({
    queryKey: ["suggest", debounced.trim().toLowerCase()],
    queryFn: () => api.suggest(debounced.trim()),
    enabled: enabled && ready,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const { data: themes } = useQuery({
    queryKey: ["suggest-themes"],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "projects", by: "theme", limit: "41" })),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const { data: countryIndex } = useQuery({
    queryKey: ["countries"],
    queryFn: api.countries,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return useMemo(
    () =>
      buildDestinations({
        query: rawQuery,
        idPrefix,
        caps,
        suggest,
        themeSeries: themes?.series,
        countries: Array.isArray(countryIndex) ? countryIndex : [],
        t,
        language: i18n.language,
      }),
    [rawQuery, idPrefix, caps, suggest, themes, countryIndex, t, i18n.language],
  );
}
