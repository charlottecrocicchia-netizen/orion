import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const next = i18n.language.startsWith("fr") ? "en" : "fr";

  const switchLanguage = () => {
    void i18n.changeLanguage(next);
    window.localStorage.setItem("orion.lang", next);
  };

  return (
    <Button variant="ghost" size="sm" onClick={switchLanguage} aria-label={t("lang.switch")}>
      {next.toUpperCase()}
    </Button>
  );
}
