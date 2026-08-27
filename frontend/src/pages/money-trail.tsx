/** B2.4 — « Où est passé cet argent ? » (docs/conception-b-chaine-argent-public.md § 15).
 *
 *  Focus Trace Workspace : une surface de travail plein écran sous la
 *  navbar (pas de footer éditorial ici, pas de défilement du document
 *  dans le cas nominal). Deux régions permanentes seulement :
 *
 *    à gauche, la TRACE — comment suis-je arrivé ici ? Un arbre
 *    typographique compact (indentation réelle, nom, montant, relation
 *    « └ % » au niveau au-dessus), chaque ancêtre cliquable, aucun
 *    faux nœud « Chaîne de l'argent », aucune boîte ;
 *
 *    au centre, le FOCUS — où suis-je, et où cet argent peut-il aller
 *    ensuite ? Le niveau courant reçoit tout l'espace : chiffre, part
 *    du parent, nature courte, UNE question, puis les destinations en
 *    lignes éditoriales (hairlines, jamais des cartes).
 *
 *  L'inspecteur méthodologique glisse depuis la droite à la demande —
 *  troisième région, temporaire. Cliquer une destination déplace
 *  l'attention : l'étape rejoint la trace, le nouveau niveau prend le
 *  centre (micro-transition 150 ms, tuée par prefers-reduced-motion),
 *  l'URL change sans rechargement. Cliquer un ancêtre de la trace
 *  ramène le focus à ce niveau — les descendants quittent la trace.
 *
 *  Deep-link ≡ descente : le fil enrichi de la réponse courante
 *  (montants, parts, comparabilité — moteur B2.2) reconstruit la
 *  trace entière en UNE requête ; aucun contexte ne dépend de
 *  l'historique ni du cache.
 *
 *  Invariants inchangés (B0/B1) : le moteur fait foi ; l'i18n pose
 *  ses phrases sur les clés stables ; inconnu ≠ zéro ; un ratio
 *  n'existe que si le moteur le déclare valide (appel transversal :
 *  liaison sans pourcentage) ; NIH bénéficiaire, NSF double système
 *  de mesure, aucun total unique inter-financeurs. URL = vue
 *  reproductible (niveau, id, dépli, page, filtre local). */

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";

import { ExploreExits } from "@/components/explore-exits";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
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
/** Hauteur approximative d'une ligne de destination (px) — sert au
 *  nombre adaptatif de destinations visibles. */
const ROW_PX = 76;
const DEFAULT_VISIBLE = 8;
/** Au-delà de ce nombre d'enfants ENTIÈREMENT servis, le focus
 *  propose un filtre local ; jamais pour trois enfants. */
const SEARCH_THRESHOLD = 15;

const LEVELS = new Set(["funder", "programme", "call", "project", "organisation", "country"]);

type AggregateNode = ChainFunderNode | ChainProgrammeNode | ChainCallNode;

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

function usePagePatch(): [
  number,
  boolean,
  string,
  (patch: Record<string, string | null>) => void,
] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const expanded = params.get("expanded") === "1" || page > 1;
  const q = params.get("q") ?? "";
  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { preventScrollReset: true });
  };
  return [page, expanded, q, patch];
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

function shareFamily(key: string | null | undefined): "cordis" | "nih" | "nsf" | null {
  if (!key) return null;
  if (key.startsWith("ec_")) return "cordis";
  if (key.startsWith("nih_")) return "nih";
  if (key.startsWith("nsf_")) return "nsf";
  return null;
}

/** Le nombre de destinations visibles sans dépli : adapté à la
 *  hauteur réellement disponible (7 à 10) quand le workspace est
 *  contraint en hauteur (≥ md) ; valeur fixe en flux naturel étroit. */
function useVisibleCount(listRef: RefObject<HTMLDivElement | null>): number {
  const [count, setCount] = useState(DEFAULT_VISIBLE);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // En flux naturel (< md), la hauteur de la liste est celle de son
    // CONTENU : la mesurer nourrirait le compte qu'elle mesure. La
    // valeur fixe s'applique, et la bascule de média remet d'équerre.
    const mql = window.matchMedia("(min-width: 768px)");
    const apply = (height: number) => {
      if (!mql.matches) {
        setCount(DEFAULT_VISIBLE);
        return;
      }
      if (height > 0) setCount(Math.max(7, Math.min(10, Math.floor(height / ROW_PX))));
    };
    const observer = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.height ?? 0);
    });
    observer.observe(el);
    const onChange = () => apply(el.clientHeight);
    mql.addEventListener?.("change", onChange);
    return () => {
      observer.disconnect();
      mql.removeEventListener?.("change", onChange);
    };
  }, [listRef]);
  return count;
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
/* L'inspecteur méthodologique — le détail sans quitter le contexte    */

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
/* La trace — comment suis-je arrivé ici ?                             */

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

/** Le panneau de trace (≥ md) : essentiellement typographique —
 *  indentation réelle, nom, montant, relation au parent. Aucune boîte
 *  autour d'une étape ; le niveau courant porte un filet d'accent. */
function TracePanel({ nodes }: { nodes: TraceNode[] }) {
  const { t, locale, money } = useMoneyCopy();
  const hasShare = nodes.some((node) => node.share != null);
  return (
    <nav
      aria-label={t("money.rail.title")}
      className="hidden w-[224px] shrink-0 overflow-y-auto border-r border-border-soft px-5 py-6 md:block lg:w-[248px]"
    >
      <p className="text-[11px] font-medium uppercase tracking-[.12em] text-muted-foreground">
        {t("money.rail.title")}
      </p>
      <ol className="mt-4">
        {nodes.map((node, index) => (
          <li key={`${node.level}-${index}`} style={{ paddingLeft: index * 10 }}>
            {index > 0 ? (
              <p
                className="tnum py-1 text-[11px] leading-none text-muted-foreground"
                title={
                  node.share != null
                    ? t("money.trace.ofPrevious", {
                        pct: pct(node.share * 100, locale),
                        parent: nodes[index - 1]?.label ?? "",
                      })
                    : undefined
                }
              >
                <span aria-hidden="true">└ </span>
                {node.share != null ? (
                  <>
                    {pct(node.share * 100, locale)}
                    <span className="sr-only">
                      {" "}
                      {t("money.trace.ofPreviousSr", { parent: nodes[index - 1]?.label ?? "" })}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
            {node.to && !node.active ? (
              <Link
                to={node.to}
                className="group flex items-baseline justify-between gap-2 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="min-w-0 text-[12.5px] leading-snug line-clamp-2">
                  {node.label}
                </span>
                {node.amount != null ? (
                  <span className="tnum shrink-0 text-[11px]">
                    {money(node.amount, node.currency)}
                  </span>
                ) : null}
              </Link>
            ) : (
              <span
                aria-current="true"
                className="-ml-2 flex items-baseline justify-between gap-2 border-l-2 border-accent py-0.5 pl-1.5"
              >
                <span className="min-w-0 text-[12.5px] font-medium leading-snug text-foreground line-clamp-2">
                  {node.label}
                </span>
                {node.amount != null ? (
                  <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                    {money(node.amount, node.currency)}
                  </span>
                ) : null}
              </span>
            )}
          </li>
        ))}
      </ol>
      {hasShare ? (
        <p className="mt-4 text-[10.5px] leading-snug text-muted-foreground">
          {t("money.trace.convention")}
        </p>
      ) : null}
      <p className="mt-6">
        <Link
          to="/money"
          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ↩ {t("money.backToRoot")}
        </Link>
      </p>
    </nav>
  );
}

/** La trace compacte (< md) : une ligne « EC › Horizon › EIT » —
 *  cliquer une étape remonte directement. */
function TraceLine({ nodes }: { nodes: TraceNode[] }) {
  const { t } = useMoneyCopy();
  return (
    <nav
      aria-label={t("money.rail.title")}
      className="flex items-center gap-1.5 overflow-x-auto px-6 pt-4 text-[12.5px] md:hidden"
    >
      {/* Le retour à la racine est un geste, pas un nœud de la trace. */}
      <Link
        to="/money"
        aria-label={t("money.backToRoot")}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">↩</span>
      </Link>
      {nodes.map((node, index) => (
        <span key={`${node.level}-${index}`} className="flex shrink-0 items-center gap-1.5">
          {index > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground/60">
              ›
            </span>
          ) : null}
          {node.to && !node.active ? (
            <Link
              to={node.to}
              className="max-w-[16ch] truncate text-muted-foreground hover:text-foreground"
              title={node.label}
            >
              {node.label}
            </Link>
          ) : (
            <span
              aria-current="true"
              className="max-w-[20ch] truncate font-medium"
              title={node.label}
            >
              {node.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* La coquille du workspace : trace + focus, la fenêtre suffit         */

function Workspace({ trace, children }: { trace?: TraceNode[]; children: ReactNode }) {
  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)] md:flex-row md:overflow-hidden">
      {trace ? <TracePanel nodes={trace} /> : null}
      {trace ? <TraceLine nodes={trace} /> : null}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Les destinations : des lignes éditoriales, pas des cartes           */

interface DestinationItem {
  level: string;
  id: number | string;
  to: string;
  name: string;
  code?: string;
  count?: number | null;
  amount: number | null;
}

function DestinationRow({
  item,
  parentLabel,
  parentAmount,
  currency,
}: {
  item: DestinationItem;
  parentLabel: string;
  parentAmount: number | null;
  currency: string | null | undefined;
}) {
  const { t, locale, money } = useMoneyCopy();
  const share =
    parentAmount != null && parentAmount > 0 && item.amount != null
      ? (item.amount / parentAmount) * 100
      : null;
  return (
    <Link
      to={item.to}
      className="group flex items-start justify-between gap-6 border-b border-border-soft py-3.5 transition-colors hover:bg-surface/50"
    >
      <span className="sr-only">{t("money.followTo", { name: item.name })} — </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug transition-colors group-hover:text-accent line-clamp-2">
          {item.name}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
          {item.code && item.code !== item.name ? (
            <span className="font-mono">{item.code}</span>
          ) : null}
          {item.code && item.code !== item.name && item.count != null ? " · " : null}
          {item.count != null ? (
            <span className="tnum">
              {t("money.orgProjects", { count: item.count, n: formatInt(item.count, locale) })}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-start gap-3 text-right">
        <span>
          <span className="tnum block text-[14px] font-medium leading-snug">
            {item.amount == null ? (
              <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                —
              </span>
            ) : (
              money(item.amount, currency)
            )}
          </span>
          {share != null ? (
            <span
              className="tnum mt-0.5 block text-[11.5px] text-muted-foreground"
              title={t("money.shareOf", { pct: pct(share, locale), parent: parentLabel })}
            >
              {pct(share, locale)}
              <span className="sr-only"> {t("money.ofParent", { parent: parentLabel })}</span>
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="mt-0.5 text-[13px] text-muted-foreground/50 transition-colors group-hover:text-accent"
        >
          ›
        </span>
      </span>
    </Link>
  );
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** La question unique du niveau, puis ses destinations. Top adaptatif
 *  (7–10 selon la hauteur), « Voir les N autres », filtre local
 *  uniquement quand l'ensemble des enfants est déjà entièrement servi
 *  — un filtre qui ne verrait qu'une page mentirait. */
function DestinationsSection({
  data,
  parentLabel,
  page,
  expanded,
  q,
  patch,
}: {
  data: AggregateNode;
  parentLabel: string;
  page: number;
  expanded: boolean;
  q: string;
  patch: (changes: Record<string, string | null>) => void;
}) {
  const { t, locale } = useMoneyCopy();
  const listRef = useRef<HTMLDivElement>(null);
  const visibleCount = useVisibleCount(listRef);

  const children = data.children;
  const parentAmount = data.aggregate?.amount ?? null;
  const currency = data.aggregate?.measure.currency;
  const childrenLabel = t(`money.children.${children.level}`, { count: children.total });
  const items: DestinationItem[] = children.items.map((item) => ({
    level: item.level,
    id: item.id,
    to: childTo(item, { level: data.node.level, id: data.node.id }),
    name: item.label ?? item.code ?? String(item.id),
    code: item.code,
    count: item.projects ?? null,
    amount: item.amount,
  }));

  const fullyLoaded = items.length === children.total;
  const searchable = fullyLoaded && children.total > SEARCH_THRESHOLD;
  const query = searchable ? q.trim() : "";
  const matched = query
    ? items.filter((item) => normalize(`${item.name} ${item.code ?? ""}`).includes(normalize(query)))
    : items;

  const collapsed = !query && !expanded && items.length > visibleCount;
  const top = collapsed ? items.slice(0, visibleCount) : matched;
  const hasMore = !query && expanded && page * PAGE_SIZE < children.total;
  // Concentration : dérivé d'affichage sur le top replié seul — même
  // mesure, même réponse, parent connu.
  const topSum = collapsed
    ? top.reduce((sum, row) => (row.amount != null ? sum + row.amount : sum), 0)
    : 0;
  const concentration =
    collapsed && parentAmount != null && parentAmount > 0 && topSum > 0
      ? (topSum / parentAmount) * 100
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[13px] font-medium uppercase tracking-[.08em]">
          {t("money.nextQuestion")}
        </h2>
        {searchable ? (
          <input
            type="search"
            value={q}
            onChange={(event) => patch({ q: event.target.value || null, page: null })}
            placeholder={t("money.search.placeholder", {
              n: formatInt(children.total, locale),
              what: childrenLabel.toLocaleLowerCase(locale),
            })}
            aria-label={t("money.search.placeholder", {
              n: formatInt(children.total, locale),
              what: childrenLabel.toLocaleLowerCase(locale),
            })}
            className="w-[240px] border-b border-border bg-transparent py-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
          />
        ) : null}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {query
          ? `${childrenLabel} · ${formatInt(matched.length, locale)} / ${formatInt(children.total, locale)}`
          : collapsed
            ? t("money.topOf", { top: top.length, n: formatInt(children.total, locale) }) +
              (concentration != null
                ? ` — ${t("money.concentration", { top: top.length, pct: pct(concentration, locale) })}`
                : "")
            : `${childrenLabel} · ${formatInt(children.total, locale)}`}
      </p>
      <div ref={listRef} className="mt-3 min-h-0 flex-1 md:overflow-y-auto md:overscroll-contain">
        {children.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("money.emptyLevel")}
          </p>
        ) : matched.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("money.search.noMatch")}
          </p>
        ) : (
          top.map((item) => (
            <DestinationRow
              key={`${item.level}:${item.id}`}
              item={item}
              parentLabel={parentLabel}
              parentAmount={parentAmount}
              currency={currency}
            />
          ))
        )}
        {collapsed ? (
          <button
            type="button"
            onClick={() => patch({ expanded: "1" })}
            className="mt-3 text-[13px] text-accent underline-offset-2 hover:underline"
          >
            {t("money.showMore", {
              count: children.total - top.length,
              n: formatInt(children.total - top.length, locale),
            })}
          </button>
        ) : null}
        {!query && expanded && page === 1 && children.total > visibleCount ? (
          <button
            type="button"
            onClick={() => patch({ expanded: null, page: null })}
            className="mt-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("money.showLess", { n: visibleCount })}
          </button>
        ) : null}
        {!query ? <Pager page={page} hasMore={hasMore} update={patch} /> : null}
        <div className="space-y-1 pb-4 pt-3">
          {children.coverage && children.coverage.unknown_amount > 0 ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.listUnknown", {
                count: children.coverage.unknown_amount,
                n: formatInt(children.coverage.unknown_amount, locale),
              })}
            </p>
          ) : null}
          {children.level === "call" ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.callScopeNote")}
            </p>
          ) : null}
          {children.directly_on_parent ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.directlyOnParent", {
                count: children.directly_on_parent,
                n: formatInt(children.directly_on_parent, locale),
              })}
            </p>
          ) : null}
          {children.no_call_projects ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.noCallProjects", {
                count: children.no_call_projects,
                n: formatInt(children.no_call_projects, locale),
              })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Réconciliation — lecture comptable progressive : une situation      */
/* banale est calme, une anomalie mérite davantage d'explication.      */

function ReconRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-sm">
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
      <p className="mt-8 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground/80">{t("money.reconciliation.title")}</b>{" "}
        {t("money.reconciliation.notApplicable")}
      </p>
    );
  }

  const parent = reconciliation.parent_amount;
  const knownSum = reconciliation.children_known_sum;
  const status = reconciliation.status;

  // Le cas exact sans part inconnue est TRIVIAL : trois lignes calmes.
  // « Contribution du projet » ne se dit que d'une contribution
  // (CORDIS) — les natures comptables ne s'interchangent jamais.
  if (
    status === "exact" &&
    (reconciliation.unknown_children == null || reconciliation.unknown_children === 0)
  ) {
    return (
      <section className="mt-10 max-w-[430px]">
        <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("money.reconciliation.exactTitle")}
        </h2>
        <dl className="mt-2.5 space-y-1">
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
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {t("money.reconciliation.noUnallocated")}
        </p>
      </section>
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

  // Une anomalie méthodologique (gap, dépassement, total inconnu)
  // porte le filet d'accent : elle mérite l'attention, pas une carte.
  return (
    <section className="mt-10 max-w-[460px] border-l-2 border-accent/35 pl-4">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.reconciliation.title")}
      </h2>
      <dl className="mt-2.5 space-y-1">
        {rows.map((row) => (
          <ReconRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
        ))}
      </dl>
      <p className="mt-2.5 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
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
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* NSF — deux systèmes de mesure, jamais fondus                        */

function NsfSystemMeta({
  provenance,
  period,
  source,
}: {
  provenance: ChainProvenance | null | undefined;
  period: string;
  source: string;
}) {
  const { t } = useMoneyCopy();
  return (
    <dl className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
      <div>
        <dt className="sr-only">{t("money.methodology.nature")}</dt>
        <dd>
          <NatureMark provenance={provenance} />
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-medium text-foreground/60">{t("money.nsf.period")}</dt>
        <dd>{period}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-medium text-foreground/60">{t("money.methodology.source")}</dt>
        <dd>{source}</dd>
      </div>
    </dl>
  );
}

function NsfMeasureSystems({
  cumulative,
  axis,
}: {
  cumulative: { amount: number | null; measure: ChainMeasure };
  axis: NonNullable<ChainProjectNode["annual_obligations"]>;
}) {
  const { t, money, measureShort } = useMoneyCopy();
  return (
    <section className="mt-12">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.nsf.systemsTitle")}
      </h2>
      <div className="mt-4 grid gap-8 md:grid-cols-2 md:gap-0">
        <div className="md:pr-8">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(cumulative.measure.key)}
          </p>
          <p className="display-tight tnum mt-1.5 text-[24px] font-semibold">
            {money(cumulative.amount, "USD")}
          </p>
          <NsfSystemMeta
            provenance={cumulative.measure.provenance}
            period={t("money.nsf.cumulativeNote")}
            source={t("money.nsf.cumulativeProvenance")}
          />
        </div>
        <div className="border-border-soft md:border-l md:pl-8">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(axis.measure.key)}
          </p>
          <p className="display-tight tnum mt-1.5 text-[24px] font-semibold">
            {money(axis.window_sum, "USD")}
          </p>
          <NsfSystemMeta
            provenance={axis.measure.provenance}
            period={t("money.nsf.windowNote")}
            source={t("money.nsf.vintage", { vintage: axis.vintage })}
          />
          <table className="mt-4 w-full max-w-[320px] text-[13px]">
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
      <p className="mt-4 max-w-[62ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
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
    <section className="mt-12">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {beneficiary
          ? t("money.children.beneficiary", { count: data.children.total })
          : t("money.children.participation", { count: data.children.total })}{" "}
        · {formatInt(data.children.total, locale)}
      </h2>
      {beneficiary ? (
        <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.nih.beneficiaryNote")}
        </p>
      ) : null}
      <div className="mt-2">
        {items.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
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
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* États & petites briques                                             */

function LoadingBlock() {
  return (
    <div className="flex md:h-[calc(100dvh-4rem)]">
      <div className="hidden w-[224px] shrink-0 border-r border-border-soft px-5 py-6 md:block lg:w-[248px]">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-4/6" />
      </div>
      <div className="flex-1 px-6 py-8 md:px-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-1/2" />
        <Skeleton className="mt-6 h-12 w-56" />
        <Skeleton className="mt-10 h-64 w-full max-w-[720px]" />
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

function callNotAvailableNote(t: (k: string) => string, down: ChainNavEntry[]): ReactNode {
  const call = down.find((entry) => entry.level === "call");
  if (call?.status !== "not_available") return null;
  return (
    <p className="mt-2 max-w-[62ch] text-[12px] leading-snug text-muted-foreground">
      {t("money.callNotAvailable")}
    </p>
  );
}

/** La part du nœud dans son parent, libellée par famille de mesure. */
function ShareLine({ share, measureKey }: { share?: ChainNodeShare | null; measureKey: string | null | undefined }) {
  const { t, locale } = useMoneyCopy();
  const family = shareFamily(measureKey);
  if (share == null || share.ratio == null || !family) return null;
  return (
    <p className="tnum mt-1.5 text-[13.5px] font-medium text-foreground/85">
      {t(`money.shareLine.${family}`, {
        pct: pct(share.ratio * 100, locale),
        parent: share.parent.label ?? "",
      })}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Racine — trois portes typographiques                                */

function FundersRoot() {
  const { t, locale, money, measureShort } = useMoneyCopy();
  const query = useQuery({ queryKey: ["chain-funders"], queryFn: api.chainFunders });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const { funders, cross_funder_total } = query.data;
  return (
    <Workspace>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-10 md:px-12 md:py-14">
        <div className="mx-auto w-full max-w-[680px]">
          <Eyebrow>{t("money.eyebrow")}</Eyebrow>
          <h1 className="display-tight mt-1.5 text-[clamp(26px,3.2vw,36px)] font-semibold">
            {t("money.title")}
          </h1>
          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {t("money.lead")}
          </p>
          <p className="mt-8 text-[13px] font-medium uppercase tracking-[.08em]">
            {t("money.rootGesture")}
          </p>
          {/* Trois univers NON comparables : trois lignes, chacune dans
              sa mesure et sa devise — aucun classement, aucun total. */}
          <div className="mt-3">
            {funders.map((funder) => (
              <Link
                key={funder.id}
                to={`/money/funder/${funder.id}`}
                className="group flex items-baseline justify-between gap-6 border-b border-border-soft py-4"
              >
                <span className="min-w-0">
                  <span className="block text-[17px] font-medium leading-snug transition-colors group-hover:text-accent">
                    {funder.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {measureShort(funder.aggregate.measure.key)}
                    {" · "}
                    <span className="tnum">
                      {t("money.rootProjects", {
                        count: funder.aggregate.projects,
                        n: formatInt(funder.aggregate.projects, locale),
                      })}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="tnum text-[17px] font-semibold">
                    {money(funder.aggregate.amount, funder.aggregate.measure.currency)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-[14px] text-muted-foreground/50 transition-colors group-hover:text-accent"
                  >
                    ›
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {!cross_funder_total.available ? (
            <p className="mt-6 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
              <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
              {t("money.noTotalBody")}
            </p>
          ) : null}
        </div>
      </div>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Focus agrégé : financeur, programme, appel                          */

function AggregateFocus({ level, id }: { level: "funder" | "programme" | "call"; id: string }) {
  const { t, locale, money, measureLabel, measureShort } = useMoneyCopy();
  const [page, expanded, q, patch] = usePagePatch();
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

  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  // Pendant le vol d'une navigation, `placeholderData` sert encore le
  // nœud PRÉCÉDENT (l'Outlet reste monté sur les routes-outil) : tout
  // le rendu se type d'après le niveau des DONNÉES servies, jamais
  // d'après l'URL — l'ancien focus reste cohérent jusqu'à l'arrivée
  // du nouveau, qui prend le centre avec sa micro-transition.
  const shown = data.node.level as "funder" | "programme" | "call";
  const label =
    shown === "funder"
      ? (data as ChainFunderNode).node.label
      : shown === "call"
        ? (data as ChainCallNode).node.code
        : ((data as ChainProgrammeNode).node.label ?? (data as ChainProgrammeNode).node.code);
  const trace = traceFromSpine(data.ancestors, {
    level: shown,
    label,
    amount: data.aggregate?.amount,
    currency: data.aggregate?.measure.currency,
    share: data.share_of_parent?.comparability === "ok" ? data.share_of_parent.ratio : null,
  });
  const call = shown === "call" ? (data as ChainCallNode) : null;
  const transversal = Boolean(call && call.programmes.length > 1 && !call.context);
  const funderCode =
    shown === "funder"
      ? String(data.node.id)
      : shown === "programme"
        ? (data as ChainProgrammeNode).node.funder
        : (data as ChainCallNode).node.funder;
  const coverage = data.aggregate?.coverage;

  return (
    <Workspace trace={trace}>
      <div
        key={`${shown}:${data.node.id}:${programmeContext ?? ""}`}
        className="focus-in flex min-h-0 flex-1 flex-col px-6 pb-4 pt-6 md:px-10"
      >
        <header className="shrink-0">
          <Eyebrow>
            {t(`money.levels.${shown}`)}
            {"code" in data.node && data.node.code !== label ? (
              <>
                {" "}
                · <span className="font-mono normal-case">{data.node.code}</span>
              </>
            ) : null}
          </Eyebrow>
          <h1
            className={cn(
              "display-tight mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold",
              shown === "call" ? "font-mono text-[clamp(17px,1.8vw,22px)]" : undefined,
            )}
          >
            {label}
          </h1>
          <p className="display-tight tnum mt-3 text-[clamp(26px,2.8vw,36px)] font-semibold">
            {data.aggregate?.amount == null ? (
              <span title={t("money.unknownAmount")}>—</span>
            ) : (
              money(data.aggregate.amount, data.aggregate.measure.currency)
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>{measureShort(data.aggregate?.measure.key)}</span>
            <NatureMark provenance={data.aggregate?.measure.provenance} />
            <MethodologyPanel
              rows={[
                {
                  label: t("money.methodology.measure"),
                  value: measureLabel(data.aggregate?.measure.key),
                },
                ...(shown === "call"
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
          </div>
          <ShareLine share={data.share_of_parent} measureKey={data.aggregate?.measure.key} />
          {data.aggregate && coverage ? (
            <p className="mt-2 max-w-[68ch] text-[12px] leading-snug text-muted-foreground">
              {coverage.unknown_amount > 0
                ? t("money.coverageLine", {
                    count: coverage.unknown_amount,
                    projects: formatInt(data.aggregate.projects, locale),
                    unknown: formatInt(coverage.unknown_amount, locale),
                  })
                : t("money.coverageFull", {
                    projects: formatInt(data.aggregate.projects, locale),
                  })}{" "}
              {t("money.sumObserved")}
            </p>
          ) : null}
          {callNotAvailableNote(t, data.navigation.down)}
          {call?.context ? (
            <p className="mt-2 max-w-[62ch] text-[12px] leading-snug text-muted-foreground">
              {t("money.callContextNote")}{" "}
              <Link to={`/money/call/${call.node.id}`} className="text-accent hover:underline">
                {t("money.callContextAll")}
              </Link>
            </p>
          ) : null}
          {transversal && call ? (
            <p className="mt-2 max-w-[68ch] text-[12px] leading-snug text-muted-foreground">
              {t("money.callTransversal", { count: call.programmes.length })}{" "}
              {t("money.callProgrammesServed")}{" "}
              {call.programmes.map((programme, index) => (
                <span key={programme.id}>
                  {index > 0 ? " · " : ""}
                  <Link
                    to={`/money/call/${call.node.id}?programme=${programme.id}`}
                    className="font-mono text-[11px] transition-colors hover:text-accent"
                  >
                    {programme.code}
                    <span className="tnum"> ({formatInt(programme.projects, locale)})</span>
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </header>
        <div className="mt-7 flex min-h-0 flex-1 flex-col">
          <DestinationsSection
            data={data}
            parentLabel={label}
            page={page}
            expanded={expanded}
            q={q}
            patch={patch}
          />
        </div>
      </div>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Focus projet : la fiche analytique compacte                         */

function ProjectFocus({ id }: { id: string }) {
  const { t, locale, money, measureLabel, measureShort, natureLabel } = useMoneyCopy();
  const query = useQuery({
    queryKey: ["chain-project", id],
    queryFn: () => api.chainProject(id),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const trace = traceFromSpine(data.ancestors, {
    level: "project",
    label: data.node.label,
    amount: data.measure.amount,
    currency: data.measure.currency,
    share: data.share_of_parent?.comparability === "ok" ? data.share_of_parent.ratio : null,
  });
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
    <Workspace trace={trace}>
      <div
        key={`project:${data.node.id}`}
        className="focus-in min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-6 md:px-10"
      >
        <div className="max-w-[720px]">
          <Eyebrow>
            {t("money.levels.project")} ·{" "}
            <span className="font-mono normal-case">{data.node.source_id}</span>
          </Eyebrow>
          <h1 className="display-tight mt-1 text-[clamp(21px,2.2vw,28px)] font-semibold">
            {data.node.label}
          </h1>
          {data.node.title !== data.node.label ? (
            <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-muted-foreground">
              {data.node.title}
            </p>
          ) : null}
          {dates ? <p className="tnum mt-1.5 text-[12.5px] text-muted-foreground">{dates}</p> : null}
          <p className="display-tight tnum mt-4 text-[clamp(26px,2.8vw,36px)] font-semibold">
            {data.measure.amount == null ? (
              <span title={t("money.unknownAmount")}>—</span>
            ) : (
              money(data.measure.amount, data.measure.currency)
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>{measureShort(data.measure.key)}</span>
            <NatureMark provenance={data.measure.provenance} />
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
          </div>
          <ShareLine share={data.share_of_parent} measureKey={data.measure.key} />
          {callNotAvailableNote(t, data.navigation.down)}
          {data.total_cost ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
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
          <ExploreExits
            exits={[{ label: t("money.projectSheet"), to: `/projects/${data.node.id}` }]}
          />
        </div>
      </div>
    </Workspace>
  );
}

/* ------------------------------------------- organisation / pays (transverse) */

/** Les relations de financement d'une entité transverse : une ligne
 *  par financeur, chacune dans sa mesure et sa devise — plusieurs
 *  chaînes convergent ici, aucun total unique. */
function FunderRelations({ blocks }: { blocks: ChainFunderBlock[] }) {
  const { t, locale, money, measureShort } = useMoneyCopy();
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.orgRelations")}
      </h2>
      <div className="mt-2 max-w-[620px]">
        {blocks.map((block) => (
          <div
            key={block.funder}
            className="flex items-baseline justify-between gap-6 border-b border-border-soft py-3.5"
          >
            <span className="min-w-0">
              <Link
                to={`/money/funder/${block.funder}`}
                className="text-[14.5px] font-medium leading-snug transition-colors hover:text-accent"
              >
                {t(`money.funderNames.${block.funder}`)}
              </Link>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                {block.amount == null ? t("money.unknownShare") : measureShort(block.measure.key)}
              </span>
              <span className="tnum block text-[11.5px] text-muted-foreground">
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
              </span>
            </span>
            <span className="tnum shrink-0 text-[15px] font-semibold">
              {block.amount == null ? (
                <span className="text-muted-foreground" title={t("money.unknownShare")}>
                  {t("money.unknown")}
                </span>
              ) : (
                money(block.amount, block.measure.currency)
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoTotalNote() {
  const { t } = useTranslation();
  return (
    <p className="mt-6 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
      <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
      {t("money.noTotalBody")}
    </p>
  );
}

function TransverseShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Workspace>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-12">
        <p className="text-[12.5px]">
          <Link to="/money" className="text-muted-foreground transition-colors hover:text-foreground">
            ↩ {t("money.backToRoot")}
          </Link>
        </p>
        <div className="mt-6 max-w-[760px]">{children}</div>
      </div>
    </Workspace>
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
    <TransverseShell>
      <Eyebrow>{t("money.levels.organisation")}</Eyebrow>
      <h1 className="display-tight mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold">
        {data.node.country ? (
          <span aria-hidden="true" className="mr-2">
            {countryFlag(data.node.country)}
          </span>
        ) : null}
        {label}
      </h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{t("money.orgLead")}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
            { label: t("money.methodology.dedup"), value: t("money.dedupNote") },
          ]}
        />
      </div>
      {data.by_funder.length === 0 ? (
        <p className="py-14 text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <FunderRelations blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits exits={[{ label: t("money.orgSheet"), to: `/organisations/${data.node.id}` }]} />
    </TransverseShell>
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
    <TransverseShell>
      <Eyebrow>{t("money.levels.country")}</Eyebrow>
      <h1 className="display-tight mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold">
        <span aria-hidden="true" className="mr-2">
          {countryFlag(data.node.id)}
        </span>
        {countryName}
      </h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{t("money.countryOrgs", { n: formatInt(data.organisations, locale) })}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.country"), value: t("money.countryDestination") },
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
          ]}
        />
      </div>
      <p className="mt-2 max-w-[68ch] text-[12px] leading-snug text-muted-foreground">
        {t("money.countryDestination")}
      </p>
      {data.by_funder.length === 0 ? (
        <p className="py-14 text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <FunderRelations blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits exits={[{ label: t("money.countrySheet"), to: `/countries/${data.node.id}` }]} />
    </TransverseShell>
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
      return <AggregateFocus level={level} id={id} />;
    case "project":
      return <ProjectFocus id={id} />;
    case "organisation":
      return <OrganisationView id={id} />;
    default:
      return <CountryView code={id} />;
  }
}
