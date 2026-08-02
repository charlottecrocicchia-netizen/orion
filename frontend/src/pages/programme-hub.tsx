import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { ExploreExits } from "@/components/explore-exits";
import { Kpi, KpiStatic } from "@/components/kpi";
import { YearBars } from "@/components/year-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  countryFlag,
  formatCompactEur,
  formatInt,
  formatOrgName,
  yearsRange,
} from "@/lib/format";

export function ProgrammeHubPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: ["programme", id],
    queryFn: () => api.programme(id),
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
        <Link to="/explore/programmes" className="transition-colors hover:text-foreground">
          {t("explore.programmesTitle")}
        </Link>{" "}
        › <span>{data.code}</span>
      </nav>

      <h1 className="display-tight mt-6 text-[clamp(28px,4vw,40px)] font-semibold">{data.label}</h1>

      <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Kpi value={data.kpis.funding_eur} label={t("org.totalFunding")} kind="eur" hero />
        <Kpi value={data.kpis.projects_count} label={t("org.projects")} hero />
        <KpiStatic
          value={yearsRange(data.kpis.first_year, data.kpis.last_year)}
          label={t("programme.period")}
        />
        <KpiStatic value={data.code} label={t("project.programme")} />
      </div>

      <section className="mt-14">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("org.fundingByYear")} · M€
        </h2>
        <YearBars data={years.map((d) => ({ year: d.year, amount_eur: d.amount_eur / 1e6 }))} />
      </section>

      <div className="mt-14 grid gap-14 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("programme.topBeneficiaries")}
          </h2>
          {data.top_beneficiaries.map((org) => (
            <Link
              key={org.id}
              to={`/organisations/${org.id}`}
              className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
            >
              {org.country ? (
                <span aria-hidden="true" className="leading-none">
                  {countryFlag(org.country)}
                </span>
              ) : null}
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
            {t("programme.topProjects")}
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

      <ExploreExits
        exits={[
          {
            label: t("programme.searchProjects", { code: data.code }),
            to: `/projects?programme=${data.id}`,
          },
          { label: t("explore.programmesTitle"), to: "/explore/programmes" },
          { label: t("explore.countriesTitle"), to: "/explore/countries" },
        ]}
      />
    </div>
  );
}
