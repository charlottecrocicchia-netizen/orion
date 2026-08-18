import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { lensValue, lensWords, parseLens, usePublishedLenses } from "@/lib/lens";
import { cn } from "@/lib/utils";

/** Le chip de périmètre (chantier Space natif, lot 1 — validé
 *  2026-08-17 ; généralisé au lot M1.1). La règle qu'il répare :
 *  `?sector=…` cadrait la vue SANS le dire à l'écran. Désormais toute
 *  vue cadrée porte son périmètre, nommé, cliquable — et le périmètre
 *  vit dans l'URL, jamais dans une session : deux onglets peuvent lire
 *  deux périmètres.
 *
 *  Le composant ne connaît AUCUNE lentille : ses entrées viennent du
 *  registre publié (`stats.lenses`, ordre de rang) et ses mots de
 *  `lens.<slug>.*`. Deux entrées par lentille — le cœur seul, puis le
 *  cœur + habilitant — et « Toute la R&D » pour finir. */
export function SectorChip({
  sector,
  onChange,
}: {
  sector: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const lenses = usePublishedLenses();
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
  const active = parseLens(sector);
  if (!active) return null;

  const activeWords = lensWords(active.slug, t);
  // Le menu suit le registre ; la lentille active y figure toujours,
  // même si le registre n'est pas encore arrivé.
  const slugs = lenses.map((lens) => lens.slug);
  if (!slugs.includes(active.slug)) slugs.unshift(active.slug);
  const entries = slugs.flatMap((slug) => {
    const words = lensWords(slug, t);
    return [
      {
        value: lensValue(slug, true),
        label: words.direct,
        hint: t("explorer.sector.directHint"),
      },
      {
        value: lensValue(slug, false),
        label: words.enabling,
        hint: t("explorer.sector.enablingHint"),
      },
    ];
  });
  entries.push({ value: "", label: t("explorer.sector.all"), hint: "" });

  return (
    <span ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={activeWords.chipLabel}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft/40 px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent"
      >
        <i aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
        {active.coreOnly ? activeWords.direct : activeWords.enabling}
        <span aria-hidden="true" className="text-muted-foreground">
          ▾
        </span>
      </button>
      {open ? (
        <span
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-40 min-w-[220px] rounded-xl border border-border bg-background p-1.5 shadow-key"
        >
          {entries.map((entry) => (
            <button
              key={entry.value || "all"}
              type="button"
              role="menuitemradio"
              aria-checked={sector === entry.value}
              onClick={() => {
                setOpen(false);
                onChange(entry.value);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                sector === entry.value
                  ? "bg-accent-soft/60 font-medium"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {entry.label}
              {entry.hint ? (
                <span className="block text-[11px] text-muted-foreground">{entry.hint}</span>
              ) : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
