/** B2 — « Où est passé cet argent ? » (docs/conception-b-chaine-argent-public.md § 15).
 *
 *  Drill-down progressif sur le moteur B1 (/api/chain/*). Le moteur
 *  FAIT FOI : profondeur variable (NIH et NSF n'ont pas d'étage
 *  appel — jamais synthétisé), nature comptable et provenance lues
 *  sur les clés stables des enveloppes de mesure, réconciliation
 *  affichée telle que le moteur la donne (`gap` n'est pas une erreur),
 *  inconnu ≠ zéro, et aucun total unique inter-financeurs — les blocs
 *  par financeur restent séparés (gold ITACONIX). Tout l'état vit
 *  dans l'URL : copier, rafraîchir, rouvrir = même vue. */

import { useEffect, type ReactNode } from "react";
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

const PAGE_SIZE = 50;

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
  const natureLabel = (provenance: ChainProvenance | null | undefined) =>
    provenance ? t(`money.nature.${provenance}`) : "";
  return { t, locale, money, measureLabel, natureLabel };
}

function usePagePatch(): [number, (patch: Record<string, string | null>) => void] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { preventScrollReset: true });
  };
  return [page, patch];
}

/* ------------------------------------------------------------------ */
/* Blocs partagés                                                     */

function crumbPath(crumb: ChainCrumb): string {
  return `/money/${crumb.level}/${crumb.id}`;
}

function MoneyCrumbs({
  ancestors,
  current,
}: {
  ancestors: ChainCrumb[];
  current: string;
}) {
  const { t } = useTranslation();
  const items: BreadcrumbItem[] = [
    { label: t("money.eyebrow"), to: "/money" },
    ...ancestors.map((a) => ({
      label: a.label ?? a.code ?? String(a.id),
      to: crumbPath(a),
    })),
    { label: current },
  ];
  return <Breadcrumb items={items} />;
}

function NatureTag({ provenance }: { provenance: ChainProvenance | null | undefined }) {
  const { t } = useTranslation();
  if (!provenance) return null;
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground"
      title={t(`money.natureHint.${provenance}`)}
    >
      {t(`money.nature.${provenance}`)}
    </span>
  );
}

/** Le chiffre en titre + sa définition — jamais un montant nu. */
function MeasureHero({
  amount,
  measure,
  projects,
  coverage,
}: {
  amount: number | null;
  measure: ChainMeasure;
  projects?: number;
  coverage?: { with_amount: number; unknown_amount: number };
}) {
  const { t, locale, money, measureLabel } = useMoneyCopy();
  return (
    <div className="mt-8">
      <div className="display-tight tnum text-[clamp(34px,5vw,52px)] font-semibold">
        {amount == null ? (
          <span title={t("money.unknownAmount")}>—</span>
        ) : (
          money(amount, measure.currency)
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span>{amount == null ? t("money.unknownAmount") : measureLabel(measure.key)}</span>
        {amount != null ? <NatureTag provenance={measure.provenance} /> : null}
      </p>
      {projects != null && coverage != null ? (
        <p className="mt-3 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          <b className="font-medium text-foreground/80">{t("money.coverageTitle")}</b>{" "}
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

/** Une ligne enfant du drill — nom, volumétrie, montant, part. */
function ChildRow({
  to,
  flag,
  name,
  meta,
  count,
  amount,
  currency,
  share,
}: {
  to: string;
  flag?: string | null;
  name: string;
  meta?: string;
  count?: number | null;
  amount: number | null;
  currency: string | null | undefined;
  share: number | null;
}) {
  const { t, locale, money } = useMoneyCopy();
  return (
    <Link
      to={to}
      className="group flex items-baseline gap-3 border-b border-border-soft py-2.5 text-sm"
    >
      {flag ? (
        <span aria-hidden="true" className="leading-none">
          {flag}
        </span>
      ) : null}
      <span className="min-w-0 truncate leading-snug transition-colors group-hover:text-accent">
        {name}
        {meta ? <span className="ml-1.5 text-[12px] text-muted-foreground">{meta}</span> : null}
      </span>
      {count != null ? (
        <span className="tnum ml-auto whitespace-nowrap text-[13px] text-muted-foreground">
          {formatInt(count, locale)}
        </span>
      ) : (
        <span className="ml-auto" />
      )}
      <span className="tnum w-24 whitespace-nowrap text-right font-medium">
        {amount == null ? (
          <span className="text-muted-foreground" title={t("money.unknownAmount")}>
            —
          </span>
        ) : (
          money(amount, currency)
        )}
      </span>
      <span className="tnum hidden w-14 whitespace-nowrap text-right text-[12.5px] text-muted-foreground sm:inline">
        {share == null
          ? ""
          : `${share.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}
      </span>
    </Link>
  );
}

function ChildrenSection({
  title,
  list,
  page,
  patch,
  parentAmount,
  currency,
  toChild,
  footNotes,
}: {
  title: string;
  list: ChainChildren;
  page: number;
  patch: (changes: Record<string, string | null>) => void;
  parentAmount: number | null;
  currency: string | null | undefined;
  toChild: (item: ChainChildren["items"][number]) => string;
  footNotes?: ReactNode;
}) {
  const { t, locale } = useMoneyCopy();
  const paginated = list.level === "call" || list.level === "project";
  const hasMore = paginated && page * PAGE_SIZE < list.total;
  return (
    <section className="mt-14">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {title} · {formatInt(list.total, locale)}
      </h2>
      {list.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        list.items.map((item) => (
          <ChildRow
            key={item.id}
            to={toChild(item)}
            name={item.label ?? item.code ?? String(item.id)}
            meta={item.label && item.code && item.label !== item.code ? item.code : undefined}
            count={item.projects ?? null}
            amount={item.amount}
            currency={currency}
            share={
              parentAmount != null && parentAmount > 0 && item.amount != null
                ? (item.amount / parentAmount) * 100
                : null
            }
          />
        ))
      )}
      {footNotes}
      {paginated ? <Pager page={page} hasMore={hasMore} update={patch} /> : null}
    </section>
  );
}

/** D5 — la réconciliation d'un changement de grain, en toutes lettres. */
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
      <p className="mt-4 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground/80">{t("money.reconciliation.title")}</b>{" "}
        {t("money.reconciliation.notApplicable")}
      </p>
    );
  }
  const rows: { label: string; value: string }[] = [
    {
      label: t("money.reconciliation.parent"),
      value:
        reconciliation.parent_amount == null
          ? t("money.unknown")
          : money(reconciliation.parent_amount, currency),
    },
    {
      label: t("money.reconciliation.childrenSum"),
      value:
        reconciliation.children_known_sum == null
          ? t("money.unknown")
          : money(reconciliation.children_known_sum, currency),
    },
  ];
  if (reconciliation.unallocated != null && reconciliation.status !== "exact") {
    rows.push({
      label:
        reconciliation.status === "children_exceed_parent"
          ? t("money.reconciliation.excess")
          : t("money.reconciliation.unallocated"),
      value: money(Math.abs(reconciliation.unallocated), currency),
    });
  }
  if (reconciliation.unknown_children != null && reconciliation.unknown_children > 0) {
    rows.push({
      label: t("money.reconciliation.unknownChildren"),
      value: formatInt(reconciliation.unknown_children, locale),
    });
  }
  return (
    <div className="mt-6 rounded-xl border border-border-soft bg-surface/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.reconciliation.title")}
      </p>
      <dl className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tnum font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        {t(`money.reconciliation.status.${reconciliation.status}`)}
      </p>
    </div>
  );
}

/** R3 — l'axe annuel NSF, un SECOND système de mesure, jamais fondu. */
function NsfAnnualBlock({ axis }: { axis: ChainAnnualObligations }) {
  const { t, money } = useMoneyCopy();
  return (
    <section className="mt-14">
      <h2 className="mb-3 flex flex-wrap items-baseline gap-2 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.nsf.annualTitle")}
        <NatureTag provenance={axis.measure.provenance} />
      </h2>
      <p className="mb-4 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("money.nsf.incompatibility")}
      </p>
      <table className="w-full max-w-[440px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
            <th scope="col" className="py-2 pr-3">
              {t("money.nsf.fy")}
            </th>
            <th scope="col" className="py-2 text-right">
              {t("money.nsf.obligation")}
            </th>
          </tr>
        </thead>
        <tbody>
          {axis.fiscal_years.map((row) => (
            <tr key={row.fy} className="border-b border-border-soft">
              <td className="tnum py-2 pr-3">{row.fy}</td>
              <td className="tnum py-2 text-right">{money(row.amount, "USD")}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 pr-3 font-medium">{t("money.nsf.windowSum")}</td>
            <td className="tnum py-2 text-right font-medium">{money(axis.window_sum, "USD")}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        {t("money.nsf.vintage", { vintage: axis.vintage })}
      </p>
    </section>
  );
}

/** ⓘ — la méthodologie en divulgation, façon R5B. */
function MethodologyDetails({ rows }: { rows: { label: string; value: string }[] }) {
  const { t } = useTranslation();
  return (
    <details className="mt-10 max-w-[74ch] rounded-xl border border-border-soft bg-surface/50 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer list-none text-foreground/75">
        ⓘ {t("money.methodology.title")}
      </summary>
      <dl className="mt-3 space-y-1.5">
        {rows
          .filter((row) => row.value)
          .map((row) => (
            <div key={row.label} className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground/70">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-3">
        <Link to="/about-data" className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground">
          {t("money.methodology.aboutData")}
        </Link>
      </p>
    </details>
  );
}

function LoadingBlock() {
  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="mt-8 h-24 w-full" />
      <Skeleton className="mt-8 h-56 w-full" />
    </div>
  );
}

function ErrorBlock({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-24 text-center">
      <p className="text-lg font-medium">
        {notFound ? t("money.notFound") : t("money.error")}
      </p>
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

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[980px] px-6 pt-12 pb-20">{children}</div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 text-xs font-medium uppercase tracking-[.1em] text-accent">{children}</p>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="display-tight mt-1.5 text-[clamp(28px,4vw,40px)] font-semibold">{children}</h1>
  );
}

function callNotAvailableNote(t: (k: string) => string, down: ChainNavEntry[]): ReactNode {
  const call = down.find((entry) => entry.level === "call");
  if (call?.status !== "not_available") return null;
  return (
    <p className="mt-2 text-[12.5px] text-muted-foreground">{t("money.callNotAvailable")}</p>
  );
}

/* ------------------------------------------------------------------ */
/* Vues par niveau                                                    */

function FundersRoot() {
  const { t, measureLabel } = useMoneyCopy();
  const query = useQuery({ queryKey: ["chain-funders"], queryFn: api.chainFunders });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const { funders, cross_funder_total } = query.data;
  return (
    <Shell>
      <Eyebrow>{t("money.eyebrow")}</Eyebrow>
      <Title>{t("money.title")}</Title>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
        {t("money.lead")}
      </p>
      <section className="mt-12">
        {funders.map((funder) => (
          <ChildRow
            key={funder.id}
            to={`/money/funder/${funder.id}`}
            name={funder.label}
            meta={measureLabel(funder.aggregate.measure.key)}
            count={funder.aggregate.projects}
            amount={funder.aggregate.amount}
            currency={funder.aggregate.measure.currency}
            share={null}
          />
        ))}
      </section>
      {!cross_funder_total.available ? (
        <p className="mt-6 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
          {t("money.noTotalBody")}
        </p>
      ) : null}
    </Shell>
  );
}

function FunderView({ code }: { code: string }) {
  const { t, measureLabel } = useMoneyCopy();
  const [page, patch] = usePagePatch();
  const query = useQuery({
    queryKey: ["chain-funder", code],
    queryFn: () => api.chainFunder(code),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={data.node.label} />
      <Eyebrow>{t("money.levels.funder")}</Eyebrow>
      <Title>{data.node.label}</Title>
      {data.aggregate ? (
        <MeasureHero
          amount={data.aggregate.amount}
          measure={data.aggregate.measure}
          projects={data.aggregate.projects}
          coverage={data.aggregate.coverage}
        />
      ) : null}
      {callNotAvailableNote(t, data.navigation.down)}
      <ChildrenSection
        title={t("money.children.programme", { count: data.children.total })}
        list={data.children}
        page={page}
        patch={patch}
        parentAmount={data.aggregate?.amount ?? null}
        currency={data.aggregate?.measure.currency}
        toChild={(item) => `/money/programme/${item.id}`}
      />
      <MethodologyDetails
        rows={[
          {
            label: t("money.methodology.measure"),
            value: data.aggregate ? measureLabel(data.aggregate.measure.key) : "",
          },
          { label: t("money.methodology.programmeSemantics"), value: t(`money.programmeSemantics.${code}`) },
          { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
        ]}
      />
    </Shell>
  );
}

function ProgrammeView({ id }: { id: string }) {
  const { t, locale, measureLabel } = useMoneyCopy();
  const [page, patch] = usePagePatch();
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
  const childLevel = data.children.level;
  const title =
    childLevel === "programme"
      ? t("money.children.programme", { count: data.children.total })
      : childLevel === "call"
        ? t("money.children.call", { count: data.children.total })
        : t("money.children.project", { count: data.children.total });
  return (
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={data.node.label ?? data.node.code} />
      <Eyebrow>
        {t("money.levels.programme")} · <span className="font-mono normal-case">{data.node.code}</span>
      </Eyebrow>
      <Title>{data.node.label ?? data.node.code}</Title>
      <MeasureHero
        amount={data.aggregate.amount}
        measure={data.aggregate.measure}
        projects={data.aggregate.projects}
        coverage={data.aggregate.coverage}
      />
      {callNotAvailableNote(t, data.navigation.down)}
      <ChildrenSection
        title={title}
        list={data.children}
        page={page}
        patch={patch}
        parentAmount={data.aggregate.amount}
        currency={data.aggregate.measure.currency}
        toChild={(item) =>
          childLevel === "programme"
            ? `/money/programme/${item.id}`
            : childLevel === "call"
              ? `/money/call/${item.id}?programme=${data.node.id}`
              : `/money/project/${item.id}`
        }
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
      <MethodologyDetails
        rows={[
          { label: t("money.methodology.measure"), value: measureLabel(data.aggregate.measure.key) },
          {
            label: t("money.methodology.programmeSemantics"),
            value: t(`money.programmeSemantics.${data.node.funder}`),
          },
          { label: t("money.methodology.notBudget"), value: t("money.notBudget") },
        ]}
      />
    </Shell>
  );
}

function CallView({ id }: { id: string }) {
  const { t, locale, measureLabel } = useMoneyCopy();
  const [page, patch] = usePagePatch();
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
  return (
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={data.node.code} />
      <Eyebrow>{t("money.levels.call")}</Eyebrow>
      <Title>
        <span className="font-mono text-[0.82em]">{data.node.code}</span>
      </Title>
      {data.context ? (
        <p className="mt-3 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.callContextNote")}{" "}
          <Link to={`/money/call/${data.node.id}`} className="text-accent hover:underline">
            {t("money.callContextAll")}
          </Link>
        </p>
      ) : transversal ? (
        <p className="mt-3 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
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
      />
      <ChildrenSection
        title={t("money.children.project", { count: data.children.total })}
        list={data.children}
        page={page}
        patch={patch}
        parentAmount={data.aggregate.amount}
        currency={data.aggregate.measure.currency}
        toChild={(item) => `/money/project/${item.id}`}
      />
      <MethodologyDetails
        rows={[
          { label: t("money.methodology.measure"), value: measureLabel(data.aggregate.measure.key) },
          { label: t("money.methodology.callLink"), value: t("money.callReconstructed") },
          { label: t("money.methodology.notBudget"), value: t("money.notEnvelope") },
        ]}
      />
    </Shell>
  );
}

function ParticipationsTable({ data }: { data: ChainProjectNode }) {
  const { t, money } = useMoneyCopy();
  const beneficiary = data.children.level === "beneficiary";
  return (
    <section className="mt-14">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {beneficiary
          ? t("money.children.beneficiary", { count: data.children.total })
          : t("money.children.participation", { count: data.children.total })}
      </h2>
      {beneficiary ? (
        <p className="mb-4 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.nih.beneficiaryNote")}
        </p>
      ) : null}
      {data.children.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {beneficiary ? t("money.nih.noBeneficiary") : t("money.emptyLevel")}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
              <th scope="col" className="py-2 pr-3">
                {t("money.table.organisation")}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t("money.table.role")}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t("money.table.country")}
              </th>
              {!beneficiary ? (
                <th scope="col" className="py-2 text-right">
                  {t("money.table.amount")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.children.items.map((item) => (
              <tr
                key={item.source_uid}
                className="border-b border-border-soft transition-colors hover:bg-surface/60"
              >
                <td className="py-2 pr-3">
                  <Link
                    to={`/money/organisation/${item.organisation.id}`}
                    className="transition-colors hover:text-accent"
                  >
                    {formatOrgName(item.organisation.label)}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{item.role ?? "—"}</td>
                <td className="py-2 pr-3">
                  {item.country ? (
                    <Link
                      to={`/money/country/${item.country}`}
                      className="transition-colors hover:text-accent"
                    >
                      <span aria-hidden="true">{countryFlag(item.country)}</span> {item.country}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                {!beneficiary ? (
                  <td className="tnum py-2 text-right">
                    {item.amount == null ? (
                      <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                        {t("money.unknown")}
                      </span>
                    ) : (
                      money(item.amount, data.measure.currency)
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
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
  return (
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={data.node.label} />
      <Eyebrow>
        {t("money.levels.project")} ·{" "}
        <span className="font-mono normal-case">{data.node.source_id}</span>
      </Eyebrow>
      <Title>{data.node.label}</Title>
      {data.node.title !== data.node.label ? (
        <p className="mt-2 max-w-[74ch] text-[15px] leading-relaxed text-muted-foreground">
          {data.node.title}
        </p>
      ) : null}
      {dates ? <p className="tnum mt-2 text-[13px] text-muted-foreground">{dates}</p> : null}
      {callNotAvailableNote(t, data.navigation.down)}
      <MeasureHero amount={data.measure.amount} measure={data.measure} />
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
      <ParticipationsTable data={data} />
      {data.annual_obligations ? <NsfAnnualBlock axis={data.annual_obligations} /> : null}
      <MethodologyDetails
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
      <ExploreExits
        exits={[{ label: t("money.projectSheet"), to: `/projects/${data.node.id}` }]}
      />
    </Shell>
  );
}

function ByFunderBlocks({ blocks }: { blocks: ChainFunderBlock[] }) {
  const { t, locale, money, measureLabel } = useMoneyCopy();
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            {block.amount == null ? t("money.unknownShare") : measureLabel(block.measure.key)}
          </p>
          <p className="tnum mt-3 text-[12.5px] text-muted-foreground">
            {t("money.orgProjects", { count: block.projects, n: formatInt(block.projects, locale) })}
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
    <p className="mt-6 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
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
  return (
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={formatOrgName(data.node.label)} />
      <Eyebrow>{t("money.levels.organisation")}</Eyebrow>
      <Title>
        {data.node.country ? (
          <span aria-hidden="true" className="mr-2">
            {countryFlag(data.node.country)}
          </span>
        ) : null}
        {formatOrgName(data.node.label)}
      </Title>
      {data.by_funder.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <ByFunderBlocks blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <MethodologyDetails
        rows={[
          { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
          { label: t("money.methodology.dedup"), value: t("money.dedupNote") },
        ]}
      />
      <ExploreExits
        exits={[{ label: t("money.orgSheet"), to: `/organisations/${data.node.id}` }]}
      />
    </Shell>
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
    <Shell>
      <MoneyCrumbs ancestors={data.ancestors} current={countryName} />
      <Eyebrow>{t("money.levels.country")}</Eyebrow>
      <Title>
        <span aria-hidden="true" className="mr-2">
          {countryFlag(data.node.id)}
        </span>
        {countryName}
      </Title>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {t("money.countryOrgs", { n: formatInt(data.organisations, locale) })}
      </p>
      <p className="mt-3 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("money.countryDestination")}
      </p>
      {data.by_funder.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <ByFunderBlocks blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <MethodologyDetails
        rows={[
          { label: t("money.methodology.country"), value: t("money.countryDestination") },
          { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
        ]}
      />
      <ExploreExits
        exits={[{ label: t("money.countrySheet"), to: `/countries/${data.node.id}` }]}
      />
    </Shell>
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
