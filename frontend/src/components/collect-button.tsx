import { useState } from "react";
import { useTranslation } from "react-i18next";

import { addToDossier } from "@/lib/dossier";

/** "+ Add to dossier" wherever a rich view lives (recette 2026-08-03:
 *  "the dossier is only worth it if you can fill it from everywhere").
 *  A collected view IS an Explorer URL — each rich page hands over its
 *  signature view (the organisation's trajectory, the country's years,
 *  the benchmark) with an honest default title. Same pill, same
 *  two-second acknowledgement as the Explorer's own button. */

export function CollectButton({ view, title }: { view: string; title: string }) {
  const { t } = useTranslation();
  const [collected, setCollected] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        addToDossier(view, title);
        setCollected(true);
        window.setTimeout(() => setCollected(false), 2000);
      }}
      className="rounded-full border px-4 py-2 text-[13px] transition-colors hover:border-accent hover:text-accent"
    >
      {collected ? t("dossier.added") : `+ ${t("dossier.add")}`}
    </button>
  );
}
