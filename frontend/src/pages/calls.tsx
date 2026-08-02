import { useTranslation } from "react-i18next";

import { PhasePlaceholder } from "@/components/phase-placeholder";

/** /calls — the dated P5 door (personas: the business developer first).
 *  What arrives in autumn 2026, and the past/future bridge meanwhile. */
export function CallsPage() {
  const { t } = useTranslation();
  return (
    <PhasePlaceholder
      eyebrow={t("calls.eyebrow")}
      title={t("calls.title")}
      titleAccent={t("calls.titleAccent")}
      when={t("calls.when")}
      features={[
        { name: t("calls.f1"), desc: t("calls.f1Desc") },
        { name: t("calls.f2"), desc: t("calls.f2Desc") },
        { name: t("calls.f3"), desc: t("calls.f3Desc") },
        { name: t("calls.f4"), desc: t("calls.f4Desc") },
      ]}
      bridgeTitle={t("calls.bridgeTitle")}
      bridge={[
        { to: "/explore?by=theme&split=1", label: t("calls.bridgeThemes") },
        { to: "/organisations", label: t("calls.bridgeOrgs") },
        {
          to: "/explore?by=country&split=1&limit=6&view=bump",
          label: t("calls.bridgeCountries"),
        },
      ]}
      honest={t("calls.honest")}
    />
  );
}
