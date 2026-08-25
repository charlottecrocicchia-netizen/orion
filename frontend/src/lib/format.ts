import { useTranslation } from "react-i18next";

/** Les unités monétaires que l'API peut servir (Reference Engine, R1) :
 *  le symbole suit l'unité de la RÉPONSE — `eur` nominal ou real·EUR,
 *  `usd` real ré-exprimé en dollars. Une unité hors de cette table
 *  n'est pas de l'argent. */
const MONEY_SYMBOLS: Record<string, string> = { eur: "€", usd: "$" };

export function isMoneyUnit(unit: string): boolean {
  return unit in MONEY_SYMBOLS;
}

export function moneySymbol(unit: string): string {
  return MONEY_SYMBOLS[unit] ?? "€";
}

export function formatCompactMoney(
  value: number | null | undefined,
  locale: string,
  unit = "eur",
): string {
  if (value == null) return "—";
  const symbol = moneySymbol(unit);
  const abs = Math.abs(value);
  const fmt = (n: number, suffix: string, digits: number) =>
    `${symbol}${n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}${suffix}`;
  if (abs >= 995e8) return fmt(value / 1e9, "B", 0);
  if (abs >= 1e9) return fmt(value / 1e9, "B", 1);
  if (abs >= 1e6) return fmt(value / 1e6, "M", 1);
  if (abs >= 1e3) return fmt(value / 1e3, "k", 0);
  return fmt(value, "", 0);
}

/** Le raccourci historique des surfaces nominales (fiches, hubs,
 *  recherche) — strictement `formatCompactMoney` en euros. */
export function formatCompactEur(value: number | null | undefined, locale: string): string {
  return formatCompactMoney(value, locale, "eur");
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
  if (isMoneyUnit(unit)) return formatCompactMoney(value, locale, unit);
  if (unit === "pct") return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  // Les unités TREND (R2) : l'indice est un nombre pur (100 à la base),
  // la croissance un pourcentage SIGNÉ — jamais confondue avec une part
  // du total.
  if (unit === "index") return value.toLocaleString(locale, { maximumFractionDigits: 1 });
  // ECONOMIC SCALE (R3) : une intensité vit sous 0,1 % — trois chiffres
  // significatifs ; le par-habitant est une monnaie à décimales.
  if (unit === "gdppct")
    return `${value.toLocaleString(locale, { maximumSignificantDigits: 3 })} %`;
  if (unit === "eurcap" || unit === "usdcap")
    return `${moneySymbol(unit === "usdcap" ? "usd" : "eur")}${value.toLocaleString(locale, {
      maximumFractionDigits: value >= 100 ? 0 : 2,
    })}`;
  // PURCHASING POWER (R4) : le dollar international n'est PAS une devise
  // de marché — il ne rejoint pas MONEY_SYMBOLS, mais il se lit comme un
  // montant. Le glyphe « Int$ » le dit sans laisser croire à des dollars
  // américains.
  if (unit === "intl")
    return `Int$${value.toLocaleString(locale, {
      maximumFractionDigits: value >= 100 ? 0 : 2,
    })}`;
  if (unit === "growth")
    return `${value > 0 ? "+" : ""}${value.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
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
      // Canonical org-type keys and manager-region slugs translate;
      // other bare keys display as-is.
      const translated = t(`orgType.${serie.key}`);
      if (!translated.startsWith("orgType.")) return translated;
      const region = t(`regions.${serie.key}`);
      if (!region.startsWith("regions.")) return region;
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

/** Localized country name from an ISO code — shared by every surface
 *  that says a country to the reader (search facets, the collaborators
 *  map…). Display follows the interface language; matching is the
 *  country-match lib's business, not this one's. */
export function useCountryName(): (code: string) => string {
  const { i18n } = useTranslation();
  const names = new Intl.DisplayNames([i18n.language || "en"], { type: "region" });
  return (code: string) => {
    try {
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  };
}

/** The site a project's source link actually opens. One place, so a badge
 *  can never lie about its origin (recette 2026-08-03). */
export function sourceLabel(source: string): string {
  if (source.startsWith("nih")) return "RePORTER";
  if (source.startsWith("nsf")) return "NSF";
  return "CORDIS";
}
