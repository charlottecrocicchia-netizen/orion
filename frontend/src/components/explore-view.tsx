import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { BarsChart, LinesChart, TreemapChart } from "@/components/charts";
import { BumpChart } from "@/components/bump-chart";
import { EuropeMap } from "@/components/europe-map";
import { ExploreTable } from "@/components/explore-table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { readState, resolveView, toApiParams } from "@/lib/explore-state";

/** One self-contained Explorer view — an Angles slide's body. Same state
 *  grammar, same API cache keys and same chart components as the page
 *  board; data only loads when the slide is active or adjacent (the deck
 *  preloads n±1). The accessible twin table folds under every chart. */
export function ExploreView({
  query,
  title,
  active,
}: {
  query: string;
  title: string;
  active: boolean;
}) {
  const { t } = useTranslation();
  const state = readState(new URLSearchParams(query));
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

  return (
    <div>
      {view === "lines" ? (
        <LinesChart series={data.series} unit={data.unit} ariaLabel={title} />
      ) : view === "bump" ? (
        <BumpChart series={data.series} ariaLabel={title} />
      ) : view === "bars" ? (
        <BarsChart series={data.series} unit={data.unit} ariaLabel={title} />
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
        <TreemapChart series={data.series} unit={data.unit} ariaLabel={title} />
      ) : (
        <ExploreTable data={data} temporal={temporal} />
      )}
      {view !== "table" ? (
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
