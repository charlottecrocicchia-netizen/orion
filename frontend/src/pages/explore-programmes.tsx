import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCompactEur, formatInt } from "@/lib/format";

/** Programmes, organised for the SCALE TO COME (recette 2026-08-02: even
 *  grouped, 450 flat ANR rows won't survive dozens of sources): the root
 *  page lists the SOURCES — one editorial row per funding agency — and a
 *  source's programmes only unfold once you step inside (?funder=code).
 *  A new agency lands as one more row, never a redesign. Hairlines
 *  structure everything; no cartouches. */

const strip = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ExploreProgrammesPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("");
  const { data, isPending } = useQuery({ queryKey: ["programmes"], queryFn: api.programmes });

  const funderCode = params.get("funder");

  const agencies = useMemo(() => {
    const byCode = new Map<
      string,
      { code: string; name: string; programmes: number; projects: number; funding: number }
    >();
    for (const programme of data ?? []) {
      const agency = byCode.get(programme.funder_code) ?? {
        code: programme.funder_code,
        name: programme.funder_name,
        programmes: 0,
        projects: 0,
        funding: 0,
      };
      agency.programmes += 1;
      agency.projects += programme.projects_count;
      agency.funding += programme.funding_eur ?? 0;
      byCode.set(programme.funder_code, agency);
    }
    return [...byCode.values()].sort((a, b) => b.funding - a.funding);
  }, [data]);

  const agency = funderCode ? agencies.find((entry) => entry.code === funderCode) : null;
  const needle = strip(filter.trim());
  const programmes = useMemo(
    () =>
      (data ?? [])
        .filter((programme) => programme.funder_code === funderCode)
        .filter(
          (programme) =>
            needle === "" ||
            strip(programme.label).includes(needle) ||
            strip(programme.code ?? "").includes(needle),
        )
        .sort((a, b) => (b.funding_eur ?? 0) - (a.funding_eur ?? 0)),
    [data, funderCode, needle],
  );

  const enterAgency = (code: string) => {
    setFilter("");
    setParams({ funder: code }, { preventScrollReset: true });
  };
  const leaveAgency = () => {
    setFilter("");
    setParams({}, { preventScrollReset: true });
  };

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t("explore.programmesTitle")}
        </h1>
        {agency ? (
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`⌕ ${t("explore.programmesFilter", { count: programmes.length })}`}
            aria-label={t("explore.programmesFilter", { count: programmes.length })}
            className="w-full max-w-[320px] rounded-full bg-surface px-4 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
          />
        ) : null}
      </div>

      {isPending ? (
        <div className="mt-10 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : agency ? (
        <section className="mt-8 pb-16" aria-label={agency.name}>
          <button
            type="button"
            onClick={leaveAgency}
            className="text-[13px] text-accent underline-offset-2 hover:underline"
          >
            ‹ {t("explore.allSources")}
          </button>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b pb-5">
            <h2 className="text-[22px] font-semibold">{agency.name}</h2>
            <span className="tnum text-[13.5px] text-muted-foreground">
              {t("explore.sourceMeta", {
                programmes: formatInt(agency.programmes, i18n.language),
                projects: formatInt(agency.projects, i18n.language),
                amount: formatCompactEur(agency.funding, i18n.language),
              })}
            </span>
          </div>
          <div className="mt-1">
            {programmes.map((programme) => (
              <Link
                key={programme.id}
                to={`/explore/programmes/${programme.id}`}
                className="group flex items-baseline gap-4 border-b border-border-soft py-3 text-[14.5px]"
              >
                <span className="min-w-0 leading-snug transition-colors group-hover:text-accent">
                  {programme.label}
                </span>
                <span className="tnum ml-auto whitespace-nowrap text-[13px] text-muted-foreground">
                  {formatInt(programme.projects_count, i18n.language)}
                </span>
                <span className="tnum w-20 whitespace-nowrap text-right text-[13.5px] font-medium">
                  {formatCompactEur(programme.funding_eur, i18n.language)}
                </span>
              </Link>
            ))}
            {programmes.length === 0 ? (
              <p className="mt-12 text-center text-[14.5px] text-muted-foreground">
                {t("explore.noProgrammeMatch", { q: filter.trim() })}
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="mt-8 pb-16">
          <p className="max-w-[56ch] text-[13.5px] text-muted-foreground">
            {t("explore.sourcesLead")}
          </p>
          <div className="mt-4">
            {agencies.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => enterAgency(entry.code)}
                className="group flex w-full flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border-soft py-6 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-[20px] font-semibold leading-snug transition-colors group-hover:text-accent">
                    {entry.name}
                  </span>
                  <span className="tnum mt-0.5 block text-[13px] text-muted-foreground">
                    {t("explore.sourceMeta", {
                      programmes: formatInt(entry.programmes, i18n.language),
                      projects: formatInt(entry.projects, i18n.language),
                      amount: formatCompactEur(entry.funding, i18n.language),
                    })}
                  </span>
                </span>
                <span className="ml-auto flex items-baseline gap-5 whitespace-nowrap">
                  <span className="display-tight tnum text-[21px] font-semibold">
                    {formatCompactEur(entry.funding, i18n.language)}
                  </span>
                  <span aria-hidden="true" className="text-accent">
                    →
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-8 font-mono text-[11px] text-muted-foreground">
            {t("explore.sourcesSoon")}
          </p>
        </div>
      )}
    </div>
  );
}
