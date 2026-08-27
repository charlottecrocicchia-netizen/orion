/** B2.1 — « Où est passé cet argent ? » (docs/conception-b-chaine-argent-public.md § 15).
 *
 *  Drill-down sur le moteur B1 (/api/chain/*), recomposé pour que la
 *  CHAÎNE soit le repère principal : un rail de parcours matérialise
 *  les étages traversés (ancêtres servis par le moteur — jamais
 *  reconstruits, jamais un étage synthétique : NIH/NSF passent
 *  programme → projet), le breadcrumb reste la navigation secondaire
 *  et accessible. Les montants des ancêtres viennent du cache de
 *  requêtes quand l'étage a été visité — « si disponible », aucun
 *  appel en cascade.
 *
 *  Invariants inchangés (B2) : le moteur fait foi ; l'i18n pose ses
 *  phrases sur les clés stables, jamais sur la prose de l'API ;
 *  inconnu ≠ zéro ; réconciliation affichée telle quelle (`gap` n'est
 *  pas une erreur, un dépassement de plafond n'est jamais déguisé en
 *  barre à 100 %) ; aucun total unique inter-financeurs ; les barres
 *  de distribution n'existent qu'entre valeurs réellement comparables
 *  (même mesure, même devise, au sein d'un même niveau). Tout l'état
 *  vit dans l'URL : copier, rafraîchir, rouvrir = même vue. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";

import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { ExploreExits } from "@/components/explore-exits";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
  type ChainAnnualObligations,
  type ChainChildren,
  type ChainCrumb,
  type ChainFunderBlock,
  type ChainMeasure,
  type ChainNavEntry,
  type ChainProjectNode,
  type ChainProvenance,
  type ChainReconciliation,
} from "@/lib/api";
import { countryFlag, formatCompactMoney, formatInt, formatOrgName } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const TOP_COUNT = 12;

const LEVELS = new Set(["funder", "programme", "call", "project", "organisation", "country"]);

/* ------------------------------------------------------------------ */
/* Vocabulaire : clés stables du moteur → copy i18n (jamais la prose  */
/* française de l'API).                                               */

const MEASURE_KEYS = new Set([
  "ec_max_contribution",
  "ec_max_contribution_sum",
  "nih_obligations_window_sum",
  "nih_obligations_window_sum_sum",
  "nsf_obligated_cumulative",
  "nsf_obligated_cumulative_sum",
  "ec_contribution",
  "ec_contribution_sum",
  "nsf_award_obligated",
  "nsf_awards_obligated_sum",
  "nih_beneficiary_projects_total",
  "nsf_obligation_fy",
  "total_cost",
]);

function useMoneyCopy() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const money = (value: number | null | undefined, currency: string | null | undefined) =>
    formatCompactMoney(value ?? null, locale, currency === "USD" ? "usd" : "eur");
  const measureLabel = (key: string | null | undefined) =>
    key && MEASURE_KEYS.has(key) ? t(`money.measure.${key}`) : (key ?? "");
  const measureShort = (key: string | null | undefined) =>
    key && MEASURE_KEYS.has(key) ? t(`money.measureShort.${key}`) : (key ?? "");
  const natureLabel = (provenance: ChainProvenance | null | undefined) =>
    provenance ? t(`money.nature.${provenance}`) : "";
  return { t, locale, money, measureLabel, measureShort, natureLabel };
}

function usePagePatch(): [number, boolean, (patch: Record<string, string | null>) => void] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const expanded = params.get("expanded") === "1" || page > 1;
  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { preventScrollReset: true });
  };
  return [page, expanded, patch];
}

function pct(share: number, locale: string): string {
  // Une part réelle mais minuscule ne s'affiche JAMAIS « 0 % » — un
  // zéro qui n'en est pas un (esprit I4) : elle devient « < 0,1 % ».
  if (share > 0 && share < 0.05) {
    return `< ${(0.1).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  }
  return `${share.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
}

/* ------------------------------------------------------------------ */
/* Rail de parcours — la chaîne, matérialisée                          */

interface RailNode {
  level: string;
  label: string;
  to?: string;
  amount?: number | null;
  currency?: string | null;
  share?: number | null;
  active?: boolean;
}

function crumbPath(crumb: ChainCrumb): string {
  return `/money/${crumb.level}/${crumb.id}`;
}

function TrailRail({ nodes }: { nodes: RailNode[] }) {
  const { t, locale, money } = useMoneyCopy();
  const levelName = (level: string) => (LEVELS.has(level) ? t(`money.levels.${level}`) : level);

  return (
    <>
      {/* Desktop : rail vertical persistant, collé au défilement. */}
      <nav aria-label={t("money.rail.title")} className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("money.rail.title")}
          </p>
          <ol className="mt-4">
            <li className="relative pb-4 pl-6">
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[4px] top-2 w-px bg-border"
              />
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 h-[9px] w-[9px] rounded-full border-2 border-border bg-background"
              />
              <Link
                to="/money"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("money.eyebrow")}
              </Link>
            </li>
            {nodes.map((node, index) => {
              const last = index === nodes.length - 1;
              return (
                <li key={`${node.level}-${index}`} className="relative pb-4 pl-6 last:pb-0">
                  {!last ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[4px] top-2 w-px bg-border"
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-1 h-[9px] w-[9px] rounded-full border-2",
                      node.active ? "border-accent bg-accent" : "border-border bg-background",
                    )}
                  />
                  {node.share != null ? (
                    <p
                      className="tnum mb-1 text-[11px] text-muted-foreground"
                      title={t("money.trace.ofPrevious", {
                        pct: pct(node.share * 100, locale),
                        parent: nodes[index - 1]?.label ?? "",
                      })}
                    >
                      <span aria-hidden="true">↓ </span>
                      {pct(node.share * 100, locale)}
                      <span className="sr-only">
                        {" "}
                        {t("money.trace.ofPreviousSr", { parent: nodes[index - 1]?.label ?? "" })}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-[10.5px] font-medium uppercase tracking-[.08em] text-muted-foreground">
                    {levelName(node.level)}
                  </p>
                  {node.to && !node.active ? (
                    <Link
                      to={node.to}
                      className="mt-0.5 block max-w-[200px] truncate text-[13.5px] leading-snug transition-colors hover:text-accent"
                      title={node.label}
                    >
                      {node.label}
                    </Link>
                  ) : (
                    <p
                      aria-current="true"
                      className="mt-0.5 max-w-[200px] truncate text-[13.5px] font-medium leading-snug"
                      title={node.label}
                    >
                      {node.label}
                    </p>
                  )}
                  {node.amount != null ? (
                    <p className="tnum mt-0.5 text-[12.5px] text-muted-foreground">
                      {money(node.amount, node.currency)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
      {/* Largeurs étroites : le même parcours, en fil horizontal
          compact — il défile dans son propre conteneur, jamais la page. */}
      <nav
        aria-label={t("money.rail.title")}
        className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-[12.5px] lg:hidden"
      >
        <Link
          to="/money"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("money.eyebrow")}
        </Link>
        {nodes.map((node, index) => (
          <span key={`${node.level}-${index}`} className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            {node.to && !node.active ? (
              <Link
                to={node.to}
                className="max-w-[26ch] truncate rounded-full border px-2.5 py-0.5 transition-colors hover:text-accent"
                title={
                  node.share != null
                    ? t("money.trace.ofPrevious", {
                        pct: pct(node.share * 100, locale),
                        parent: nodes[index - 1]?.label ?? "",
                      })
                    : undefined
                }
              >
                {node.label}
                {node.share != null ? (
                  <span className="tnum text-muted-foreground"> · {pct(node.share * 100, locale)}</span>
                ) : null}
              </Link>
            ) : (
              <span
                aria-current="true"
                className="max-w-[26ch] truncate rounded-full border border-accent/50 bg-accent-soft px-2.5 py-0.5 font-medium"
              >
                {node.label}
                {node.share != null ? (
                  <span className="tnum font-normal text-muted-foreground">
                    {" "}
                    · {pct(node.share * 100, locale)}
                  </span>
                ) : null}
              </span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Coquille : breadcrumb secondaire + rail + panneau principal        */

function TrailShell({
  crumbs,
  rail,
  children,
}: {
  crumbs: BreadcrumbItem[];
  rail: RailNode[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-10">
      <Breadcrumb items={crumbs} />
      <div className="lg:mt-8 lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-14">
        <TrailRail nodes={rail} />
        <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}

function moneyCrumbItems(
  t: (key: string) => string,
  ancestors: ChainCrumb[],
  current: string,
): BreadcrumbItem[] {
  return [
    { label: t("money.eyebrow"), to: "/money" },
    ...ancestors.map((a) => ({ label: a.label ?? a.code ?? String(a.id), to: crumbPath(a) })),
    { label: current },
  ];
}

function railFromAncestors(ancestors: ChainCrumb[], current: RailNode): RailNode[] {
  // La trace vient ENTIÈREMENT du moteur (ancêtres enrichis) : un
  // deep-link porte la même trace qu'une descente par clics.
  return [
    ...ancestors.map((a) => ({
      level: a.level,
      label: a.label ?? a.code ?? String(a.id),
      to: crumbPath(a),
      amount: a.amount,
      currency: a.currency,
      share: a.comparability === "ok" ? a.share_of_parent : null,
    })),
    { ...current, active: true },
  ];
}

/* ------------------------------------------------------------------ */
/* Nature — un signal discret, jamais caché                            */

function NatureMark({ provenance }: { provenance: ChainProvenance | null | undefined }) {
  const { t } = useTranslation();
  if (!provenance) return null;
  return (
    <span
      className="cursor-help text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground underline decoration-border decoration-dotted underline-offset-[3px]"
      title={t(`money.natureHint.${provenance}`)}
    >
      {t(`money.nature.${provenance}`)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Méthodologie : panneau latéral ouvert à la demande                 */

function MethodologyPanel({
  rows,
  restrictions,
}: {
  rows: { label: string; value: string }[];
  restrictions?: string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const filtered = rows.filter((row) => row.value);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">ⓘ</span>
        {t("money.methodology.title")}
      </button>
      {open ? (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={close} />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-label={t("money.methodology.title")}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] overflow-y-auto overscroll-contain border-l bg-background p-6 shadow-key"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("money.methodology.title")}
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-full border px-2.5 py-0.5 text-[12.5px] transition-colors hover:text-accent"
              >
                {t("money.methodology.close")}
              </button>
            </div>
            <dl className="mt-5 space-y-4 text-[13px] leading-relaxed">
              {filtered.map((row) => (
                <div key={row.label}>
                  <dt className="font-medium text-foreground/75">{row.label}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
            {restrictions && restrictions.length > 0 ? (
              <p className="mt-5 border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
                {restrictions.join(" ")}
              </p>
            ) : null}
            <p className="mt-6">
              <Link
                to="/about-data"
                className="text-[13px] text-accent underline-offset-2 hover:underline"
              >
                {t("money.methodology.aboutData")}
              </Link>
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Le chiffre en titre + sa définition — jamais un montant nu          */

function shareFamily(key: string | null | undefined): "cordis" | "nih" | "nsf" | null {
  if (!key) return null;
  if (key.startsWith("ec_")) return "cordis";
  if (key.startsWith("nih_")) return "nih";
  if (key.startsWith("nsf_")) return "nsf";
  return null;
}

function MeasureHero({
  amount,
  measure,
  projects,
  coverage,
  share,
  methodology,
}: {
  amount: number | null;
  measure: ChainMeasure;
  projects?: number;
  coverage?: { with_amount: number; unknown_amount: number };
  share?: import("@/lib/api").ChainNodeShare | null;
  methodology?: ReactNode;
}) {
  const { t, locale, money, measureLabel } = useMoneyCopy();
  const family = shareFamily(measure.key);
  return (
    <div className="mt-8">
      <div className="display-tight tnum text-[clamp(34px,5vw,52px)] font-semibold">
        {amount == null ? (
          <span title={t("money.unknownAmount")}>—</span>
        ) : (
          money(amount, measure.currency)
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span>{amount == null ? t("money.unknownAmount") : measureLabel(measure.key)}</span>
        {amount != null ? <NatureMark provenance={measure.provenance} /> : null}
        {methodology}
      </div>
      {share != null && share.ratio != null && family ? (
        <p className="tnum mt-2 text-[14px] text-muted-foreground">
          {t(`money.shareLine.${family}`, {
            pct: pct(share.ratio * 100, locale),
            parent: share.parent.label ?? "",
          })}
        </p>
      ) : null}
      {projects != null && coverage != null ? (
        <p className="mt-3 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {coverage.unknown_amount > 0
            ? t("money.coverageLine", {
                count: coverage.unknown_amount,
                projects: formatInt(projects, locale),
                unknown: formatInt(coverage.unknown_amount, locale),
              })
            : t("money.coverageFull", { projects: formatInt(projects, locale) })}{" "}
          {t("money.sumObserved")}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Distribution : la répartition se voit avant de se lire              */

interface DistributionRow {
  key: string | number;
  to: string;
  name: string;
  meta?: string;
  flag?: string | null;
  count?: number | null;
  amount: number | null;
}

function DistributionList({
  parentAmount,
  parentName,
  parentCurrency,
  childrenLabel,
  rows,
  total,
  coverage,
  page,
  expanded,
  patch,
  paginated,
  footNotes,
}: {
  parentAmount: number | null;
  parentName: string;
  parentCurrency: string | null | undefined;
  childrenLabel: string;
  rows: DistributionRow[];
  total: number;
  coverage?: { with_amount: number; unknown_amount: number };
  page: number;
  expanded: boolean;
  patch: (changes: Record<string, string | null>) => void;
  paginated: boolean;
  footNotes?: ReactNode;
}) {
  const { t, locale, money } = useMoneyCopy();
  const collapsed = !expanded && rows.length > TOP_COUNT;
  const visible = collapsed ? rows.slice(0, TOP_COUNT) : rows;
  const hasMore = paginated && expanded && page * PAGE_SIZE < total;
  // Concentration : dérivé d'affichage, uniquement quand toutes les
  // valeurs comparées portent la même mesure et que le parent est connu.
  const topSum = visible.reduce(
    (sum, row) => (row.amount != null ? sum + row.amount : sum),
    0,
  );
  const concentration =
    collapsed && parentAmount != null && parentAmount > 0 && topSum > 0
      ? (topSum / parentAmount) * 100
      : null;

  return (
    <section className="mt-14">
      <h2 className="text-[15px] font-medium">
        {parentAmount != null
          ? t("money.nextQuestion", { amount: money(parentAmount, parentCurrency) })
          : t("money.nextQuestionNoAmount")}
      </h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {collapsed
          ? t("money.topOf", { top: TOP_COUNT, n: formatInt(total, locale), count: total })
          : `${childrenLabel} · ${formatInt(total, locale)}`}
        {concentration != null
          ? ` — ${t("money.concentration", {
              top: Math.min(TOP_COUNT, visible.length),
              pct: pct(concentration, locale),
            })}`
          : ""}
      </p>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("money.emptyLevel")}
          </p>
        ) : (
          visible.map((row) => {
            const share =
              parentAmount != null && parentAmount > 0 && row.amount != null
                ? (row.amount / parentAmount) * 100
                : null;
            return (
              <Link
                key={row.key}
                to={row.to}
                className="group flex items-baseline gap-3 border-b border-border-soft py-3 transition-colors hover:bg-surface/50"
              >
                <span className="sr-only">{t("money.followTo", { name: row.name })} — </span>
                {row.flag ? (
                  <span aria-hidden="true" className="leading-none">
                    {row.flag}
                  </span>
                ) : null}
                <span className="min-w-0 truncate text-sm leading-snug transition-colors group-hover:text-accent">
                  {row.name}
                  {row.meta ? (
                    <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                      {row.meta}
                    </span>
                  ) : null}
                </span>
                {row.count != null ? (
                  <span className="tnum ml-auto shrink-0 whitespace-nowrap text-[13px] text-muted-foreground">
                    {formatInt(row.count, locale)}
                  </span>
                ) : (
                  <span className="ml-auto" />
                )}
                <span className="tnum w-24 shrink-0 whitespace-nowrap text-right text-sm font-medium">
                  {row.amount == null ? (
                    <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                      —
                    </span>
                  ) : (
                    money(row.amount, parentCurrency)
                  )}
                </span>
                <span
                  className="tnum hidden w-16 shrink-0 whitespace-nowrap text-right text-[12.5px] text-muted-foreground sm:inline"
                  title={
                    share == null
                      ? undefined
                      : t("money.shareOf", { pct: pct(share, locale), parent: parentName })
                  }
                >
                  {share == null ? "" : pct(share, locale)}
                  {share != null ? (
                    <span className="sr-only"> {t("money.ofParent", { parent: parentName })}</span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 text-muted-foreground/50 transition-colors group-hover:text-accent sm:inline"
                >
                  ›
                </span>
              </Link>
            );
          })
        )}
      </div>
      {collapsed ? (
        <button
          type="button"
          onClick={() => patch({ expanded: "1" })}
          className="mt-5 rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          {t("money.showMore", {
            count: total - TOP_COUNT,
            n: formatInt(total - TOP_COUNT, locale),
          })}
        </button>
      ) : null}
      {expanded && page === 1 && total > TOP_COUNT ? (
        <button
          type="button"
          onClick={() => patch({ expanded: null, page: null })}
          className="mt-5 rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("money.showLess", { n: TOP_COUNT })}
        </button>
      ) : null}
      {coverage && coverage.unknown_amount > 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {t("money.listUnknown", {
            count: coverage.unknown_amount,
            n: formatInt(coverage.unknown_amount, locale),
          })}
        </p>
      ) : null}
      {footNotes}
      {paginated ? <Pager page={page} hasMore={hasMore} update={patch} /> : null}
    </section>
  );
}

function childrenToRows(
  list: ChainChildren,
  toChild: (item: ChainChildren["items"][number]) => string,
): DistributionRow[] {
  return list.items.map((item) => ({
    key: item.id,
    to: toChild(item),
    name: item.label ?? item.code ?? String(item.id),
    meta: item.label && item.code && item.label !== item.code ? item.code : undefined,
    count: item.projects ?? null,
    amount: item.amount,
  }));
}

/* ------------------------------------------------------------------ */
/* Réconciliation — D5, en composition visuelle honnête               */

function ReconRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tnum", strong ? "font-semibold" : "font-medium")}>{value}</dd>
    </div>
  );
}

function ReconciliationBlock({
  reconciliation,
  currency,
}: {
  reconciliation: ChainReconciliation;
  currency: string | null | undefined;
}) {
  const { t, locale, money } = useMoneyCopy();
  if (reconciliation.status === "not_applicable") {
    return (
      <p className="mt-6 max-w-[70ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground/80">{t("money.reconciliation.title")}</b>{" "}
        {t("money.reconciliation.notApplicable")}
      </p>
    );
  }

  const parent = reconciliation.parent_amount;
  const knownSum = reconciliation.children_known_sum;
  const status = reconciliation.status;
  const zeroGap =
    status === "gap" &&
    reconciliation.unallocated != null &&
    Math.abs(reconciliation.unallocated) < 0.01;
  const exceed = status === "children_exceed_parent";
  const dash = "—";

  const rows: { label: string; value: string; strong?: boolean }[] = [
    {
      label: exceed ? t("money.reconciliation.ceiling") : t("money.reconciliation.parent"),
      value: parent == null ? t("money.unknown") : money(parent, currency),
      strong: true,
    },
    {
      label: t("money.reconciliation.childrenSum"),
      value: knownSum == null ? t("money.unknown") : money(knownSum, currency),
    },
  ];
  if (exceed) {
    rows.push({
      label: t("money.reconciliation.excess"),
      value:
        reconciliation.unallocated == null
          ? dash
          : `+${money(Math.abs(reconciliation.unallocated), currency)}`,
    });
  } else {
    rows.push({
      label: t("money.reconciliation.unallocated"),
      value:
        status === "gap" && !zeroGap && reconciliation.unallocated != null
          ? money(reconciliation.unallocated, currency)
          : dash,
    });
  }
  rows.push({
    label: t("money.reconciliation.unknownChildren"),
    value:
      reconciliation.unknown_children != null && reconciliation.unknown_children > 0
        ? formatInt(reconciliation.unknown_children, locale)
        : dash,
  });

  // Le « 43,5 % non ventilé » : arithmétique d'affichage sur la même
  // réponse — jamais un ratio entre mesures incompatibles.
  const gapShare =
    status === "gap" && !zeroGap && parent != null && parent > 0 && reconciliation.unallocated != null
      ? (reconciliation.unallocated / parent) * 100
      : null;

  return (
    <div className="mt-8 rounded-2xl border border-border-soft bg-surface/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.reconciliation.title")}
      </p>
      <dl className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <ReconRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
        ))}
      </dl>
      <p className="mt-3 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
        {status === "exact"
          ? t("money.reconciliation.status.exact")
          : zeroGap
            ? t("money.reconciliation.status.gap_zero", {
                count: reconciliation.unknown_children ?? 0,
              })
            : gapShare != null
              ? `${t("money.reconciliation.gapShare", { pct: pct(gapShare, locale) })} ${t(
                  "money.reconciliation.status.gap",
                )}`
              : t(`money.reconciliation.status.${status}`)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NSF — deux systèmes de mesure, deux blocs, jamais fondus            */

function NsfMeasureSystems({
  cumulative,
  axis,
}: {
  cumulative: { amount: number | null; measure: ChainMeasure };
  axis: ChainAnnualObligations;
}) {
  const { t, money, measureShort } = useMoneyCopy();
  return (
    <section className="mt-14">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.nsf.systemsTitle")}
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border-soft px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(cumulative.measure.key)}
          </p>
          <p className="display-tight tnum mt-2 text-[26px] font-semibold">
            {money(cumulative.amount, "USD")}
          </p>
          <dl className="mt-3 space-y-0.5 text-[12px] text-muted-foreground">
            <div>
              <dt className="sr-only">{t("money.methodology.nature")}</dt>
              <dd>
                <NatureMark provenance={cumulative.measure.provenance} />
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-medium text-foreground/60">{t("money.nsf.period")}</dt>
              <dd>{t("money.nsf.cumulativeNote")}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-medium text-foreground/60">{t("money.methodology.source")}</dt>
              <dd>{t("money.nsf.cumulativeProvenance")}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border-soft px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(axis.measure.key)}
          </p>
          <p className="display-tight tnum mt-2 text-[26px] font-semibold">
            {money(axis.window_sum, "USD")}
          </p>
          <dl className="mt-3 space-y-0.5 text-[12px] text-muted-foreground">
            <div>
              <dt className="sr-only">{t("money.methodology.nature")}</dt>
              <dd>
                <NatureMark provenance={axis.measure.provenance} />
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-medium text-foreground/60">{t("money.nsf.period")}</dt>
              <dd>{t("money.nsf.windowNote")}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-medium text-foreground/60">{t("money.methodology.source")}</dt>
              <dd>{t("money.nsf.vintage", { vintage: axis.vintage })}</dd>
            </div>
          </dl>
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[10.5px] font-semibold uppercase tracking-[.08em]">
                <th scope="col" className="py-1.5 pr-3">
                  {t("money.nsf.fy")}
                </th>
                <th scope="col" className="py-1.5 text-right">
                  {t("money.nsf.obligation")}
                </th>
              </tr>
            </thead>
            <tbody>
              {axis.fiscal_years.map((row) => (
                <tr key={row.fy} className="border-b border-border-soft">
                  <td className="tnum py-1.5 pr-3">{row.fy}</td>
                  <td className="tnum py-1.5 text-right">{money(row.amount, "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 max-w-[70ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("money.nsf.notDecomposition")}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Participants / bénéficiaires                                        */

function ParticipationsSection({ data }: { data: ChainProjectNode }) {
  const { t, locale, money } = useMoneyCopy();
  const beneficiary = data.children.level === "beneficiary";
  const items = data.children.items;
  const parent = data.measure.amount;

  return (
    <section className="mt-14">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {beneficiary
          ? t("money.children.beneficiary", { count: data.children.total })
          : t("money.children.participation", { count: data.children.total })}{" "}
        · {formatInt(data.children.total, locale)}
      </h2>
      {beneficiary ? (
        <p className="mb-4 max-w-[70ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.nih.beneficiaryNote")}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {beneficiary ? t("money.nih.noBeneficiary") : t("money.emptyLevel")}
        </p>
      ) : (
        items.map((item) => {
          const share =
            !beneficiary && parent != null && parent > 0 && item.amount != null
              ? (item.amount / parent) * 100
              : null;
          return (
            <div
              key={item.source_uid}
              className="flex items-baseline gap-3 border-b border-border-soft py-3"
            >
              <span className="min-w-0 truncate text-sm leading-snug">
                <Link
                  to={`/money/organisation/${item.organisation.id}`}
                  className="transition-colors hover:text-accent"
                >
                  {formatOrgName(item.organisation.label)}
                </Link>
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {item.role ?? ""}
              </span>
              {item.country ? (
                <Link
                  to={`/money/country/${item.country}`}
                  className="shrink-0 text-[12.5px] text-muted-foreground transition-colors hover:text-accent"
                >
                  <span aria-hidden="true">{countryFlag(item.country)}</span> {item.country}
                </Link>
              ) : null}
              {!beneficiary ? (
                <>
                  <span className="tnum ml-auto w-24 shrink-0 whitespace-nowrap text-right text-sm font-medium">
                    {item.amount == null ? (
                      <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                        {t("money.unknown")}
                      </span>
                    ) : (
                      money(item.amount, data.measure.currency)
                    )}
                  </span>
                  <span
                    className="tnum hidden w-24 shrink-0 whitespace-nowrap text-right text-[12.5px] text-muted-foreground sm:inline"
                    title={
                      share == null ? undefined : t("money.ofProjectFull", { pct: pct(share, locale) })
                    }
                  >
                    {share == null ? "" : t("money.ofProject", { pct: pct(share, locale) })}
                  </span>
                </>
              ) : (
                <span className="ml-auto" />
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* États                                                               */

function LoadingBlock() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pt-10">
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-8 lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-14">
        <Skeleton className="hidden h-48 w-full lg:block" />
        <div>
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="mt-8 h-24 w-full" />
          <Skeleton className="mt-8 h-56 w-full" />
        </div>
      </div>
    </div>
  );
}

function ErrorBlock({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-24 text-center">
      <p className="text-lg font-medium">{notFound ? t("money.notFound") : t("money.error")}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? t("money.notFoundHint") : t("money.errorHint")}
      </p>
      <p className="mt-6 flex items-center justify-center gap-4 text-sm">
        {!notFound ? (
          <button
            type="button"
            onClick={retry}
            className="rounded-full border px-4 py-1.5 transition-colors hover:text-accent"
          >
            {t("money.retry")}
          </button>
        ) : null}
        <Link to="/money" className="text-accent underline-offset-2 hover:underline">
          {t("money.backToRoot")}
        </Link>
      </p>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[.1em] text-accent">{children}</p>;
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="display-tight mt-1.5 text-[clamp(26px,3.4vw,38px)] font-semibold">
      {children}
    </h1>
  );
}

function callNotAvailableNote(t: (k: string) => string, down: ChainNavEntry[]): ReactNode {
  const call = down.find((entry) => entry.level === "call");
  if (call?.status !== "not_available") return null;
  return (
    <p className="mt-2 max-w-[70ch] text-[12.5px] text-muted-foreground">
      {t("money.callNotAvailable")}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Racine — trois portes d'entrée                                      */

function FundersRoot() {
  const { t, locale, money, measureShort } = useMoneyCopy();
  const query = useQuery({ queryKey: ["chain-funders"], queryFn: api.chainFunders });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const { funders, cross_funder_total } = query.data;
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-14">
      <Eyebrow>{t("money.eyebrow")}</Eyebrow>
      <Title>{t("money.title")}</Title>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
        {t("money.lead")}
      </p>
      <p className="mt-3 text-[14px] font-medium">{t("money.rootGesture")}</p>
      {/* Trois univers NON comparables : trois blocs distincts, aucune
          barre commune, aucun classement, aucun total. */}
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {funders.map((funder) => (
          <Link
            key={funder.id}
            to={`/money/funder/${funder.id}`}
            className="group flex flex-col rounded-2xl border p-7 transition-colors hover:border-accent/60"
          >
            <p className="text-[11px] font-medium uppercase tracking-[.09em] text-muted-foreground">
              {funder.label}
            </p>
            <p className="display-tight tnum mt-5 text-[34px] font-semibold">
              {money(funder.aggregate.amount, funder.aggregate.measure.currency)}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              {measureShort(funder.aggregate.measure.key)}
            </p>
            <p className="tnum mt-4 text-[12.5px] text-muted-foreground">
              {t("money.rootProjects", {
                count: funder.aggregate.projects,
                n: formatInt(funder.aggregate.projects, locale),
              })}
            </p>
            <p className="mt-6 text-sm font-medium text-accent">
              {t("money.explore")}{" "}
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </p>
          </Link>
        ))}
      </div>
      {!cross_funder_total.available ? (
        <p className="mt-8 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
          <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
          {t("money.noTotalBody")}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vues par niveau                                                     */

function FunderView({ code }: { code: string }) {
  const { t, measureLabel } = useMoneyCopy();
  const [page, expanded, patch] = usePagePatch();
  const query = useQuery({
    queryKey: ["chain-funder", code],
    queryFn: () => api.chainFunder(code),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const rail = railFromAncestors(data.ancestors, {
    level: "funder",
    label: data.node.label,
    amount: data.aggregate?.amount,
    currency: data.aggregate?.measure.currency,
  });
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, data.node.label)} rail={rail}>
      <Eyebrow>{t("money.levels.funder")}</Eyebrow>
      <Title>{data.node.label}</Title>
      {data.aggregate ? (
        <MeasureHero
          amount={data.aggregate.amount}
          measure={data.aggregate.measure}
          projects={data.aggregate.projects}
          coverage={data.aggregate.coverage}
          methodology={
            <MethodologyPanel
              rows={[
                {
                  label: t("money.methodology.measure"),
                  value: measureLabel(data.aggregate.measure.key),
                },
                {
                  label: t("money.methodology.programmeSemantics"),
                  value: t(`money.programmeSemantics.${code}`),
                },
                { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
                { label: t("money.methodology.notBudget"), value: t("money.notBudget") },
              ]}
            />
          }
        />
      ) : null}
      {callNotAvailableNote(t, data.navigation.down)}
      <DistributionList
        parentAmount={data.aggregate?.amount ?? null}
        parentName={data.node.label}
        parentCurrency={data.aggregate?.measure.currency}
        childrenLabel={t("money.children.programme", { count: data.children.total })}
        rows={childrenToRows(data.children, (item) => `/money/programme/${item.id}`)}
        total={data.children.total}
        page={page}
        expanded={expanded}
        patch={patch}
        paginated={false}
      />
    </TrailShell>
  );
}

function ProgrammeView({ id }: { id: string }) {
  const { t, locale, measureLabel } = useMoneyCopy();
  const [page, expanded, patch] = usePagePatch();
  const query = useQuery({
    queryKey: ["chain-programme", id, page],
    queryFn: () =>
      api.chainProgramme(id, new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })),
    placeholderData: keepPreviousData,
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const label = data.node.label ?? data.node.code;
  const childLevel = data.children.level;
  const title =
    childLevel === "programme"
      ? t("money.children.programme", { count: data.children.total })
      : childLevel === "call"
        ? t("money.children.call", { count: data.children.total })
        : t("money.children.project", { count: data.children.total });
  const rail = railFromAncestors(data.ancestors, {
    level: "programme",
    label,
    amount: data.aggregate.amount,
    currency: data.aggregate.measure.currency,
  });
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, label)} rail={rail}>
      <Eyebrow>
        {t("money.levels.programme")} ·{" "}
        <span className="font-mono normal-case">{data.node.code}</span>
      </Eyebrow>
      <Title>{label}</Title>
      <MeasureHero
        amount={data.aggregate.amount}
        measure={data.aggregate.measure}
        projects={data.aggregate.projects}
        coverage={data.aggregate.coverage}
        share={data.share_of_parent}
        methodology={
          <MethodologyPanel
            rows={[
              {
                label: t("money.methodology.measure"),
                value: measureLabel(data.aggregate.measure.key),
              },
              {
                label: t("money.methodology.programmeSemantics"),
                value: t(`money.programmeSemantics.${data.node.funder}`),
              },
              { label: t("money.methodology.notBudget"), value: t("money.notBudget") },
              ...(childLevel === "call"
                ? [{ label: t("money.methodology.callLink"), value: t("money.callReconstructed") }]
                : []),
            ]}
          />
        }
      />
      {callNotAvailableNote(t, data.navigation.down)}
      <DistributionList
        parentAmount={data.aggregate.amount}
        parentName={label}
        parentCurrency={data.aggregate.measure.currency}
        childrenLabel={title}
        rows={childrenToRows(data.children, (item) =>
          childLevel === "programme"
            ? `/money/programme/${item.id}`
            : childLevel === "call"
              ? `/money/call/${item.id}?programme=${data.node.id}`
              : `/money/project/${item.id}`,
        )}
        total={data.children.total}
        coverage={data.children.coverage}
        page={page}
        expanded={expanded}
        patch={patch}
        paginated={childLevel === "call" || childLevel === "project"}
        footNotes={
          <>
            {childLevel === "call" ? (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                {t("money.callScopeNote")}
              </p>
            ) : null}
            {data.children.directly_on_parent ? (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                {t("money.directlyOnParent", {
                  count: data.children.directly_on_parent,
                  n: formatInt(data.children.directly_on_parent, locale),
                })}
              </p>
            ) : null}
            {data.children.no_call_projects ? (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {t("money.noCallProjects", {
                  count: data.children.no_call_projects,
                  n: formatInt(data.children.no_call_projects, locale),
                })}
              </p>
            ) : null}
          </>
        }
      />
    </TrailShell>
  );
}

function CallView({ id }: { id: string }) {
  const { t, locale, measureLabel } = useMoneyCopy();
  const [page, expanded, patch] = usePagePatch();
  const [params] = useSearchParams();
  const programmeContext = params.get("programme");
  const query = useQuery({
    queryKey: ["chain-call", id, programmeContext, page],
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (programmeContext) search.set("programme", programmeContext);
      return api.chainCall(id, search);
    },
    placeholderData: keepPreviousData,
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const transversal = data.programmes.length > 1;
  const rail = railFromAncestors(data.ancestors, {
    level: "call",
    label: data.node.code,
    amount: data.aggregate.amount,
    currency: data.aggregate.measure.currency,
  });
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, data.node.code)} rail={rail}>
      <Eyebrow>{t("money.levels.call")}</Eyebrow>
      <Title>
        <span className="font-mono text-[0.82em]">{data.node.code}</span>
      </Title>
      {data.context ? (
        <p className="mt-3 max-w-[70ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.callContextNote")}{" "}
          <Link to={`/money/call/${data.node.id}`} className="text-accent hover:underline">
            {t("money.callContextAll")}
          </Link>
        </p>
      ) : transversal ? (
        <p className="mt-3 max-w-[70ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.callTransversal", { count: data.programmes.length })}
        </p>
      ) : null}
      {transversal && !data.context ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>{t("money.callProgrammesServed")}</span>
          {data.programmes.map((programme) => (
            <Link
              key={programme.id}
              to={`/money/call/${data.node.id}?programme=${programme.id}`}
              className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors hover:text-accent"
            >
              {programme.code} · {formatInt(programme.projects, locale)}
            </Link>
          ))}
        </p>
      ) : null}
      <MeasureHero
        amount={data.aggregate.amount}
        measure={data.aggregate.measure}
        projects={data.aggregate.projects}
        coverage={data.aggregate.coverage}
        share={data.share_of_parent}
        methodology={
          <MethodologyPanel
            rows={[
              {
                label: t("money.methodology.measure"),
                value: measureLabel(data.aggregate.measure.key),
              },
              { label: t("money.methodology.callLink"), value: t("money.callReconstructed") },
              { label: t("money.methodology.notBudget"), value: t("money.notEnvelope") },
            ]}
          />
        }
      />
      <DistributionList
        parentAmount={data.aggregate.amount}
        parentName={data.node.code}
        parentCurrency={data.aggregate.measure.currency}
        childrenLabel={t("money.children.project", { count: data.children.total })}
        rows={childrenToRows(data.children, (item) => `/money/project/${item.id}`)}
        total={data.children.total}
        coverage={data.children.coverage}
        page={page}
        expanded={expanded}
        patch={patch}
        paginated
      />
    </TrailShell>
  );
}

function ProjectView({ id }: { id: string }) {
  const { t, locale, money, measureLabel, natureLabel } = useMoneyCopy();
  const query = useQuery({
    queryKey: ["chain-project", id],
    queryFn: () => api.chainProject(id),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const dates =
    data.node.start_date || data.node.end_date
      ? [data.node.start_date, data.node.end_date]
          .map((d) =>
            d ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d)) : "…",
          )
          .join(" → ")
      : null;
  const attribution = data.node.programme?.attribution;
  const rail = railFromAncestors(data.ancestors, {
    level: "project",
    label: data.node.label,
    amount: data.measure.amount,
    currency: data.measure.currency,
  });
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, data.node.label)} rail={rail}>
      <Eyebrow>
        {t("money.levels.project")} ·{" "}
        <span className="font-mono normal-case">{data.node.source_id}</span>
      </Eyebrow>
      <Title>{data.node.label}</Title>
      {data.node.title !== data.node.label ? (
        <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
          {data.node.title}
        </p>
      ) : null}
      {dates ? <p className="tnum mt-2 text-[13px] text-muted-foreground">{dates}</p> : null}
      {callNotAvailableNote(t, data.navigation.down)}
      <MeasureHero
        amount={data.measure.amount}
        measure={data.measure}
        share={data.share_of_parent}
        methodology={
          <MethodologyPanel
            rows={[
              { label: t("money.methodology.measure"), value: measureLabel(data.measure.key) },
              {
                label: t("money.methodology.nature"),
                value: natureLabel(data.measure.provenance),
              },
              {
                label: t("money.methodology.attribution"),
                value: attribution?.provenance
                  ? attribution.provenance === "derived"
                    ? t("money.attributionDerived")
                    : data.node.source.startsWith("cordis")
                      ? t("money.attributionSource")
                      : t("money.attributionDirect")
                  : "",
              },
              { label: t("money.methodology.source"), value: data.node.source },
              {
                label: t("money.methodology.eurObserved"),
                value:
                  data.measure.currency === "USD" && data.amount_eur_observed.amount != null
                    ? `${money(data.amount_eur_observed.amount, "EUR")} — ${t("money.eurObservedNote")}`
                    : "",
              },
            ]}
          />
        }
      />
      {data.total_cost ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {t("money.totalCost")}{" "}
          {data.total_cost.status === "available" ? (
            <span className="tnum font-medium text-foreground">
              {money(data.total_cost.amount, "EUR")}
            </span>
          ) : data.total_cost.status === "not_available" ? (
            <span title={t("money.totalCostZeroHint")}>{t("money.notAvailable")}</span>
          ) : (
            <span title={t("money.unknownAmount")}>{t("money.unknown")}</span>
          )}
        </p>
      ) : null}
      <ReconciliationBlock reconciliation={data.reconciliation} currency={data.measure.currency} />
      <ParticipationsSection data={data} />
      {data.annual_obligations ? (
        <NsfMeasureSystems
          cumulative={{ amount: data.measure.amount, measure: data.measure }}
          axis={data.annual_obligations}
        />
      ) : null}
      <ExploreExits exits={[{ label: t("money.projectSheet"), to: `/projects/${data.node.id}` }]} />
    </TrailShell>
  );
}

/* ------------------------------------------------------------------ */
/* Organisation / pays — blocs par financeur, aucun total unique       */

function ByFunderBlocks({ blocks }: { blocks: ChainFunderBlock[] }) {
  const { t, locale, money, measureShort } = useMoneyCopy();
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {blocks.map((block) => (
        <div key={block.funder} className="rounded-2xl border p-6">
          <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            <Link
              to={`/money/funder/${block.funder}`}
              className="transition-colors hover:text-accent"
            >
              {t(`money.funderNames.${block.funder}`)}
            </Link>
          </p>
          <p className="display-tight tnum mt-3 text-[26px] font-semibold">
            {block.amount == null ? (
              <span title={t("money.unknownAmount")}>—</span>
            ) : (
              money(block.amount, block.measure.currency)
            )}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
            {block.amount == null ? t("money.unknownShare") : measureShort(block.measure.key)}
          </p>
          <p className="tnum mt-3 text-[12.5px] text-muted-foreground">
            {t("money.orgProjects", {
              count: block.projects,
              n: formatInt(block.projects, locale),
            })}
            {" · "}
            {t("money.orgParticipations", {
              count: block.participations,
              n: formatInt(block.participations, locale),
            })}
            {block.coverage.unknown_amount > 0
              ? ` · ${t("money.orgUnknownCount", {
                  n: formatInt(block.coverage.unknown_amount, locale),
                })}`
              : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function NoTotalNote() {
  const { t } = useTranslation();
  return (
    <p className="mt-6 max-w-[70ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
      <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
      {t("money.noTotalBody")}
    </p>
  );
}

function OrganisationView({ id }: { id: string }) {
  const { t } = useMoneyCopy();
  const query = useQuery({
    queryKey: ["chain-organisation", id],
    queryFn: () => api.chainOrganisation(id),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const label = formatOrgName(data.node.label);
  const rail: RailNode[] = [{ level: "organisation", label, active: true }];
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, label)} rail={rail}>
      <Eyebrow>{t("money.levels.organisation")}</Eyebrow>
      <Title>
        {data.node.country ? (
          <span aria-hidden="true" className="mr-2">
            {countryFlag(data.node.country)}
          </span>
        ) : null}
        {label}
      </Title>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span>{t("money.orgLead")}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
            { label: t("money.methodology.dedup"), value: t("money.dedupNote") },
          ]}
        />
      </div>
      {data.by_funder.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <ByFunderBlocks blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits
        exits={[{ label: t("money.orgSheet"), to: `/organisations/${data.node.id}` }]}
      />
    </TrailShell>
  );
}

function CountryView({ code }: { code: string }) {
  const { t, locale } = useMoneyCopy();
  const { i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["chain-country", code],
    queryFn: () => api.chainCountry(code),
  });
  const countryName =
    new Intl.DisplayNames([i18n.language], { type: "region" }).of(code.toUpperCase()) ??
    code.toUpperCase();
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const rail: RailNode[] = [{ level: "country", label: countryName, active: true }];
  return (
    <TrailShell crumbs={moneyCrumbItems(t, data.ancestors, countryName)} rail={rail}>
      <Eyebrow>{t("money.levels.country")}</Eyebrow>
      <Title>
        <span aria-hidden="true" className="mr-2">
          {countryFlag(data.node.id)}
        </span>
        {countryName}
      </Title>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span>{t("money.countryOrgs", { n: formatInt(data.organisations, locale) })}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.country"), value: t("money.countryDestination") },
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
          ]}
        />
      </div>
      <p className="mt-3 max-w-[70ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("money.countryDestination")}
      </p>
      {data.by_funder.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <ByFunderBlocks blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits
        exits={[{ label: t("money.countrySheet"), to: `/countries/${data.node.id}` }]}
      />
    </TrailShell>
  );
}

/* ------------------------------------------------------------------ */

export function MoneyTrailPage() {
  const { level, id } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  // Surface hors lentille : `lens=` n'a pas cours ici et la porte est
  // canonicalisée (même doctrine que R5B) — l'URL canonique fait foi.
  useEffect(() => {
    if (params.has("lens")) {
      const next = new URLSearchParams(params);
      next.delete("lens");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);
  if (!level) return <FundersRoot />;
  if (!LEVELS.has(level) || !id) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 py-24 text-center">
        <p className="text-lg font-medium">{t("money.notFound")}</p>
        <p className="mt-6 text-sm">
          <Link to="/money" className="text-accent underline-offset-2 hover:underline">
            {t("money.backToRoot")}
          </Link>
        </p>
      </div>
    );
  }
  switch (level) {
    case "funder":
      return <FunderView code={id} />;
    case "programme":
      return <ProgrammeView id={id} />;
    case "call":
      return <CallView id={id} />;
    case "project":
      return <ProjectView id={id} />;
    case "organisation":
      return <OrganisationView id={id} />;
    default:
      return <CountryView code={id} />;
  }
}
