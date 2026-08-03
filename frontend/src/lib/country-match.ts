/** Country-name matching, MULTI-LOCALE by contract (recette 2026-08-02:
 *  "Allemagne" typed under an ENGLISH interface must still pose the
 *  country tag — anyone types a country in their own language). Every
 *  country carries its names in all MATCH_LOCALES plus the corpus'
 *  English name; matching is accent- and case-insensitive. The DISPLAYED
 *  label stays the interface language — only matching widens. */

/** Extend here as user languages arrive (wave 1: "de", "es", "it"…). */
export const MATCH_LOCALES = ["en", "fr"] as const;

export const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** All stripped names for each code: every MATCH_LOCALES exonym plus the
 *  provided fallback (the corpus' English name). Built once per code
 *  list — Intl.DisplayNames is cheap but not free. */
export function buildCountryNames(
  entries: { code: string; name: string }[],
): Map<string, string[]> {
  const displays = MATCH_LOCALES.map((locale) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }).filter((display): display is Intl.DisplayNames => display != null);

  const map = new Map<string, string[]>();
  for (const entry of entries) {
    const names = new Set<string>([stripAccents(entry.name)]);
    for (const display of displays) {
      try {
        const localized = display.of(entry.code);
        if (localized) names.add(stripAccents(localized));
      } catch {
        /* unknown code: the corpus name already covers it */
      }
    }
    map.set(entry.code, [...names]);
  }
  return map;
}

export function countryMatches(names: string[] | undefined, needle: string): boolean {
  if (!names) return false;
  return names.some((name) => name.includes(needle));
}
