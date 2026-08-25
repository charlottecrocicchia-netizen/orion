import type { ExploreResponse } from "@/lib/api";

/** Les exclusions dynamiques du Reference Engine (R0 § D13) — outillage
 *  partagé entre la page, le replay et la note ⓘ.
 *
 *  `reasons` est un dictionnaire ouvert (motifs précis par mode :
 *  no_index_year, no_gdp_year, no_population_year…) ; chaque motif
 *  porteur d'années alimente la bande hachurée de l'axe — l'année
 *  reste VISIBLE, jamais tronquée, jamais un faux zéro. */

/** Motif → clé i18n (explorer.reference.*) — la carte UNIQUE. */
export const REASON_KEYS: Record<string, string> = {
  no_index_year: "noIndex",
  no_date: "noDate",
  no_currency_index: "noCurrency",
  no_jurisdiction: "noJurisdiction",
  no_gdp_year: "noGdpYear",
  no_population_year: "noPopulationYear",
  no_rate_year: "noRateYear",
  // PURCHASING POWER (R4) — trois motifs qui ne se confondent JAMAIS :
  // sans pays ; territoire dont le couple n'existe sur AUCUNE année ;
  // territoire qui l'a sur d'autres années mais pas sur celle cadrée.
  no_country: "noCountry",
  no_jurisdiction_series: "noJurisdictionSeries",
  no_reference_year: "noReferenceYear",
};

/** Toutes les années non calculables de la vue, tous motifs confondus. */
export function excludedYears(data: ExploreResponse | undefined): number[] | undefined {
  if (!data?.excluded) return undefined;
  const years = [
    ...new Set(
      Object.values(data.excluded.reasons).flatMap((reason) => reason.years ?? []),
    ),
  ].sort((a, b) => a - b);
  return years.length > 0 ? years : undefined;
}

/** Les années d'un motif, CONDENSÉES en plages (« 2015–2024 » plutôt
 *  que dix nombres) : la couverture se lit d'un coup d'œil, sans
 *  perdre une seule année. */
export function formatYears(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start: number | null = null;
  let previous: number | null = null;
  const flush = () => {
    if (start == null || previous == null) return;
    parts.push(
      start === previous
        ? String(start)
        : previous === start + 1
          ? `${start}, ${previous}`
          : `${start}–${previous}`,
    );
  };
  for (const year of sorted) {
    if (previous != null && year === previous + 1) {
      previous = year;
      continue;
    }
    flush();
    start = year;
    previous = year;
  }
  flush();
  return parts.join(", ");
}
