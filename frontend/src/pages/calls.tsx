import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { LensUnavailable } from "@/components/lens-unavailable";
import { SectorChip } from "@/components/sector-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type CallRow, type CallsResponse } from "@/lib/api";
import { brusselsDayMonth, callFamilyLabel, daysLeft, deadlineUrgency } from "@/lib/calls";
import { LENS_PARAM, useActiveLensState } from "@/lib/lens";
import { formatCompactEur } from "@/lib/format";
import { cn } from "@/lib/utils";

/** /calls — E1.1 (recette fondatrice : « fonctionnelle mais
 *  administrative »). La liste apprend la grammaire des listes riches
 *  d'Orion : une TÊTE DE RYTHME par appel (statut · échéance ·
 *  urgence), le titre en fort, le label technique en mono, le budget en
 *  tnum à droite, la méta en capitales — et trois REGISTRES distincts
 *  pour Ouverts / À venir / Récemment clos. Aucun changement d'API :
 *  tout est affichage. Le résumé court et les tags thèmes attendront
 *  que la liste les serve (signalé au rapport E1.1). */

const PAGE_SIZE = 50;

type Status = "open" | "upcoming" | "closed";

/* ------------------------------------------------------------------ */
/* La ligne enrichie                                                   */
/* ------------------------------------------------------------------ */

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
  const closed = row.status === "closed";
  const upcoming = row.status === "upcoming";
  // Le rythme : l'échéance pour un ouvert/clos, l'OUVERTURE pour un à
  // venir — c'est sa prochaine date vraie.
  const rhythmIso = upcoming ? (row.opening_date ?? row.next_deadline) : row.next_deadline;
  const remaining = row.status === "open" ? daysLeft(row.next_deadline) : null;
  const urgency = deadlineUrgency(remaining);
  const budget = budgetLine(row, locale);
  const statusWord = t(`calls.statusShort.${row.status}`);
  const dayMonth = brusselsDayMonth(rhythmIso, locale);

  return (
    <article
      className={cn(
        "group -mx-4 rounded-xl border-b border-border-soft px-4 transition-colors last:border-b-0 hover:bg-surface/70",
        closed ? "py-3" : "py-4",
      )}
    >
      <div className="flex gap-x-5">
        {/* La tête de rythme (desktop) : statut, jour, urgence. Le bleu
            reste parcimonieux — seule la ligne d'urgence le porte. */}
        <div className="hidden w-[96px] shrink-0 sm:block" aria-hidden="true">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {statusWord}
          </p>
          <p
            className={cn(
              "display-tight tnum mt-0.5 text-[19px] font-semibold leading-none",
              closed && "font-medium text-muted-foreground",
            )}
          >
            {dayMonth ?? "—"}
          </p>
          {remaining != null && urgency ? (
            <p
              className={cn(
                "tnum mt-1 text-[11px] leading-tight",
                urgency === "critical" ? "font-medium text-accent" : "text-muted-foreground",
              )}
            >
              {t("calls.daysLeft", { count: remaining })}
            </p>
          ) : upcoming && row.opening_date ? (
            <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
              {t("calls.opensWord")}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          {/* Mobile : le rythme en une ligne, avant le titre. */}
          <p className="mb-1 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.14em] sm:hidden">
            <span className="text-muted-foreground">{statusWord}</span>
            <span className={cn("tnum font-semibold", closed ? "text-muted-foreground" : "text-foreground")}>
              {dayMonth}
            </span>
            {remaining != null && urgency ? (
              <span
                className={cn(
                  "tnum",
                  urgency === "critical" ? "font-medium text-accent" : "text-muted-foreground",
                )}
              >
                {t("calls.daysLeft", { count: remaining })}
              </span>
            ) : null}
          </p>

          <p className="flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-muted-foreground">
            <span translate="no">{callFamilyLabel(row.identifier)}</span>
            {row.lens_tags.map((tag) => (
              <span
                key={tag.lens}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 px-1.5 py-px text-[10px] text-accent"
              >
                <i aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                {t(`lens.${tag.lens}.name`, { defaultValue: tag.lens })}
              </span>
            ))}
          </p>

          <div className="mt-0.5 flex items-baseline gap-3">
            <h3
              className={cn(
                "min-w-0 font-medium leading-snug",
                closed ? "text-[13.5px] text-muted-foreground" : "text-[15.5px]",
              )}
            >
              <Link
                to={`/calls/${row.id}`}
                className="underline-offset-2 transition-colors group-hover:text-accent hover:underline"
              >
                {row.title ?? row.identifier}
              </Link>
            </h3>
            {budget ? (
              <span
                className={cn(
                  "display-tight tnum ml-auto shrink-0 whitespace-nowrap font-semibold",
                  closed ? "text-[13px] text-muted-foreground" : "text-[15px]",
                )}
              >
                {budget}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-[.06em] text-muted-foreground">
            {row.framework_programme ? (
              <span>{row.framework_programme.label ?? row.framework_programme.code}</span>
            ) : null}
            {row.types_of_action?.length ? <span>· {row.types_of_action[0]}</span> : null}
            {row.expected_grants ? (
              <span className="tnum">· {t("calls.grantsShort", { count: row.expected_grants })}</span>
            ) : null}
            {row.deadline_model === "multiple cut-off" ? (
              <span>· {t("calls.cutoffs")}</span>
            ) : null}
            <span className="font-mono text-[10px] normal-case tracking-normal" translate="no">
              {row.identifier}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Les groupes d'horizon dans « Ouverts »                              */
/* ------------------------------------------------------------------ */

function horizonKey(row: CallRow): "week" | "month" | "later" {
  const days = daysLeft(row.next_deadline);
  if (days != null && days <= 7) return "week";
  if (days != null && days <= 31) return "month";
  return "later";
}

function HorizonHeader({ label }: { label: string }) {
  return (
    <p className="mt-6 border-b border-border-soft pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground first:mt-2">
      {label}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Une section de statut : requête paginée + registre visuel           */
/* ------------------------------------------------------------------ */

function useCallsInfinite(status: Status, params: URLSearchParams) {
  const key = params.toString();
  return useInfiniteQuery({
    queryKey: ["calls", status, key],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(params);
      p.set("status", status);
      p.set("page", String(pageParam));
      p.set("size", String(PAGE_SIZE));
      return api.calls(p);
    },
    initialPageParam: 1,
    getNextPageParam: (last: CallsResponse, all) =>
      all.reduce((n, page) => n + page.results.length, 0) < last.total
        ? all.length + 1
        : undefined,
  });
}

function StatusSection({
  status,
  params,
  onMeta,
}: {
  status: Status;
  params: URLSearchParams;
  onMeta?: (meta: CallsResponse["meta"]) => void;
}) {
  const { t } = useTranslation();
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useCallsInfinite(
    status,
    params,
  );
  const heading = t(`calls.section.${status}`);
  const total = data?.pages[0]?.total ?? 0;
  const rows = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);
  const meta = data?.pages[0]?.meta;
  const metaRef = useRef(onMeta);
  metaRef.current = onMeta;
  useEffect(() => {
    if (meta) metaRef.current?.(meta);
  }, [meta]);

  if (isPending) {
    return (
      <section aria-label={heading} className="mt-12 space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }
  if (!data) return null;

  const more = hasNextPage ? (
    <button
      type="button"
      onClick={() => fetchNextPage()}
      disabled={isFetchingNextPage}
      className="mt-5 w-full rounded-full border border-border py-2 text-[13px] text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
    >
      {isFetchingNextPage
        ? `${t("calls.loadingMore")}…`
        : t("calls.showMore", { count: Math.min(PAGE_SIZE, total - rows.length) })}
    </button>
  ) : null;

  const empty =
    total === 0 ? <p className="py-5 text-[13.5px] text-muted-foreground">{t("calls.empty")}</p> : null;

  /* Registre 3 — récemment clos : replié, compact, en retrait. */
  if (status === "closed") {
    return (
      <details className="mt-14 border-t pt-6">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-baseline gap-3">
            <i aria-hidden="true" className="inline-block h-2 w-2 translate-y-[-1px] rounded-full border border-border" />
            <span className="text-[15px] font-medium text-muted-foreground">
              {heading} <span className="tnum">({total})</span>
            </span>
            <span aria-hidden="true" className="text-[11px] text-muted-foreground">▾</span>
          </span>
          <span className="mt-0.5 block pl-5 text-[12px] text-muted-foreground">
            {t("calls.closedHint")}
          </span>
        </summary>
        <div className="mt-3">
          {rows.map((row) => (
            <CallRowLine key={row.id} row={row} />
          ))}
          {empty}
          {more}
        </div>
      </details>
    );
  }

  /* Registres 1 et 2 — ouverts (accent plein) / à venir (contour). */
  const openRegister = status === "open";
  const grouped = openRegister
    ? (["week", "month", "later"] as const)
        .map((key) => ({ key, rows: rows.filter((row) => horizonKey(row) === key) }))
        .filter((group) => group.rows.length > 0)
    : null;

  return (
    <section aria-label={heading} className="mt-12">
      <header className="flex items-baseline gap-3 border-b pb-2">
        <i
          aria-hidden="true"
          className={cn(
            "inline-block h-2 w-2 translate-y-[-1px] rounded-full",
            openRegister ? "bg-accent" : "border border-accent/50 bg-accent-soft/30",
          )}
        />
        <h2 className={cn("text-[17px] font-semibold", !openRegister && "text-foreground/80")}>
          {heading}
        </h2>
        <span className="tnum text-[13px] text-muted-foreground">{total}</span>
      </header>
      <div className={cn("mt-1", !openRegister && "opacity-[.92]")}>
        {grouped
          ? grouped.map((group) => (
              <div key={group.key}>
                <HorizonHeader label={t(`calls.horizon.${group.key}`)} />
                {group.rows.map((row) => (
                  <CallRowLine key={row.id} row={row} />
                ))}
              </div>
            ))
          : rows.map((row) => <CallRowLine key={row.id} row={row} />)}
        {empty}
        {more}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Le filtre programme, au registre des segments de l'Explorateur      */
/* ------------------------------------------------------------------ */

function ProgrammeSegment({
  value,
  label,
  entries,
  onChange,
}: {
  value: string;
  label: string;
  entries: { code: string; label: string; topics: number }[];
  onChange: (code: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-1 border-b border-dotted pb-px text-[13.5px] transition-colors",
          value
            ? "border-accent font-medium text-accent"
            : "border-muted-foreground/50 text-muted-foreground hover:border-foreground hover:text-foreground",
        )}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open ? (
        <span
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-[320px] min-w-[300px] overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-key"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!value}
            onClick={() => {
              setOpen(false);
              onChange("");
            }}
            className={cn(
              "block w-full rounded-lg px-3 py-1.5 text-left text-[13px]",
              !value ? "bg-accent-soft/60 font-medium" : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {t("calls.allProgrammes")}
          </button>
          {entries.map((entry) => (
            <button
              key={entry.code}
              type="button"
              role="menuitemradio"
              aria-checked={value === entry.code}
              onClick={() => {
                setOpen(false);
                onChange(entry.code);
              }}
              className={cn(
                "flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-[13px]",
                value === entry.code
                  ? "bg-accent-soft/60 font-medium"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <span className="min-w-0 flex-1">{entry.label}</span>
              <span className="tnum text-[11px] text-muted-foreground/70">
                {entry.topics.toLocaleString(i18n.language)}
              </span>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* La page                                                             */
/* ------------------------------------------------------------------ */

export function CallsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const lensState = useActiveLensState();
  const [meta, setMeta] = useState<CallsResponse["meta"] | null>(null);
  const { data: programmes } = useQuery({
    queryKey: ["call-programmes"],
    queryFn: api.callProgrammes,
  });

  const patch = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { preventScrollReset: true });
  };

  const shared = useMemo(() => {
    const p = new URLSearchParams();
    for (const key of ["q", "programme", LENS_PARAM]) {
      const value = params.get(key);
      if (value) p.set(key, value);
    }
    return p;
  }, [params]);

  const activeProgramme = params.get("programme") ?? "";
  const programmeEntries = programmes?.programmes ?? [];
  const programmeLabel = activeProgramme
    ? (programmeEntries.find((entry) => entry.code === activeProgramme)?.label ?? activeProgramme)
    : t("calls.allProgrammes");
  const hasFilters = Boolean(params.get("q") || activeProgramme);

  if (lensState.kind === "invalid") return <LensUnavailable />;

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("calls.eyebrow")}</p>
      <h1 className="display-tight mt-1 text-[clamp(28px,4vw,40px)] font-semibold">
        {t("calls.title")}
      </h1>
      <p className="mt-2 max-w-[62ch] text-[13.5px] text-muted-foreground">{t("calls.lead")}</p>

      {/* La phrase de filtres — recherche, programme en segment, la
          lentille comme membre de la phrase (pas un chip posé à côté). */}
      <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-border-soft py-3">
        <input
          type="search"
          value={params.get("q") ?? ""}
          onChange={(event) => patch("q", event.target.value)}
          placeholder={`⌕ ${t("calls.searchPlaceholder")}…`}
          aria-label={t("calls.searchPlaceholder")}
          className="w-full max-w-[300px] rounded-full bg-surface px-4 py-1.5 text-[13.5px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
        <ProgrammeSegment
          value={activeProgramme}
          label={programmeLabel}
          entries={programmeEntries}
          onChange={(code) => patch("programme", code)}
        />
        <SectorChip sector={params.get(LENS_PARAM) ?? ""} onChange={(next) => patch(LENS_PARAM, next)} />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("q");
              next.delete("programme");
              setParams(next, { preventScrollReset: true });
            }}
            className="text-[12.5px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("calls.clearFilters")}
          </button>
        ) : null}
      </div>

      <StatusSection status="open" params={shared} onMeta={setMeta} />
      <StatusSection status="upcoming" params={shared} />
      <StatusSection status="closed" params={shared} />

      <footer className="mb-4 mt-14 border-t pt-4 text-[12px] leading-relaxed text-muted-foreground">
        {meta?.last_synced_at ? (
          <p>
            {t("calls.synced", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(meta.last_synced_at)),
            })}
          </p>
        ) : null}
        <p>{t("calls.attribution")}</p>
        <p>{t("calls.brusselsNote")}</p>
      </footer>
    </div>
  );
}
