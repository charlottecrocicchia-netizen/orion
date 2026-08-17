import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/** Le chip de périmètre spatial (chantier Space natif, lot 1 — validé
 *  2026-08-17). La règle qu'il répare : `?sector=space` cadrait la vue
 *  SANS le dire à l'écran. Désormais toute vue cadrée porte son
 *  périmètre, nommé, cliquable — et le périmètre vit dans l'URL, jamais
 *  dans une session : deux onglets peuvent lire deux périmètres.
 *
 *  Trois états : « Spatial direct » (cœur seul, sector=space-direct),
 *  « Spatial + habilitant » (core + enabling, sector=space — son sens
 *  historique, désormais nommé), « Toute la R&D » (pas de paramètre). */
export const SECTOR_VALUES = ["space-direct", "space", ""] as const;

const KEY_OF: Record<string, string> = {
  "space-direct": "direct",
  space: "enabling",
  "": "all",
};

export function sectorLabelKey(sector: string): string {
  return `explorer.sector.${KEY_OF[sector] ?? "all"}`;
}

export function SectorChip({
  sector,
  onChange,
}: {
  sector: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  // Sans cadrage, pas de chip : « Toute la R&D » est l'état silencieux —
  // un chip permanent ne se lirait bientôt plus (la leçon des notes de
  // couverture vaut ici aussi).
  if (!sector) return null;

  return (
    <span ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("explorer.sector.chipLabel")}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft/40 px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent"
      >
        <i aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
        {t(sectorLabelKey(sector))}
        <span aria-hidden="true" className="text-muted-foreground">
          ▾
        </span>
      </button>
      {open ? (
        <span
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[220px] rounded-xl border border-border bg-background p-1.5 shadow-key"
        >
          {SECTOR_VALUES.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="menuitemradio"
              aria-checked={sector === value}
              onClick={() => {
                setOpen(false);
                onChange(value);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                sector === value
                  ? "bg-accent-soft/60 font-medium"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {t(`explorer.sector.${KEY_OF[value]}`)}
              {value === "" ? null : (
                <span className="block text-[11px] text-muted-foreground">
                  {t(`explorer.sector.${KEY_OF[value]}Hint`)}
                </span>
              )}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
