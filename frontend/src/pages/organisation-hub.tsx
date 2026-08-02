import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CountryFlags } from "@/components/country-flags";
import { ExploreExits } from "@/components/explore-exits";
import { PartnerGraph } from "@/components/partner-graph";
import { TrajectorySpark } from "@/components/trajectory-spark";
import { TrendDelta } from "@/components/trend-delta";
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

      {/* The record hero — the total as a display figure, its trajectory
          drawing itself on entry (doctrine step 4, Attio record layout). */}
      <div className="mt-9 max-w-[680px]">
        <div className="font-display tnum text-[clamp(40px,5vw,58px)] font-[520] leading-none tracking-[-0.028em]">
          {formatCompactEur(data.kpis.total_funding_eur, i18n.language)}
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
            {t("org.portfolio")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
                <th className="py-2 pr-3">{t("org.titleCol")}</th>
                <th className="py-2 pr-3">{t("org.role")}</th>
                <th className="py-2 pr-3">{t("org.year")}</th>
                <th className="py-2 text-right">{t("org.amount")}</th>
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

        <div className="grid gap-10 sm:grid-cols-2">
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

        {partners && partners.length > 0 ? (
        <section>
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
                <dt className="text-muted-foreground">{t("org.asCoordinator")}</dt>
                <dd className="tnum font-medium">
                  {formatInt(data.kpis.coordinator_count, i18n.language)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("org.activePeriod")}</dt>
                <dd className="tnum font-medium">
                  {yearsRange(data.kpis.first_year, data.kpis.last_year)}
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
          {data.identifiers.length > 0 ? (
            <section>
              <h2 className="text-label uppercase text-muted-foreground">ID</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.identifiers.map((identifier) => (
                  <span
                    key={`${identifier.scheme}-${identifier.value}`}
                    className="rounded-lg border px-2.5 py-0.5 font-mono text-[10.5px] uppercase text-muted-foreground"
                    title={identifier.value}
                  >
                    {identifier.scheme} ✓
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          {data.website ? (
            <a
              href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[13px] text-accent underline-offset-2 hover:underline"
            >
              {data.website.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : null}
          <Link
            to={`/compare?orgs=${data.id}`}
            className="inline-flex rounded-full bg-accent px-4.5 py-2 text-[13.5px] font-medium text-background transition-transform hover:translate-x-0.5"
          >
            {t("compare.cta")} →
          </Link>
        </aside>
      </div>

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
