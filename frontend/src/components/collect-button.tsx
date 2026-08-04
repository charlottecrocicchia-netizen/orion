import { useTranslation } from "react-i18next";

import { addToDossier, removeByParams, useIsCollected } from "@/lib/dossier";

/** "+ Add to dossier" wherever a rich view lives (recette 2026-08-03:
 *  "the dossier is only worth it if you can fill it from everywhere").
 *  A collected view IS an Explorer URL — each rich page hands over its
 *  signature view with an honest default title.
 *
 *  A TOGGLE since the 2026-08-04 recette: once added, the same button
 *  says so and removes on the spot — « je ne peux plus retirer un bloc
 *  une fois ajouté » must never be true again. */

export function CollectButton({ view, title }: { view: string; title: string }) {
  const { t } = useTranslation();
  const collected = useIsCollected(view);
  return (
    <button
      type="button"
      aria-pressed={collected}
      onClick={() => {
        if (collected) removeByParams(view);
        else addToDossier(view, title);
      }}
      className={
        collected
          ? "rounded-full border border-accent bg-accent-soft px-4 py-2 text-[13px] text-accent transition-colors hover:border-destructive hover:bg-transparent hover:text-destructive"
          : "rounded-full border px-4 py-2 text-[13px] transition-colors hover:border-accent hover:text-accent"
      }
      title={collected ? t("dossier.removeHint") : undefined}
    >
      {collected ? `✓ ${t("dossier.inDossier")}` : `+ ${t("dossier.add")}`}
    </button>
  );
}
