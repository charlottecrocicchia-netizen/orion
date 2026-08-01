import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { LinesChart } from "@/components/charts";
import { CountryFlags } from "@/components/country-flags";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCompactEur, formatInt, formatOrgName, orgTypeKey, yearsRange } from "@/lib/format";

const MAX_ORGS = 4;
const seriesColor = (index: number) => `var(--color-series-${index + 1})`;

/** Type-to-add picker, reusing the fuzzy organisation search. */
function AddOrganisation({ exclude, onAdd }: { exclude: string[]; onAdd: (id: number) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["compare-picker", q],
    queryFn: () => api.searchOrganisations(new URLSearchParams({ q, size: "6" })),
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
      {q.trim().length >= 3 && suggestions.length > 0 ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[320px] rounded-xl border bg-background p-1.5 shadow-[0_16px_48px_rgba(29,29,31,.14)] dark:shadow-[0_16px_48px_rgba(0,0,0,.5)]"
        >
          {suggestions.map((hit) => (
            <button
              key={hit.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => {
                onAdd(hit.id);
                setQ("");
              }}
              className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-[13.5px] transition-colors hover:bg-surface"
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
  const [params, setParams] = useSearchParams();
  const ids = (params.get("orgs") ?? "").split("~").filter(Boolean).slice(0, MAX_ORGS);

  const { data, isPending } = useQuery({
    queryKey: ["compare", ids.join("~")],
    queryFn: () => api.compareOrganisations(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });

  const setIds = (next: string[]) => {
    const out = new URLSearchParams();
    if (next.length > 0) out.set("orgs", next.join("~"));
    setParams(out, { preventScrollReset: true });
  };

  const entries = data ?? [];
  const series = entries.map((entry) => ({
    key: entry.id,
    label: formatOrgName(entry.name),
    points: entry.funding_by_year
      .filter((point) => point.year >= 2005)
      .map((point) => ({ year: point.year, value: point.amount_eur })),
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
          <AddOrganisation exclude={ids} onAdd={(id) => setIds([...ids, String(id)])} />
        ) : null}
      </div>

      {ids.length === 0 ? (
        <p className="mt-10 max-w-[55ch] text-muted-foreground">{t("compare.empty")}</p>
      ) : isPending ? (
        <Skeleton className="mt-10 h-[420px] w-full" />
      ) : (
        <>
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
                            to={`/organisations/${entry.id}`}
                            className="display-tight block max-w-[26ch] text-[15.5px] font-semibold leading-snug hover:underline underline-offset-2"
                          >
                            {formatOrgName(entry.name)}
                          </Link>
                          <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                            {entry.country ? <CountryFlags codes={[entry.country]} /> : null}
                            {orgTypeKey(entry.org_type)
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

          {series.length >= 1 ? (
            <section className="mt-12">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("org.fundingByYear")}
              </h2>
              <LinesChart series={series} unit="eur" ariaLabel={t("compare.chartLabel")} />
            </section>
          ) : null}

          <div className={cn("mt-12 grid gap-10", entries.length > 1 && "md:grid-cols-2", entries.length > 2 && "lg:grid-cols-4")}>
            {entries.map((entry, index) => (
              <section key={entry.id}>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ background: seriesColor(index) }}
                  />
                  {t("compare.themes")}
                </h2>
                {entry.top_themes.map((theme) => (
                  <div
                    key={theme.key}
                    className="flex items-baseline gap-3 border-b border-border-soft py-2 text-[13px]"
                  >
                    <span className="min-w-0 truncate">{theme.label ?? theme.key}</span>
                    <span className="tnum ml-auto text-muted-foreground">
                      {formatInt(theme.projects, i18n.language)}
                    </span>
                  </div>
                ))}
                <h2 className="mb-3 mt-8 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                  {t("org.partners")}
                </h2>
                {entry.top_partners.map((partner) => (
                  <Link
                    key={partner.id}
                    to={`/organisations/${partner.id}`}
                    className="group flex items-baseline gap-2 border-b border-border-soft py-2 text-[13px]"
                  >
                    <span className="min-w-0 truncate transition-colors group-hover:text-accent">
                      {formatOrgName(partner.name)}
                    </span>
                    <span className="tnum ml-auto whitespace-nowrap text-muted-foreground">
                      {formatInt(partner.shared_projects, i18n.language)}
                    </span>
                  </Link>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
