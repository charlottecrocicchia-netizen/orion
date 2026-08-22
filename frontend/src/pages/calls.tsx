import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { LensUnavailable } from "@/components/lens-unavailable";
import { SectorChip } from "@/components/sector-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type CallRow } from "@/lib/api";
import { brusselsDate, daysLeft } from "@/lib/calls";
import { LENS_PARAM, useActiveLensState } from "@/lib/lens";
import { formatCompactEur } from "@/lib/format";

/** /calls — E1 : la page vitrine devient le catalogue (GO fondatrice du
 *  2026-08-22). Trois vérités, jamais mêlées : le FAIT source (dates,
 *  budget, lien portail), le statut DÉRIVÉ des dates, la LECTURE Orion
 *  (badge de lentille). L'état vit dans l'URL — recherche, programme et
 *  lentille compris — et le fuseau affiché est celui de Bruxelles, le
 *  fuseau officiel de soumission. */

function budgetLine(row: CallRow, locale: string): string | null {
  if (row.budget_max_eur == null) return null;
  if (row.budget_min_eur != null && row.budget_min_eur !== row.budget_max_eur) {
    return `${formatCompactEur(row.budget_min_eur, locale)} – ${formatCompactEur(row.budget_max_eur, locale)}`;
  }
  return formatCompactEur(row.budget_max_eur, locale);
}

function CallRowLine({ row }: { row: CallRow }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const remaining = row.status === "open" ? daysLeft(row.next_deadline) : null;
  const budget = budgetLine(row, locale);
  return (
    <Link
      to={`/calls/${row.id}`}
      className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-soft py-3.5"
    >
      <span className="min-w-0 flex-1 basis-[28ch]">
        <span className="block font-mono text-[11.5px] text-muted-foreground">
          {row.identifier}
        </span>
        <span className="block text-[14.5px] leading-snug transition-colors group-hover:text-accent">
          {row.title ?? row.identifier}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted-foreground">
          {row.framework_programme?.label ?? row.framework_programme?.code}
          {row.types_of_action?.length ? ` · ${row.types_of_action[0]}` : ""}
          {row.lens_tags.map((tag) => (
            <span
              key={tag.lens}
              className="ml-2 inline-flex items-center gap-1 rounded-full border border-accent/40 px-2 py-px text-[11px] text-accent"
            >
              <i aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              {t(`lens.${tag.lens}.name`, { defaultValue: tag.lens })}
            </span>
          ))}
        </span>
      </span>
      <span className="tnum whitespace-nowrap text-right text-[13px] text-muted-foreground">
        {budget ?? ""}
      </span>
      <span className="tnum w-[13ch] whitespace-nowrap text-right text-[13.5px]">
        {row.status === "upcoming" && row.opening_date ? (
          <span className="text-muted-foreground">
            {t("calls.opens", { date: brusselsDate(row.opening_date, locale) })}
          </span>
        ) : (
          <>
            <span className="font-medium">{brusselsDate(row.next_deadline, locale)}</span>
            {remaining != null && remaining <= 60 ? (
              <span className="block text-[11.5px] text-muted-foreground">
                {t("calls.daysLeft", { count: remaining })}
              </span>
            ) : null}
          </>
        )}
      </span>
    </Link>
  );
}

function StatusSection({
  status,
  params,
  collapsed,
}: {
  status: "open" | "upcoming" | "closed";
  params: URLSearchParams;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const apiParams = new URLSearchParams(params);
  apiParams.set("status", status);
  const { data, isPending } = useQuery({
    queryKey: ["calls", apiParams.toString()],
    queryFn: () => api.calls(apiParams),
  });

  const heading = t(`calls.section.${status}`);
  if (isPending) {
    return (
      <section aria-label={heading} className="mt-10 space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </section>
    );
  }
  if (!data) return null;

  const rows = (
    <>
      {data.results.map((row) => (
        <CallRowLine key={row.id} row={row} />
      ))}
      {data.total > data.results.length ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {t("calls.truncated", { shown: data.results.length, total: data.total })}
        </p>
      ) : null}
      {data.total === 0 ? (
        <p className="py-6 text-[13.5px] text-muted-foreground">{t("calls.empty")}</p>
      ) : null}
    </>
  );

  if (collapsed) {
    return (
      <details className="mt-10 border-t pt-6">
        <summary className="cursor-pointer text-[17px] font-semibold">
          {heading} <span className="tnum text-muted-foreground">({data.total})</span>
        </summary>
        <div className="mt-2">{rows}</div>
      </details>
    );
  }
  return (
    <section aria-label={heading} className="mt-10 border-t pt-6">
      <h2 className="text-[17px] font-semibold">
        {heading} <span className="tnum font-normal text-muted-foreground">({data.total})</span>
      </h2>
      <div className="mt-2">{rows}</div>
    </section>
  );
}

export function CallsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lensState = useActiveLensState();
  const { data: programmes } = useQuery({
    queryKey: ["call-programmes"],
    queryFn: api.callProgrammes,
  });
  // La fraîcheur et l'attribution valent pour toute la page : la
  // requête « ouverts » les porte déjà, aucune requête de plus.
  const openParams = useMemo(() => {
    const p = filteredParams(params);
    p.set("status", "open");
    return p;
  }, [params]);
  const { data: openData } = useQuery({
    queryKey: ["calls", openParams.toString()],
    queryFn: () => api.calls(openParams),
  });

  function filteredParams(source: URLSearchParams): URLSearchParams {
    const p = new URLSearchParams();
    for (const key of ["q", "programme", LENS_PARAM]) {
      const value = source.get(key);
      if (value) p.set(key, value);
    }
    return p;
  }

  const patch = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { preventScrollReset: true });
  };

  const shared = filteredParams(params);
  const sector = params.get(LENS_PARAM) ?? "";

  // Le refus unifié (M1.2) : une lentille inconnue ne se replie jamais
  // en silence sur le catalogue entier.
  if (lensState.kind === "invalid") return <LensUnavailable />;

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("calls.eyebrow")}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t("calls.title")}
        </h1>
        <SectorChip sector={sector} onChange={(next) => patch(LENS_PARAM, next)} />
      </div>
      <p className="mt-2 max-w-[62ch] text-[13.5px] text-muted-foreground">{t("calls.lead")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={params.get("q") ?? ""}
          onChange={(event) => patch("q", event.target.value)}
          placeholder={`⌕ ${t("calls.searchPlaceholder")}`}
          aria-label={t("calls.searchPlaceholder")}
          className="w-full max-w-[340px] rounded-full bg-surface px-4 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
        <select
          value={params.get("programme") ?? ""}
          onChange={(event) => patch("programme", event.target.value)}
          aria-label={t("calls.programmeFilter")}
          className="max-w-[280px] rounded-full border border-border bg-background px-4 py-2 text-[13.5px]"
        >
          <option value="">{t("calls.allProgrammes")}</option>
          {(programmes?.programmes ?? []).map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>

      <StatusSection status="open" params={shared} />
      <StatusSection status="upcoming" params={shared} />
      <StatusSection status="closed" params={shared} collapsed />

      <footer className="mb-4 mt-12 border-t pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {openData?.meta.last_synced_at ? (
          <p>
            {t("calls.synced", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(openData.meta.last_synced_at)),
            })}
          </p>
        ) : null}
        <p>{t("calls.attribution")}</p>
        <p>{t("calls.brusselsNote")}</p>
      </footer>
    </div>
  );
}
