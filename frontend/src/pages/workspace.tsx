import { useTranslation } from "react-i18next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

/** /workspace — the dated P6 door (personas: the watcher first). Where
 *  the veille will live, and what already works today. */
export function WorkspacePage() {
  const { t } = useTranslation();
  return (
    <PhasePlaceholder
      eyebrow={t("workspace.eyebrow")}
      title={t("workspace.title")}
      titleAccent={t("workspace.titleAccent")}
      when={t("workspace.when")}
      features={[
        { name: t("workspace.f1"), desc: t("workspace.f1Desc") },
        { name: t("workspace.f2"), desc: t("workspace.f2Desc") },
        { name: t("workspace.f3"), desc: t("workspace.f3Desc") },
        { name: t("workspace.f4"), desc: t("workspace.f4Desc") },
      ]}
      bridgeTitle={t("workspace.bridgeTitle")}
      bridge={[
        { to: "/explore", label: t("workspace.bridgeUrl") },
        { to: "/dossier", label: t("workspace.bridgeDossier") },
      ]}
      honest={t("workspace.honest")}
    />
  );
}
