import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { ExploreExits } from "@/components/explore-exits";
import { TrajectorySpark } from "@/components/trajectory-spark";
import { TrendDelta } from "@/components/trend-delta";
import { YearBars } from "@/components/year-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { countryFlag, formatCompactEur, formatInt, formatOrgName } from "@/lib/format";

export function CountryHubPage() {
  const { code = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: ["country", code],
    queryFn: () => api.country(code),
  });

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-8 h-56 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const years = data.funding_by_year.filter((d) => d.year >= 2005);

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <nav className="text-[13px] text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/explore/countries" className="transition-colors hover:text-foreground">
          {t("explore.countriesTitle")}
        </Link>{" "}
        › <span>{data.name}</span>
      </nav>

      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl leading-none">
          {countryFlag(data.code)}
        </span>
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">{data.name}</h1>
        {data.eu_member ? (
          <span className="rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("country.euMember")}
          </span>
        ) : null}
      </div>

      {/* The record hero — the total as a display figure, its trajectory
          drawing itself on entry (doctrine step 4, Attio record layout). */}
      <div className="mt-9 max-w-[680px]">
        <div className="font-display tnum text-[clamp(40px,5vw,58px)] font-[520] leading-none tracking-[-0.028em]">
          {formatCompactEur(data.kpis.funding_eur, i18n.language)}
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">{t("org.totalFunding")}</div>
        <div className="mt-6">
          <TrajectorySpark data={years} />
        </div>
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_264px]">
        <div className="min-w-0 space-y-14">
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("org.fundingByYear")} · M€
            </h2>
            <YearBars data={years.map((d) => ({ year: d.year, amount_eur: d.amount_eur / 1e6 }))} />
          </section>

          <div className="grid gap-14 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("country.topOrganisations")}
          </h2>
          {data.top_organisations.map((org) => (
            <Link
              key={org.id}
              to={`/organisations/${org.id}`}
              className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
            >
              <span className="min-w-0 leading-snug transition-colors group-hover:text-accent">
                {formatOrgName(org.name)}
              </span>
              <span className="tnum ml-auto whitespace-nowrap text-muted-foreground">
                {formatInt(org.projects_count, i18n.language)}
              </span>
              <span className="tnum w-20 whitespace-nowrap text-right font-medium">
                {formatCompactEur(org.funding_eur, i18n.language)}
              </span>
            </Link>
          ))}
        </section>
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("country.topProjects")}
          </h2>
          {data.top_projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
            >
              <span className="min-w-0 leading-snug">
                {project.acronym ? (
                  <b className="mr-1.5 font-medium group-hover:text-accent">{project.acronym}</b>
                ) : null}
                <span className="text-muted-foreground">{project.title}</span>
              </span>
              <span className="tnum ml-auto whitespace-nowrap text-muted-foreground">
                {project.start_year ?? ""}
              </span>
              <span className="tnum w-20 whitespace-nowrap text-right font-medium">
                {formatCompactEur(project.funding_eur, i18n.language)}
              </span>
            </Link>
          ))}
        </section>
          </div>
        </div>

        {/* The metadata sidebar — the record's quiet column (Attio). */}
        <aside className="space-y-8 lg:pt-1">
          <section>
            <h2 className="text-label uppercase text-muted-foreground">{t("org.glance")}</h2>
            <dl className="mt-3 space-y-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("org.projects")}</dt>
                <dd className="tnum font-medium">
                  {formatInt(data.kpis.projects_count, i18n.language)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("country.organisations")}</dt>
                <dd className="tnum font-medium">
                  {formatInt(data.kpis.organisations_count, i18n.language)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("country.coordinations")}</dt>
                <dd className="tnum font-medium">
                  {formatInt(data.kpis.coordinator_count, i18n.language)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("org.momentum")}</dt>
                <dd>
                  <TrendDelta series={data.funding_by_year} className="text-[13px]" />
                </dd>
              </div>
            </dl>
          </section>
          <Link
            to={`/projects?country=${data.code}`}
            className="inline-flex rounded-full bg-accent px-4.5 py-2 text-[13.5px] font-medium text-background transition-transform hover:translate-x-0.5"
          >
            {t("country.searchProjects", { name: data.name })} →
          </Link>
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
