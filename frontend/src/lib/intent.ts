/** Free-text intent parser, V1 — deliberate rules, no model. Phase 4 will
 *  replace this parser; the interface (the editable composition sentence)
 *  stays. Routing rule: a bare term goes to the classic project search, a
 *  structured request opens the Explorer pre-filled, "X vs Y" opens the
 *  benchmark. */

interface Lexicon {
  byDimension: Record<string, string>;
  metrics: Record<string, string>;
  vs: RegExp;
  since: RegExp;
  range: RegExp;
}

const FR: Lexicon = {
  byDimension: {
    pays: "country",
    thème: "theme",
    thèmes: "theme",
    theme: "theme",
    programme: "programme",
    programmes: "programme",
    organisation: "organisation",
    organisations: "organisation",
    année: "year",
    années: "year",
    bailleur: "funder",
  },
  metrics: {
    coordonne: "coordination",
    coordination: "coordination",
    projets: "projects",
    organisations: "organisations",
    moyen: "avg",
    moyenne: "avg",
  },
  vs: /\s+(?:vs\.?|contre|face à)\s+/i,
  since: /\bdepuis\s+(\d{4})\b/i,
  range: /\b(\d{4})\s*[-–à]\s*(\d{4})\b/i,
};

const EN: Lexicon = {
  byDimension: {
    country: "country",
    countries: "country",
    theme: "theme",
    themes: "theme",
    programme: "programme",
    programmes: "programme",
    program: "programme",
    organisation: "organisation",
    organisations: "organisation",
    organization: "organisation",
    year: "year",
    years: "year",
    funder: "funder",
  },
  metrics: {
    coordinates: "coordination",
    coordination: "coordination",
    projects: "projects",
    organisations: "organisations",
    average: "avg",
  },
  vs: /\s+(?:vs\.?|versus|against)\s+/i,
  since: /\bsince\s+(\d{4})\b/i,
  range: /\b(\d{4})\s*[-–]\s*(\d{4})\b/i,
};

// The countries a person would type; codes match the API facets.
const COUNTRY_WORDS: Record<string, string> = {
  france: "FR", allemagne: "DE", germany: "DE", espagne: "ES", spain: "ES",
  italie: "IT", italy: "IT", "royaume-uni": "GB", uk: "GB", "pays-bas": "NL",
  netherlands: "NL", belgique: "BE", belgium: "BE", suisse: "CH",
  switzerland: "CH", suède: "SE", sweden: "SE", norvège: "NO", norway: "NO",
  pologne: "PL", poland: "PL", portugal: "PT", grèce: "GR", greece: "GR",
  autriche: "AT", austria: "AT", danemark: "DK", denmark: "DK",
  finlande: "FI", finland: "FI", irlande: "IE", ireland: "IE",
  turquie: "TR", turkey: "TR", ukraine: "UA",
};

export interface Intent {
  /** Where the request should land. */
  to: "projects" | "explore" | "compare";
  /** Query-string for the target route (without leading ?). */
  params: string;
}

const STOPWORDS = new Set([
  "le", "la", "les", "l", "de", "du", "des", "d", "par", "en", "et", "où",
  "va", "argent", "the", "of", "by", "in", "and", "where", "does", "money",
  "go", "goes", "qui", "who", "quoi", "what", "montre", "show", "voir",
  "depuis", "since", "entre", "between",
]);

export function parseIntent(raw: string, lang: string): Intent | null {
  const text = raw.trim();
  if (!text) return null;
  const lex = lang.startsWith("fr") ? FR : EN;
  const lower = text.toLowerCase();

  // "X vs Y" — two organisations (or countries) side by side.
  if (lex.vs.test(lower)) {
    const [left, right] = text.split(lex.vs).map((s) => s.trim());
    if (left && right) {
      const codes = [left, right].map((side) => COUNTRY_WORDS[side.toLowerCase()]);
      if (codes.every(Boolean)) {
        return {
          to: "explore",
          params: `by=country&split=1&compare=${codes.join("~")}`,
        };
      }
      return { to: "compare", params: `find=${encodeURIComponent(`${left}~${right}`)}` };
    }
  }

  const params = new URLSearchParams();
  let structured = false;

  const since = lex.since.exec(lower);
  const range = lex.range.exec(lower);
  if (range) {
    params.set("time", `${range[1]}..${range[2]}`);
    structured = true;
  } else if (since) {
    params.set("time", `${since[1]}..2027`);
    structured = true;
  }

  const words = lower.replace(/[?!.,;:()«»"']/g, " ").split(/\s+/).filter(Boolean);
  const rest: string[] = [];
  let metric: string | null = null;
  let by: string | null = null;
  let country: string | null = null;

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const prev = words[index - 1];
    if ((prev === "par" || prev === "by" || prev === "per") && lex.byDimension[word]) {
      by = lex.byDimension[word];
      structured = true;
      continue;
    }
    if (!metric && lex.metrics[word] && word !== prev) {
      metric = lex.metrics[word];
      if (metric === "coordination") structured = true;
      continue;
    }
    if (COUNTRY_WORDS[word]) {
      country = COUNTRY_WORDS[word];
      structured = true;
      continue;
    }
    if (word === "par" || word === "by" || word === "per") continue;
    if (/^\d{4}$/.test(word)) continue; // consumed by time rules
    if (!STOPWORDS.has(word)) rest.push(word);
  }

  const q = rest.join(" ").trim();

  if (!structured) {
    // A bare term stays a classic search — the historic demo journey.
    return q ? { to: "projects", params: `q=${encodeURIComponent(q)}` } : null;
  }

  if (metric === "coordination") params.set("metric", "coordination");
  if (by) {
    params.set("by", by);
    if (by !== "year") params.set("split", q || country ? "0" : "1");
  }
  if (country && by !== "country") params.set("country", country);
  if (country && by === "country") params.set("compare", country);
  if (q) params.set("q", q);
  return { to: "explore", params: params.toString() };
}
