import { useTranslation } from "react-i18next";

import type { ExploreSeries } from "@/lib/api";
import { seriesLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** La légende interactive des vues multi-séries (chantier 2026-08-22).
 *
 *  Le clic sur un item masque / réaffiche sa série — c'est LA commande
 *  de visibilité (jamais un clic sur la courbe elle-même : un clic
 *  accidentel ne supprime rien). L'item masqué reste lisible, atténué
 *  et barré ; « Tout afficher » revient dès qu'un masquage a un effet
 *  sur la vue courante. État de présentation pur : l'URL le porte
 *  (`hidden=` sur les clés canoniques), les données ne bougent pas. */
export function SeriesLegend({
  series,
  hidden,
  colorOf,
  onToggle,
  onShowAll,
}: {
  series: ExploreSeries[];
  hidden: string[];
  colorOf: (key: string) => string;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  if (series.length < 2) return null;
  const anyEffective = hidden.some((key) => series.some((s) => String(s.key) === key));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
      {series.map((serie) => {
        const key = String(serie.key);
        const isHidden = hidden.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={!isHidden}
            title={isHidden ? t("explorer.legend.show") : t("explorer.legend.hide")}
            onClick={() => onToggle(key)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors",
              isHidden
                ? "text-muted-foreground/60 hover:text-foreground"
                : "hover:bg-surface",
            )}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: isHidden ? "var(--color-border)" : colorOf(key),
              }}
            />
            <span className={isHidden ? "line-through decoration-[1px]" : undefined}>
              {seriesLabel(serie, t)}
            </span>
          </button>
        );
      })}
      {anyEffective ? (
        <button
          type="button"
          onClick={onShowAll}
          className="ml-1.5 rounded-full border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {t("explorer.legend.showAll")}
        </button>
      ) : null}
    </div>
  );
}
