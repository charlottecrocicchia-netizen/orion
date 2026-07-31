import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("orion.theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("theme.toggle")}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
