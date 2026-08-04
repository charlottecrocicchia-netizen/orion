/** The five manager regions (chantier régions, validated 2026-08-04).
 *
 *  One tint per region — the palette lives in CSS tokens (light/dark
 *  variants in index.css), validated by scripts/validate_palette.js:
 *  olive and violet were REJECTED by the colour-blindness simulation,
 *  deep purple entered for Latin America. The region of a country comes
 *  from the API (the backend referential) — the front never hardcodes
 *  geography.
 *
 *  Intensity keeps encoding the amount — five LOG buckets named in
 *  euros (decision ⑤: rank quantiles lie at world scale, where Brazil
 *  would paint as dark as a Germany worth 60× more). */

export const REGION_ORDER = [
  "europe",
  "north-america",
  "asia-pacific",
  "latin-america",
  "middle-east-africa",
] as const;

export type RegionSlug = (typeof REGION_ORDER)[number];

export const isRegion = (value: string | null | undefined): value is RegionSlug =>
  REGION_ORDER.includes(value as RegionSlug);

/** The region's tint — a CSS token, so dark mode follows for free. */
export const regionColor = (region: string | null | undefined): string =>
  isRegion(region) ? `var(--region-${region})` : "var(--color-surface)";

/** Opacity ladder shared by every choropleth (globe and flat maps). */
export const AMOUNT_STEPS = [0.12, 0.28, 0.46, 0.66, 0.88] as const;

/** Log thresholds, named in euros: <10 M€ · 10-100 M€ · 0,1-1 Md€ ·
 *  1-10 Md€ · >10 Md€. */
export const AMOUNT_THRESHOLDS = [1e7, 1e8, 1e9, 1e10] as const;

export function amountStep(value: number): number {
  let index = 0;
  while (index < AMOUNT_THRESHOLDS.length && value > AMOUNT_THRESHOLDS[index]) index++;
  return AMOUNT_STEPS[Math.min(index, AMOUNT_STEPS.length - 1)];
}

/** The legend's bucket labels — locale-aware, always the full ladder. */
export function bucketLabels(language: string): string[] {
  const md = language.startsWith("fr") ? "Md€" : "B€";
  const m = "M€";
  const sep = language.startsWith("fr") ? "0,1" : "0.1";
  return [`<10 ${m}`, `10-100 ${m}`, `${sep}-1 ${md}`, `1-10 ${md}`, `>10 ${md}`];
}
