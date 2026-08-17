import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CollectButton } from "@/components/collect-button";
import { CountryPanel } from "@/components/country-panel";
import { CoverageNote } from "@/components/coverage-note";
import { ExploreExits } from "@/components/explore-exits";
import { TrajectorySpark } from "@/components/trajectory-spark";
import { WorldMap } from "@/components/world-map";
import { YearBars } from "@/components/year-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { countryFlag, formatCompactEur, formatInt, formatOrgName } from "@/lib/format";
import { isRegion, REGION_ORDER, regionColor } from "@/lib/regions";
import { cn } from "@/lib/utils";

/** La page région (symétrie géographique, validée 2026-08-17) : le
 *  niveau qui manquait entre le monde et le pays — une VRAIE page, avec
 *  une adresse, ses chiffres, sa carte cadrée et son classement de pays.
 *  Jumelle structurelle de la fiche pays, pour que « la page Europe face
 *  à la page États-Unis » se lise côte à côte comme deux fiches groupe.
 *  Le geste ne change pas : premier clic, le pays se sélectionne ;
 *  second, on descend vers sa fiche. */
export function RegionHubPage() {
  const { slug = "" } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: allCountries, isPending } = useQuery({
    queryKey: ["countries"],
    queryFn: api.countries,
  });
  const { data: regions } = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const { data: flows } = useQuery({ queryKey: ["country-flows"], queryFn: api.countryFlows });
  const { data: byYear } = useQuery({
    queryKey: ["region-years", slug],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "funding", by: "year", scope: slug })),
    enabled: isRegion(slug),
  });
  // La vue par pays porte l'assiette (lot E) : une région mélange
  // presque toujours des couvertures — la page le confesse.
  const { data: byCountry } = useQuery({
    queryKey: ["region-countries", slug],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "country", scope: slug, limit: "40" }),
      ),
    enabled: isRegion(slug),
  });
  const { data: topOrgs } = useQuery({
    queryKey: ["region-orgs", slug],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "organisation", scope: slug, limit: "8" }),
      ),
    enabled: isRegion(slug),
  });

  // Un slug inconnu retombe sur le monde, sans bruit — la règle des
  // scopes depuis le chantier régions.
  if (!isRegion(slug)) return <Navigate to="/explore/countries" replace />;

  if (isPending || !allCountries) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-6 pt-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-8 h-56 w-full" />
      </div>
    );
  }

  const countries = allCountries
    .filter((entry) => entry.region === slug)
    .sort((a, b) => b.funding_eur - a.funding_eur);
  const summary = regions?.find((entry) => entry.region === slug);
  const fundingTotal =
    summary?.funding_eur ?? countries.reduce((sum, entry) => sum + entry.funding_eur, 0);
  const years = (byYear?.series[0]?.points ?? [])
    .filter((point) => point.year >= 2005)
    .map((point) => ({ year: point.year, amount_eur: point.value ?? 0 }));

  const panelIndex = selected ? countries.findIndex((entry) => entry.code === selected) : -1;
  const panelEntry = panelIndex >= 0 ? countries[panelIndex] : null;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-12">
      <nav className="text-[13px] text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/explore/countries" className="transition-colors hover:text-foreground">
          {t("regions.world")}
        </Link>{" "}
        › <span>{t(`regions.${slug}`)}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <i
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 rounded-full"
          style={{ background: regionColor(slug), opacity: 0.9 }}
        />
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t(`regions.${slug}`)}
        </h1>
        <span className="ml-auto">
          <CollectButton view={`by=country&scope=${slug}`} title={t(`regions.${slug}`)} />
        </span>
      </div>

      {/* Les autres régions à un clic — la symétrie se parcourt. */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("regions.scopeLabel")}>
        <Link
          to="/explore/countries"
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("regions.world")}
        </Link>
        {REGION_ORDER.map((candidate) => (
          <Link
            key={candidate}
            to={`/explore/regions/${candidate}`}
            aria-current={slug === candidate ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
              slug === candidate
                ? "border-foreground/60 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <i
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: regionColor(candidate), opacity: 0.9 }}
            />
            {t(`regions.${candidate}`)}
          </Link>
        ))}
      </div>

      <div className="mt-9 max-w-[680px]">
        <div className="font-display tnum text-[clamp(40px,5vw,58px)] font-[520] leading-none tracking-[-0.028em]">
          {formatCompactEur(fundingTotal, i18n.language)}
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">{t("org.totalFunding")}</div>
        <div className="mt-6">
          <TrajectorySpark data={years} />
        </div>
        {/* L'assiette de la région (lot E, prolongé par la symétrie) :
            une région MIXTE confesse par la note standard ; une région
            entièrement non couverte le dit encore plus fort — tout ce
            qui s'affiche vient des consortiums, les budgets domestiques
            sont invisibles, pas nuls. Elle ne se tait que couverte. */}
        {countries.length > 0 &&
        countries.every((entry) => entry.coverage && entry.coverage !== "funders") ? (
          <p className="mt-4 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <b className="font-semibold text-foreground/80">{t("coverage.mixedTitle")}</b>{" "}
            {t("coverage.regionAllPartial")}
          </p>
        ) : byCountry ? (
          <CoverageNote meta={byCountry.meta} />
        ) : null}
      </div>

      <div className="mt-14 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start lg:gap-8">
        <div className={panelEntry ? undefined : "lg:col-span-2 mx-auto w-full max-w-[840px]"}>
          <WorldMap
            countries={countries}
            flows={flows ?? []}
            selected={selected}
            onSelect={setSelected}
            onOpen={(code) => navigate(`/explore/countries/${code}`)}
            scope={slug}
          />
        </div>
        {panelEntry ? (
          <div className="fixed inset-x-3 bottom-3 top-20 z-30 overflow-y-auto lg:static lg:inset-auto lg:z-auto lg:overflow-visible">
            <CountryPanel
              code={panelEntry.code}
              entry={panelEntry}
              rank={panelIndex + 1}
              flows={flows ?? []}
              onClose={() => setSelected(null)}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_264px]">
        <div className="min-w-0 space-y-14">
          {/* Le classement — c'est ici qu'on choisit son pays, badges
              d'assiette au revers (lot E : jamais un zéro déguisé). */}
          <section aria-label={t("regions.countriesRank")}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("regions.countriesRank")}
            </h2>
            {countries.map((country, index) => (
              <Link
                key={country.code}
                to={`/explore/countries/${country.code}`}
                className="group grid grid-cols-[44px_30px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border-soft py-3"
              >
                <span
                  className={cn(
                    "display-tight tnum text-right text-[22px] font-semibold",
                    index === 0 ? "text-accent" : "text-muted-foreground/45",
                  )}
                >
                  {index + 1}
                </span>
                <span aria-hidden="true" className="text-lg leading-none">
                  {countryFlag(country.code)}
                </span>
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[14.5px] font-semibold leading-snug transition-colors group-hover:text-accent">
                    {country.name}
                  </span>
                  {country.coverage && country.coverage !== "funders" ? (
                    <span className="whitespace-nowrap rounded-full border border-border px-1.5 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("coverage.badgePartial")}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="display-tight tnum block whitespace-nowrap text-[16.5px] font-semibold">
                    {formatCompactEur(country.funding_eur, i18n.language)}
                  </span>
                  <span className="tnum block text-[11px] text-muted-foreground">
                    {t("search.projectsCount", { count: country.projects_count })}
                  </span>
                </span>
              </Link>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("org.fundingByYear")} · M€
            </h2>
            <YearBars data={years.map((d) => ({ year: d.year, amount_eur: d.amount_eur / 1e6 }))} />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("country.topOrganisations")}
            </h2>
            {(topOrgs?.series ?? []).map((org) => (
              <Link
                key={org.key}
                to={`/organisations/${org.key}`}
                className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
              >
                <span className="min-w-0 leading-snug transition-colors group-hover:text-accent">
                  {formatOrgName(org.label ?? String(org.key))}
                </span>
                <span className="tnum ml-auto w-20 whitespace-nowrap text-right font-medium">
                  {formatCompactEur(org.value ?? 0, i18n.language)}
                </span>
              </Link>
            ))}
          </section>
        </div>

        <aside className="space-y-8 lg:pt-1">
          <section>
            <h2 className="text-label uppercase text-muted-foreground">{t("org.glance")}</h2>
            <dl className="mt-3 space-y-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("regions.countriesCount")}</dt>
                <dd className="tnum font-medium">{formatInt(countries.length, i18n.language)}</dd>
              </div>
              {summary ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{t("org.projects")}</dt>
                  <dd className="tnum font-medium">
                    {formatInt(summary.projects_count, i18n.language)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>

      <ExploreExits
        exits={[
          { label: t("explore.countriesTitle"), to: "/explore/countries" },
          { label: t("explore.programmesTitle"), to: "/explore/programmes" },
        ]}
      />
    </div>
  );
}
