import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { REASON_KEYS } from "@/lib/excluded";
import { formatCompactEur, moneySymbol } from "@/lib/format";

/** ⓘ Reference — la méthodologie au point d'usage (R0 § D8), pour tous
 *  les modes du Reference Engine. Toujours les mêmes blocs, dans cet
 *  ordre : définition (et perspective en ECONOMIC SCALE) · sources avec
 *  millésimes · exclusions ventilées · lien méthodologique.
 *
 *  Règle gravée (A1, généralisée) : les montants exclus du calcul ne
 *  « disparaissent » JAMAIS en silence — la part exclue s'annonce AU
 *  POINT D'AFFICHAGE, chiffrée par l'API depuis le périmètre affiché
 *  (filtres compris), toujours en EUR NOMINAL. Les motifs sont un
 *  dictionnaire OUVERT (R0 § D13) rendu par la carte unique
 *  REASON_KEYS. L'API fournit les valeurs ; l'UI fournit les phrases
 *  EN/FR. */
export function ReferenceNote({
  data,
  trend,
}: {
  data: ExploreResponse;
  /** Mode TREND actif (R2) : la note dit d'abord la transformation
   *  (définition, base, séries non indexables, avertissement cohorte),
   *  puis la méthode Real sous-jacente dont elle hérite sources,
   *  millésimes et exclusions. */
  trend?: { mode: "index" | "growth"; base: number | null; nonIndexable: string[] };
}) {
  const { t, i18n } = useTranslation();
  const reference = data.meta.reference;
  if (!reference) return null;
  const excluded = data.excluded;
  const amount = (value: number) => formatCompactEur(value, i18n.language);
  const scale = reference.mode === "gdp" || reference.mode === "capita";
  const vintage = [...new Set(Object.values(reference.vintages ?? {}))].join(" · ");
  const realMethod =
    reference.base != null
      ? t("explorer.reference.method", {
          year: reference.base,
          cur: reference.cur,
          symbol: moneySymbol((reference.cur ?? "EUR").toLowerCase()),
          vintage,
        })
      : null;
  const hasExcluded = excluded != null && excluded.projects > 0;

  return (
    <details className="mt-4 max-w-[74ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer list-none text-foreground/75">
        <span aria-hidden="true">ⓘ</span>{" "}
        <b className="font-semibold text-foreground/80">{t("explorer.reference.title")}</b>
        {hasExcluded ? (
          <>
            {" — "}
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
      {trend?.mode === "index" ? (
        <>
          <p className="mt-1.5">
            {t("explorer.reference.trendIndexMethod", { base: trend.base ?? "" })}
          </p>
          {trend.nonIndexable.length > 0 ? (
            <p className="mt-1.5">
              {t("explorer.reference.nonIndexable", {
                count: trend.nonIndexable.length,
                base: trend.base ?? "",
                series: trend.nonIndexable.join(" · "),
              })}
            </p>
          ) : null}
        </>
      ) : null}
      {trend?.mode === "growth" ? (
        <>
          <p className="mt-1.5">{t("explorer.reference.trendGrowthMethod")}</p>
          <p className="mt-1.5">{t("explorer.reference.trendCohortWarning")}</p>
        </>
      ) : null}
      {scale ? (
        <>
          {/* La perspective, en toutes lettres : l'utilisateur ne se
              demande JAMAIS « le PIB de qui ? » (R0 § D3). */}
          <p className="mt-1.5">
            {t(
              reference.perspective === "funder"
                ? "explorer.reference.perspectiveFunder"
                : "explorer.reference.perspectiveRecipient",
            )}
          </p>
          <p className="mt-1.5">
            {t(
              reference.mode === "gdp"
                ? "explorer.reference.gdpMethod"
                : "explorer.reference.capitaMethod",
              {
                year: reference.base ?? "",
                code: reference.denominator?.series_code ?? "",
                vintage: reference.denominator?.vintage ?? "",
              },
            )}
          </p>
        </>
      ) : null}
      {realMethod && (!scale || reference.mode === "capita") ? (
        <p className="mt-1.5">{realMethod}</p>
      ) : null}
      {hasExcluded ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {Object.entries(excluded.reasons).map(([reason, detail]) => {
            const key = REASON_KEYS[reason];
            if (!key || detail.projects === 0) return null;
            return (
              <li key={reason}>
                {t(`explorer.reference.${key}`, {
                  count: detail.projects,
                  amount: amount(detail.amount_eur_nominal),
                  years: (detail.years ?? []).join(", "),
                })}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-1.5">
        <Link to="/about-data" className="text-accent underline-offset-2 hover:underline">
          {t("explorer.reference.methodology")} →
        </Link>
      </p>
    </details>
  );
}
