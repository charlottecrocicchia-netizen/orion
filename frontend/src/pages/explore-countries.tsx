import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

import { CountryPanel } from "@/components/country-panel";
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

/** Countries & world. Map rule (fondatrice, 2026-08-02): the first click
 *  SELECTS — highlight, pinned flows, the summary panel beside — and the
 *  file opens on a distinct gesture only: the panel's CTA, or a second
 *  activation of the already-selected country. Globe and flat map share
 *  the selection; the ranked list below stays the canonical reading. */
export function ExploreCountriesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<GeoView>(storedView);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isPending } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const { data: flows } = useQuery({ queryKey: ["country-flows"], queryFn: api.countryFlows });

  const switchView = (next: GeoView) => {
    setView(next);
    try {
      window.localStorage.setItem("orion.geoview", next);
    } catch {
      /* private mode */
    }
  };

  // First activation selects; repeating it on the selected country goes
  // to the file (the panel's CTA is the other door).
  const activate = (code: string) => {
    if (code === selected) navigate(`/explore/countries/${code}`);
    else setSelected(code);
  };

  const panelIndex = selected ? (data?.findIndex((entry) => entry.code === selected) ?? -1) : -1;
  const panelEntry = panelIndex >= 0 ? data![panelIndex] : null;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-12">
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
        <MotionConfig reducedMotion="user">
          <div
            className={cn(
              "mt-8 lg:items-start lg:gap-8",
              panelEntry ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]" : "",
            )}
          >
            <motion.div
              layout
              transition={{ duration: 0.4, ease: [0.2, 0.6, 0.2, 1] }}
              className={panelEntry ? undefined : "mx-auto max-w-[840px]"}
            >
              {view === "globe" ? (
                <WorldGlobe
                  countries={data}
                  flows={flows ?? []}
                  mode="select"
                  selected={selected}
                  onOpenCountry={activate}
                />
              ) : (
                <EuropeMap
                  countries={data}
                  flows={flows ?? []}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </motion.div>
            <AnimatePresence>
              {panelEntry ? (
                <motion.div
                  key={panelEntry.code}
                  initial={{ opacity: 0, x: 64 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 64 }}
                  transition={{ duration: 0.34, ease: [0.2, 0.6, 0.2, 1] }}
                  className="fixed inset-x-3 bottom-3 top-20 z-30 overflow-y-auto lg:static lg:inset-auto lg:z-auto lg:overflow-visible"
                >
                  <CountryPanel
                    code={panelEntry.code}
                    entry={panelEntry}
                    rank={panelIndex + 1}
                    flows={flows ?? []}
                    onClose={() => setSelected(null)}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </MotionConfig>
      ) : null}

      <div className="mx-auto mt-10 max-w-[880px]">
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
                    <span className="text-[15.5px] font-semibold leading-snug transition-colors group-hover:text-accent">
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
