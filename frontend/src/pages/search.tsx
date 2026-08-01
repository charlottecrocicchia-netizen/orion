import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, NavLink, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { AmountBar } from "@/components/amount-bar";
import { CountryFlags } from "@/components/country-flags";
import { ExploreExits } from "@/components/explore-exits";
import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ProjectHit, ProjectSearchResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  countryFlag,
  formatCompactEur,
  formatInt,
  formatOrgName,
  orgTypeKey,
  yearsRange,
} from "@/lib/format";

function useSearchState() {
  const [params, setParams] = useSearchParams();
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { preventScrollReset: true });
  };
  const toggleMulti = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    const values = next.getAll(key);
    next.delete(key);
    for (const existing of values) if (existing !== value) next.append(key, existing);
    if (!values.includes(value)) next.append(key, value);
    next.delete("page");
    setParams(next, { preventScrollReset: true });
  };
  return { params, update, toggleMulti };
}

function FacetChip({
  active,
  onClick,
  label,
  count,
  flag,
  locale,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  flag?: string;
  locale: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} · ${formatInt(count, locale)}`}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-accent text-background"
          : "bg-surface text-foreground hover:bg-accent-soft hover:text-accent",
      )}
    >
      {flag ? <span aria-hidden="true">{flag}</span> : null}
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn("tnum text-[11.5px]", active ? "opacity-70" : "text-muted-foreground")}
      >
        {formatInt(count, locale)}
      </span>
    </button>
  );
}

function FacetDivider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px self-center bg-border" />;
}

interface HitGroup {
  key: string;
  label: string;
  total: number | null;
  hits: ProjectHit[];
}

/** Relevance pages read better with a spine: hits grouped under the funding
 *  frame they belong to (EU framework roots, ANR as one), page-local order
 *  preserved inside each group, global counts from the facets. */
function groupByFrame(data: ProjectSearchResponse): HitGroup[] {
  const groups: HitGroup[] = [];
  const byKey = new Map<string, HitGroup>();
  for (const hit of data.results) {
    const anr = hit.source === "anr";
    const key = anr ? "anr" : (hit.programme_root ?? hit.source);
    let group = byKey.get(key);
    if (!group) {
      const label = anr
        ? (data.facets.funders.find((f) => f.code === "anr")?.label ?? "ANR")
        : (data.facets.programmes.find((p) => p.id === hit.programme_root_id)?.label ??
          hit.programme_root ??
          hit.source);
      const total = anr
        ? (data.facets.funders.find((f) => f.code === "anr")?.count ?? null)
        : (data.facets.programmes.find((p) => p.id === hit.programme_root_id)?.count ?? null);
      group = { key, label, total, hits: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.hits.push(hit);
  }
  return groups;
}

function ProjectHitRow({ hit, maxFunding }: { hit: ProjectHit; maxFunding: number }) {
  const { t, i18n } = useTranslation();
  return (
    <article className="border-b border-border-soft py-6 last:border-b-0">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-medium">
          {hit.acronym ? <span className="mr-2 text-accent">{hit.acronym}</span> : null}
          <Link to={`/projects/${hit.id}`} className="hover:underline underline-offset-2">
            {hit.title}
          </Link>
        </h2>
        <span className="ml-auto flex shrink-0 flex-col items-end">
          <span className="display-tight tnum whitespace-nowrap text-[17px] font-semibold">
            {formatCompactEur(hit.funding_amount_eur, i18n.language)}
          </span>
          <AmountBar value={hit.funding_amount_eur} max={maxFunding} />
        </span>
      </div>
      {hit.snippet ? (
        <p
          className="mt-1.5 text-[13px] text-muted-foreground [&_b]:font-medium [&_b]:text-accent"
          dangerouslySetInnerHTML={{ __html: hit.snippet }}
        />
      ) : null}
      <p className="mt-2 text-[13px] text-muted-foreground">
        {yearsRange(hit.start_year, hit.end_year)} ·{" "}
        {t("search.organisationsCount", { count: hit.participations_count })}
        {hit.countries.length > 0 ? (
          <>
            {" · "}
            <CountryFlags codes={hit.countries} max={5} />
          </>
        ) : null}
      </p>
    </article>
  );
}

function Tabs({ q }: { q: string }) {
  const { t } = useTranslation();
  const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-4 py-1.5 text-sm",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex gap-1.5">
      <NavLink to={`/projects${suffix}`} className={cls} end>
        {t("search.projectsTab")}
      </NavLink>
      <NavLink to={`/organisations${suffix}`} className={cls} end>
        {t("search.organisationsTab")}
      </NavLink>
    </div>
  );
}

function Pager({
  page,
  hasMore,
  update,
}: {
  page: number;
  hasMore: boolean;
  update: (patch: Record<string, string | null>) => void;
}) {
  const { t } = useTranslation();
  if (page === 1 && !hasMore) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => update({ page: page > 2 ? String(page - 1) : null })}
      >
        ← {t("search.previous")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasMore}
        onClick={() => update({ page: String(page + 1) })}
      >
        {t("search.next")} →
      </Button>
    </div>
  );
}

export function ProjectsSearchPage() {
  const { t, i18n } = useTranslation();
  const { params, update, toggleMulti } = useSearchState();
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1"), 1);

  const apiParams = new URLSearchParams(params);
  apiParams.set("lang", i18n.language.startsWith("fr") ? "fr" : "en");
  const { data, isPending } = useQuery({
    queryKey: ["search-projects", apiParams.toString()],
    queryFn: () => api.searchProjects(apiParams),
    placeholderData: keepPreviousData,
  });

  const activeFunders = params.getAll("funder");
  const activeProgrammes = params.getAll("programme");
  const activeCountries = params.getAll("country");
  const sort = params.get("sort") ?? "relevance";
  const hasFilters =
    activeFunders.length > 0 ||
    activeProgrammes.length > 0 ||
    activeCountries.length > 0 ||
    params.get("year_from") != null ||
    params.get("year_to") != null;
  const maxFunding = Math.max(...(data?.results.map((h) => h.funding_amount_eur ?? 0) ?? []), 0);

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs q={q} />
        <div className="text-[13px] text-muted-foreground">
          {t("search.sort.label")}{" "}
          {(["relevance", "amount", "date"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ sort: key === "relevance" ? null : key })}
              className={cn(
                "ml-2",
                sort === key ? "font-medium text-accent" : "hover:text-foreground",
              )}
            >
              {t(`search.sort.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <h1 className="display-tight tnum text-[26px] font-semibold">
          {isPending ? "…" : t("search.results", { count: data?.total ?? 0 })}
        </h1>
        {q ? (
          <span className="text-sm text-muted-foreground">{t("search.resultsFor", { q })}</span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {data?.facets.funders.map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeFunders.includes(facet.code)}
            onClick={() => toggleMulti("funder", facet.code)}
            label={facet.label}
            count={facet.count}
            locale={i18n.language}
          />
        ))}
        {(data?.facets.programmes.length ?? 0) > 0 ? <FacetDivider /> : null}
        {data?.facets.programmes.slice(0, 5).map((facet) => (
          <FacetChip
            key={facet.id}
            active={activeProgrammes.includes(String(facet.id))}
            onClick={() => toggleMulti("programme", String(facet.id))}
            label={facet.label}
            count={facet.count}
            locale={i18n.language}
          />
        ))}
        {(data?.facets.countries.length ?? 0) > 0 ? <FacetDivider /> : null}
        {data?.facets.countries.slice(0, 6).map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeCountries.includes(facet.code)}
            onClick={() => toggleMulti("country", facet.code)}
            label={facet.code}
            count={facet.count}
            flag={countryFlag(facet.code)}
            locale={i18n.language}
          />
        ))}
        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              update({ funder: null, programme: null, country: null, year_from: null, year_to: null })
            }
            className="ml-1 text-[13px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("search.filters.clear")}
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        {isPending ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mt-4 h-20 w-full" />)
        ) : data && data.results.length === 0 && q ? (
          <p className="mt-10 text-muted-foreground">{t("search.noResults", { q })}</p>
        ) : sort === "relevance" && q && data ? (
          groupByFrame(data).map((group) => (
            <section key={group.key}>
              <header className="mt-8 flex items-baseline gap-3 border-b pb-2 first:mt-3">
                <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
                  {group.label}
                </p>
                {group.total != null ? (
                  <span className="tnum text-[11px] text-muted-foreground/70">
                    {t("search.results", { count: group.total })}
                  </span>
                ) : null}
              </header>
              {group.hits.map((hit) => (
                <ProjectHitRow key={hit.id} hit={hit} maxFunding={maxFunding} />
              ))}
            </section>
          ))
        ) : (
          data?.results.map((hit) => (
            <ProjectHitRow key={hit.id} hit={hit} maxFunding={maxFunding} />
          ))
        )}
      </div>

      <Pager
        page={page}
        hasMore={(data?.total ?? 0) > page * 20}
        update={update}
      />

      <ExploreExits
        exits={[
          { label: t("explore.countriesTitle"), to: "/explore/countries" },
          { label: t("explore.programmesTitle"), to: "/explore/programmes" },
          { label: t("search.organisationsTab"), to: q ? `/organisations?q=${encodeURIComponent(q)}` : "/organisations" },
        ]}
      />
    </div>
  );
}

export function OrganisationsSearchPage() {
  const { t, i18n } = useTranslation();
  const { params, update, toggleMulti } = useSearchState();
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1"), 1);
  const sort = params.get("sort") ?? (q ? "relevance" : "funding");

  const apiParams = new URLSearchParams(params);
  if (!params.get("sort") && !q) apiParams.set("sort", "funding");
  const { data, isPending } = useQuery({
    queryKey: ["search-organisations", apiParams.toString()],
    queryFn: () => api.searchOrganisations(apiParams),
    placeholderData: keepPreviousData,
  });

  const activeCountries = params.getAll("country");
  const maxFunding = Math.max(...(data?.results.map((h) => h.total_funding_eur ?? 0) ?? []), 0);
  const ranked = sort === "funding" || sort === "projects";
  const bestMatch =
    q && sort === "relevance" && page === 1 && (data?.results.length ?? 0) > 0
      ? data?.results[0]
      : null;
  const rest = bestMatch ? (data?.results.slice(1) ?? []) : (data?.results ?? []);

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs q={q} />
        <div className="text-[13px] text-muted-foreground">
          {t("search.sort.label")}{" "}
          {(["relevance", "funding", "projects"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ sort: key === "relevance" ? null : key })}
              className={cn(
                "ml-2",
                sort === key ? "font-medium text-accent" : "hover:text-foreground",
              )}
            >
              {key === "funding" ? t("search.sort.amount") : t(`search.sort.${key === "projects" ? "projects" : "relevance"}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <h1 className="display-tight tnum text-[26px] font-semibold">
          {isPending ? "…" : t("search.results", { count: data?.total ?? 0 })}
        </h1>
        {q ? (
          <span className="text-sm text-muted-foreground">{t("search.resultsFor", { q })}</span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {data?.facets.countries.slice(0, 8).map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeCountries.includes(facet.code)}
            onClick={() => toggleMulti("country", facet.code)}
            label={facet.code}
            count={facet.count}
            flag={countryFlag(facet.code)}
            locale={i18n.language}
          />
        ))}
      </div>

      <div className="mt-2">
        {isPending ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mt-3 h-14 w-full" />)
        ) : (
          <>
            {bestMatch ? (
              <article className="mb-4 mt-3 rounded-2xl border p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/organisations/${bestMatch.id}`}
                      className="display-tight text-[19px] font-semibold leading-snug hover:underline underline-offset-2"
                    >
                      {formatOrgName(bestMatch.name)}
                    </Link>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {bestMatch.country ? <CountryFlags codes={[bestMatch.country]} /> : null}
                      {orgTypeKey(bestMatch.org_type)
                        ? ` ${t(`orgType.${orgTypeKey(bestMatch.org_type)}`)}`
                        : null}
                    </p>
                  </div>
                  <div className="hidden text-accent sm:block">
                    <Sparkline data={bestMatch.funding_by_year} width={150} height={36} />
                  </div>
                  <div className="tnum text-right text-sm text-muted-foreground">
                    {t("search.projectsCount", { count: bestMatch.projects_count })}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="display-tight tnum text-[22px] font-semibold">
                      {formatCompactEur(bestMatch.total_funding_eur, i18n.language)}
                    </span>
                    <AmountBar value={bestMatch.total_funding_eur} max={maxFunding} />
                  </div>
                </div>
              </article>
            ) : null}
            {rest.map((hit, index) => {
              const typeKey = orgTypeKey(hit.org_type);
              return (
                <article
                  key={hit.id}
                  className="flex items-center gap-5 border-b border-border-soft py-4 last:border-b-0"
                >
                  {ranked ? (
                    <span className="tnum w-7 shrink-0 text-right text-[13px] text-muted-foreground">
                      {(page - 1) * 20 + index + 1}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <Link
                      to={`/organisations/${hit.id}`}
                      className="font-medium hover:underline underline-offset-2"
                    >
                      {formatOrgName(hit.name)}
                    </Link>
                    <span className="ml-3 whitespace-nowrap text-[13px] text-muted-foreground">
                      {hit.country ? <CountryFlags codes={[hit.country]} /> : null}
                      {typeKey ? ` ${t(`orgType.${typeKey}`)}` : null}
                    </span>
                  </div>
                  <div className="ml-auto hidden shrink-0 sm:block">
                    <Sparkline data={hit.funding_by_year} />
                  </div>
                  <div className="tnum w-24 shrink-0 whitespace-nowrap text-right text-sm text-muted-foreground">
                    {t("search.projectsCount", { count: hit.projects_count })}
                  </div>
                  <div className="flex w-24 shrink-0 flex-col items-end">
                    <span className="display-tight tnum whitespace-nowrap text-[16px] font-semibold">
                      {formatCompactEur(hit.total_funding_eur, i18n.language)}
                    </span>
                    <AmountBar value={hit.total_funding_eur} max={maxFunding} />
                  </div>
                </article>
              );
            })}
          </>
        )}
      </div>

      <Pager page={page} hasMore={(data?.total ?? 0) > page * 20} update={update} />

      <ExploreExits
        exits={[
          { label: t("search.projectsTab"), to: q ? `/projects?q=${encodeURIComponent(q)}` : "/projects" },
          { label: t("explore.countriesTitle"), to: "/explore/countries" },
        ]}
      />
    </div>
  );
}
