import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, NavLink, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { ExploreExits } from "@/components/explore-exits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCompactEur, formatInt, yearsRange } from "@/lib/format";

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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "hover:border-accent hover:text-accent",
      )}
    >
      {children}
    </button>
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

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-8">
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {data?.facets.funders.map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeFunders.includes(facet.code)}
            onClick={() => toggleMulti("funder", facet.code)}
          >
            {facet.label} · {formatInt(facet.count, i18n.language)}
          </FacetChip>
        ))}
        {data?.facets.programmes.slice(0, 5).map((facet) => (
          <FacetChip
            key={facet.id}
            active={activeProgrammes.includes(String(facet.id))}
            onClick={() => toggleMulti("programme", String(facet.id))}
          >
            {facet.label} · {formatInt(facet.count, i18n.language)}
          </FacetChip>
        ))}
        {data?.facets.countries.slice(0, 6).map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeCountries.includes(facet.code)}
            onClick={() => toggleMulti("country", facet.code)}
          >
            {facet.code} · {formatInt(facet.count, i18n.language)}
          </FacetChip>
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
        ) : (
          data?.results.map((hit) => (
            <article key={hit.id} className="border-b py-5 last:border-b-0">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[17px] font-medium">
                  {hit.acronym ? <span className="mr-2 text-accent">{hit.acronym}</span> : null}
                  <Link to={`/projects/${hit.id}`} className="hover:underline underline-offset-2">
                    {hit.title}
                  </Link>
                </h2>
                <span className="display-tight tnum ml-auto whitespace-nowrap text-[17px] font-semibold">
                  {formatCompactEur(hit.funding_amount_eur, i18n.language)}
                </span>
              </div>
              {hit.snippet ? (
                <p
                  className="mt-1.5 text-[13px] text-muted-foreground [&_b]:font-medium [&_b]:text-accent"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              ) : null}
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {hit.programme_root ?? hit.source} · {yearsRange(hit.start_year, hit.end_year)} ·{" "}
                {formatInt(hit.participations_count, i18n.language)}{" "}
                {t("search.organisationsCount", { count: hit.participations_count })
                  .split(" ")
                  .slice(1)
                  .join(" ")}
                {hit.countries.length > 0 ? ` · ${hit.countries.slice(0, 5).join(" ")}` : ""}
              </p>
            </article>
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

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-8">
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

      <div className="mt-4 flex flex-wrap gap-2">
        {data?.facets.countries.slice(0, 8).map((facet) => (
          <FacetChip
            key={facet.code}
            active={activeCountries.includes(facet.code)}
            onClick={() => toggleMulti("country", facet.code)}
          >
            {facet.code} · {formatInt(facet.count, i18n.language)}
          </FacetChip>
        ))}
      </div>

      <div className="mt-2">
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mt-3 h-14 w-full" />
            ))
          : data?.results.map((hit) => (
              <article key={hit.id} className="flex items-baseline gap-4 border-b py-4 last:border-b-0">
                <div className="min-w-0">
                  <Link
                    to={`/organisations/${hit.id}`}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {hit.name}
                  </Link>
                  <span className="ml-3 text-[13px] text-muted-foreground">
                    {[hit.country, hit.org_type].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="tnum ml-auto whitespace-nowrap text-sm text-muted-foreground">
                  {formatInt(hit.projects_count, i18n.language)} {t("org.projects").toLowerCase()}
                </div>
                <div className="display-tight tnum w-24 whitespace-nowrap text-right text-[16px] font-semibold">
                  {formatCompactEur(hit.total_funding_eur, i18n.language)}
                </div>
              </article>
            ))}
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
