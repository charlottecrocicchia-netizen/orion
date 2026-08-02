export function formatCompactEur(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string, digits: number) =>
    `€${n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}${unit}`;
  if (abs >= 995e8) return fmt(value / 1e9, "B", 0);
  if (abs >= 1e9) return fmt(value / 1e9, "B", 1);
  if (abs >= 1e6) return fmt(value / 1e6, "M", 1);
  if (abs >= 1e3) return fmt(value / 1e3, "k", 0);
  return fmt(value, "", 0);
}

export function formatInt(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return value.toLocaleString(locale);
}

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const SMALL_WORDS = new Set([
  "de", "du", "des", "la", "le", "les", "l", "d", "et", "en", "sur", "sous", "aux", "au",
  "a", "pour", "par", "of", "the", "and", "for", "in", "on", "at", "von", "und", "der",
  "die", "das", "für", "fuer", "zur", "zum", "im", "am", "di", "e", "del", "della",
  "dei", "delle", "y", "el", "van", "het", "voor", "en",
]);

/** Sentence-case a shouting source name (« Centre national de la recherche
 *  scientifique », not ALL CAPS). Heuristic: short vowel-less tokens stay as
 *  acronyms (CNRS, UMR); mixed-case names pass through untouched. */
export function formatOrgName(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4) return name;
  const upperRatio = letters.replace(/[^\p{Lu}]/gu, "").length / letters.length;
  if (upperRatio < 0.85) return name;

  const isAcronym = (token: string) => {
    if (!/^[\p{Lu}\d.]{2,}$/u.test(token)) return false;
    const own = token.replace(/[^\p{L}]/gu, "");
    if (own.length === 0 || SMALL_WORDS.has(token.toLocaleLowerCase())) return false;
    return own.length <= 3 || (own.length <= 4 && !/[AEIOUY]/.test(own));
  };

  let started = false;
  let afterBreak = false;
  return name
    .split(/(\s+)/)
    .map((chunk) => {
      if (!chunk || /^\s+$/.test(chunk)) return chunk;
      if (/^[-–—]+$/.test(chunk)) {
        afterBreak = true;
        return chunk;
      }
      // Hyphenated words are almost always place names (Midi-Pyrenees,
      // Fontenay-aux-Roses): capitalize every non-linking segment.
      if (chunk.includes("-")) afterBreak = true;
      return chunk
        .split(/([-'’()])/)
        .map((part) => {
          if (["-", "'", "’", "(", ")"].includes(part)) {
            if (part === "-" || part === "(") afterBreak = true;
            return part;
          }
          if (!part) return part;
          if (isAcronym(part)) {
            started = true;
            afterBreak = false;
            return part;
          }
          const lower = part.toLocaleLowerCase();
          const cap = !started || (afterBreak && !SMALL_WORDS.has(lower));
          started = true;
          afterBreak = false;
          return cap ? lower.charAt(0).toLocaleUpperCase() + lower.slice(1) : lower;
        })
        .join("");
    })
    .join("");
}

/** The two source taxonomies (CORDIS activity codes, ANR free-text categories)
 *  collapse into eight canonical keys, translated through i18n `orgType.*`. */
const ORG_TYPE_KEYS: Record<string, string> = {
  REC: "research",
  "Organisme de recherche": "research",
  "Organismes de type EPST": "research",
  HES: "university",
  Université: "university",
  "Autre établissement d’enseignement supérieur": "university",
  PRC: "company",
  "Entreprises Privées": "company",
  "GE (grande entreprise)": "company",
  "ETI (entreprise de taille intermédiaire)": "company",
  "Divers privé": "company",
  "PME (petite et moyenne entreprise)": "sme",
  PUB: "public",
  "Divers public": "public",
  "Hôpital / Santé": "health",
  "Fondation ou association": "nonprofit",
  Associations: "nonprofit",
  OTH: "other",
  ETRANGER: "other",
};

export function orgTypeKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return ORG_TYPE_KEYS[raw] ?? "other";
}

export function formatValue(
  value: number | null | undefined,
  unit: string,
  locale: string,
): string {
  if (value == null) return "\u2014";
  if (unit === "eur") return formatCompactEur(value, locale);
  if (unit === "pct") return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  return formatInt(Math.round(value), locale);
}

interface LabelledSeries {
  key: string | number;
  label: string | null;
}

export function themeLabel(
  key: string,
  fallback: string | null,
  t: (key: string) => string,
): string {
  // The 41 euroSciVoc level-2 themes are translated in the FR bundle; the EN
  // bundle has no entries so the source label passes through.
  const translated = t(`themes.${key}`);
  if (!translated.startsWith("themes.")) return translated;
  return fallback ?? key;
}

export function seriesLabel(serie: LabelledSeries, t: (key: string) => string): string {
  if (typeof serie.key === "string") {
    if (serie.key.startsWith("/")) return themeLabel(serie.key, serie.label, t);
    if (!serie.label) {
      // Canonical org-type keys translate; other bare keys display as-is.
      const translated = t(`orgType.${serie.key}`);
      if (!translated.startsWith("orgType.")) return translated;
    }
  }
  return formatOrgName(serie.label ?? String(serie.key));
}

export function yearsRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return "—";
  if (from != null && to != null) return from === to ? String(from) : `${from} – ${to}`;
  return String(from ?? to);
}

/** The six validated series hues, by fixed data order. */
export function seriesColor(index: number): string {
  return `var(--color-series-${(index % 6) + 1})`;
}

/** Word-wrap a label into as many lines as it needs — SVG has no text
 *  wrapping, and a label must read IN FULL (recette rule, 2026-08-02):
 *  never sliced, wrapped instead. A single word longer than `max` keeps
 *  its own line rather than being cut. */
export function wrapLabel(label: string, max = 24): string[] {
  if (label.length <= max) return [label];
  const lines: string[] = [];
  let current = "";
  for (const word of label.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= max || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}
