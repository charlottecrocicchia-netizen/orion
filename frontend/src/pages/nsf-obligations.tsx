import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { KpiStatic } from "@/components/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import type { NsfObligationsAggregate } from "@/lib/api";
import { formatCompactMoney, formatOrgName, useCountryName } from "@/lib/format";
import { cn } from "@/lib/utils";

/** /nsf-obligations — la surface dédiée « Share of NSF award
 *  obligations » (lot R5B, contrat gelé R5A § 19 / § 20.1).
 *
 *  Métrique INDÉPENDANTE, pas un mode du Reference Engine : pas de
 *  `value=`, aucune entrée dans « View funding as ». L'axe temporel
 *  s'écrit `fy=` (exercice fédéral d'obligation) — `time=` est REJETÉ
 *  ici, jamais réinterprété (§ 19.4), comme `fy=` n'existe sur aucune
 *  autre surface. Le sélecteur n'offre QUE les FY `available` du /meta
 *  (jamais un choix qui finirait en 422) ; un FY forcé par l'URL se dit
 *  INDISPONIBLE — jamais un zéro, jamais un repli (§ 19.6). La
 *  couverture s'affiche toujours : le non joignable reste au
 *  dénominateur et n'est jamais redistribué (§ 20.1 C3). */

const DIMENSIONS = ["fy", "division", "state", "country", "organisation"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const FY_PATTERN = /^(\d{4})(?:\.\.(\d{4}))?$/;

/** Chaque refus de l'API a SA phrase — jamais un message générique
 *  (doctrine des refus nommés, R0 § D13, motifs propres à la surface). */
const ERROR_KEYS: Record<string, string> = {
  fy_required: "nsfObligations.errors.fyRequired",
  fy_invalid: "nsfObligations.errors.fyInvalid",
  dimension_not_supported: "nsfObligations.errors.dimensionNotSupported",
  time_not_supported_on_this_surface: "nsfObligations.errors.timeNotSupported",
  nsf_only_surface: "nsfObligations.errors.nsfOnly",
  fy_unavailable: "nsfObligations.errors.fyUnavailable",
  fy_coverage_below_threshold: "nsfObligations.errors.fyCoverageBelow",
  nsf_obligations_unavailable: "nsfObligations.errors.noVintage",
};

function refusalKey(error: unknown): string {
  const detail = error instanceof ApiError ? error.detail : null;
  return (detail && ERROR_KEYS[detail]) || "nsfObligations.errors.generic";
}

/* ————— Un segment de phrase ouvrant un petit menu (registre calls) ————— */

function Segment({
  display,
  menuLabel,
  children,
}: {
  display: ReactNode;
  menuLabel: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1 border-b border-dotted border-accent/45 pb-px text-[13.5px] font-medium text-accent"
      >
        {display}
        <span aria-hidden="true" className="text-[10px] opacity-60">
          ▾
        </span>
      </button>
      {open ? (
        <span
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[220px] rounded-xl border border-border bg-background p-1.5 shadow-key"
        >
          {children(() => setOpen(false))}
        </span>
      ) : null}
    </span>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface",
        selected ? "bg-accent-soft/60 font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ————— Le refus, en toutes lettres — jamais un écran vide ————— */

function Refusal({ messageKey, fyLabel }: { messageKey: string; fyLabel?: string }) {
  const { t } = useTranslation();
  return (
    <p className="max-w-[64ch] py-24 text-center text-muted-foreground">
      {t(messageKey, { fy: fyLabel ?? "" })}
    </p>
  );
}

/* ————— La page ————— */

export function NsfObligationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const countryName = useCountryName();
  const [params, setParams] = useSearchParams();

  const money = (value: number) => formatCompactMoney(value, locale, "usd");
  const pct = (share: number) =>
    `${share.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  const fyLabel = (fy: number | string) => t("nsfObligations.fy", { fy });

  const { data: meta } = useQuery({
    queryKey: ["nsf-obligations-meta"],
    queryFn: api.nsfObligationsMeta,
  });
  const availableYears = (meta?.years ?? [])
    .filter((year) => year.available)
    .map((year) => year.fy);
  const defaultFy = availableYears.length
    ? Math.max(...availableYears)
    : null;

  // Contrat § 19.4 : `time=` n'existe pas ici — une URL qui le porte se
  // refuse en toutes lettres, jamais réinterprétée. Refus prédictif :
  // aucune requête n'est émise.
  const timeForbidden = params.has("time");

  // `lens=` n'a aucun effet sur cette surface : une URL forcée qui le
  // porte est CANONICALISÉE (doctrine D10 — l'URL canonique fait foi),
  // jamais laissée avec l'apparence d'un effet.
  useEffect(() => {
    if (params.has("lens")) {
      const next = new URLSearchParams(params);
      next.delete("lens");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const rawFy = params.get("fy");
  const fyParam = rawFy ?? (defaultFy != null ? String(defaultFy) : null);
  const byParam = params.get("by") ?? "division";

  const fyMatch = fyParam != null ? FY_PATTERN.exec(fyParam) : null;
  const fromFy = fyMatch ? Number(fyMatch[1]) : null;
  const toFy = fyMatch ? Number(fyMatch[2] ?? fyMatch[1]) : fromFy;
  const periodLabel =
    fromFy != null && toFy != null
      ? fromFy === toFy
        ? fyLabel(fromFy)
        : t("nsfObligations.fyRange", { from: fromFy, to: toFy })
      : (fyParam ?? "—");

  const patch = (next: { fy?: string; by?: string }) => {
    const search = new URLSearchParams(params);
    if (next.fy != null) search.set("fy", next.fy);
    if (next.by != null) search.set("by", next.by);
    setParams(search, { preventScrollReset: true });
  };
  const setRange = (from: number, to: number) => {
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    patch({ fy: lo === hi ? String(lo) : `${lo}..${hi}` });
  };

  const query = new URLSearchParams({ fy: fyParam ?? "", by: byParam, limit: "50" });
  const { data, error, isError, isPending } = useQuery({
    queryKey: ["nsf-obligations", fyParam, byParam],
    queryFn: () => api.nsfObligationsAggregate(query),
    enabled: !timeForbidden && fyParam != null,
    retry: false,
  });

  const bucketLabel = (bucket: { key: string; label: string | null }): string => {
    if (byParam === "country") return countryName(bucket.label ?? bucket.key);
    if (byParam === "organisation") return formatOrgName(bucket.label ?? bucket.key);
    if (byParam === "division") return bucket.key;
    return bucket.label ?? bucket.key;
  };

  const coverageSentence = (view: NsfObligationsAggregate): string =>
    view.unjoinable_usd > 0
      ? t("nsfObligations.coverageLine", {
          coverage: pct(view.coverage * 100),
          amount: money(view.unjoinable_usd),
        })
      : t("nsfObligations.coverageLineFull", {
          coverage: pct(view.coverage * 100),
        });

  /* ————— Corps de la vue, selon l'état ————— */

  let body: ReactNode;
  if (timeForbidden) {
    body = <Refusal messageKey="nsfObligations.errors.timeNotSupported" />;
  } else if (meta && meta.vintage == null) {
    // Aucune vintage chargée : la métrique n'existe pas encore — un
    // refus nommé, pas un écran vide (§ 19.6).
    body = <Refusal messageKey="nsfObligations.errors.noVintage" />;
  } else if (meta && rawFy == null && availableYears.length === 0) {
    // Une vintage existe mais chaque FY est fermé (hors seuil) : sans
    // FY offert, aucun défaut n'est possible — la surface le dit.
    body = <Refusal messageKey="nsfObligations.errors.noAvailableFy" />;
  } else if (isError) {
    body = <Refusal messageKey={refusalKey(error)} fyLabel={periodLabel} />;
  } else if (fyParam == null || isPending || !data) {
    body = (
      <div className="mt-10 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  } else {
    body = (
      <>
        {/* Le dénominateur officiel, la part joignable, la couverture —
            les trois chiffres d'honnêteté, toujours ensemble. */}
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3">
          <KpiStatic
            value={money(data.denominator_usd)}
            label={t("nsfObligations.kpiDenominator")}
            note={periodLabel}
          />
          <KpiStatic
            value={money(data.joinable_usd)}
            label={t("nsfObligations.kpiJoinable")}
          />
          <KpiStatic
            value={pct(data.coverage * 100)}
            label={t("nsfObligations.kpiCoverage")}
          />
        </div>

        {/* La couverture en une phrase : le non joignable reste au
            dénominateur, jamais masqué, jamais renormalisé (C3). */}
        <p className="mt-5 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
          <b className="font-semibold text-foreground/80">
            {t("nsfObligations.coverageTitle")}
          </b>{" "}
          {coverageSentence(data)}
        </p>

        {byParam === "fy" ? (
          /* Vue par exercice : LA SÉRIE — official/joinable/coverage par
             FY, jamais réduite à un ratio unique. */
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
                <th className="py-2 pr-3">{t("nsfObligations.perFyFy")}</th>
                <th className="py-2 pr-3 text-right">{t("nsfObligations.perFyOfficial")}</th>
                <th className="py-2 pr-3 text-right">{t("nsfObligations.perFyJoinable")}</th>
                <th className="py-2 text-right">{t("nsfObligations.perFyCoverage")}</th>
              </tr>
            </thead>
            <tbody>
              {data.per_fy.map((row) => (
                <tr
                  key={row.fy}
                  className="border-b border-border-soft transition-colors hover:bg-surface/60"
                >
                  <td className="tnum py-2 pr-3">{fyLabel(row.fy)}</td>
                  <td className="tnum py-2 pr-3 text-right">{money(row.official_total_usd)}</td>
                  <td className="tnum py-2 pr-3 text-right">{money(row.joinable_usd)}</td>
                  <td className="tnum py-2 text-right">{pct(row.coverage * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Le Top de la surface : classé par les obligations R5
             elles-mêmes (§ 19.5) — l'ordre vient du serveur. Les parts
             ne bouclent pas à 100 % du dénominateur officiel : la
             phrase de couverture au-dessus le dit. */
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
                <th className="py-2 pr-3">{t(`nsfObligations.tableKeys.${byParam}`)}</th>
                <th className="py-2 pr-3 text-right">{t("nsfObligations.tableAmount")}</th>
                <th className="py-2 text-right">{t("nsfObligations.tableShare")}</th>
              </tr>
            </thead>
            <tbody>
              {(data.buckets ?? []).map((bucket) => (
                <tr
                  key={bucket.key}
                  className="border-b border-border-soft transition-colors hover:bg-surface/60"
                >
                  <td className="py-2 pr-3">{bucketLabel(bucket)}</td>
                  <td className="tnum py-2 pr-3 text-right font-medium">
                    {money(bucket.amount_usd)}
                  </td>
                  <td className="tnum py-2 text-right">{pct(bucket.share_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.bucket_count != null && (data.buckets?.length ?? 0) < data.bucket_count ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {t("nsfObligations.moreBuckets", {
              count: data.bucket_count - (data.buckets?.length ?? 0),
            })}
          </p>
        ) : null}

        {/* La provenance — la source officielle et son millésime. */}
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          {t("nsfObligations.provenance", { vintage: data.vintage })}
        </p>

        {/* ⓘ Méthodologie — le contenu gelé du contrat R5B, replié. */}
        <details className="mt-4 max-w-[74ch] rounded-xl border border-border-soft bg-surface/50 px-4 py-3">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            ⓘ {t("nsfObligations.methodologyTitle")}
          </summary>
          <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <p>{t("nsfObligations.methodologyBody")}</p>
            <p>{t("nsfObligations.methodologyFiscalYear")}</p>
            <p>
              {t("nsfObligations.methodologySource", {
                vintage: data.vintage,
                coverage: pct(data.coverage * 100),
              })}
            </p>
          </div>
        </details>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pb-16 pt-12">
      <p className="text-sm font-medium text-accent">{t("nsfObligations.eyebrow")}</p>
      <h1 className="display-tight mt-1 text-[clamp(28px,4vw,40px)] font-semibold">
        {t("nsfObligations.title")}
      </h1>
      <p className="mt-2 max-w-[62ch] text-[13.5px] text-muted-foreground">
        {t("nsfObligations.lead")}
      </p>

      {/* La phrase de cadrage : FY (simple ou plage, uniquement les FY
          available du /meta) et dimension. */}
      <div className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-3 border-y border-border-soft py-3 text-[13.5px] text-muted-foreground">
        <span>{t("nsfObligations.sentenceFrom")}</span>
        <Segment
          display={fromFy != null ? fyLabel(fromFy) : "—"}
          menuLabel={t("nsfObligations.fromLabel")}
        >
          {(close) =>
            availableYears.map((year) => (
              <MenuItem
                key={year}
                selected={year === fromFy}
                onClick={() => {
                  close();
                  setRange(year, toFy ?? year);
                }}
              >
                {fyLabel(year)}
              </MenuItem>
            ))
          }
        </Segment>
        <span>{t("nsfObligations.sentenceTo")}</span>
        <Segment
          display={toFy != null ? fyLabel(toFy) : "—"}
          menuLabel={t("nsfObligations.toLabel")}
        >
          {(close) =>
            availableYears.map((year) => (
              <MenuItem
                key={year}
                selected={year === toFy}
                onClick={() => {
                  close();
                  setRange(fromFy ?? year, year);
                }}
              >
                {fyLabel(year)}
              </MenuItem>
            ))
          }
        </Segment>
        <span>·</span>
        <Segment
          display={t(
            DIMENSIONS.includes(byParam as Dimension)
              ? `nsfObligations.dims.${byParam}`
              : "nsfObligations.dimensionLabel",
          )}
          menuLabel={t("nsfObligations.dimensionLabel")}
        >
          {(close) =>
            DIMENSIONS.map((dimension) => (
              <MenuItem
                key={dimension}
                selected={dimension === byParam}
                onClick={() => {
                  close();
                  patch({ by: dimension });
                }}
              >
                {t(`nsfObligations.dims.${dimension}`)}
              </MenuItem>
            ))
          }
        </Segment>
      </div>

      {body}
    </div>
  );
}
