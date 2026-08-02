/** The Explorer's URL state, extracted so the page AND the Angles slides
 *  read the same grammar (lot 3). One state → one API query → one resolved
 *  view — never three copies of the rules. */

export interface ExplorerState {
  metric: string;
  by: string;
  split: boolean;
  compare: string[];
  from: number | null;
  to: number | null;
  q: string;
  country: string;
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
  return apiParams;
}

/** Metrics whose values ADD UP — a treemap (part-of-whole) is only honest
 *  for these. Averages and rates get no treemap at all. */
const SUMMABLE = new Set(["funding", "projects", "organisations"]);

export function resolveView(state: ExplorerState): {
  temporal: boolean;
  mappable: boolean;
  availableViews: string[];
  view: string;
} {
  const temporal = state.by === "year" || state.split;
  // The map view only speaks euros: other metrics keep treemap/bars/table.
  const mappable =
    !temporal && state.by === "country" && (state.metric === "funding" || state.metric === "avg");
  const summable = SUMMABLE.has(state.metric);
  // Bump (ranks) and delta (before/after windows) need several series over
  // time — a single-series "year" dimension has nothing to race.
  // Default order rule (fondatrice, 2026-08-02): static horizontal bars are
  // never the default — map first when the dimension is geographic, treemap
  // first when values add up. Bars stay available as a choice, and remain
  // the default only for ranked RATES (avg, coordination), where length is
  // the honest encoding and part-of-whole would lie.
  const availableViews = temporal
    ? state.by === "year"
      ? ["lines", "table"]
      : ["lines", "bump", "delta", "table"]
    : mappable
      ? summable
        ? ["map", "treemap", "bars", "table"]
        : ["map", "bars", "table"]
      : summable
        ? ["treemap", "bars", "table"]
        : ["bars", "table"];
  const view = availableViews.includes(state.view) ? state.view : availableViews[0];
  return { temporal, mappable, availableViews, view };
}
