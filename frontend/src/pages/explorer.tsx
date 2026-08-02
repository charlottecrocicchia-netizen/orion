import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent, ReactNode } from "react";

import { BarsChart, LinesChart, TreemapChart } from "@/components/charts";
import { EuropeMap } from "@/components/europe-map";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ExploreResponse } from "@/lib/api";
import { parseIntent } from "@/lib/intent";
import { STORIES } from "@/lib/stories";
import { countryFlag, formatValue, seriesLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const METRICS = ["funding", "projects", "organisations", "avg", "coordination"] as const;
const DIMENSIONS = [
  "country",
  "programme",
  "theme",
  "organisation",
  "funder",
  "orgtype",
  "year",
] as const;
const ORG_TYPE_OPTIONS = [
  "research",
  "university",
  "company",
  "sme",
  "public",
  "health",
  "nonprofit",
  "other",
];
const YEAR_MIN = 2005;
const YEAR_MAX = 2027;

interface ExplorerState {
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

function readState(params: URLSearchParams): ExplorerState {
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

/* ————— A dotted-underline sentence segment opening a small menu ————— */

function Segment({
  display,
  children,
  chip = false,
  menuLabel,
}: {
  display: ReactNode;
  children: (close: () => void) => ReactNode;
  chip?: boolean;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={menuLabel}
        onClick={() => setOpen(!open)}
        className={cn(
          "whitespace-nowrap text-accent",
          chip
            ? "rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium"
            : "border-b-2 border-dotted border-accent/45 pb-px",
        )}
      >
        {display}
        {!chip ? (
          <span aria-hidden="true" className="ml-1 align-[2px] text-[0.6em] opacity-60">
            ▾
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-30 min-w-[240px] rounded-xl border bg-background p-1.5 text-left text-[14px] font-normal tracking-normal shadow-key"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </span>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "block w-full rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface",
        selected && "font-medium text-accent",
      )}
    >
      {children}
    </button>
  );
}

/* ————— The page ————— */

export function ExplorerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const state = readState(params);
  const [copied, setCopied] = useState(false);

  const patch = (changes: Partial<ExplorerState>) => {
    const next = { ...state, ...changes };
    const out = new URLSearchParams();
    if (next.metric !== "funding") out.set("metric", next.metric);
    if (next.by !== "country") out.set("by", next.by);
    if (next.by !== "year") out.set("split", next.split ? "1" : "0");
    if (next.compare.length > 0) out.set("compare", next.compare.join("~"));
    if (next.from != null && next.to != null) out.set("time", `${next.from}..${next.to}`);
    if (next.q) out.set("q", next.q);
    if (next.country) out.set("country", next.country);
    if (next.limit !== 5) out.set("limit", String(next.limit));
    if (next.view !== "auto") out.set("view", next.view);
    setParams(out, { preventScrollReset: true });
  };

  const apiParams = new URLSearchParams({ metric: state.metric, by: state.by, limit: String(state.limit) });
  if (state.by !== "year" && state.split) apiParams.set("split", "true");
  if (state.compare.length > 0) apiParams.set("compare", state.compare.join("~"));
  if (state.from != null) apiParams.set("year_from", String(state.from));
  if (state.to != null) apiParams.set("year_to", String(state.to));
  if (state.q) apiParams.set("q", state.q);
  if (state.country) apiParams.set("country", state.country);

  const { data, isPending, isError } = useQuery({
    queryKey: ["explore", apiParams.toString()],
    queryFn: () => api.explore(apiParams),
    placeholderData: keepPreviousData,
  });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: api.programmes,
    enabled: state.by === "programme",
  });
  const { data: themes } = useQuery({
    queryKey: ["explore-themes"],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "projects", by: "theme", limit: "25" })),
    enabled: state.by === "theme",
  });
  const { data: flows } = useQuery({
    queryKey: ["country-flows"],
    queryFn: api.countryFlows,
    enabled: state.view === "map",
  });

  const temporal = state.by === "year" || state.split;
  // The map view only speaks euros: other metrics keep bars/treemap/table.
  const mappable =
    !temporal && state.by === "country" && (state.metric === "funding" || state.metric === "avg");
  const availableViews = temporal
    ? ["lines", "table"]
    : mappable
      ? ["bars", "map", "treemap", "table"]
      : ["bars", "treemap", "table"];
  const view = availableViews.includes(state.view) ? state.view : availableViews[0];

  const toggleCompare = (key: string) => {
    const next = state.compare.includes(key)
      ? state.compare.filter((k) => k !== key)
      : [...state.compare, key].slice(0, 6);
    patch({ compare: next });
  };

  const share = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCsv = () => {
    if (!data) return;
    const rows: string[][] = [];
    if (temporal) {
      const years = [...new Set(data.series.flatMap((s) => (s.points ?? []).map((p) => p.year)))].sort();
      rows.push(["year", ...data.series.map((s) => seriesLabel(s, t))]);
      for (const year of years) {
        rows.push([
          String(year),
          ...data.series.map((s) => String((s.points ?? []).find((p) => p.year === year)?.value ?? "")),
        ]);
      }
    } else {
      rows.push(["key", "label", data.metric]);
      for (const s of data.series) rows.push([String(s.key), seriesLabel(s, t), String(s.value ?? "")]);
    }
    const csv = [
      ...rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")),
      `# ${t("explorer.sources")} — orion ${new URL(window.location.href).search}`,
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `orion-${data.metric}-by-${data.by}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const compareDisplay =
    state.compare.length > 0
      ? state.compare
          .map((key) => {
            if (state.by === "orgtype") return t(`orgType.${key}`);
            if (state.by === "programme")
              return programmes?.find((p) => String(p.id) === key)?.label.slice(0, 16) ?? key;
            if (state.by === "theme")
              return (
                themes?.series.find((s) => s.key === key)?.label?.slice(0, 22) ?? key
              );
            return key;
          })
          .join(" · ")
      : t("explorer.top", { count: state.limit });

  const boardTitle = `${t(`explorer.metric.${state.metric}`)} · ${t(`explorer.dim.${state.by}`)}`;

  const submitFreeText = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const intent = parseIntent(String(new FormData(form).get("free") ?? ""), i18n.language);
    if (!intent) return;
    if (intent.to === "explore") {
      setParams(new URLSearchParams(intent.params), { preventScrollReset: true });
    } else {
      navigate(`/${intent.to === "projects" ? "projects" : "compare"}?${intent.params}`);
    }
    form.reset();
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pt-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-sm font-medium text-accent">{t("explorer.eyebrow")}</p>
        <form onSubmit={submitFreeText} className="min-w-[260px] flex-1 sm:max-w-[380px]">
          <input
            name="free"
            type="text"
            placeholder={`⌕ ${t("explorer.freeText")}`}
            aria-label={t("explorer.freeText")}
            className="w-full rounded-full bg-surface px-4 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
          />
        </form>
      </div>

      {/* The composition sentence — the interface itself */}
      <p className="display-tight mt-3 max-w-[34ch] text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.5]">
        {t("explorer.show")}{" "}
        <Segment menuLabel={t("explorer.show")} display={t(`explorer.metric.${state.metric}`)}>
          {(close) =>
            METRICS.map((metric) => (
              <MenuItem
                key={metric}
                selected={metric === state.metric}
                onClick={() => {
                  patch({ metric });
                  close();
                }}
              >
                {t(`explorer.metric.${metric}`)}
              </MenuItem>
            ))
          }
        </Segment>{" "}
        {t("explorer.by")}{" "}
        <Segment menuLabel={t("explorer.by")} display={t(`explorer.dim.${state.by}`)}>
          {(close) =>
            DIMENSIONS.map((by) => (
              <MenuItem
                key={by}
                selected={by === state.by}
                onClick={() => {
                  patch({ by, compare: [], view: "auto", split: by === "year" ? false : state.split });
                  close();
                }}
              >
                {t(`explorer.dim.${by}`)}
              </MenuItem>
            ))
          }
        </Segment>
        {state.by !== "year" ? (
          <>
            {", "}
            <Segment menuLabel={t("explorer.top", { count: state.limit })} display={compareDisplay}>
              {(close) => (
                <>
                  <div className="flex gap-1 border-b px-2 pb-1.5 pt-0.5">
                    {[5, 10, 25].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          patch({ limit: n, compare: [] });
                          close();
                        }}
                        className={cn(
                          "rounded-full px-3 py-1 text-[12.5px] hover:bg-surface",
                          state.compare.length === 0 && state.limit === n && "bg-foreground text-background",
                        )}
                      >
                        {t("explorer.top", { count: n })}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto pt-1">
                    {state.by === "country" &&
                      countries?.slice(0, 24).map((c) => (
                        <MenuItem
                          key={c.code}
                          selected={state.compare.includes(c.code)}
                          onClick={() => toggleCompare(c.code)}
                        >
                          {countryFlag(c.code)} {c.name}
                        </MenuItem>
                      ))}
                    {state.by === "programme" &&
                      programmes?.slice(0, 12).map((p) => (
                        <MenuItem
                          key={p.id}
                          selected={state.compare.includes(String(p.id))}
                          onClick={() => toggleCompare(String(p.id))}
                        >
                          {p.label}
                        </MenuItem>
                      ))}
                    {state.by === "orgtype" &&
                      ORG_TYPE_OPTIONS.map((key) => (
                        <MenuItem
                          key={key}
                          selected={state.compare.includes(key)}
                          onClick={() => toggleCompare(key)}
                        >
                          {t(`orgType.${key}`)}
                        </MenuItem>
                      ))}
                    {state.by === "theme" &&
                      themes?.series.map((serie) => (
                        <MenuItem
                          key={String(serie.key)}
                          selected={state.compare.includes(String(serie.key))}
                          onClick={() => toggleCompare(String(serie.key))}
                        >
                          {serie.label ?? String(serie.key)}
                        </MenuItem>
                      ))}
                  </div>
                </>
              )}
            </Segment>
            {", "}
            <button
              type="button"
              aria-pressed={state.split}
              onClick={() => patch({ split: !state.split, view: "auto" })}
              className={cn(
                "whitespace-nowrap border-b-2 pb-px",
                state.split
                  ? "border-accent/45 border-dotted text-accent"
                  : "border-transparent text-muted-foreground hover:text-accent",
              )}
            >
              {t("explorer.overTime")}
            </button>
          </>
        ) : null}{" "}
        <Segment
          chip
          menuLabel={t("search.filters.years")}
          display={`${state.from ?? YEAR_MIN} → ${state.to ?? YEAR_MAX}`}
        >
          {(close) => (
            <div className="flex items-center gap-2 p-2">
              {(["from", "to"] as const).map((bound) => (
                <select
                  key={bound}
                  aria-label={t(`search.filters.${bound}`)}
                  value={bound === "from" ? (state.from ?? YEAR_MIN) : (state.to ?? YEAR_MAX)}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    patch({
                      from: bound === "from" ? year : (state.from ?? YEAR_MIN),
                      to: bound === "to" ? year : (state.to ?? YEAR_MAX),
                    });
                  }}
                  className="rounded-lg border bg-background px-2 py-1.5 text-[13px]"
                >
                  {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              ))}
              <button type="button" onClick={close} className="rounded-full bg-foreground px-3 py-1.5 text-[12.5px] text-background">
                {t("explorer.apply")}
              </button>
            </div>
          )}
        </Segment>{" "}
        {state.q ? (
          <button
            type="button"
            onClick={() => patch({ q: "" })}
            className="rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium text-accent"
          >
            « {state.q} » <span className="opacity-55">×</span>
          </button>
        ) : null}
        {state.country ? (
          <button
            type="button"
            onClick={() => patch({ country: "" })}
            className="rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium text-accent"
          >
            {countryFlag(state.country)} {state.country} <span className="opacity-55">×</span>
          </button>
        ) : null}
        <Segment chip menuLabel={t("explorer.addFilter")} display={t("explorer.addFilter")}>
          {(close) => (
            <form
              className="w-[280px] p-2"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                patch({
                  q: String(form.get("q") ?? "").trim(),
                  country: state.by === "country" ? "" : String(form.get("country") ?? ""),
                });
                close();
              }}
            >
              <label className="block text-[12px] text-muted-foreground" htmlFor="explorer-q">
                {t("explorer.theme")} · {t("explorer.themeHint")}
              </label>
              <input
                id="explorer-q"
                name="q"
                defaultValue={state.q}
                placeholder="hydrogen, quantum…"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-accent"
              />
              {state.by !== "country" ? (
                <>
                  <label className="mt-3 block text-[12px] text-muted-foreground" htmlFor="explorer-country">
                    {t("explorer.countryFilter")}
                  </label>
                  <select
                    id="explorer-country"
                    name="country"
                    defaultValue={state.country}
                    className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-[13.5px]"
                  >
                    <option value="">{t("explorer.anyCountry")}</option>
                    {countries?.slice(0, 24).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              <button
                type="submit"
                className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-[12.5px] text-background"
              >
                {t("explorer.apply")}
              </button>
            </form>
          )}
        </Segment>
      </p>

      {/* The view */}
      <section className="mt-9 rounded-[20px] border p-7 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-[15px] font-semibold">{boardTitle}</h1>
          <span className="text-[12.5px] text-muted-foreground">
            {data ? t(`explorer.basis.${data.basis}`) : ""}
            {state.by === "theme" ? ` · ${t("explorer.multiTheme")}` : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
            >
              {t("explorer.csv")}
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-full bg-foreground px-3.5 py-1.5 text-[12.5px] text-background hover:opacity-90"
            >
              {copied ? t("explorer.shared") : t("explorer.share")}
            </button>
          </div>
        </div>

        <div className="mt-5">
          {isPending ? (
            <Skeleton className="h-[380px] w-full" />
          ) : isError || !data || data.series.length === 0 ? (
            <p className="py-24 text-center text-muted-foreground">{t("explorer.emptyView")}</p>
          ) : view === "lines" ? (
            <LinesChart series={data.series} unit={data.unit} ariaLabel={boardTitle} />
          ) : view === "bars" ? (
            <BarsChart series={data.series} unit={data.unit} ariaLabel={boardTitle} />
          ) : view === "map" ? (
            <EuropeMap
              countries={data.series
                .filter((serie) => typeof serie.key === "string" && serie.value != null)
                .map((serie) => ({
                  code: String(serie.key),
                  name: serie.label ?? String(serie.key),
                  eu_member: false,
                  projects_count: 0,
                  funding_eur: serie.value ?? 0,
                }))}
              flows={flows ?? []}
              legendLabel={`${t(`explorer.metric.${state.metric}`)} · €`}
            />
          ) : view === "treemap" ? (
            <TreemapChart series={data.series} unit={data.unit} ariaLabel={boardTitle} />
          ) : (
            <ExploreTable data={data} temporal={temporal} />
          )}
        </div>

        <div className="mt-4 flex items-center gap-1.5 border-t border-border-soft pt-3.5">
          {availableViews.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => patch({ view: candidate })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12.5px]",
                view === candidate
                  ? "bg-foreground text-background"
                  : "text-muted-foreground transition-colors hover:text-foreground",
              )}
            >
              {t(`explorer.views.${candidate}`)}
            </button>
          ))}
          <span className="ml-auto hidden text-[11.5px] text-muted-foreground sm:block">
            {t("explorer.sources")}
          </span>
        </div>
      </section>

      {/* Prepared views */}
      <section className="mt-14">
        <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("explorer.storiesTitle")}
        </h2>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((story) => (
            <Link
              key={story.key}
              to={`/explore?${story.params}`}
              className="lift rounded-2xl border p-5 hover:border-accent"
            >
              <h3 className="text-[16px] font-semibold leading-snug">
                {t(`explorer.stories.${story.key}.title`)}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {t(`explorer.stories.${story.key}.desc`)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExploreTable({ data, temporal }: { data: ExploreResponse; temporal: boolean }) {
  const { t, i18n } = useTranslation();
  if (temporal) {
    const years = [
      ...new Set(data.series.flatMap((s) => (s.points ?? []).map((p) => p.year))),
    ].sort((a, b) => a - b);
    return (
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
              <th className="py-2 pr-3">{t("org.year")}</th>
              {data.series.map((serie) => (
                <th key={String(serie.key)} className="py-2 pr-3 text-right">
                  {seriesLabel(serie, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className="border-b border-border-soft transition-colors hover:bg-surface/60">
                <td className="tnum py-2 pr-3">{year}</td>
                {data.series.map((serie) => (
                  <td key={String(serie.key)} className="tnum py-2 pr-3 text-right">
                    {formatValue(
                      (serie.points ?? []).find((p) => p.year === year)?.value,
                      data.unit,
                      i18n.language,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
          <th className="py-2 pr-3">{t("explorer.tableKey")}</th>
          <th className="py-2 text-right">{t("explorer.tableValue")}</th>
        </tr>
      </thead>
      <tbody>
        {data.series.map((serie) => (
          <tr key={String(serie.key)} className="border-b border-border-soft transition-colors hover:bg-surface/60">
            <td className="py-2 pr-3">{seriesLabel(serie, t)}</td>
            <td className="tnum py-2 text-right font-medium">
              {formatValue(serie.value, data.unit, i18n.language)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
