import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { formatCompactEur, moneySymbol } from "@/lib/format";

/** ⓘ Reference — la méthodologie au point d'usage (R0 § D8), pour le
 *  mode `real`. Toujours les mêmes blocs, dans cet ordre : définition ·
 *  sources (avec millésimes) · exclusions · lien méthodologique.
 *
 *  Règle gravée (A1) : les montants exclus du calcul real (indice non
 *  publié pour 2026-2027, date manquante) ne « disparaissent » JAMAIS
 *  en silence — la part exclue s'annonce AU POINT D'AFFICHAGE, chiffrée
 *  par l'API depuis le périmètre affiché (filtres compris), toujours en
 *  EUR NOMINAL (le périmètre exclu n'a pas de valeur réelle). L'API
 *  fournit les valeurs ; l'UI fournit les phrases EN/FR. */
export function ReferenceNote({ data }: { data: ExploreResponse }) {
  const { t, i18n } = useTranslation();
  const reference = data.meta.reference;
  if (!reference) return null;
  const excluded = data.excluded;
  const amount = (value: number) => formatCompactEur(value, i18n.language);
  const vintage = [...new Set(Object.values(reference.vintages))].join(" · ");
  const method = t("explorer.reference.method", {
    year: reference.base,
    cur: reference.cur,
    symbol: moneySymbol(reference.cur.toLowerCase()),
    vintage,
  });
  const hasExcluded = excluded != null && excluded.projects > 0;
  const reasons = excluded?.reasons;

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
      <p className="mt-1.5">{method}</p>
      {hasExcluded && reasons ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {reasons.no_index_year.projects > 0 ? (
            <li>
              {t("explorer.reference.noIndex", {
                count: reasons.no_index_year.projects,
                years: reasons.no_index_year.years.join(", "),
                amount: amount(reasons.no_index_year.amount_eur_nominal),
              })}
            </li>
          ) : null}
          {reasons.no_date.projects > 0 ? (
            <li>
              {t("explorer.reference.noDate", {
                count: reasons.no_date.projects,
                amount: amount(reasons.no_date.amount_eur_nominal),
              })}
            </li>
          ) : null}
          {reasons.no_currency_index.projects > 0 ? (
            <li>
              {t("explorer.reference.noCurrency", {
                count: reasons.no_currency_index.projects,
                amount: amount(reasons.no_currency_index.amount_eur_nominal),
              })}
            </li>
          ) : null}
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
