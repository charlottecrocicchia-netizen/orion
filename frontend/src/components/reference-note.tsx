import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import type { ExploreResponse } from "@/lib/api";
import { REASON_KEYS, formatYears } from "@/lib/excluded";
import { formatCompactEur, moneySymbol } from "@/lib/format";

/** ⓘ Reference — la méthodologie au point d'usage (R0 § D8), en
 *  PROGRESSIVE DISCLOSURE (recette R3, 2026-08-24) :
 *
 *  1. ce que SIGNIFIE le chiffre, en langage humain — la première
 *     chose lue, jamais une formule ;
 *  2. la couverture et les exclusions chiffrées ;
 *  3. le calcul, ses conventions et son avertissement essentiel
 *     (cohortes d'attribution ≠ dépense publique annuelle) ;
 *  4. les sources avec leurs millésimes ;
 *  5. `Methodology →` pour le reste.
 *
 *  Rien n'est retiré : toute la précision méthodologique de R1-R3 est
 *  RÉORGANISÉE derrière la signification. Règle gravée (A1,
 *  généralisée) : la part exclue s'annonce AU POINT D'AFFICHAGE,
 *  chiffrée par l'API depuis le périmètre affiché, toujours en EUR
 *  NOMINAL. Les motifs sont un dictionnaire OUVERT (R0 § D13) rendu
 *  par la carte unique REASON_KEYS. L'API fournit les valeurs ; l'UI
 *  fournit les phrases EN/FR. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
        {title}
      </p>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}

export function ReferenceNote({
  data,
  trend,
  period,
  id,
}: {
  data: ExploreResponse;
  /** Mode TREND actif (R2) : index ou growth, avec son année de base et
   *  les séries non indexables. */
  trend?: {
    mode: "index" | "growth";
    base: number | null;
    nonIndexable: string[];
  };
  /** La fenêtre affichée — les agrégats pluriannuels se disent. */
  period?: { label: string; multiYear: boolean };
  /** Ancre du bouton ⓘ voisin du sélecteur (page board uniquement). */
  id?: string;
}) {
  const { t, i18n } = useTranslation();
  const reference = data.meta.reference;
  const excluded = data.excluded;
  const hasExcluded = excluded != null && excluded.projects > 0;
  const amount = (value: number) => formatCompactEur(value, i18n.language);

  // Le mode courant — le nominal n'a pas de `meta.reference` : sa
  // signification se dit quand même (niveau 1 pour les six modes).
  const mode = trend?.mode ?? reference?.mode ?? "nominal";
  const scale = mode === "gdp" || mode === "capita";
  const cur = reference?.cur ?? "EUR";
  const vintage = [...new Set(Object.values(reference?.vintages ?? {}))].join(
    " · ",
  );
  const multiYear = period?.multiYear ?? false;

  // ————— 1. Ce que signifie le chiffre —————
  const meanings: Record<string, { title: string; lines: string[] }> = {
    nominal: {
      title: t("explorer.reference.meaningNominal"),
      lines: [t("explorer.reference.meaningNominalBody")],
    },
    real: {
      title: t("explorer.reference.meaningReal"),
      lines: [
        t("explorer.reference.meaningRealBody", {
          year: reference?.base ?? "",
        }),
      ],
    },
    gdp: {
      title: t("explorer.reference.meaningGdp"),
      lines: [
        t("explorer.reference.meaningGdpBody"),
        t(
          reference?.perspective === "funder"
            ? "explorer.reference.meaningGdpWhoseFunder"
            : "explorer.reference.meaningGdpWhoseRecipient",
        ),
        ...(multiYear ? [t("explorer.reference.meaningGdpAggregate")] : []),
      ],
    },
    capita: {
      title: t("explorer.reference.meaningCapita"),
      lines: [
        t("explorer.reference.meaningCapitaBody"),
        ...(multiYear
          ? [
              t("explorer.reference.meaningCapitaCumulative"),
              t("explorer.reference.meaningCapitaAggregate"),
            ]
          : []),
      ],
    },
    index: {
      title: t("explorer.reference.meaningIndex"),
      lines: [
        t("explorer.reference.meaningIndexBody", { base: trend?.base ?? "" }),
        t("explorer.reference.meaningIndexWarning"),
      ],
    },
    growth: {
      title: t("explorer.reference.meaningGrowth"),
      lines: [t("explorer.reference.meaningGrowthBody")],
    },
    // PURCHASING POWER : le sens, PUIS immédiatement sa limite, PUIS le
    // caractère spatial. Sans cette entrée, le repli afficherait le
    // texte du NOMINAL sur une vue PPP — muet et faux.
    ppp: {
      title: t("explorer.reference.meaningPpp"),
      lines: [
        t("explorer.reference.meaningPppBody"),
        t("explorer.reference.meaningPppLimit"),
        t("explorer.reference.meaningPppSpatial", {
          year: reference?.year ?? "",
        }),
      ],
    },
  };
  const meaning = meanings[mode] ?? meanings.nominal;

  // Une somme de montants sur plusieurs années : c'est un cumul
  // d'ATTRIBUTIONS, jamais une dépense de la période.
  const cumulativeLine =
    multiYear && (mode === "nominal" || mode === "real") && !data.split
      ? t("explorer.reference.meaningCumulative", {
          period: period?.label ?? "",
        })
      : null;

  // ————— 3. Le calcul, ses conventions, ses limites —————
  const calculation: string[] = [];
  if (mode === "index") {
    calculation.push(
      t("explorer.reference.trendIndexMethod", { base: trend?.base ?? "" }),
    );
  }
  if (mode === "growth") {
    calculation.push(
      t("explorer.reference.trendGrowthMethod"),
      t("explorer.reference.trendCohortWarning"),
    );
  }
  if (scale) {
    calculation.push(
      t(
        reference?.perspective === "funder"
          ? "explorer.reference.perspectiveFunder"
          : "explorer.reference.perspectiveRecipient",
      ),
      t(
        mode === "gdp"
          ? "explorer.reference.gdpMethod"
          : "explorer.reference.capitaMethod",
        {
          year: reference?.base ?? "",
          code: reference?.denominator?.series_code ?? "",
          vintage: reference?.denominator?.vintage ?? "",
        },
      ),
      t("explorer.reference.cohortNote"),
    );
  }
  if (mode === "ppp") {
    calculation.push(
      t("explorer.reference.perspectiveRecipient"),
      t("explorer.reference.pppMethod"),
      t("explorer.reference.pppFlowNote"),
      // La convention de change du dénominateur : le ratio n'est pas un
      // taux de marché, et surtout pas celui qu'un bénéficiaire obtient.
      t("explorer.reference.pppRateNote"),
    );
  }
  // La méthode real sous-jacente : dite dès qu'elle porte le chiffre
  // (real, capita, et les deux modes TREND qui en dérivent).
  if (
    reference?.base != null &&
    (mode === "real" || mode === "capita" || trend != null)
  ) {
    calculation.push(
      t("explorer.reference.method", {
        year: reference.base,
        cur,
        symbol: moneySymbol(cur.toLowerCase()),
        vintage,
      }),
    );
  }
  if (trend?.mode === "index" && trend.nonIndexable.length > 0) {
    calculation.push(
      t("explorer.reference.nonIndexable", {
        count: trend.nonIndexable.length,
        base: trend.base ?? "",
        series: trend.nonIndexable.join(" · "),
      }),
    );
  }

  // ————— 4. Les sources, avec leurs millésimes —————
  const sources: string[] = [];
  // En PPP, `series` est indexée par CONCEPT et non par devise : la
  // boucle générique rendrait « wdi:NY.GDP.MKTP.PP.CD
  // (gdp_ppp_current_intl) ». La phrase dédiée dit la même chose en
  // français et en anglais, et nomme l'instantané pour ce qu'il est —
  // une date d'import Orion, pas la date de publication du WDI.
  const pppSources =
    mode === "ppp" ? t("explorer.reference.pppSources", { vintage }) : null;
  if (mode !== "ppp") {
    for (const [currency, serie] of Object.entries(reference?.series ?? {})) {
      sources.push(`${serie} (${currency}${vintage ? ` · ${vintage}` : ""})`);
    }
  }
  if (reference?.denominator) {
    sources.push(
      `${reference.denominator.source}:${reference.denominator.series_code}` +
        ` (${reference.denominator.vintage})`,
    );
  }
  if (reference?.rates_source)
    sources.push(reference.rates_source.toUpperCase());

  return (
    <details
      id={id}
      className="mt-4 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground"
    >
      <summary className="cursor-pointer list-none text-foreground/75">
        <span aria-hidden="true">ⓘ</span>{" "}
        <b className="font-semibold text-foreground/80">
          {t("explorer.reference.title")}
        </b>
        {" — "}
        {meaning.title}
        {/* La part exclue reste lisible SANS ouvrir (règle A1) : le
            détail par motif vit dans le corps. */}
        {hasExcluded ? (
          <>
            {" · "}
            <span aria-hidden="true">⚠</span>{" "}
            {t("explorer.reference.excludedLine", {
              count: excluded.projects,
              amount: amount(excluded.amount_eur_nominal),
            })}
          </>
        ) : null}{" "}
        <span className="text-accent underline-offset-2 hover:underline">
          {t("explorer.reference.detail")}
        </span>
      </summary>

      {/* 1. La signification, en langage humain — la première chose lue. */}
      <div className="mt-2 space-y-1.5 text-foreground/70">
        {meaning.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {cumulativeLine ? <p>{cumulativeLine}</p> : null}
      </div>

      {/* 2. Ce qui n'entre PAS dans ce chiffre. */}
      {hasExcluded ? (
        <Section title={t("explorer.reference.sectionCoverage")}>
          <ul className="list-disc space-y-0.5 pl-4">
            {Object.entries(excluded.reasons).map(([reason, detail]) => {
              const key = REASON_KEYS[reason];
              if (!key || detail.projects === 0) return null;
              return (
                <li key={reason}>
                  {t(`explorer.reference.${key}`, {
                    count: detail.projects,
                    amount: amount(detail.amount_eur_nominal),
                    years: formatYears(detail.years ?? []),
                  })}
                </li>
              );
            })}
          </ul>
          {/* Le motif `no_reference_year` frappe surtout l'année la plus
              récente : c'est un calendrier de publication, pas une
              lacune. Le dire évite de lire un trou là où il n'y en a
              pas. */}
          {(excluded.reasons.no_reference_year?.projects ?? 0) > 0 ? (
            <p className="mt-1.5">
              {t("explorer.reference.pppTrailingYearNote")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* 3. Le calcul et ses conventions. */}
      {calculation.length > 0 ? (
        <Section title={t("explorer.reference.sectionCalculation")}>
          {calculation.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Section>
      ) : null}

      {/* 4. Les sources. */}
      {pppSources != null || sources.length > 0 ? (
        <Section title={t("explorer.reference.sectionSources")}>
          {pppSources != null ? <p>{pppSources}</p> : null}
          {sources.length > 0 ? <p>{sources.join(" · ")}</p> : null}
        </Section>
      ) : null}

      {/* 5. La méthodologie complète. */}
      <p className="mt-3">
        <Link
          to="/about-data"
          className="text-accent underline-offset-2 hover:underline"
        >
          {t("explorer.reference.methodology")} →
        </Link>
      </p>
    </details>
  );
}
