/** B2.3 — « Où est passé cet argent ? » (docs/conception-b-chaine-argent-public.md § 15).
 *
 *  Navigateur de trace interactif : un explorateur hiérarchique en
 *  colonnes (Column View / Path Exploration). Chaque colonne est un
 *  niveau RÉEL de la chaîne ; cliquer une destination ouvre l'étage
 *  suivant sans perdre le contexte ; changer de branche à n'importe
 *  quel niveau ne remplace que les colonnes descendantes. La trace
 *  compacte au-dessus est la mémoire du chemin (« où suis-je ? ») ;
 *  les colonnes répondent « où puis-je aller ? ». Elle commence au
 *  financeur : « Chaîne de l'argent » est le nom de la fonctionnalité,
 *  pas un nœud de financement.
 *
 *  Deep-link ≡ descente : la réponse du nœud courant porte le fil
 *  enrichi (montants, parts, comparabilité — moteur B1/B2.2) et les
 *  nœuds ancêtres, aux identifiants connus d'un coup, se chargent EN
 *  PARALLÈLE (profondeur bornée par la chaîne, jamais un N+1) pour
 *  reconstruire les colonnes. Si la sélection tombe hors de la page
 *  servie d'une liste ancêtre, elle est épinglée depuis le fil enrichi
 *  — jamais de chargement massif des fratries.
 *
 *  Invariants inchangés (B0/B1) : le moteur fait foi ; l'i18n pose
 *  ses phrases sur les clés stables ; inconnu ≠ zéro ; un ratio
 *  n'existe que si le moteur le déclare valide (un appel transversal
 *  garde la liaison sans pourcentage) ; NIH bénéficiaire, NSF double
 *  système de mesure, aucun total unique inter-financeurs ; les
 *  connecteurs entre colonnes ne codent jamais les montants. URL =
 *  vue reproductible, sélection comprise. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
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
  type ChainCallNode,
  type ChainCrumb,
  type ChainFunderBlock,
  type ChainFunderNode,
  type ChainMeasure,
  type ChainNavEntry,
  type ChainNodeShare,
  type ChainProgrammeNode,
  type ChainProjectNode,
  type ChainProvenance,
  type ChainReconciliation,
} from "@/lib/api";
import { countryFlag, formatCompactMoney, formatInt, formatOrgName } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const TOP_COUNT = 10;

const LEVELS = new Set(["funder", "programme", "call", "project", "organisation", "country"]);

type AggregateNode = ChainFunderNode | ChainProgrammeNode | ChainCallNode;

/** Un nœud de l'épine dorsale (fil enrichi ou nœud courant) : ce qu'il
 *  faut pour l'épingler dans la colonne de son parent. */
interface SpineRef {
  level: string;
  id: number | string;
  label?: string | null;
  code?: string;
  amount?: number | null;
  /** false quand le moteur refuse le ratio (transversal, inconnu). */
  shareValid?: boolean;
}

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

function crumbPath(crumb: Pick<ChainCrumb, "level" | "id">): string {
  return `/money/${crumb.level}/${crumb.id}`;
}

function childTo(
  item: { level: string; id: number | string },
  parent?: { level: string; id: number | string },
): string {
  if (item.level === "call" && parent?.level === "programme") {
    return `/money/call/${item.id}?programme=${parent.id}`;
  }
  return crumbPath(item as Pick<ChainCrumb, "level" | "id">);
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
/* Méthodologie : panneau latéral ouvert à la demande — l'inspecteur   */
/* renseigne sans jamais interrompre la navigation.                    */

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
/* La trace compacte — la mémoire du chemin (« où suis-je ? »)         */

interface TraceNode {
  level: string;
  label: string;
  to?: string;
  amount?: number | null;
  currency?: string | null;
  share?: number | null;
  active?: boolean;
}

function traceFromSpine(ancestors: ChainCrumb[], current: TraceNode): TraceNode[] {
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

function TraceStrip({ nodes }: { nodes: TraceNode[] }) {
  const { t, locale, money } = useMoneyCopy();
  const hasShare = nodes.some((node) => node.share != null);
  return (
    <nav
      aria-label={t("money.rail.title")}
      className="mt-5 flex items-center gap-2.5 overflow-x-auto pb-1.5"
    >
      {nodes.map((node, index) => (
        <span key={`${node.level}-${index}`} className="flex shrink-0 items-center gap-2.5">
          {index > 0 ? (
            <span className="tnum text-[11.5px] text-muted-foreground">
              <span
                aria-hidden="true"
                title={
                  node.share != null
                    ? t("money.trace.ofPrevious", {
                        pct: pct(node.share * 100, locale),
                        parent: nodes[index - 1]?.label ?? "",
                      })
                    : undefined
                }
              >
                ›{node.share != null ? ` ${pct(node.share * 100, locale)}` : ""}
              </span>
              {node.share != null ? (
                <span className="sr-only">
                  {" "}
                  {pct(node.share * 100, locale)}{" "}
                  {t("money.trace.ofPreviousSr", { parent: nodes[index - 1]?.label ?? "" })}
                </span>
              ) : null}
            </span>
          ) : null}
          {node.to && !node.active ? (
            <Link
              to={node.to}
              className="group block rounded-lg border border-border-soft px-3 py-1.5 transition-colors hover:border-accent/50"
            >
              <span className="block max-w-[24ch] truncate text-[12.5px] leading-tight transition-colors group-hover:text-accent">
                {node.label}
              </span>
              {node.amount != null ? (
                <span className="tnum block text-[11.5px] leading-tight text-muted-foreground">
                  {money(node.amount, node.currency)}
                </span>
              ) : null}
            </Link>
          ) : (
            <span
              aria-current="true"
              className="block rounded-lg border border-accent/50 bg-accent-soft px-3 py-1.5"
            >
              <span className="block max-w-[24ch] truncate text-[12.5px] font-medium leading-tight">
                {node.label}
              </span>
              {node.amount != null ? (
                <span className="tnum block text-[11.5px] leading-tight text-muted-foreground">
                  {money(node.amount, node.currency)}
                </span>
              ) : null}
            </span>
          )}
        </span>
      ))}
      {hasShare ? (
        <span className="shrink-0 text-[10.5px] text-muted-foreground">
          {t("money.trace.convention")}
        </span>
      ) : null}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Le navigateur en colonnes — « où puis-je aller maintenant ? »       */

interface ColumnItem {
  level: string;
  id: number | string;
  to: string;
  name: string;
  code?: string;
  count?: number | null;
  amount: number | null;
  /** true quand un ratio contre le parent serait invalide (crumb
   *  transversal épinglé) — jamais un pourcentage faux. */
  noShare?: boolean;
}

interface ColumnSpec {
  key: string;
  /** Le référent des pourcentages : le parent de la colonne. */
  parentLabel: string;
  parentAmount: number | null;
  currency: string | null | undefined;
  childrenLevelLabel: string;
  items: ColumnItem[];
  total: number;
  selectedKey?: string;
  pending?: boolean;
  /** La dernière colonne (niveau courant) : dépli et pages dans l'URL. */
  urlDriven?: boolean;
  coverage?: { with_amount: number; unknown_amount: number };
  question?: string | null;
  footNotes?: ReactNode;
}

function itemKey(level: string, id: number | string): string {
  return `${level}:${id}`;
}

function ColumnRow({
  item,
  parentLabel,
  parentAmount,
  currency,
  selected,
}: {
  item: ColumnItem;
  parentLabel: string;
  parentAmount: number | null;
  currency: string | null | undefined;
  selected: boolean;
}) {
  const { t, locale, money } = useMoneyCopy();
  const share =
    !item.noShare && parentAmount != null && parentAmount > 0 && item.amount != null
      ? (item.amount / parentAmount) * 100
      : null;
  return (
    <Link
      to={item.to}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group block border-l-2 py-2 pl-3 pr-2 transition-colors",
        selected
          ? "border-accent bg-accent-soft/60"
          : "border-transparent hover:border-border hover:bg-surface/60",
      )}
    >
      <span className="sr-only">{t("money.followTo", { name: item.name })} — </span>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span
            className={cn(
              "block text-[13px] leading-snug transition-colors line-clamp-2",
              selected ? "font-medium" : "group-hover:text-accent",
            )}
          >
            {item.name}
          </span>
          {item.code && item.code !== item.name ? (
            <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
              {item.code}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 shrink-0 text-[13px]",
            selected ? "text-accent" : "text-muted-foreground/50 group-hover:text-accent",
          )}
        >
          ›
        </span>
      </span>
      <span className="tnum mt-1 block text-[12px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground/80">
          {item.amount == null ? (
            <span title={t("money.unknownAmount")}>—</span>
          ) : (
            money(item.amount, currency)
          )}
        </span>
        {share != null ? (
          <span title={t("money.shareOf", { pct: pct(share, locale), parent: parentLabel })}>
            {" "}
            · {pct(share, locale)}
            <span className="sr-only"> {t("money.ofParent", { parent: parentLabel })}</span>
          </span>
        ) : null}
        {item.count != null ? (
          <span>
            {" "}
            · {t("money.orgProjects", { count: item.count, n: formatInt(item.count, locale) })}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function NavColumn({
  column,
  page,
  expanded,
  patch,
  standalone,
}: {
  column: ColumnSpec;
  page: number;
  expanded: boolean;
  patch: (changes: Record<string, string | null>) => void;
  /** Rendu séquentiel (écrans étroits) : pleine largeur, sans bord. */
  standalone?: boolean;
}) {
  const { t, locale } = useMoneyCopy();
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = column.urlDriven ? expanded : localExpanded;
  const collapsed = !isExpanded && column.items.length > TOP_COUNT;
  const top = collapsed ? column.items.slice(0, TOP_COUNT) : column.items;
  // La sélection du chemin reste TOUJOURS visible : si elle est classée
  // au-delà du top replié, elle s'ajoute sous lui plutôt que de
  // disparaître derrière le dépli.
  const selectedItem = column.selectedKey
    ? column.items.find((i) => itemKey(i.level, i.id) === column.selectedKey)
    : undefined;
  const visible =
    collapsed && selectedItem && !top.includes(selectedItem) ? [...top, selectedItem] : top;
  const hasMore = Boolean(column.urlDriven) && isExpanded && page * PAGE_SIZE < column.total;
  // Concentration : dérivé d'affichage sur le top replié seul,
  // uniquement quand toutes les valeurs comparées portent la même
  // mesure et que le parent est connu.
  const topSum = top.reduce((sum, row) => (row.amount != null ? sum + row.amount : sum), 0);
  const concentration =
    collapsed && column.parentAmount != null && column.parentAmount > 0 && topSum > 0
      ? (topSum / column.parentAmount) * 100
      : null;
  const expand = () => (column.urlDriven ? patch({ expanded: "1" }) : setLocalExpanded(true));
  const collapse = () =>
    column.urlDriven ? patch({ expanded: null, page: null }) : setLocalExpanded(false);

  return (
    <section
      aria-label={`${column.childrenLevelLabel} — ${column.parentLabel}`}
      className={cn(
        "news-in shrink-0",
        standalone
          ? "w-full"
          : cn("border-r border-border-soft pr-4", column.urlDriven ? "w-[340px]" : "w-[300px]"),
      )}
    >
      <header className="pb-2">
        {column.question ? (
          <p className="text-[13.5px] font-medium leading-snug">{column.question}</p>
        ) : (
          <p className="truncate text-[13.5px] font-medium leading-snug" title={column.parentLabel}>
            {column.parentLabel}
          </p>
        )}
        {!column.pending ? (
          <p className="mt-0.5 text-[11px] uppercase tracking-[.07em] text-muted-foreground">
            {collapsed
              ? t("money.topOf", { top: TOP_COUNT, n: formatInt(column.total, locale) })
              : `${column.childrenLevelLabel} · ${formatInt(column.total, locale)}`}
          </p>
        ) : null}
        {concentration != null ? (
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {t("money.concentration", {
              top: Math.min(TOP_COUNT, top.length),
              pct: pct(concentration, locale),
            })}
          </p>
        ) : null}
        {column.parentAmount != null && column.items.length > 0 ? (
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {t("money.column.shareRef", { parent: column.parentLabel })}
          </p>
        ) : null}
      </header>
      {column.pending ? (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : column.items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {t("money.emptyLevel")}
        </p>
      ) : (
        <div className={standalone ? undefined : "max-h-[60vh] overflow-y-auto overscroll-contain"}>
          {visible.map((item) => (
            <ColumnRow
              key={itemKey(item.level, item.id)}
              item={item}
              parentLabel={column.parentLabel}
              parentAmount={column.parentAmount}
              currency={column.currency}
              selected={column.selectedKey === itemKey(item.level, item.id)}
            />
          ))}
          {collapsed ? (
            <button
              type="button"
              onClick={expand}
              className="mt-2 w-full rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
            >
              {t("money.showMore", {
                count: column.total - TOP_COUNT,
                n: formatInt(column.total - TOP_COUNT, locale),
              })}
            </button>
          ) : null}
          {isExpanded && column.total > TOP_COUNT && (!column.urlDriven || page === 1) ? (
            <button
              type="button"
              onClick={collapse}
              className="mt-2 w-full rounded-lg border px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("money.showLess", { n: TOP_COUNT })}
            </button>
          ) : null}
          {column.urlDriven ? <Pager page={page} hasMore={hasMore} update={patch} /> : null}
        </div>
      )}
      {column.coverage && column.coverage.unknown_amount > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {t("money.listUnknown", {
            count: column.coverage.unknown_amount,
            n: formatInt(column.coverage.unknown_amount, locale),
          })}
        </p>
      ) : null}
      {column.footNotes}
    </section>
  );
}

/** Construit la colonne d'un nœud agrégé : ses enfants, avec la
 *  sélection courante. Si la sélection tombe hors de la page servie,
 *  elle est épinglée depuis le fil enrichi — la trace reste complète
 *  sans jamais précharger toutes les fratries. */
function columnFromNode(
  t: (key: string, options?: Record<string, unknown>) => string,
  moneyFmt: (v: number | null | undefined, c: string | null | undefined) => string,
  crumb: SpineRef & { label: string },
  node: AggregateNode | undefined,
  selected: SpineRef | undefined,
  options: { urlDriven?: boolean; question?: boolean; footNotes?: ReactNode } = {},
): ColumnSpec {
  const childLevel = node?.children.level ?? "programme";
  const childrenLevelLabel = t(`money.children.${childLevel}`, {
    count: node?.children.total ?? 0,
  });
  const parentAmount = node?.aggregate?.amount ?? null;
  const currency = node?.aggregate?.measure.currency;
  const items: ColumnItem[] = (node?.children.items ?? []).map((item) => ({
    level: item.level,
    id: item.id,
    to: childTo(item, crumb),
    name: item.label ?? item.code ?? String(item.id),
    code: item.code,
    count: item.projects ?? null,
    amount: item.amount,
  }));
  const selectedKey = selected ? itemKey(selected.level, selected.id) : undefined;
  if (selected && selectedKey && node && !items.some((i) => itemKey(i.level, i.id) === selectedKey)) {
    items.unshift({
      level: selected.level,
      id: selected.id,
      to: childTo(selected, crumb),
      name: selected.label ?? selected.code ?? String(selected.id),
      code: selected.code,
      count: null,
      amount: selected.amount ?? null,
      noShare: selected.shareValid === false,
    });
  }
  return {
    key: itemKey(crumb.level, crumb.id),
    parentLabel: crumb.label,
    parentAmount,
    currency,
    childrenLevelLabel,
    items,
    total: node?.children.total ?? 0,
    selectedKey,
    pending: node == null,
    urlDriven: options.urlDriven,
    coverage: options.urlDriven ? node?.children.coverage : undefined,
    question:
      options.question && node
        ? parentAmount != null
          ? t("money.nextQuestion", { amount: moneyFmt(parentAmount, currency) })
          : t("money.nextQuestionNoAmount")
        : null,
    footNotes: options.footNotes,
  };
}

function crumbToSpineRef(crumb: ChainCrumb): SpineRef {
  return {
    level: crumb.level,
    id: crumb.id,
    label: crumb.label,
    code: crumb.code,
    amount: crumb.amount,
    shareValid: crumb.comparability === "ok",
  };
}

/* -------------------------------------------------- colonne racine */

function FundersColumn({ selectedId }: { selectedId: string }) {
  const { t, locale, money } = useMoneyCopy();
  const query = useQuery({ queryKey: ["chain-funders"], queryFn: api.chainFunders });
  const funders = query.data?.funders ?? [];
  return (
    <section
      aria-label={t("money.children.funder", { count: funders.length })}
      className="news-in w-[280px] shrink-0 border-r border-border-soft pr-4"
    >
      <header className="pb-2">
        <p className="text-[13.5px] font-medium leading-snug">{t("money.title")}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[.07em] text-muted-foreground">
          {t("money.children.funder", { count: funders.length })} ·{" "}
          {formatInt(funders.length, locale)}
        </p>
      </header>
      {query.isPending ? (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        // Trois univers NON comparables : chaque montant dans sa devise
        // et sa mesure — aucun pourcentage, aucun classement.
        funders.map((funder) => {
          const selected = selectedId === String(funder.id);
          return (
            <Link
              key={funder.id}
              to={`/money/funder/${funder.id}`}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "group block border-l-2 py-2 pl-3 pr-2 transition-colors",
                selected
                  ? "border-accent bg-accent-soft/60"
                  : "border-transparent hover:border-border hover:bg-surface/60",
              )}
            >
              <span className="sr-only">{t("money.followTo", { name: funder.label })} — </span>
              <span className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "min-w-0 text-[13px] leading-snug line-clamp-2",
                    selected ? "font-medium" : "group-hover:text-accent",
                  )}
                >
                  {funder.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 shrink-0 text-[13px]",
                    selected ? "text-accent" : "text-muted-foreground/50 group-hover:text-accent",
                  )}
                >
                  ›
                </span>
              </span>
              <span className="tnum mt-1 block text-[12px] text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {money(funder.aggregate.amount, funder.aggregate.measure.currency)}
                </span>{" "}
                ·{" "}
                {t("money.rootProjects", {
                  count: funder.aggregate.projects,
                  n: formatInt(funder.aggregate.projects, locale),
                })}
              </span>
            </Link>
          );
        })
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Requêtes de l'épine dorsale — parallèles, profondeur bornée         */

function fetchAggregateNode(level: string, id: string): Promise<AggregateNode> {
  if (level === "funder") return api.chainFunder(id);
  if (level === "programme") {
    return api.chainProgramme(id, new URLSearchParams({ page: "1", size: String(PAGE_SIZE) }));
  }
  return api.chainCall(id, new URLSearchParams({ page: "1", size: String(PAGE_SIZE) }));
}

function ancestorQueryKey(level: string, id: string): (string | number | null)[] {
  // Les mêmes clés que les vues elles-mêmes : une descente par clics a
  // déjà rempli le cache, un deep-link le remplit en parallèle.
  if (level === "funder") return ["chain-funder", id];
  if (level === "programme") return ["chain-programme", id, 1];
  return ["chain-call", id, null, 1];
}

function useSpineNodes(ancestors: ChainCrumb[]) {
  return useQueries({
    queries: ancestors.map((a) => ({
      queryKey: ancestorQueryKey(a.level, String(a.id)),
      queryFn: () => fetchAggregateNode(a.level, String(a.id)),
      staleTime: 60_000,
    })),
  });
}

/** Les colonnes du chemin : racine (financeurs) + une colonne par
 *  ancêtre, chacune avec l'étape suivante sélectionnée. */
function spineColumns(
  t: (key: string, options?: Record<string, unknown>) => string,
  moneyFmt: (v: number | null | undefined, c: string | null | undefined) => string,
  ancestors: ChainCrumb[],
  spineNodes: { data?: AggregateNode }[],
  currentRef: SpineRef & { label: string },
  patch: (changes: Record<string, string | null>) => void,
): ReactNode[] {
  const funderCode = ancestors.length > 0 ? String(ancestors[0].id) : String(currentRef.id);
  const columns: ReactNode[] = [<FundersColumn key="funders" selectedId={funderCode} />];
  ancestors.forEach((crumb, index) => {
    const selected =
      index + 1 < ancestors.length ? crumbToSpineRef(ancestors[index + 1]) : currentRef;
    columns.push(
      <NavColumn
        key={itemKey(crumb.level, crumb.id)}
        column={columnFromNode(
          t,
          moneyFmt,
          { ...crumbToSpineRef(crumb), label: crumb.label ?? crumb.code ?? String(crumb.id) },
          spineNodes[index]?.data,
          selected,
        )}
        page={1}
        expanded={false}
        patch={patch}
      />,
    );
  });
  return columns;
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
  compact,
}: {
  amount: number | null;
  measure: ChainMeasure;
  projects?: number;
  coverage?: { with_amount: number; unknown_amount: number };
  share?: ChainNodeShare | null;
  methodology?: ReactNode;
  compact?: boolean;
}) {
  const { t, locale, money, measureLabel } = useMoneyCopy();
  const family = shareFamily(measure.key);
  return (
    <div className={compact ? "mt-5" : "mt-8"}>
      <div
        className={cn(
          "display-tight tnum font-semibold",
          compact ? "text-[clamp(28px,3vw,38px)]" : "text-[clamp(34px,5vw,52px)]",
        )}
      >
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
        <p className="tnum mt-2 text-[14px] font-medium text-foreground/85">
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
/* Réconciliation — lecture comptable (allégée quand elle est triviale) */

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
  measureKey,
}: {
  reconciliation: ChainReconciliation;
  currency: string | null | undefined;
  measureKey?: string | null;
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

  // Une réconciliation exacte sans part inconnue est TRIVIALE : trois
  // lignes suffisent — le tableau détaillé et son statut long sont
  // réservés aux écarts, dépassements et parts inconnues.
  // « Contribution du projet » ne se dit que d'une contribution
  // (CORDIS) : les natures comptables ne s'interchangent jamais.
  if (
    status === "exact" &&
    (reconciliation.unknown_children == null || reconciliation.unknown_children === 0)
  ) {
    return (
      <div className="mt-8 rounded-2xl border border-border-soft bg-surface/40 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("money.reconciliation.exactTitle")}
        </p>
        <dl className="mt-3 space-y-1.5">
          <ReconRow
            label={
              shareFamily(measureKey) === "cordis"
                ? t("money.reconciliation.exactParent")
                : t("money.reconciliation.parent")
            }
            value={parent == null ? t("money.unknown") : money(parent, currency)}
            strong
          />
          <ReconRow
            label={t("money.reconciliation.childrenSum")}
            value={knownSum == null ? t("money.unknown") : money(knownSum, currency)}
          />
        </dl>
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {t("money.reconciliation.noUnallocated")}
        </p>
      </div>
    );
  }

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
              <span className="shrink-0 text-[12px] text-muted-foreground">{item.role ?? ""}</span>
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
                      share == null
                        ? undefined
                        : t("money.ofProjectFull", { pct: pct(share, locale) })
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
    <div className="mx-auto w-full max-w-[1400px] px-6 pt-10">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-6 h-12 w-2/3" />
      <div className="mt-8 flex gap-6">
        <Skeleton className="h-72 w-[280px]" />
        <Skeleton className="hidden h-72 w-[300px] lg:block" />
        <Skeleton className="hidden h-72 w-[340px] lg:block" />
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
    <h1 className="display-tight mt-1.5 text-[clamp(24px,3vw,34px)] font-semibold">{children}</h1>
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
/* La coquille du navigateur (desktop)                                 */

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

function NavigatorShell({
  crumbs,
  trace,
  columns,
  detail,
}: {
  crumbs: BreadcrumbItem[];
  trace: TraceNode[];
  columns: ReactNode;
  detail?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const spineSignature = trace.map((node) => `${node.level}:${node.label}`).join("→");
  useEffect(() => {
    // La nouvelle colonne vient d'apparaître à droite : on l'amène en
    // vue. Défilement local du conteneur, par assignation directe —
    // le scrollTo({behavior:"smooth"}) programmatique est interrompu
    // par les re-rendus des colonnes et laisse la vue au point de
    // départ (constat en recette réelle) ; le fondu `news-in` porte
    // déjà la transition, et il respecte prefers-reduced-motion.
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [spineSignature]);
  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 pb-20 pt-10">
      <Breadcrumb items={crumbs} />
      <TraceStrip nodes={trace} />
      <div ref={scrollRef} className="mt-6 flex gap-5 overflow-x-auto overscroll-x-contain pb-2">
        {columns}
        {detail}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vues agrégées : financeur, programme, appel                         */

function AggregateNavigator({ level, id }: { level: "funder" | "programme" | "call"; id: string }) {
  const { t, locale, money } = useMoneyCopy();
  const [page, expanded, patch] = usePagePatch();
  const [params] = useSearchParams();
  const programmeContext = level === "call" ? params.get("programme") : null;
  const query = useQuery<AggregateNode>({
    queryKey:
      level === "funder"
        ? ["chain-funder", id]
        : level === "programme"
          ? ["chain-programme", id, page]
          : ["chain-call", id, programmeContext, page],
    queryFn: () => {
      if (level === "funder") return api.chainFunder(id);
      const search = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (level === "call" && programmeContext) search.set("programme", programmeContext);
      return level === "programme" ? api.chainProgramme(id, search) : api.chainCall(id, search);
    },
    placeholderData: keepPreviousData,
  });
  const ancestors = query.data?.ancestors ?? [];
  const spineNodes = useSpineNodes(ancestors);

  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const label =
    level === "funder"
      ? (data as ChainFunderNode).node.label
      : level === "call"
        ? (data as ChainCallNode).node.code
        : ((data as ChainProgrammeNode).node.label ?? (data as ChainProgrammeNode).node.code);
  const currentRef: SpineRef & { label: string } = {
    level,
    id: data.node.id,
    label,
    code: "code" in data.node ? data.node.code : undefined,
    amount: data.aggregate?.amount,
    shareValid: data.share_of_parent?.comparability === "ok",
  };
  const trace = traceFromSpine(ancestors, {
    level,
    label,
    amount: data.aggregate?.amount,
    currency: data.aggregate?.measure.currency,
    share: data.share_of_parent?.comparability === "ok" ? data.share_of_parent.ratio : null,
  });
  const call = level === "call" ? (data as ChainCallNode) : null;
  const transversal = Boolean(call && call.programmes.length > 1 && !call.context);

  const lastColumnFootnotes = (
    <>
      {data.children.level === "call" ? (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {t("money.callScopeNote")}
        </p>
      ) : null}
      {data.children.directly_on_parent ? (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {t("money.directlyOnParent", {
            count: data.children.directly_on_parent,
            n: formatInt(data.children.directly_on_parent, locale),
          })}
        </p>
      ) : null}
      {data.children.no_call_projects ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {t("money.noCallProjects", {
            count: data.children.no_call_projects,
            n: formatInt(data.children.no_call_projects, locale),
          })}
        </p>
      ) : null}
    </>
  );
  const lastColumn = columnFromNode(t, money, currentRef, data as AggregateNode, undefined, {
    urlDriven: true,
    question: true,
    footNotes: lastColumnFootnotes,
  });

  const columns = spineColumns(t, money, ancestors, spineNodes, currentRef, patch);
  columns.push(
    <NavColumn
      key={itemKey(level, data.node.id)}
      column={lastColumn}
      page={page}
      expanded={expanded}
      patch={patch}
    />,
  );

  const summary = (
    <AggregateSummaryPane
      data={data as AggregateNode}
      level={level}
      label={label}
      transversal={transversal}
    />
  );

  return (
    <>
      {/* Écrans étroits : modèle séquentiel — trace compacte, niveau
          courant, destinations ; le retour passe par la trace. */}
      <div className="lg:hidden">
        <div className="mx-auto w-full max-w-[720px] px-6 pb-20 pt-10">
          <Breadcrumb items={moneyCrumbItems(t, ancestors, label)} />
          <TraceStrip nodes={trace} />
          <div className="mt-6">{summary}</div>
          <div className="mt-8">
            <NavColumn
              column={lastColumn}
              page={page}
              expanded={expanded}
              patch={patch}
              standalone
            />
          </div>
        </div>
      </div>
      {/* Desktop : le navigateur en colonnes. */}
      <div className="hidden lg:block">
        <NavigatorShell
          crumbs={moneyCrumbItems(t, ancestors, label)}
          trace={trace}
          columns={columns}
          detail={summary}
        />
      </div>
    </>
  );
}

/** Le résumé du niveau courant, à droite des colonnes : chiffre,
 *  nature, couverture, notes de contexte, méthodologie. */
function AggregateSummaryPane({
  data,
  level,
  label,
  transversal,
}: {
  data: AggregateNode;
  level: "funder" | "programme" | "call";
  label: string;
  transversal: boolean;
}) {
  const { t, locale, measureLabel } = useMoneyCopy();
  const call = level === "call" ? (data as ChainCallNode) : null;
  const funderCode =
    level === "funder"
      ? String(data.node.id)
      : level === "programme"
        ? (data as ChainProgrammeNode).node.funder
        : (data as ChainCallNode).node.funder;
  return (
    <aside className="news-in w-[360px] shrink-0 lg:w-[380px]">
      <Eyebrow>
        {t(`money.levels.${level}`)}
        {"code" in data.node && data.node.code !== label ? (
          <>
            {" "}
            · <span className="font-mono normal-case">{data.node.code}</span>
          </>
        ) : null}
      </Eyebrow>
      <h1
        className={cn(
          "display-tight mt-1.5 text-[clamp(20px,2vw,26px)] font-semibold",
          level === "call" ? "font-mono text-[clamp(16px,1.6vw,20px)]" : undefined,
        )}
      >
        {label}
      </h1>
      {data.aggregate ? (
        <MeasureHero
          amount={data.aggregate.amount}
          measure={data.aggregate.measure}
          projects={data.aggregate.projects}
          coverage={data.aggregate.coverage}
          share={data.share_of_parent}
          compact
          methodology={
            <MethodologyPanel
              rows={[
                {
                  label: t("money.methodology.measure"),
                  value: measureLabel(data.aggregate.measure.key),
                },
                ...(level === "call"
                  ? [
                      {
                        label: t("money.methodology.callLink"),
                        value: t("money.callReconstructed"),
                      },
                      { label: t("money.methodology.notBudget"), value: t("money.notEnvelope") },
                    ]
                  : [
                      {
                        label: t("money.methodology.programmeSemantics"),
                        value: t(`money.programmeSemantics.${funderCode}`),
                      },
                      { label: t("money.methodology.notBudget"), value: t("money.notBudget") },
                    ]),
                { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
              ]}
            />
          }
        />
      ) : null}
      {callNotAvailableNote(t, data.navigation.down)}
      {call?.context ? (
        <p className="mt-3 max-w-[46ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.callContextNote")}{" "}
          <Link to={`/money/call/${call.node.id}`} className="text-accent hover:underline">
            {t("money.callContextAll")}
          </Link>
        </p>
      ) : null}
      {transversal && call ? (
        <>
          <p className="mt-3 max-w-[46ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("money.callTransversal", { count: call.programmes.length })}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>{t("money.callProgrammesServed")}</span>
            {call.programmes.map((programme) => (
              <Link
                key={programme.id}
                to={`/money/call/${call.node.id}?programme=${programme.id}`}
                className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors hover:text-accent"
              >
                {programme.code} · {formatInt(programme.projects, locale)}
              </Link>
            ))}
          </p>
        </>
      ) : null}
    </aside>
  );
}

/* -------------------------------------------------- projet : fiche à droite */

function ProjectDetailPane({ data }: { data: ChainProjectNode }) {
  const { t, locale, money, measureLabel, natureLabel } = useMoneyCopy();
  const dates =
    data.node.start_date || data.node.end_date
      ? [data.node.start_date, data.node.end_date]
          .map((d) =>
            d ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d)) : "…",
          )
          .join(" → ")
      : null;
  const attribution = data.node.programme?.attribution;
  return (
    <aside className="news-in min-w-0">
      <Eyebrow>
        {t("money.levels.project")} ·{" "}
        <span className="font-mono normal-case">{data.node.source_id}</span>
      </Eyebrow>
      <h1 className="display-tight mt-1.5 text-[clamp(22px,2.4vw,30px)] font-semibold">
        {data.node.label}
      </h1>
      {data.node.title !== data.node.label ? (
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted-foreground">
          {data.node.title}
        </p>
      ) : null}
      {dates ? <p className="tnum mt-2 text-[13px] text-muted-foreground">{dates}</p> : null}
      {callNotAvailableNote(t, data.navigation.down)}
      <MeasureHero
        amount={data.measure.amount}
        measure={data.measure}
        share={data.share_of_parent}
        compact
        methodology={
          <MethodologyPanel
            rows={[
              { label: t("money.methodology.measure"), value: measureLabel(data.measure.key) },
              { label: t("money.methodology.nature"), value: natureLabel(data.measure.provenance) },
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
      <ReconciliationBlock
        reconciliation={data.reconciliation}
        currency={data.measure.currency}
        measureKey={data.measure.key}
      />
      <ParticipationsSection data={data} />
      {data.annual_obligations ? (
        <NsfMeasureSystems
          cumulative={{ amount: data.measure.amount, measure: data.measure }}
          axis={data.annual_obligations}
        />
      ) : null}
      <ExploreExits exits={[{ label: t("money.projectSheet"), to: `/projects/${data.node.id}` }]} />
    </aside>
  );
}

function ProjectNavigator({ id }: { id: string }) {
  const { t, money } = useMoneyCopy();
  const [, , patch] = usePagePatch();
  const query = useQuery({
    queryKey: ["chain-project", id],
    queryFn: () => api.chainProject(id),
  });
  const ancestors = query.data?.ancestors ?? [];
  const spineNodes = useSpineNodes(ancestors);

  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const currentRef: SpineRef & { label: string } = {
    level: "project",
    id: data.node.id,
    label: data.node.label,
    amount: data.measure.amount,
    shareValid: data.share_of_parent?.comparability === "ok",
  };
  const trace = traceFromSpine(ancestors, {
    level: "project",
    label: data.node.label,
    amount: data.measure.amount,
    currency: data.measure.currency,
    share: data.share_of_parent?.comparability === "ok" ? data.share_of_parent.ratio : null,
  });

  // Une feuille n'efface pas le chemin : les colonnes du parcours
  // restent visibles, le projet sélectionné dans la dernière, sa fiche
  // ouverte à droite.
  const columns = spineColumns(t, money, ancestors, spineNodes, currentRef, patch);
  const detail = (
    <div className="w-[520px] shrink-0 xl:w-[620px]">
      <ProjectDetailPane data={data} />
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <div className="mx-auto w-full max-w-[720px] px-6 pb-20 pt-10">
          <Breadcrumb items={moneyCrumbItems(t, ancestors, data.node.label)} />
          <TraceStrip nodes={trace} />
          <div className="mt-6">
            <ProjectDetailPane data={data} />
          </div>
        </div>
      </div>
      <div className="hidden lg:block">
        <NavigatorShell
          crumbs={moneyCrumbItems(t, ancestors, data.node.label)}
          trace={trace}
          columns={columns}
          detail={detail}
        />
      </div>
    </>
  );
}

/* ------------------------------------------- organisation / pays (transverse) */

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
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-10">
      <Breadcrumb items={moneyCrumbItems(t, data.ancestors, label)} />
      <div className="mt-8">
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
      </div>
    </div>
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
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-10">
      <Breadcrumb items={moneyCrumbItems(t, data.ancestors, countryName)} />
      <div className="mt-8">
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
      </div>
    </div>
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
    case "programme":
    case "call":
      return <AggregateNavigator level={level} id={id} />;
    case "project":
      return <ProjectNavigator id={id} />;
    case "organisation":
      return <OrganisationView id={id} />;
    default:
      return <CountryView code={id} />;
  }
}
