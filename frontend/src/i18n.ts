import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      badge: "Phase 0 — Foundations",
      tagline: "R&D funding intelligence for Europe",
      subtitle:
        "Deep analytics on 100,000+ funded R&D projects across Europe and France, combined with the calls that matter next — searchable in plain language.",
      status: {
        title: "System status",
        api: "API",
        database: "Database",
        version: "Version",
        ok: "Operational",
        down: "Unreachable",
      },
      data: {
        title: "Data",
        projects: "Funded projects",
        organisations: "Organisations",
        empty: "No data yet — ingestion in progress.",
      },
      theme: { toggle: "Toggle theme" },
      lang: { switch: "Changer de langue" },
      footer: { phase: "Phase 0 · v0.0.1" },
    },
  },
  fr: {
    translation: {
      badge: "Phase 0 — Fondations",
      tagline: "L'intelligence des financements R&D en Europe",
      subtitle:
        "L'analyse fine de plus de 100 000 projets R&D financés en Europe et en France, et les appels à projets qui comptent — le tout interrogeable en langage naturel.",
      status: {
        title: "État du système",
        api: "API",
        database: "Base de données",
        version: "Version",
        ok: "Opérationnel",
        down: "Injoignable",
      },
      data: {
        title: "Données",
        projects: "Projets financés",
        organisations: "Organisations",
        empty: "Pas encore de données — ingestion en cours.",
      },
      theme: { toggle: "Changer de thème" },
      lang: { switch: "Switch to English" },
      footer: { phase: "Phase 0 · v0.0.1" },
    },
  },
} as const;

function storedLanguage(): string | null {
  try {
    return window.localStorage.getItem("orion.lang");
  } catch {
    return null;
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
