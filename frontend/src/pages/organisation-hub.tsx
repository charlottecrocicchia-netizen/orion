import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";

import { useCarriedLens, withLens } from "@/lib/lens";
import { useTranslation } from "react-i18next";

import { CollaboratorsMap } from "@/components/collaborators-map";
import { CollectButton } from "@/components/collect-button";
import { CountryFlags } from "@/components/country-flags";
import { ExploreExits } from "@/components/explore-exits";
import { RoleTimeline } from "@/components/role-timeline";
import { TrajectorySpark } from "@/components/trajectory-spark";
import { TrendDelta } from "@/components/trend-delta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  countryFlag,
  formatCompactEur,
  formatInt,
  formatOrgName,
  orgTypeKey,
  themeLabel,
  yearsRange,
} from "@/lib/format";

/** A deck-style act header — the demo page (lot 4 bis) reads the
 *  organisation through NUMBERED VIEWS, like an Angles deck reads a
 *  question: mono kicker, display title, one reading phrase. */
function ActHeader({ index, title, phrase }: { index: string; title: string; phrase: string }) {
  return (
    <div className="mb-7">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
        {index}
      </p>
      <h2 className="font-display mt-1.5 text-[clamp(21px,2.5vw,28px)] font-[560] tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">{phrase}</p>
    </div>
  );
}

export function OrganisationHubPage() {
  const carried = useCarriedLens();
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
  const { data: partnerCountries } = useQuery({
    queryKey: ["organisation-partner-countries", id],
    queryFn: () => api.organisationPartnerCountries(id),
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
        <Link to={withLens("/organisations", carried)} className="transition-colors hover:text-foreground">
          {t("nav.organisations")}
        </Link>{" "}
        ›{" "}
        {/* The breadcrumb is the sanctioned "short display label" case: the
            full name reads in the h1 right below. */}
        <span title={displayName}>
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
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h1 className="display-tight mt-1.5 max-w-[26ch] text-[clamp(26px,3.6vw,38px)] font-semibold leading-tight">
          {displayName}
        </h1>
        {/* The file's signature view — the funding trajectory — collects
            into the dossier as a living Explorer view. */}
        <div className="mt-2.5 shrink-0">
          <CollectButton
            view={`by=organisation&split=1&compare=${encodeURIComponent(id)}`}
            title={displayName}
          />
        </div>
      </div>

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

      {/* Act 01 — the yearly timeline with the role split (lot 4 bis). */}
      <section className="mt-16 border-t pt-10">
        <ActHeader
          index={`01 · ${t("org.actTrajectoryKicker")}`}
          title={t("org.actTrajectory")}
          phrase={t("org.actTrajectoryPhrase")}
        />
        {(() => {
          const coordinated = years.reduce((sum, row) => sum + row.coordinated_eur, 0);
          const participated = Math.max(data.kpis.total_funding_eur - coordinated, 0);
          const share = (part: number) =>
            data.kpis.total_funding_eur > 0
              ? Math.round((part / data.kpis.total_funding_eur) * 100)
              : 0;
          return (
            <div className="mb-8 grid gap-x-10 gap-y-5 sm:grid-cols-3">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 self-center rounded-[3px] bg-series-1" />
                  <span className="tnum font-display text-[clamp(22px,2.6vw,30px)] font-[560] tracking-[-0.02em]">
                    {formatCompactEur(coordinated, i18n.language)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t("org.statCoordinated", { pct: share(coordinated) })}
                </p>
              </div>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 self-center rounded-[3px] bg-series-2" />
                  <span className="tnum font-display text-[clamp(22px,2.6vw,30px)] font-[560] tracking-[-0.02em]">
                    {formatCompactEur(participated, i18n.language)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t("org.statParticipated", { pct: share(participated) })}
                </p>
              </div>
              <div>
                <span className="tnum font-display text-[clamp(22px,2.6vw,30px)] font-[560] tracking-[-0.02em]">
                  {formatInt(data.kpis.projects_count, i18n.language)}
                </span>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t("org.statProjects", {
                    period: yearsRange(data.kpis.first_year, data.kpis.last_year),
                  })}
                </p>
              </div>
            </div>
          );
        })()}
        <RoleTimeline data={years} />
      </section>

      {/* Act 02 — where the collaborators live, and who returns. */}
      {(partners && partners.length > 0) || (partnerCountries && partnerCountries.length > 0) ? (
        <section id="partners" className="mt-16 scroll-mt-24 border-t pt-10">
          <ActHeader
            index={`02 · ${t("org.actPartnersKicker")}`}
            title={t("org.actPartners")}
            phrase={t("org.actPartnersPhrase")}
          />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {partnerCountries && partnerCountries.length > 0 ? (
              <CollaboratorsMap data={partnerCountries} />
            ) : null}
            {partners && partners.length > 0 ? (
              <div>
                {partners.map((partner) => (
                  <Link
                    key={partner.id}
                    to={withLens(`/organisations/${partner.id}`, carried)}
                    className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
                  >
                    {partner.country ? <CountryFlags codes={[partner.country]} /> : null}
                    <span className="min-w-0 leading-snug transition-colors group-hover:text-accent">
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
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_264px]">
        <div className="min-w-0 space-y-14">
        {/* The watch-post (lot 2): what this organisation works on, as
            shares of its own portfolio. */}
        {data.top_themes.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("org.themesProfile")}
            </h2>
            {(() => {
              const maxTheme = Math.max(...data.top_themes.map((th) => th.amount_eur), 1);
              const total = data.kpis.total_funding_eur || 1;
              return data.top_themes.map((theme) => (
                <div
                  key={theme.key}
                  className="grid grid-cols-[minmax(120px,190px)_minmax(0,1fr)_112px] items-center gap-3 border-b border-border-soft py-2.5 text-[13.5px]"
                >
                  <span className="leading-snug">{themeLabel(theme.key, theme.label, t)}</span>
                  <span
                    aria-hidden="true"
                    className="block h-2 rounded-full bg-gradient-to-r from-accent to-gradient-to"
                    style={{ width: `${Math.max((theme.amount_eur / maxTheme) * 100, 2)}%` }}
                  />
                  <span className="tnum text-right text-muted-foreground">
                    <b className="font-semibold text-foreground">
                      {formatCompactEur(theme.amount_eur, i18n.language)}
                    </b>{" "}
                    · {t("org.themesShare", { pct: Math.round((theme.amount_eur / total) * 100) })}
                  </span>
                </div>
              ));
            })()}
            <p className="mt-2 text-[11.5px] text-muted-foreground">{t("org.themesNote")}</p>
          </section>
        ) : null}

        {/* Signals — thresholded server-side: below the honesty floors,
            nothing shows at all. */}
        {data.signals.accelerating_theme || data.signals.new_partners ? (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("org.signalsTitle")}
            </h2>
            <div className="grid gap-3.5 lg:grid-cols-2">
              {data.signals.accelerating_theme ? (
                <Link
                  to={withLens(`/explore?by=theme&split=1&compare=${encodeURIComponent(data.signals.accelerating_theme.key)}`, carried)}
                  className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-3 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
                >
                  <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-3">
                    ↑ {data.signals.accelerating_theme.growth_pct} %
                  </span>
                  <span className="text-[13.5px] leading-snug">
                    {t("org.signalTheme", {
                      theme: themeLabel(
                        data.signals.accelerating_theme.key,
                        data.signals.accelerating_theme.label,
                        t,
                      ),
                    })}{" "}
                    <span className="tnum text-[11.5px] text-muted-foreground">
                      ({t("org.signalThemeWindow")})
                    </span>
                    <small className="block text-[11.5px] text-muted-foreground">
                      {t("org.signalThemeHint")}
                    </small>
                  </span>
                </Link>
              ) : null}
              {data.signals.new_partners ? (
                <a
                  href="#partners"
                  className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-2 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
                >
                  <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-2">
                    {/* 50 is the server cap — an "at least", never a total. */}
                    {formatInt(data.signals.new_partners.count, i18n.language)}
                    {data.signals.new_partners.count >= 50 ? "+" : ""}
                  </span>
                  <span className="text-[13.5px] leading-snug">
                    {t("org.signalPartners", { count: data.signals.new_partners.count })}
                    {data.signals.new_partners.names.length > 0 ? (
                      <>
                        {" — "}
                        {data.signals.new_partners.names.map(formatOrgName).join(", ")}
                      </>
                    ) : null}
                    <small className="block text-[11.5px] text-muted-foreground">
                      {t("org.signalPartnersHint")}
                    </small>
                  </span>
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

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
                  <td className="max-w-[34ch] py-2.5 pr-3 leading-snug">
                    <Link to={withLens(`/projects/${row.id}`, carried)} className="hover:underline underline-offset-2">
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
          {data.sources_count > 1 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t("org.consolidated", { count: data.sources_count })}
            </p>
          ) : null}
          {data.website ? (
            <a
              href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-[13px] text-accent underline-offset-2 hover:underline"
            >
              {data.website.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : null}
          <Link
            to={withLens(`/compare?orgs=${data.id}`, carried)}
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
