import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { useCarriedLens, withLens } from "@/lib/lens";
import { useTranslation } from "react-i18next";

import { BarsChart, LinesChart } from "@/components/charts";
import { BumpChart } from "@/components/bump-chart";
import { DonutChart } from "@/components/donut-chart";
import { DumbbellChart } from "@/components/dumbbell-chart";
import { WorldMap } from "@/components/world-map";
import { CoverageNote } from "@/components/coverage-note";
import { ReferenceNote } from "@/components/reference-note";
import { ExploreTable } from "@/components/explore-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { readState, resolveView, toApiParams } from "@/lib/explore-state";
import { applyTrend, resolveIndexBase } from "@/lib/trend";
import { excludedYears } from "@/lib/excluded";
import {
  countryFlag,
  formatValue,
  seriesColor,
  seriesLabel,
} from "@/lib/format";

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
  const carried = useCarriedLens();
  const { t, i18n } = useTranslation();
  const [drill, setDrill] = useState<{ id: string; label: string } | null>(
    null,
  );
  // Map rule: first click selects (summary line below), second click on
  // the selected shape zooms into the country file.
  const [mapSelected, setMapSelected] = useState<string | null>(null);
  const state = readState(new URLSearchParams(query));
  if (drill) state.programme = drill.id;
  const { temporal, view } = resolveView(state);
  const apiParams = toApiParams(state);

  const {
    data: rawData,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["explore", apiParams.toString()],
    queryFn: () => api.explore(apiParams),
    enabled: active,
    staleTime: 60_000,
  });
  // TREND (R2) : une vue rejouée (deck, dossier) passe par LA même
  // transformation que la page (lib/trend.ts) — la base est résolue par
  // la même règle canonique, sans réécriture d'URL (la vue rejouée est
  // en lecture).
  const trendMode =
    state.value === "index" || state.value === "growth"
      ? (state.value as "index" | "growth")
      : null;
  const canonicalBase =
    trendMode === "index" && rawData
      ? resolveIndexBase(rawData, state.from, state.to, state.base)
      : null;
  const trend =
    trendMode && temporal && rawData
      ? applyTrend(rawData, trendMode, canonicalBase)
      : null;
  const data = trend ? trend.data : rawData;
  const { data: countryIndex } = useQuery({
    queryKey: ["countries"],
    queryFn: api.countries,
  });
  const { data: flows } = useQuery({
    queryKey: ["country-flows"],
    queryFn: api.countryFlows,
    enabled: active && view === "map",
  });

  // Un mode refusé par l'API (422) sur une vue REJOUÉE — dossier,
  // planche — doit se dire. Sans ce traitement, `data` reste indéfini et
  // le composant rendait un bloc vide de 340 px : exactement la « vue
  // vide » que la doctrine interdit. Le rejeu étant en lecture seule, il
  // ne réécrit aucune URL : il nomme le refus, et c'est tout.
  if (isError) {
    const detail = error instanceof ApiError ? error.detail : null;
    const key =
      detail === "ppp_year_unavailable"
        ? "explorer.reference.pppYearUnavailable"
        : detail === "ppp_reference_unavailable_for_view"
          ? "explorer.reference.pppReferenceUnavailableForView"
          : detail === "ppp_requires_single_award_year"
            ? "explorer.reference.pppRequiresSingleYear"
            : detail === "ppp_unavailable"
              ? "explorer.reference.pppUnavailable"
              : state.value === "real"
                ? "explorer.reference.unavailable"
                : "explorer.reference.scaleUnavailable";
    return (
      <p className="py-24 text-center text-muted-foreground">
        {t(key, { year: state.from ?? "" })}
      </p>
    );
  }
  if (!data) {
    return isPending && active ? (
      <Skeleton className="h-[340px] w-full" />
    ) : (
      <div className="h-[340px]" aria-hidden="true" />
    );
  }
  if (data.series.length === 0) {
    return (
      <p className="py-24 text-center text-muted-foreground">
        {t("explorer.emptyView")}
      </p>
    );
  }
  if (trendMode && !temporal) {
    // Un état rejoué incohérent (TREND sans axe temporel) se refuse en
    // toutes lettres — jamais une interprétation silencieuse différente.
    return (
      <p className="py-24 text-center text-muted-foreground">
        {t("explorer.reference.trendUnavailable")}
      </p>
    );
  }

  // Les séries masquées d'une URL rejouée (chantier légende) : le
  // dossier et les decks restaurent EXACTEMENT la composition gardée —
  // présentation pure, mêmes règles que la page (donut/carte/table
  // restent entiers), sans contrôle ici (la vue rejouée est en
  // lecture ; le composeur reste l'endroit où l'on compose).
  const shownSeries =
    ["lines", "bump", "delta", "bars"].includes(view) && data.series.length > 1
      ? data.series.filter((serie) => !state.hidden.includes(String(serie.key)))
      : data.series;
  const legendColorOf = (key: string) => {
    const index = data.series.findIndex((serie) => String(serie.key) === key);
    return index >= 0 ? seriesColor(index) : "var(--color-border)";
  };

  // A drill into a childless programme folds everything back onto itself:
  // say so instead of drawing a one-slice ring.
  const leafDrill =
    drill != null &&
    data.series.length === 1 &&
    String(data.series[0].key) === drill.id;
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
        <LinesChart
          series={shownSeries}
          unit={data.unit}
          ariaLabel={title}
          unavailableYears={excludedYears(data)}
          unavailableLabel={t("explorer.reference.bandLabel")}
          colorOf={legendColorOf}
          fullRange={state.range === "full"}
        />
      ) : view === "bump" ? (
        <BumpChart
          series={shownSeries}
          ariaLabel={title}
          colorOf={legendColorOf}
        />
      ) : view === "delta" ? (
        <DumbbellChart
          series={shownSeries}
          unit={data.unit}
          ariaLabel={title}
        />
      ) : view === "bars" ? (
        <BarsChart series={shownSeries} unit={data.unit} ariaLabel={title} />
      ) : view === "map" ? (
        <>
          <WorldMap
            countries={data.series
              .filter(
                (serie) => typeof serie.key === "string" && serie.value != null,
              )
              .map((serie) => ({
                code: String(serie.key),
                name: serie.label ?? String(serie.key),
                eu_member: false,
                // La région vient du référentiel backend, jamais devinée.
                // La couverture voyage avec : les hachures d'honnêteté
                // valent aussi dans les decks, le dossier, le benchmark.
                region:
                  countryIndex?.find(
                    (entry) => entry.code === String(serie.key),
                  )?.region ?? null,
                coverage: countryIndex?.find(
                  (entry) => entry.code === String(serie.key),
                )?.coverage,
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
                  to={withLens(`/explore/countries/${mapSelected}`, carried)}
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
      {/* La phrase d'honnêteté suit la vue PARTOUT où elle vit — deck,
          dossier, benchmark composable (lot E, 2026-08-17). */}
      <CoverageNote meta={data.meta} />
      {/* ⓘ Reference (R0 § D8) : une vue gardée au dossier en valeur
          réelle ou en TREND reste honnête en replay — même note, mêmes
          chiffres. */}
      <ReferenceNote
        data={data}
        period={{
          label: `${state.from ?? 2005}–${state.to ?? 2027}`,
          multiYear: (state.from ?? 2005) !== (state.to ?? 2027),
        }}
        trend={
          trend && trendMode
            ? {
                mode: trendMode,
                base: canonicalBase,
                nonIndexable: trend.nonIndexable.map((key) => {
                  const serie = data.series.find((s) => String(s.key) === key);
                  return serie ? seriesLabel(serie, t) : key;
                }),
              }
            : undefined
        }
      />
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
