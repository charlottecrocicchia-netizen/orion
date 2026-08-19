import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, NavLink, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CountryFlags } from "@/components/country-flags";
import { ExploreExits } from "@/components/explore-exits";
import { SearchComposer } from "@/components/search-composer";
import { SectorChip } from "@/components/sector-chip";
import { LensUnavailable } from "@/components/lens-unavailable";
import { LENS_PARAM, useActiveLensState, useCarriedLens, withLens } from "@/lib/lens";
import { Sparkline } from "@/components/sparkline";
import { TrendDelta } from "@/components/trend-delta";
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
  sourceLabel,
  useCountryName,
  yearsRange,
} from "@/lib/format";

/* One shared grid template: the header row and every organisation line wear
 * it together — the spreadsheet alignment is real, not approximate. */
const ORG_GRID = "sm:grid-cols-[minmax(0,1fr)_150px_88px_120px] sm:gap-5";
const ORG_GRID_RANKED = "sm:grid-cols-[26px_minmax(0,1fr)_150px_88px_120px] sm:gap-5";

function useSearchState() {
  const [params, setParams] = useSearchParams();
  const replaceAll = (entries: Record<string, string>) =>
    setParams(new URLSearchParams(entries), { preventScrollReset: true });
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
  return { params, update, toggleMulti, replaceAll };
}

/** The three teaching examples under the empty composer — each poses a
 *  full composed question in one click (the page teaches the gesture). */
function ComposerExamples({
  kind,
  replaceAll,
}: {
  kind: "projects" | "organisations";
  replaceAll: (entries: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const examples: { label: string; entries: Record<string, string> }[] =
    kind === "projects"
      ? [
          {
            label: t("search.composer.ex1"),
            entries: { country: "DE", funder: "ec", q: t("search.composer.ex1Q") },
          },
          {
            label: t("search.composer.ex2"),
            entries: { q: t("search.composer.ex2Q"), year_from: "2021" },
          },
          {
            label: t("search.composer.ex3"),
            entries: { country: "US", q: t("search.composer.ex3Q") },
          },
        ]
      : [
          { label: t("search.composer.exOrg1"), entries: { q: "fraunhofer" } },
          { label: t("search.composer.exOrg2"), entries: { country: "FR", q: "institut" } },
        ];
  return (
    <p className="mt-3 text-[13px] text-muted-foreground">
      {t("search.composer.try")}
      {examples.map((example) => (
        <button
          key={example.label}
          type="button"
          onClick={() => replaceAll(example.entries)}
          className="ml-3 text-accent underline-offset-2 hover:underline"
        >
          {example.label}
        </button>
      ))}
    </p>
  );
}

/** A refine chip (recette 2026-08-02: the loud filled chips were ugly and
 *  dead) — quiet hairline outline, localized label, muted count. Clicking
 *  poses the tag in the bar; ACTIVE facets never render here (they
 *  already live as tags). */
function FacetChip({
  onClick,
  label,
  count,
  flag,
  locale,
}: {
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
      aria-label={`${label} · ${formatInt(count, locale)}`}
      className="flex items-center gap-1.5 rounded-full border border-border-soft px-3 py-1 text-[12.5px] text-foreground/85 transition-colors hover:border-accent hover:text-accent"
    >
      {flag ? <span aria-hidden="true">{flag}</span> : null}
      <span className="leading-snug">{label}</span>
      <span aria-hidden="true" className="tnum text-[11px] text-muted-foreground">
        {formatInt(count, locale)}
      </span>
    </button>
  );
}

/** Localized country name for facet chips — the raw ISO code was ugly. */
interface HitGroup {
  key: string;
  label: string;
  total: number | null;
  hits: ProjectHit[];
}

/** Relevance pages read better with a spine: hits grouped under the funding
 *  frame they belong to (EU framework roots, NIH institutes…), page-local
 *  order preserved inside each group, global counts from the facets. */
function groupByFrame(data: ProjectSearchResponse): HitGroup[] {
  const groups: HitGroup[] = [];
  const byKey = new Map<string, HitGroup>();
  for (const hit of data.results) {
    const key = hit.programme_root ?? hit.source;
    let group = byKey.get(key);
    if (!group) {
      const label =
        data.facets.programmes.find((p) => p.id === hit.programme_root_id)?.label ??
        hit.programme_root ??
        sourceLabel(hit.source);
      const total =
        data.facets.programmes.find((p) => p.id === hit.programme_root_id)?.count ?? null;
      group = { key, label, total, hits: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.hits.push(hit);
  }
  return groups;
}

function ProjectHitRow({ hit }: { hit: ProjectHit }) {
  const carried = useCarriedLens();
  const { t, i18n } = useTranslation();
  return (
    <article className="group -mx-4 rounded-xl border-b border-border-soft px-4 py-6 transition-colors last:border-b-0 hover:bg-surface/70">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-medium">
          {hit.acronym ? <span className="mr-2 text-accent">{hit.acronym}</span> : null}
          <Link to={withLens(`/projects/${hit.id}`, carried)} className="hover:underline underline-offset-2">
            {hit.title}
          </Link>
        </h2>
        <span className="ml-auto shrink-0">
          <span className="display-tight tnum whitespace-nowrap text-[17px] font-semibold">
            {formatCompactEur(hit.funding_amount_eur, i18n.language)}
          </span>
        </span>
      </div>
      {hit.snippet ? (
        <p
          className="mt-1.5 text-[13px] text-muted-foreground [&_b]:font-medium [&_b]:text-accent"
          dangerouslySetInnerHTML={{ __html: hit.snippet }}
        />
      ) : null}
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-[.06em] text-muted-foreground">
        <span className="rounded border px-1.5 py-px font-mono text-[10px] normal-case">
          {sourceLabel(hit.source)}
        </span>
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
  // Les onglets transportent la REQUÊTE ET LE CADRE (fuite ① de la
  // recette du 2026-08-19) : q seul faisait retomber l'autre onglet
  // sur le corpus nu.
  const carried = useCarriedLens();
  const suffix = withLens(q ? `?q=${encodeURIComponent(q)}` : "", carried) || "";
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-4 py-1.5 text-sm transition-colors",
      isActive
        ? "border border-border bg-background"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex rounded-full bg-surface p-1">
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
  const carriedTop = useCarriedLens();
  const { t, i18n } = useTranslation();
  // Les quatre états de la lentille (M1.1 puis M1.2) : le registre
  // tranche ce qui cadre une vue, et un registre illisible n'est jamais
  // un verdict.
  const lensState = useActiveLensState();
  const framed = lensState.kind === "valid" || lensState.kind === "pending";
  const countryName = useCountryName();
  const { params, update, toggleMulti, replaceAll } = useSearchState();
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1"), 1);

  const apiParams = new URLSearchParams(params);
  apiParams.set("lang", i18n.language.startsWith("fr") ? "fr" : "en");
  const { data, isPending } = useQuery({
    queryKey: ["search-projects", apiParams.toString()],
    queryFn: () => api.searchProjects(apiParams),
    placeholderData: keepPreviousData,
    enabled: lensState.kind !== "invalid",
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
    params.get("year_to") != null ||
    // La lentille est un filtre à part entière : une URL cadrée
    // (?sector=<lentille publiée>) encadre une vraie liste, jamais
    // l'invite. Le registre tranche — le front ne connaît aucun slug.
    framed;
  const composed = Boolean(q) || hasFilters;

  // Le refus unifié (M1.2) : mêmes mots qu'à l'Explorateur, jamais un
  // repli silencieux sur le corpus entier.
  if (lensState.kind === "invalid") return <LensUnavailable />;

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

      {/* The composable bar IS the page (conception validated 2026-08-02):
          the question first, the list follows. */}
      <div className="mt-6">
        <SearchComposer kind="projects" params={params} update={update} toggleMulti={toggleMulti} />
        {!composed ? <ComposerExamples kind="projects" replaceAll={replaceAll} /> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-3">
        <h1 className="display-tight tnum text-[26px] font-semibold">
          {isPending ? "…" : t("search.results", { count: data?.total ?? 0 })}
        </h1>
        {q ? (
          <span className="text-sm text-muted-foreground">{t("search.resultsFor", { q })}</span>
        ) : null}
        {/* Le périmètre spatial, nommé sur la liste cadrée (Space natif,
            lot 1) — trois états, l'URL comme seule vérité. */}
        <SectorChip
          sector={framed ? (params.get(LENS_PARAM) ?? "") : ""}
          onChange={(next) => update({ sector: next || null })}
        />
      </div>

      {composed ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {t("search.refine")}
          </span>
          {data?.facets.funders
            .filter((facet) => !activeFunders.includes(facet.code))
            .map((facet) => (
              <FacetChip
                key={facet.code}
                onClick={() => toggleMulti("funder", facet.code)}
                label={facet.label}
                count={facet.count}
                locale={i18n.language}
              />
            ))}
          {data?.facets.programmes
            .filter((facet) => !activeProgrammes.includes(String(facet.id)))
            .slice(0, 4)
            .map((facet) => (
              <FacetChip
                key={facet.id}
                onClick={() => toggleMulti("programme", String(facet.id))}
                label={facet.label}
                count={facet.count}
                locale={i18n.language}
              />
            ))}
          {data?.facets.countries
            .filter((facet) => !activeCountries.includes(facet.code))
            .slice(0, 5)
            .map((facet) => (
              <FacetChip
                key={facet.code}
                onClick={() => toggleMulti("country", facet.code)}
                label={countryName(facet.code)}
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
      ) : null}

      <div className="mt-2">
        {!composed ? (
          // No directory (conception rule): the question first.
          <p className="mt-14 text-center text-[15px] text-muted-foreground">
            {t("search.composer.invite")}
          </p>
        ) : isPending ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mt-4 h-20 w-full" />)
        ) : data && data.results.length === 0 && q ? (
          <div className="mx-auto mt-16 max-w-[440px] text-center">
            <svg viewBox="0 0 120 72" className="mx-auto w-[120px]" aria-hidden="true">
              <line x1="20" y1="48" x2="52" y2="26" stroke="var(--color-border)" strokeWidth="1.4" />
              <line x1="52" y1="26" x2="88" y2="40" stroke="var(--color-border)" strokeWidth="1.4" />
              <circle cx="20" cy="48" r="3.5" fill="var(--color-muted-foreground)" />
              <circle cx="88" cy="40" r="2.8" fill="var(--color-muted-foreground)" />
              <circle cx="52" cy="26" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
              <line x1="59" y1="33" x2="68" y2="42" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="mt-4 text-[15px] text-muted-foreground">{t("search.noResults", { q })}</p>
            <div className="mt-4 flex justify-center gap-4 text-[13.5px]">
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() =>
                    update({ funder: null, programme: null, country: null, year_from: null, year_to: null })
                  }
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {t("search.emptyAction")}
                </button>
              ) : null}
              <Link
                to={withLens(`/organisations?q=${encodeURIComponent(q)}`, carriedTop)}
                className="text-accent underline-offset-2 hover:underline"
              >
                {t("search.emptyCross")}
              </Link>
            </div>
          </div>
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
                <ProjectHitRow key={hit.id} hit={hit} />
              ))}
            </section>
          ))
        ) : (
          data?.results.map((hit) => (
            <ProjectHitRow key={hit.id} hit={hit} />
          ))
        )}
      </div>

      {composed ? (
        <Pager page={page} hasMore={(data?.total ?? 0) > page * 20} update={update} />
      ) : null}

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
  const carriedTop = useCarriedLens();
  const { t, i18n } = useTranslation();
  const countryName = useCountryName();
  const { params, update, toggleMulti, replaceAll } = useSearchState();
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
  const composed = Boolean(q) || activeCountries.length > 0;
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

      <div className="mt-6">
        <SearchComposer
          kind="organisations"
          params={params}
          update={update}
          toggleMulti={toggleMulti}
        />
        {!composed ? <ComposerExamples kind="organisations" replaceAll={replaceAll} /> : null}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <h1 className="display-tight tnum text-[26px] font-semibold">
          {isPending ? "…" : t("search.results", { count: data?.total ?? 0 })}
        </h1>
        {q ? (
          <span className="text-sm text-muted-foreground">{t("search.resultsFor", { q })}</span>
        ) : null}
      </div>

      {composed ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {t("search.refine")}
          </span>
          {data?.facets.countries
            .filter((facet) => !activeCountries.includes(facet.code))
            .slice(0, 6)
            .map((facet) => (
              <FacetChip
                key={facet.code}
                onClick={() => toggleMulti("country", facet.code)}
                label={countryName(facet.code)}
                count={facet.count}
                flag={countryFlag(facet.code)}
                locale={i18n.language}
              />
            ))}
        </div>
      ) : null}

      {/* Les GROUPES en tête (recette 2026-08-04) : la règle du moment
          Safran vaut partout — badge, pastille « annoncé », jamais
          enterrés sous les homonymes. */}
      {!isPending && q && (data?.groups?.length ?? 0) > 0 ? (
        <div className="mb-1 mt-3 space-y-2">
          {data?.groups.map((group) => (
            <article key={group.id} className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-0 flex-1">
                  <span className="mr-2.5 rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 align-middle text-[10.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                    {t("ck.groupBadge")}
                  </span>
                  <Link
                    to={withLens(`/groups/${group.id}`, carriedTop)}
                    className="display-tight align-middle text-[17px] font-semibold leading-snug underline-offset-2 hover:underline"
                  >
                    {group.country ? `${countryFlag(group.country)} ` : ""}
                    {formatOrgName(group.name)}
                  </Link>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {group.entities > 0
                      ? t("ck.groupEntities", { count: group.entities })
                      : null}
                    {group.announced_entities > 0 ? (
                      <span className="ml-1.5 rounded-full border border-dashed px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]">
                        {t("search.groupAnnounced", { count: group.announced_entities })}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="display-tight tnum text-[19px] font-semibold">
                  {group.funding_eur > 0
                    ? formatCompactEur(group.funding_eur, i18n.language)
                    : "—"}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

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
                      to={withLens(`/organisations/${bestMatch.id}`, carriedTop)}
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
                    <TrendDelta series={bestMatch.funding_by_year} className="mt-0.5" />
                  </div>
                </div>
              </article>
            ) : null}
            {/* The Attio grid: one shared template for the header row and
                every line — a real spreadsheet alignment, hairlines, high-
                contrast headers, tabular figures. */}
            {rest.length > 0 ? (
              <div
                className={cn(
                  "hidden border-b py-2 text-[11px] font-semibold uppercase tracking-[.08em] sm:grid",
                  ranked ? ORG_GRID_RANKED : ORG_GRID,
                )}
              >
                {ranked ? <span className="tnum text-right">#</span> : null}
                <span>{t("search.organisationsTab")}</span>
                <span>{t("search.colTrajectory")}</span>
                <span className="text-right">{t("search.colProjects")}</span>
                <span className="text-right">{t("search.colFunding")}</span>
              </div>
            ) : null}
            {rest.map((hit, index) => {
              const typeKey = orgTypeKey(hit.org_type);
              return (
                <article
                  key={hit.id}
                  className={cn(
                    "-mx-3 flex items-center justify-between gap-4 rounded-lg border-b border-border-soft px-3 py-4 transition-colors last:border-b-0 hover:bg-surface/70 sm:mx-0 sm:grid sm:rounded-none sm:px-0",
                    ranked ? ORG_GRID_RANKED : ORG_GRID,
                  )}
                >
                  {ranked ? (
                    <span className="tnum hidden text-right text-[13px] text-muted-foreground sm:block">
                      {(page - 1) * 20 + index + 1}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <Link
                      to={withLens(`/organisations/${hit.id}`, carriedTop)}
                      className="font-medium hover:underline underline-offset-2"
                    >
                      {formatOrgName(hit.name)}
                    </Link>
                    <span className="ml-3 whitespace-nowrap text-[11px] uppercase tracking-[.06em] text-muted-foreground">
                      {hit.country ? <CountryFlags codes={[hit.country]} /> : null}
                      {typeKey ? ` ${t(`orgType.${typeKey}`)}` : null}
                    </span>
                  </div>
                  <div className="hidden text-accent sm:block">
                    <Sparkline data={hit.funding_by_year} />
                  </div>
                  <div className="tnum hidden whitespace-nowrap text-right text-sm text-muted-foreground sm:block">
                    {formatInt(hit.projects_count, i18n.language)}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="display-tight tnum whitespace-nowrap text-[16px] font-semibold">
                      {formatCompactEur(hit.total_funding_eur, i18n.language)}
                    </span>
                    <TrendDelta series={hit.funding_by_year} className="mt-0.5" />
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
