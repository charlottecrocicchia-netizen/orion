/** The Explorer's URL state, extracted so the page AND the Angles slides
 *  read the same grammar (lot 3). One state → one API query → one resolved
 *  view — never three copies of the rules. */

import { LENS_PARAM } from "@/lib/lens";

export interface ExplorerState {
  metric: string;
  by: string;
  split: boolean;
  compare: string[];
  from: number | null;
  to: number | null;
  q: string;
  country: string;
  /** Programme drill-down: inside this programme, by its direct children. */
  programme: string;
  /** Entity frame: an organisation id or a group ref (« g<id> ») — the
   *  composable benchmark scopes a view to one compared entity. */
  organisation: string;
  /** La lentille active de la vue : `<slug>` ou `<slug>-direct`
   *  (grammaire D2). Le nom du paramètre vit dans `@/lib/lens`. */
  sector: string;
  /** La maille sous le pays (lot D) : « US-CA » cadre la vue. */
  subdivision: string;
  /** Les séries MASQUÉES à l'écran (chantier légende, 2026-08-22) :
   *  identifiants canoniques (clé de série API — code pays, id, slug),
   *  jamais des labels traduits. État de PRÉSENTATION pur : il ne
   *  voyage jamais vers l'API (toApiParams l'ignore), les données,
   *  tops, KPI et exports ne bougent pas — seules les séries
   *  dessinées et l'échelle visuelle changent. */
  hidden: string[];
  /** Le mode de lecture (Reference Engine, grammaire R0 § D10) :
   *  "" = nominal (défaut canonique, absent de l'URL), "real" = valeur
   *  réelle. Jamais activé silencieusement — l'URL est la vérité. */
  value: string;
  /** L'année de référence du mode real (`base` dans l'URL). Absente en
   *  lecture = année courante du serveur ; toute URL produite par Orion
   *  en real l'écrit — une vue gardée en 2025 reste des valeurs de 2025
   *  après la bascule d'Orion vers 2026. */
  base: number | null;
  /** La devise d'affichage du mode real (`cur` dans l'URL) : "" = EUR
   *  (défaut canonique omis), "USD" en R1. Un scalaire de ré-expression,
   *  jamais une seconde méthode économique. */
  cur: string;
  /** L'échelle d'affichage de la croissance (recette R2) : "" = domaine
   *  robuste par défaut (clôtures de Tukey), "full" = échelle
   *  intégrale. PRÉSENTATION pure — jamais envoyé à l'API ni au CSV —
   *  mais la représentation change substantiellement : l'URL la porte
   *  (doctrine « URL = vue partageable/rejouable »). Étranger à tout
   *  autre mode ; supprimé de l'URL canonique quand le jeu visible n'a
   *  aucun débordement (les deux vues sont alors identiques). */
  range: string;
  limit: number;
  view: string;
}

export function readState(params: URLSearchParams): ExplorerState {
  const time = /^(\d{4})\.\.(\d{4})$/.exec(params.get("time") ?? "");
  // La grammaire ne forme jamais silencieusement une combinaison
  // incohérente (R0 § D10) : `base` et `cur` n'ont de sens qu'en mode
  // real — lus hors de lui, ils sont ignorés, et la prochaine écriture
  // d'URL les efface (canonicalisation par reconstruction).
  const raw = params.get("value");
  const value =
    raw === "real" || raw === "index" || raw === "growth" || raw === "gdp" || raw === "capita"
      ? raw
      : "";
  return {
    metric: params.get("metric") ?? "funding",
    by: params.get("by") ?? "country",
    split: params.has("split") ? params.get("split") === "1" : !params.has("by"),
    compare: (params.get("compare") ?? "").split("~").filter(Boolean),
    from: time ? Number(time[1]) : null,
    to: time ? Number(time[2]) : null,
    q: params.get("q") ?? "",
    country: params.get("country") ?? "",
    programme: params.get("programme") ?? "",
    organisation: params.get("organisation") ?? "",
    sector: params.get(LENS_PARAM) ?? "",
    subdivision: params.get("subdivision") ?? "",
    hidden: (params.get("hidden") ?? "").split("~").filter(Boolean),
    value,
    // `base` porte l'année de référence de `real` ET l'année de base
    // d'`index` (R0 § D10 : un mode a au plus un paramètre d'année) ;
    // il est étranger à `growth` et au nominal — éliminé.
    base:
      (value === "real" || value === "index" || value === "capita") &&
      /^\d{4}$/.test(params.get("base") ?? "")
        ? Number(params.get("base"))
        : null,
    // « EUR » explicite se normalise vers le défaut omis ; R1 n'offre
    // que l'USD comme ré-expression. La devise est étrangère à TREND :
    // un scalaire commun s'annule dans les ratios — éliminée.
    cur:
      (value === "real" || value === "capita") && params.get("cur") === "USD" ? "USD" : "",
    range: value === "growth" && params.get("range") === "full" ? "full" : "",
    limit: Number(params.get("limit") ?? "5"),
    view: params.get("view") ?? "auto",
  };
}

export function toApiParams(state: ExplorerState): URLSearchParams {
  const apiParams = new URLSearchParams({
    metric: state.metric,
    by: state.by,
    limit: String(state.limit),
  });
  if (state.by !== "year" && state.split) apiParams.set("split", "true");
  if (state.compare.length > 0) apiParams.set("compare", state.compare.join("~"));
  if (state.from != null) apiParams.set("year_from", String(state.from));
  if (state.to != null) apiParams.set("year_to", String(state.to));
  if (state.q) apiParams.set("q", state.q);
  if (state.country) apiParams.set("country", state.country);
  if (state.programme && state.by === "programme") apiParams.set("programme", state.programme);
  if (state.organisation) apiParams.set("organisation", state.organisation);
  if (state.sector) apiParams.set(LENS_PARAM, state.sector);
  if (state.subdivision) apiParams.set("subdivision", state.subdivision);
  // Le mode de lecture (Reference Engine) : mêmes noms côté API que
  // dans l'URL publique — value/base/cur, grammaire R0 § D10.
  if (state.value === "real" || state.value === "capita") {
    // real et capita partagent année de référence et devise d'affichage
    // (le par-habitant divise la valeur RÉELLE — R0 § D1).
    apiParams.set("value", state.value);
    if (state.base != null) apiParams.set("base", String(state.base));
    if (state.cur) apiParams.set("cur", state.cur);
  } else if (state.value === "gdp") {
    // % PIB : aucun paramètre secondaire — la perspective est FORCÉE
    // par la dimension (R0 § D3), elle ne voyage pas.
    apiParams.set("value", "gdp");
  } else if (state.value === "index" || state.value === "growth") {
    // TREND (R2) : le backend ne connaît ni index ni growth — la page
    // demande la série REAL (année de référence serveur par défaut) et
    // lib/trend.ts transforme APRÈS réception. `base` (année de base de
    // l'indice) et `range` (échelle d'affichage de la croissance) sont
    // des paramètres d'affichage : ils ne voyagent JAMAIS.
    apiParams.set("value", "real");
  }
  // `hidden` n'atteint JAMAIS l'API : masquer une série est un état de
  // présentation — le backend rend exactement les mêmes données.
  return apiParams;
}

/** Metrics whose values ADD UP — part-of-whole (the donut) is only honest
 *  for these. Averages and rates never get it. */
const SUMMABLE = new Set(["funding", "projects", "organisations"]);

export function resolveView(state: ExplorerState): {
  temporal: boolean;
  mappable: boolean;
  availableViews: string[];
  view: string;
} {
  const temporal = state.by === "year" || state.split;
  // The map view only speaks euros: other metrics keep donut/bars/table.
  const mappable =
    !temporal && state.by === "country" && (state.metric === "funding" || state.metric === "avg");
  const summable = SUMMABLE.has(state.metric);
  // TREND (R2) : des trajectoires et leurs nombres, rien d'autre — pas
  // de donut (part d'un total qui n'existe plus), pas de bump ni de
  // delta (des rangs et des sommes de fenêtres sur des valeurs
  // transformées mentiraient), pas de carte. Les vues incompatibles
  // DISPARAISSENT, jamais grisées (doctrine R0 § D4).
  if ((state.value === "index" || state.value === "growth") && temporal) {
    const view = state.view === "table" ? "table" : "lines";
    return { temporal, mappable: false, availableViews: ["lines", "table"], view };
  }
  // ECONOMIC SCALE (R3) : des intensités et des par-habitant — jamais
  // de donut (aucun total), jamais de carte de niveaux. Trajectoires en
  // temporel, barres classées sinon.
  if (state.value === "gdp" || state.value === "capita") {
    const availableViews = temporal ? ["lines", "table"] : ["bars", "table"];
    const view = availableViews.includes(state.view) ? state.view : availableViews[0];
    return { temporal, mappable: false, availableViews, view };
  }
  // Bump (ranks) and delta (before/after windows) need several series over
  // time — a single-series "year" dimension has nothing to race.
  // Default order rules (fondatrice, 2026-08-02, amended at the deck
  // recette): treemaps have left the product; the DESIGNED donut (≤ 7
  // slices, honest "others", drill where a hierarchy exists) carries
  // part-of-whole for summable metrics, and leads when the requested view
  // fits it (limit ≤ 7). Deliberate long rankings (limit > 7) lead as
  // bars — a ranked list is what was asked for. The map leads geographic
  // euro views; rates never get part-of-whole at all.
  const donutDefault = state.limit <= 7;
  const availableViews = temporal
    ? state.by === "year"
      ? ["lines", "table"]
      : ["lines", "bump", "delta", "table"]
    : mappable
      ? summable
        ? donutDefault
          ? ["map", "donut", "bars", "table"]
          : ["map", "bars", "donut", "table"]
        : ["map", "bars", "table"]
      : summable
        ? donutDefault
          ? ["donut", "bars", "table"]
          : ["bars", "donut", "table"]
        : ["bars", "table"];
  const view = availableViews.includes(state.view) ? state.view : availableViews[0];
  return { temporal, mappable, availableViews, view };
}
