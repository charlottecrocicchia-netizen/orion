import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { useCountryName } from "@/lib/format";

/** La phrase d'honnêteté des vues comparatives (lot E, 2026-08-17).
 *
 *  Règle fondatrice : **plus jamais un écran où l'absence de données se
 *  fait passer pour un zéro.** Elle apparaît UNIQUEMENT quand la vue
 *  mélange des couvertures (le serveur en décide, `meta.coverage`), se
 *  compose depuis les bailleurs réellement chargés, et disparaît d'une
 *  vue homogène — une comparaison intra-européenne n'a rien à confesser.
 *
 *  Elle nomme les pays qui ne sont vus QUE par leurs consortiums : c'est
 *  la différence entre « le Japon finance peu » et « nous ne voyons du
 *  Japon que ce qu'il fait avec l'Europe ». */
export function CoverageNote({ meta }: { meta: ExploreResponse["meta"] }) {
  const { t } = useTranslation();
  const countryName = useCountryName();
  const coverage = meta.coverage;
  if (!coverage) return null;

  const named = coverage.uncovered.slice(0, 6).map(countryName).join(", ");
  return (
    <p className="mt-4 max-w-[74ch] border-l-2 border-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
      <b className="font-semibold text-foreground/80">{t("coverage.mixedTitle")}</b>{" "}
      {t("coverage.mixedPhrase", {
        funders: coverage.funders.join(" · ") || "—",
      })}
      {named ? <span className="text-foreground/70"> {named}.</span> : null}
    </p>
  );
}
