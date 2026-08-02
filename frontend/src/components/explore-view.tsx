import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { BarsChart, LinesChart } from "@/components/charts";
import { BumpChart } from "@/components/bump-chart";
import { DonutChart } from "@/components/donut-chart";
import { DumbbellChart } from "@/components/dumbbell-chart";
import { EuropeMap } from "@/components/europe-map";
import { ExploreTable } from "@/components/explore-table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { readState, resolveView, toApiParams } from "@/lib/explore-state";
import { countryFlag, formatValue, seriesLabel } from "@/lib/format";

/** One self-contained Explorer view — an Angles slide's body. Same state
 *  grammar, same API cache keys and same chart components as the page
 *  board; data only loads when the slide is active or adjacent (the deck
 *  preloads n±1). Inside a deck, the donut's programme drill is LOCAL
 *  state (the slide's URL stays the angle's); the composer hand-off keeps
 *  the drill through the page URL instead. The accessible twin table
 *  folds under every chart. */
export function ExploreView({
  query,
  title,
  active,
}: {
  query: string;
  title: string;
  active: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [drill, setDrill] = useState<{ id: string; label: string } | null>(null);
  // Map rule: first click selects (summary line below), second click on
  // the selected shape zooms into the country file.
  const [mapSelected, setMapSelected] = useState<string | null>(null);
  const state = readState(new URLSearchParams(query));
  if (drill) state.programme = drill.id;
  const { temporal, view } = resolveView(state);
  const apiParams = toApiParams(state);

  const { data, isPending } = useQuery({
    queryKey: ["explore", apiParams.toString()],
    queryFn: () => api.explore(apiParams),
    enabled: active,
    staleTime: 60_000,
  });
  const { data: flows } = useQuery({
    queryKey: ["country-flows"],
    queryFn: api.countryFlows,
    enabled: active && view === "map",
  });

  if (!data) {
    return isPending && active ? (
      <Skeleton className="h-[340px] w-full" />
    ) : (
      <div className="h-[340px]" aria-hidden="true" />
    );
  }
  if (data.series.length === 0) {
    return <p className="py-24 text-center text-muted-foreground">{t("explorer.emptyView")}</p>;
  }

  // A drill into a childless programme folds everything back onto itself:
  // say so instead of drawing a one-slice ring.
  const leafDrill =
    drill != null && data.series.length === 1 && String(data.series[0].key) === drill.id;
  const donutSeries = drill
    ? data.series.map((serie) =>
        String(serie.key) === drill.id
          ? { ...serie, label: t("explorer.donutDirect") }
          : serie,
      )
    : data.series;

  return (
    <div>
      {drill ? (
        <button
          type="button"
          onClick={() => setDrill(null)}
          className="mb-3 text-[13px] text-accent underline-offset-2 hover:underline"
        >
          ‹ {drill.label}
        </button>
      ) : null}
      {leafDrill ? (
        <p className="py-16 text-center text-[14px] text-muted-foreground">
          {t("explorer.donutNoChildren")}
        </p>
      ) : view === "lines" ? (
        <LinesChart series={data.series} unit={data.unit} ariaLabel={title} />
      ) : view === "bump" ? (
        <BumpChart series={data.series} ariaLabel={title} />
      ) : view === "delta" ? (
        <DumbbellChart series={data.series} unit={data.unit} ariaLabel={title} />
      ) : view === "bars" ? (
        <BarsChart series={data.series} unit={data.unit} ariaLabel={title} />
      ) : view === "map" ? (
        <>
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
            selected={mapSelected}
            onSelect={setMapSelected}
          />
          {(() => {
            const picked = mapSelected
              ? data.series.find((serie) => String(serie.key) === mapSelected)
              : null;
            return picked ? (
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border-soft pt-3 text-[13px]">
                <span>
                  {countryFlag(mapSelected!)}{" "}
                  <b className="font-semibold">{seriesLabel(picked, t)}</b>
                  <span className="tnum ml-2 text-muted-foreground">
                    {formatValue(picked.value, data.unit, i18n.language)}
                  </span>
                </span>
                <Link
                  to={`/explore/countries/${mapSelected}`}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {t("explorer.mapOpenCountry")} →
                </Link>
                <button
                  type="button"
                  aria-label={t("explorer.mapDeselect")}
                  onClick={() => setMapSelected(null)}
                  className="ml-auto rounded-md px-2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ) : null;
          })()}
        </>
      ) : view === "donut" ? (
        <DonutChart
          series={donutSeries}
          unit={data.unit}
          total={data.total}
          ariaLabel={title}
          onSlice={
            state.by === "programme" && !drill
              ? (id, label) => setDrill({ id, label })
              : undefined
          }
        />
      ) : (
        <ExploreTable data={data} temporal={temporal} />
      )}
      {view !== "table" && !leafDrill ? (
        <details className="mt-3 border-t border-border-soft pt-2">
          <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">
            {t("explorer.views.table")}
          </summary>
          <div className="mt-2">
            <ExploreTable data={data} temporal={temporal} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
