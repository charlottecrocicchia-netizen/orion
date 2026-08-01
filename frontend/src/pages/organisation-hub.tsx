import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CountryFlags } from "@/components/country-flags";
import { ExploreExits } from "@/components/explore-exits";
import { Kpi, KpiStatic } from "@/components/kpi";
import { PartnerGraph } from "@/components/partner-graph";
import { YearBars } from "@/components/year-bars";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  countryFlag,
  formatCompactEur,
  formatInt,
  formatOrgName,
  orgTypeKey,
  yearsRange,
} from "@/lib/format";

export function OrganisationHubPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(Number(params.get("page") ?? "1"), 1);

  const { data, isPending } = useQuery({
    queryKey: ["organisation", id],
    queryFn: () => api.organisation(id),
  });
  const portfolioParams = new URLSearchParams({ page: String(page), size: "10" });
  const { data: portfolio } = useQuery({
    queryKey: ["organisation-projects", id, page],
    queryFn: () => api.organisationProjects(id, portfolioParams),
    placeholderData: keepPreviousData,
  });
  const { data: partners } = useQuery({
    queryKey: ["organisation-partners", id],
    queryFn: () => api.organisationPartners(id),
  });

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-8 h-72 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const years = data.funding_by_year.filter((d) => d.year >= 2005);
  const displayName = formatOrgName(data.name);
  const typeKey = orgTypeKey(data.org_type);

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <nav className="text-[13px] text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/organisations" className="transition-colors hover:text-foreground">
          {t("nav.organisations")}
        </Link>{" "}
        ›{" "}
        <span>
          {displayName.slice(0, 40)}
          {displayName.length > 40 ? "…" : ""}
        </span>
      </nav>

      <p className="mt-6 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {[
          typeKey ? t(`orgType.${typeKey}`) : null,
          data.city ? formatOrgName(data.city) : null,
          data.country ? `${countryFlag(data.country)} ${data.country}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <h1 className="display-tight mt-1.5 max-w-[26ch] text-[clamp(26px,3.6vw,38px)] font-semibold leading-tight">
        {displayName}
      </h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.identifiers.map((identifier) => (
          <span
            key={`${identifier.scheme}-${identifier.value}`}
            className="rounded-lg border px-2.5 py-0.5 text-[11px] uppercase text-muted-foreground"
          >
            {identifier.scheme} ✓
          </span>
        ))}
        {data.website ? (
          <a
            href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-accent underline-offset-2 hover:underline"
          >
            {data.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        <Link
          to={`/compare?orgs=${data.id}`}
          className="rounded-full border px-3 py-0.5 text-[12px] transition-colors hover:border-accent hover:text-accent"
        >
          {t("compare.cta")}
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Kpi value={data.kpis.total_funding_eur} label={t("org.totalFunding")} kind="eur" hero />
        <Kpi value={data.kpis.projects_count} label={t("org.projects")} hero />
        <Kpi value={data.kpis.coordinator_count} label={t("org.asCoordinator")} hero />
        <KpiStatic
          value={yearsRange(data.kpis.first_year, data.kpis.last_year)}
          label={t("org.activePeriod")}
        />
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("org.portfolio")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t("org.titleCol")}</th>
                <th className="py-2 pr-3 font-medium">{t("org.role")}</th>
                <th className="py-2 pr-3 font-medium">{t("org.year")}</th>
                <th className="py-2 text-right font-medium">{t("org.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {portfolio?.results.map((row) => (
                <tr key={`${row.id}-${row.role}-${row.amount_eur}`} className="border-b border-border-soft">
                  <td className="max-w-[34ch] truncate py-2.5 pr-3">
                    <Link to={`/projects/${row.id}`} className="hover:underline underline-offset-2">
                      {row.acronym ? <b className="mr-1.5 font-medium">{row.acronym}</b> : null}
                      <span className="text-muted-foreground">{row.title}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    {row.role === "coordinator" ? (
                      <span className="text-[12.5px] font-medium text-accent">
                        {t("project.coordinator")}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">
                        {t("project.participant")}
                      </span>
                    )}
                  </td>
                  <td className="tnum py-2.5 pr-3 text-muted-foreground">{row.start_year ?? "—"}</td>
                  <td className="tnum py-2.5 text-right font-medium">
                    {formatCompactEur(row.amount_eur, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(portfolio?.total ?? 0) > page * 10 ? (
            <div className="mt-4 flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (page > 2) next.set("page", String(page - 1));
                  else next.delete("page");
                  setParams(next, { preventScrollReset: true });
                }}
              >
                ← {t("search.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(page + 1));
                  setParams(next, { preventScrollReset: true });
                }}
              >
                {t("search.next")} →
              </Button>
            </div>
          ) : null}
        </section>

        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("org.fundingByYear")} · M€
            </h2>
            <YearBars
              data={years.map((d) => ({ year: d.year, amount_eur: d.amount_eur / 1e6 }))}
            />
          </section>
          {data.top_programmes.length > 0 ? (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("org.topProgrammes")}
              </h2>
              {data.top_programmes.map((programme) => (
                <div
                  key={programme.code}
                  className="flex items-baseline justify-between border-b border-border-soft py-2 text-sm"
                >
                  <span>{programme.label}</span>
                  <span className="tnum font-medium">
                    {formatCompactEur(programme.amount_eur, i18n.language)}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </div>

      {partners && partners.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("org.partners")}
          </h2>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <PartnerGraph center={data.name} partners={partners} />
            <div>
              {partners.map((partner) => (
                <Link
                  key={partner.id}
                  to={`/organisations/${partner.id}`}
                  className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
                >
                  {partner.country ? <CountryFlags codes={[partner.country]} /> : null}
                  <span className="min-w-0 truncate transition-colors group-hover:text-accent">
                    {formatOrgName(partner.name)}
                  </span>
                  <span className="tnum ml-auto whitespace-nowrap text-muted-foreground">
                    {t("org.sharedProjects", { count: partner.shared_projects })}
                  </span>
                  <span className="tnum w-20 whitespace-nowrap text-right font-medium">
                    {formatCompactEur(partner.partner_amount_eur, i18n.language)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <ExploreExits
        exits={[
          ...(data.country
            ? [
                {
                  label: `${t("explore.countriesTitle")} · ${data.country}`,
                  to: `/explore/countries/${data.country}`,
                },
              ]
            : []),
          {
            label: t("explore.allProjects"),
            to: `/projects?q=${encodeURIComponent(displayName.split(" ").slice(0, 3).join(" "))}`,
          },
          { label: t("explore.programmesTitle"), to: "/explore/programmes" },
        ]}
      />
      <span className="sr-only">{formatInt(portfolio?.total ?? 0, i18n.language)}</span>
    </div>
  );
}
