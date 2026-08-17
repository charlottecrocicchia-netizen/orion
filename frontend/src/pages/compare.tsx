import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CollectButton } from "@/components/collect-button";
import { CountryFlags } from "@/components/country-flags";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { CompareEntry } from "@/lib/api";
import { ExploreView } from "@/components/explore-view";
import { WorldMap } from "@/components/world-map";
import { useCountryName } from "@/lib/format";
import { addToDossier, removeByParams, useDossier } from "@/lib/dossier";
import { cn } from "@/lib/utils";
import {
  formatCompactEur,
  formatInt,
  formatOrgName,
  orgTypeKey,
  yearsRange,
} from "@/lib/format";

const MAX_ORGS = 4;
const seriesColor = (index: number) => `var(--color-series-${index + 1})`;

/** Ajoute (ou retire) d'un clic les N vues jumelles d'une composition
 *  côte à côte — un bloc de dossier par entité comparée, mêmes params
 *  Explorateur que la vue affichée. */
function TwinCollect({ queries }: { queries: { params: string; title: string }[] }) {
  const { t } = useTranslation();
  const dossier = useDossier();
  const collected =
    queries.length > 0 &&
    queries.every((q) => dossier.items.some((item) => item.params === q.params));
  return (
    <button
      type="button"
      aria-pressed={collected}
      onClick={() => {
        if (collected) for (const q of queries) removeByParams(q.params);
        else for (const q of queries) addToDossier(q.params, q.title);
      }}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
        collected
          ? "border-accent/50 bg-accent-soft text-accent hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
          : "hover:border-accent hover:text-accent",
      )}
    >
      {collected
        ? `✓ ${t("compare.collectedAll")}`
        : `＋ ${t("compare.collectAll", { count: queries.length })}`}
    </button>
  );
}

/** L'écart A − B par année, autour d'un axe zéro — le complément de la
 *  superposition quand on compare exactement deux entités. Chaque barre
 *  porte sa lecture exacte en infobulle native. */
function DeltaStrip({ a, b }: { a: CompareEntry; b: CompareEntry }) {
  const { t, i18n } = useTranslation();
  const byYear = (entry: CompareEntry) =>
    new Map(entry.funding_by_year.map((p) => [p.year, p.amount_eur]));
  const mapA = byYear(a);
  const mapB = byYear(b);
  const years = [...new Set([...mapA.keys(), ...mapB.keys()])]
    .filter((y) => y >= 2005)
    .sort((x, y) => x - y);
  if (years.length < 2) return null;
  const deltas = years.map((year) => (mapA.get(year) ?? 0) - (mapB.get(year) ?? 0));
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const W = 640;
  const H = 96;
  const zero = H / 2;
  const step = W / years.length;
  return (
    <div className="mt-6">
      <p className="mb-2 text-[12px] text-muted-foreground">
        {t("compare.gapLabel", {
          a: formatOrgName(a.name),
          b: formatOrgName(b.name),
        })}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="block w-full"
        role="img"
        aria-label={t("compare.gapLabel", { a: formatOrgName(a.name), b: formatOrgName(b.name) })}
      >
        <line x1="0" y1={zero} x2={W} y2={zero} stroke="var(--color-border)" strokeWidth="1" />
        {years.map((year, index) => {
          const delta = deltas[index];
          const h = (Math.abs(delta) / maxAbs) * (H / 2 - 6);
          return (
            <rect
              key={year}
              x={index * step + step * 0.22}
              y={delta >= 0 ? zero - h : zero}
              width={step * 0.56}
              height={Math.max(h, 0.5)}
              rx="1.5"
              fill={delta >= 0 ? "var(--color-series-1)" : "var(--color-series-2)"}
              opacity="0.8"
            >
              <title>{`${year} : ${delta >= 0 ? "+" : "−"}${formatCompactEur(Math.abs(delta), i18n.language)}`}</title>
            </rect>
          );
        })}
        <text x="0" y={H + 12} className="fill-muted-foreground" fontSize="10">
          {years[0]}
        </text>
        <text x={W} y={H + 12} textAnchor="end" className="fill-muted-foreground" fontSize="10">
          {years[years.length - 1]}
        </text>
      </svg>
    </div>
  );
}

/** Type-to-add picker — organisations by fuzzy search, GROUPS first
 *  with their badge (the benchmark compares Safran to Thales AS groups,
 *  recette 2026-08-04). */
function AddOrganisation({ exclude, onAdd }: { exclude: string[]; onAdd: (ref: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["compare-picker", q],
    queryFn: () => api.searchOrganisations(new URLSearchParams({ q, size: "6" })),
    enabled: q.trim().length >= 3,
    placeholderData: keepPreviousData,
  });
  const { data: suggested } = useQuery({
    queryKey: ["compare-picker-groups", q],
    queryFn: () => api.suggest(q),
    enabled: q.trim().length >= 3,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setQ("");
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const groupHits = (suggested?.groups ?? []).filter(
    (group) => !exclude.includes(`g${group.id}`),
  );
  const suggestions = (data?.results ?? []).filter((hit) => !exclude.includes(String(hit.id)));

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={t("compare.addPlaceholder")}
        aria-label={t("compare.add")}
        className="w-[260px] rounded-full bg-surface px-4 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
      />
      {q.trim().length >= 3 && (groupHits.length > 0 || suggestions.length > 0) ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[320px] rounded-xl border bg-background p-1.5 shadow-key"
        >
          {groupHits.map((group) => (
            <button
              key={`g${group.id}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => {
                onAdd(`g${group.id}`);
                setQ("");
              }}
              className="flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px] leading-snug transition-colors hover:bg-surface"
            >
              <span className="min-w-0">{formatOrgName(group.name)}</span>
              <span className="rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-accent">
                {t("ck.groupBadge")}
              </span>
            </button>
          ))}
          {suggestions.map((hit) => (
            <button
              key={hit.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => {
                onAdd(String(hit.id));
                setQ("");
              }}
              className="block w-full rounded-lg px-3 py-1.5 text-left text-[13.5px] leading-snug transition-colors hover:bg-surface"
            >
              {formatOrgName(hit.name)}
              {hit.country ? (
                <span className="ml-2 text-[12px] text-muted-foreground">{hit.country}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ComparePage() {
  const { t, i18n } = useTranslation();
  const countryName = useCountryName();
  // La couverture par pays vient de l'index — une seule vérité, servie
  // par l'API (lot E, 2026-08-17).
  const { data: countryIndex } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const coverageOf = (code: string) =>
    countryIndex?.find((entry) => entry.code === code)?.coverage ?? "funders";
  const [params, setParams] = useSearchParams();
  const ids = (params.get("orgs") ?? "").split("~").filter(Boolean).slice(0, MAX_ORGS);
  const find = params.get("find");
  // Le benchmark composable (recette 2026-08-05) : métrique × dimension
  // × forme dans l'URL — chaque vue composée est partageable telle
  // quelle, et les vues préparées ne sont que des URL pré-remplies.
  const cby = params.get("cby") ?? "year";
  const cmetric = params.get("cmetric") ?? "funding";
  const cview = params.get("cview") ?? "donut";

  // The free-text parser lands "X vs Y" here as find=X~Y: resolve each term
  // to its best fuzzy match once, then hand over to the regular orgs= state.
  useEffect(() => {
    if (!find || ids.length > 0) return;
    let cancelled = false;
    void Promise.all(
      find
        .split("~")
        .filter(Boolean)
        .slice(0, MAX_ORGS)
        .map((term) =>
          api
            .searchOrganisations(new URLSearchParams({ q: term, size: "1" }))
            .then((r) => r.results[0]?.id),
        ),
    ).then((resolved) => {
      if (cancelled) return;
      const found = resolved.filter((id): id is number => id != null);
      const out = new URLSearchParams();
      if (found.length > 0) out.set("orgs", found.join("~"));
      setParams(out, { replace: true });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find]);

  const { data, isPending } = useQuery({
    queryKey: ["compare", ids.join("~")],
    queryFn: () => api.compareOrganisations(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });

  const setIds = (next: string[]) => {
    const out = new URLSearchParams(params);
    if (next.length > 0) out.set("orgs", next.join("~"));
    else out.delete("orgs");
    setParams(out, { preventScrollReset: true });
  };
  const setCompose = (patch: Record<string, string | null>) => {
    const out = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") out.delete(key);
      else out.set(key, value);
    }
    setParams(out, { preventScrollReset: true });
  };

  const entries = data?.entries ?? [];
  const commonPartners = data?.common_partners ?? [];
  const entityName = (entry: CompareEntry) => formatOrgName(entry.name);
  const trajectoryQuery = `metric=${cmetric}&by=organisation&split=1&compare=${ids.join("~")}&limit=6`;
  const entityQueries = entries.map((entry) => ({
    params: `metric=${cmetric}&by=${cby}&split=0&organisation=${entry.id}&limit=6&view=${cview}`,
    title: t("compare.entityViewTitle", {
      dim: t(`explorer.dim.${cby}`),
      name: entityName(entry),
    }),
    entry,
  }));

  const kpiRows: { label: string; render: (entry: (typeof entries)[number]) => string }[] = [
    {
      label: t("org.totalFunding"),
      render: (entry) => formatCompactEur(entry.kpis.total_funding_eur, i18n.language),
    },
    {
      label: t("org.projects"),
      render: (entry) => formatInt(entry.kpis.projects_count, i18n.language),
    },
    {
      label: t("org.asCoordinator"),
      render: (entry) => formatInt(entry.kpis.coordinator_count, i18n.language),
    },
    {
      label: t("org.activePeriod"),
      render: (entry) => yearsRange(entry.kpis.first_year, entry.kpis.last_year),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("compare.eyebrow")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t("compare.title")}
        </h1>
        {ids.length < MAX_ORGS ? (
          <AddOrganisation exclude={ids} onAdd={(ref) => setIds([...ids, ref])} />
        ) : null}
        {/* The benchmark itself is a collectable view — the compared
            trajectories land in the dossier as one living block. */}
        {ids.length >= 2 && entries.length >= 2 && entries.every((e) => e.kind !== "group") ? (
          <span className="ml-auto">
            <CollectButton
              view={`by=organisation&split=1&compare=${encodeURIComponent(ids.join("~"))}`}
              title={entries.map((entry) => formatOrgName(entry.name)).join(" · ")}
            />
          </span>
        ) : null}
      </div>

      {ids.length === 0 ? (
        <p className="mt-10 max-w-[55ch] text-muted-foreground">{t("compare.empty")}</p>
      ) : isPending ? (
        <Skeleton className="mt-10 h-[420px] w-full" />
      ) : (
        <>
          {/* Doctrine step 4 — the totals as horizontal bars (length is the
              perceptual encoding); each bar wears its column's series color
              so the whole screen speaks one language with the curves. */}
          <section className="mt-9" aria-label={t("compare.totals")}>
            <h2 className="text-label uppercase text-muted-foreground">{t("compare.totals")}</h2>
            <div className="mt-3.5 space-y-2.5">
              {(() => {
                const maxTotal = Math.max(
                  ...entries.map((entry) => entry.kpis.total_funding_eur ?? 0),
                  1,
                );
                return entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[minmax(120px,220px)_minmax(0,1fr)_92px] items-center gap-4"
                  >
                    <span className="text-[13.5px] leading-snug">{formatOrgName(entry.name)}</span>
                    <span aria-hidden="true" className="block h-3">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${Math.max(((entry.kpis.total_funding_eur ?? 0) / maxTotal) * 100, 1)}%`,
                          background: seriesColor(index),
                        }}
                      />
                    </span>
                    <span className="tnum text-right text-[14px] font-medium">
                      {formatCompactEur(entry.kpis.total_funding_eur, i18n.language)}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </section>

          <div className="mt-9 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="w-[180px]" aria-label={t("compare.title")} />
                  {entries.map((entry, index) => (
                    <th key={entry.id} className="px-3 pb-3 text-left align-top">
                      <span className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: seriesColor(index) }}
                        />
                        <span className="min-w-0">
                          <Link
                            to={
                              entry.kind === "group"
                                ? `/groups/${String(entry.id).slice(1)}`
                                : `/organisations/${entry.id}`
                            }
                            className="display-tight block max-w-[26ch] text-[15.5px] font-semibold leading-snug hover:underline underline-offset-2"
                          >
                            {formatOrgName(entry.name)}
                          </Link>
                          <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                            {entry.kind === "group" ? (
                              <span className="mr-1.5 rounded-full border border-accent/50 bg-accent-soft px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                                {t("ck.groupBadge")}
                              </span>
                            ) : null}
                            {entry.country ? <CountryFlags codes={[entry.country]} /> : null}
                            {/* Le badge de couverture (lot E) : une
                                entité d'un pays non couvert par un
                                bailleur chargé porte sa mention — on
                                compare alors des assiettes inégales. */}
                            {entry.country && coverageOf(entry.country) !== "funders" ? (
                              <span
                                title={t("coverage.tipParticipations")}
                                className="ml-1.5 rounded-full border border-dashed px-1.5 py-px text-[9.5px] font-medium uppercase tracking-[0.06em]"
                              >
                                {t("coverage.badgePartial")}
                              </span>
                            ) : null}
                            {entry.kind === "group" && entry.entities != null
                              ? ` ${t("ck.groupEntities", { count: entry.entities })}`
                              : orgTypeKey(entry.org_type)
                                ? ` ${t(`orgType.${orgTypeKey(entry.org_type)}`)}`
                                : null}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={t("compare.remove", { name: formatOrgName(entry.name) })}
                          onClick={() => setIds(ids.filter((id) => id !== String(entry.id)))}
                          className="ml-auto rounded-full px-1.5 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpiRows.map((row) => (
                  <tr key={row.label} className="border-t border-border-soft">
                    <td className="py-3 pr-3 text-[12px] uppercase tracking-[.06em] text-muted-foreground">
                      {row.label}
                    </td>
                    {entries.map((entry) => (
                      <td key={entry.id} className="display-tight tnum px-3 py-3 text-[19px] font-semibold">
                        {row.render(entry)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                  {t("compare.composeTitle")}
                </h2>
                <p className="mt-1 max-w-[62ch] text-[13px] text-muted-foreground">
                  {t("compare.composePhrase")}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {t("compare.preparedLabel")}
              </span>
              {(
                [
                  ["year", t("compare.prepTrajectories")],
                  ["programme", t("compare.prepProgrammes")],
                  ["theme", t("compare.prepThemes")],
                  ["country", t("compare.prepCountries")],
                ] as const
              ).map(([dim, label]) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setCompose({ cby: dim === "year" ? null : dim })}
                  aria-pressed={cby === dim}
                  className={cn(
                    "rounded-full border px-3 py-1 transition-colors",
                    cby === dim
                      ? "border-foreground/50 bg-foreground/5 font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="ml-2 text-muted-foreground">
                {(["funding", "projects"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCompose({ cmetric: m === "funding" ? null : m })}
                    aria-pressed={cmetric === m}
                    className={cn("ml-2", cmetric === m ? "font-medium text-accent" : "hover:text-foreground")}
                  >
                    {t(`explorer.metric.${m}`)}
                  </button>
                ))}
              </span>
              {cby !== "year" ? (
                <span className="text-muted-foreground">
                  {(["donut", "bars"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCompose({ cview: v === "donut" ? null : v })}
                      aria-pressed={cview === v}
                      className={cn("ml-2", cview === v ? "font-medium text-accent" : "hover:text-foreground")}
                    >
                      {v === "donut" ? t("compare.formDonuts") : t("compare.formBars")}
                    </button>
                  ))}
                </span>
              ) : null}
            </div>

            {cby === "year" ? (
              <div className="mt-6">
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <h3 className="text-[13px] font-medium">
                    {t("compare.trajectoriesTitle", {
                      names: entries.map(entityName).join(" · "),
                    })}
                  </h3>
                  <CollectButton
                    view={trajectoryQuery}
                    title={t("compare.trajectoriesTitle", {
                      names: entries.map(entityName).join(" · "),
                    })}
                  />
                </div>
                <ExploreView
                  query={trajectoryQuery}
                  title={t("compare.trajectoriesTitle", {
                    names: entries.map(entityName).join(" · "),
                  })}
                  active
                />
                {entries.length === 2 ? <DeltaStrip a={entries[0]} b={entries[1]} /> : null}
              </div>
            ) : (
              <div className="mt-6">
                <div className="mb-2 flex justify-end">
                  <TwinCollect queries={entityQueries} />
                </div>
                <div className={cn("grid gap-8", entries.length > 1 && "md:grid-cols-2")}>
                  {entityQueries.map(({ params: viewParams, title, entry }, index) => (
                    <div key={entry.id}>
                      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: seriesColor(index) }}
                        />
                        {title}
                      </p>
                      <ExploreView query={viewParams} title={title} active />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Les partenaires COMMUNS — l'info du veilleur : qui
              travaille avec CHAQUE entité comparée. */}
          {entries.length >= 2 ? (
            <section className="mt-12">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("compare.commonTitle")}
              </h2>
              <p className="mb-3 max-w-[62ch] text-[13px] text-muted-foreground">
                {t("compare.commonPhrase")}
              </p>
              {commonPartners.length === 0 ? (
                <p className="text-[13.5px] text-muted-foreground">{t("compare.commonNone")}</p>
              ) : (
                <ul className="divide-y divide-border-soft">
                  {commonPartners.map((partner) => (
                    <li key={partner.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-2.5">
                      <Link
                        to={`/organisations/${partner.id}`}
                        className="min-w-0 flex-1 text-[13.5px] font-medium underline-offset-2 hover:underline"
                      >
                        {partner.country ? <CountryFlags codes={[partner.country]} /> : null}{" "}
                        {formatOrgName(partner.name)}
                      </Link>
                      <span className="flex items-baseline gap-3">
                        {entries.map((entry, index) => (
                          <span key={entry.id} className="tnum flex items-baseline gap-1.5 text-[12.5px] text-muted-foreground">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 self-center rounded-full"
                              style={{ background: seriesColor(index) }}
                            />
                            {t("search.projectsCount", {
                              count: partner.shared[String(entry.id)] ?? 0,
                            })}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {/* La géographie face à face — les cartes d'entités des
              groupes comparés, même grammaire que leurs fiches. */}
          {entries.some((entry) => (entry.countries?.length ?? 0) > 0) ? (
            <section className="mt-12">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("compare.geoTitle")}
              </h2>
              <div className={cn("grid gap-8", entries.length > 1 && "lg:grid-cols-2")}>
                {entries
                  .filter((entry) => (entry.countries?.length ?? 0) > 0)
                  .map((entry, index) => (
                    <div key={entry.id}>
                      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: seriesColor(index) }}
                        />
                        {formatOrgName(entry.name)}
                      </p>
                      <WorldMap
                        countries={(entry.countries ?? []).map((row) => ({
                          code: row.code,
                          name: countryName(row.code),
                          eu_member: false,
                          region: row.region,
                          projects_count: row.entities,
                          funding_eur: row.funding_eur,
                        }))}
                        flows={[]}
                        legendLabel={t("group.mapLegend")}
                        countLabel={(count) => t("ck.groupEntities", { count })}
                      />
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {/* Les anciens actes figés (thèmes, programmes, partenaires par
              colonne) sont devenus des vues préparées du composeur — les
              partenaires de chaque entité vivent sur sa fiche. */}
        </>
      )}
    </div>
  );
}
