import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

import { EuropeMap } from "@/components/europe-map";
import { WorldGlobe } from "@/components/world-globe";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { countryFlag, formatCompactEur } from "@/lib/format";

type GeoView = "globe" | "map";

function storedView(): GeoView {
  try {
    return window.localStorage.getItem("orion.geoview") === "map" ? "map" : "globe";
  } catch {
    return "globe";
  }
}

export function ExploreCountriesPage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<GeoView>(storedView);
  const [autoOpen, setAutoOpen] = useState<string | null>(null);
  const { data, isPending } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const { data: flows } = useQuery({ queryKey: ["country-flows"], queryFn: api.countryFlows });

  const switchView = (next: GeoView) => {
    setView(next);
    setAutoOpen(null);
    try {
      window.localStorage.setItem("orion.geoview", next);
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
          <h1 className="display-tight mt-1 text-[clamp(28px,4vw,40px)] font-semibold">
            {t("explore.countriesTitle")}
          </h1>
        </div>
        <div className="flex rounded-full bg-surface p-1 text-[12.5px]" role="group">
          {(["globe", "map"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={view === candidate}
              onClick={() => switchView(candidate)}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                view === candidate
                  ? "border border-border bg-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`explore.view${candidate === "globe" ? "Globe" : "Map"}`)}
            </button>
          ))}
        </div>
      </div>

      {data ? (
        <div className="mt-8">
          {view === "globe" ? (
            <WorldGlobe
              countries={data}
              onOpenCountry={(code) => {
                setAutoOpen(code);
                setView("map");
              }}
            />
          ) : (
            <EuropeMap countries={data} flows={flows ?? []} autoOpen={autoOpen} />
          )}
        </div>
      ) : null}

      <div className="mt-10">
        {isPending
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="mt-3 h-12 w-full" />)
          : data?.map((country, index) => (
              <Link
                key={country.code}
                to={`/explore/countries/${country.code}`}
                className="group grid grid-cols-[56px_34px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border-soft py-3.5"
              >
                <span
                  className={cn(
                    "display-tight tnum text-right text-[26px] font-semibold",
                    index === 0 ? "text-accent" : "text-muted-foreground/45",
                  )}
                >
                  {index + 1}
                </span>
                <span aria-hidden="true" className="text-xl leading-none">
                  {countryFlag(country.code)}
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2.5">
                    <span className="truncate text-[15.5px] font-semibold transition-colors group-hover:text-accent">
                      {country.name}
                    </span>
                    {country.eu_member ? (
                      <span className="whitespace-nowrap text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        {t("country.euMember")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="text-right">
                  <span className="display-tight tnum block whitespace-nowrap text-[19px] font-semibold">
                    {formatCompactEur(country.funding_eur, i18n.language)}
                  </span>
                  <span className="tnum block text-[11.5px] text-muted-foreground">
                    {t("search.projectsCount", { count: country.projects_count })}
                  </span>
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}
