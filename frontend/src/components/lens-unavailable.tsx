import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { withoutLens } from "@/lib/lens";

/** Le refus de lentille (M1.2) — la page douce d'Orion.
 *
 *  Elle ne dit JAMAIS pourquoi : une lentille en préparation est
 *  « indisponible », comme une lentille qui n'existe pas. Et elle ne
 *  replie jamais la vue en silence sur le corpus entier — un lien qui
 *  montrerait 700 000 projets en prétendant montrer une lentille
 *  mentirait sur ce qu'il montre.
 *
 *  Sa seule action retire le paramètre de lentille et PRÉSERVE tout le
 *  reste de l'URL : requête, filtres, années, comparaisons. */
export function LensUnavailable() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-6 py-24 text-center">
      <h1 className="text-xl font-medium">{t("explorer.lensUnavailable.title")}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {t("explorer.lensUnavailable.body")}
      </p>
      <Link
        to={withoutLens(location.pathname, location.search)}
        className="mt-6 text-accent underline-offset-2 hover:underline"
      >
        {t("explorer.lensUnavailable.action")} →
      </Link>
    </div>
  );
}
