import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCompactEur, formatInt } from "@/lib/format";

/** Programmes, regrouped by frame (recette 2026-08-02: 453 flat cards
 *  were unreadable — and the anti-uniform-cards doctrine rule applies to
 *  lists too). The framework programmes lead as editorial rows; the ANR's
 *  450 national programmes follow as a dense, instantly filterable list.
 *  Hairlines structure everything; no cartouches. */

const strip = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ExploreProgrammesPage() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState("");
  const { data, isPending } = useQuery({ queryKey: ["programmes"], queryFn: api.programmes });

  const { frameworks, national, nationalTotal } = useMemo(() => {
    const all = data ?? [];
    const needle = strip(filter.trim());
    const match = (programme: (typeof all)[number]) =>
      needle === "" ||
      strip(programme.label).includes(needle) ||
      strip(programme.code ?? "").includes(needle);
    const ec = all.filter((programme) => programme.funder_code === "ec" && match(programme));
    const rest = all
      .filter((programme) => programme.funder_code !== "ec" && match(programme))
      .sort((a, b) => (b.funding_eur ?? 0) - (a.funding_eur ?? 0));
    return {
      frameworks: ec.sort((a, b) => (b.funding_eur ?? 0) - (a.funding_eur ?? 0)),
      national: rest,
      nationalTotal: rest.reduce((sum, programme) => sum + (programme.funding_eur ?? 0), 0),
    };
  }, [data, filter]);

  const sectionTitle = "text-xs font-medium uppercase tracking-[.1em] text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t("explore.programmesTitle")}
        </h1>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`⌕ ${t("explore.programmesFilter", { count: data?.length ?? 0 })}`}
          aria-label={t("explore.programmesFilter", { count: data?.length ?? 0 })}
          className="w-full max-w-[320px] rounded-full bg-surface px-4 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      {isPending ? (
        <div className="mt-10 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <>
          {frameworks.length > 0 ? (
            <section className="mt-10" aria-label={t("explore.frameworksSection")}>
              <h2 className={sectionTitle}>
                {t("explore.frameworksSection")}
                <span className="ml-3 normal-case tracking-normal">
                  European Commission
                </span>
              </h2>
              <div className="mt-2">
                {frameworks.map((programme) => (
                  <Link
                    key={programme.id}
                    to={`/explore/programmes/${programme.id}`}
                    className="group flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border-soft py-5"
                  >
                    <span className="min-w-0 text-[19px] font-semibold leading-snug transition-colors group-hover:text-accent">
                      {programme.label}
                    </span>
                    <span className="ml-auto flex items-baseline gap-5 whitespace-nowrap">
                      <span className="display-tight tnum text-[21px] font-semibold">
                        {formatCompactEur(programme.funding_eur, i18n.language)}
                      </span>
                      <span className="tnum text-[13px] text-muted-foreground">
                        {t("search.projectsCount", { count: programme.projects_count })}
                      </span>
                      <span aria-hidden="true" className="text-accent">
                        →
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {national.length > 0 ? (
            <section className="mt-14 pb-16" aria-label={t("explore.nationalSection")}>
              <h2 className={sectionTitle}>
                {t("explore.nationalSection")}
                <span className="tnum ml-3 normal-case tracking-normal">
                  {t("explore.programmesCount", {
                    count: national.length,
                    amount: formatCompactEur(nationalTotal, i18n.language),
                  })}
                </span>
              </h2>
              <div className="mt-2">
                {national.map((programme) => (
                  <Link
                    key={programme.id}
                    to={`/explore/programmes/${programme.id}`}
                    className="group flex items-baseline gap-4 border-b border-border-soft py-2.5 text-[14px]"
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
              </div>
            </section>
          ) : null}

          {frameworks.length === 0 && national.length === 0 ? (
            <p className="mt-16 text-center text-[14.5px] text-muted-foreground">
              {t("explore.noProgrammeMatch", { q: filter.trim() })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
