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
  limit: number;
  view: string;
}

export function readState(params: URLSearchParams): ExplorerState {
  const time = /^(\d{4})\.\.(\d{4})$/.exec(params.get("time") ?? "");
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
