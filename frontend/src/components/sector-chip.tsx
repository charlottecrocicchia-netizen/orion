import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

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
 *  cœur + habilitant — et « Tout le corpus » pour finir. */
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

  // Sans cadrage, pas de chip : « Tout le corpus » est l'état silencieux —
  // un chip permanent ne se lirait bientôt plus (la leçon des notes de
  // couverture vaut ici aussi).
  const active = parseLens(sector);
  if (!active) return null;

  const activeWords = lensWords(active.slug, t);
  // Une lentille sans AUCUN habilitant n'offre qu'une entrée : son nom
  // nu. On ne montre jamais une capacité vide parce que l'architecture
  // sait la gérer — les deux périmètres réapparaissent d'eux-mêmes au
  // premier projet habilitant, et `sector=<slug>-direct` reste une URL
  // valide dans tous les cas : le contrat ne change pas, seul
  // l'affichage suit le contenu.
  const solo = (slug: string) => {
    const meta = lenses.find((lens) => lens.slug === slug);
    return meta ? meta.enabling === 0 : false;
  };
  // Le menu suit le registre ; la lentille active y figure toujours,
  // même si le registre n'est pas encore arrivé.
  const slugs = lenses.map((lens) => lens.slug);
  if (!slugs.includes(active.slug)) slugs.unshift(active.slug);
  type Entry = { value: string; label: string; hint: string; slug: string | null };
  const entries: Entry[] = slugs.flatMap((slug): Entry[] => {
    const words = lensWords(slug, t);
    if (solo(slug)) {
      // ④ (validé 2026-08-20) : la ligne d'aide dit les trois choses —
      // un seul périmètre qualifié, ce que « + habilitant » signifie
      // (par symétrie avec l'entrée voisine), et que la seconde entrée
      // viendra d'elle-même. JAMAIS d'entrée fantôme sans effet.
      return [
        { value: lensValue(slug, false), label: words.name, hint: t("explorer.sector.soloHint"), slug },
      ];
    }
    return [
      {
        value: lensValue(slug, true),
        label: words.direct,
        hint: t("explorer.sector.directHint"),
        slug: null,
      },
      {
        value: lensValue(slug, false),
        label: words.enabling,
        hint: t("explorer.sector.enablingHint"),
        slug: null,
      },
    ];
  });
  entries.push({ value: "", label: t("explorer.sector.all"), hint: "", slug: null });

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
        {solo(active.slug)
          ? activeWords.name
          : active.coreOnly
            ? activeWords.direct
            : activeWords.enabling}
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
              aria-checked={entry.slug ? entry.slug === active.slug : sector === entry.value}
              onClick={() => {
                setOpen(false);
                onChange(entry.value);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                (entry.slug ? entry.slug === active.slug : sector === entry.value)
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
          {/* La sortie vers la Lens Room : un LIEN, pas une entrée
              radio — il quitte la vue au lieu de la recadrer. */}
          <Link
            to="/lenses"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 block w-full rounded-lg border-t border-border-soft px-3 pb-1.5 pt-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            {t("lensRoom.open")} →
          </Link>
        </span>
      ) : null}
    </span>
  );
}
