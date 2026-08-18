import { useEffect } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { lensWords, useActiveLensState } from "@/lib/lens";

/** Le titre du document et la langue du document (M1.3).
 *
 *  Règle : `[Lentille] · [Vue] — Orion` sur une vue cadrée,
 *  `[Vue] — Orion` sinon. Le titre se met à jour SANS rechargement — il
 *  suit la navigation, la langue et la lentille active. L'accueil garde
 *  le jeton de marque : c'est déjà son titre, et D5 ne bouge pas.
 *
 *  Aucune image OG dynamique dans ce chantier (arbitrage 1). */

const BRAND = import.meta.env.VITE_APP_BRAND ?? "Orion";

/** Le nom d'une vue, par sa route — UN seul endroit, jamais dispersé. */
const VIEW_KEYS: [RegExp, string][] = [
  [/^\/explore\/countries/, "nav.menu.countries"],
  [/^\/explore\/regions/, "nav.menu.countries"],
  [/^\/explore\/programmes/, "nav.menu.programmes"],
  [/^\/explore\/themes/, "nav.menu.themes"],
  [/^\/explore/, "nav.explore"],
  [/^\/projects/, "nav.projects"],
  [/^\/organisations/, "nav.organisations"],
  [/^\/groups/, "nav.organisations"],
  [/^\/compare/, "nav.menu.compare"],
  [/^\/analyses/, "nav.menu.analyses"],
  [/^\/dossier/, "nav.menu.dossier"],
  [/^\/calls/, "nav.menu.calls"],
  [/^\/workspace/, "nav.menu.workspaceHome"],
  [/^\/about-data/, "nav.menu.aboutData"],
];

export function useDocumentTitle(): void {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const lensState = useActiveLensState();

  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith("fr") ? "fr" : "en";
  }, [i18n.language]);

  useEffect(() => {
    const entry = VIEW_KEYS.find(([pattern]) => pattern.test(location.pathname));
    if (!entry) {
      document.title = BRAND;
      return;
    }
    const view = t(entry[1]);
    const lens =
      lensState.kind === "valid" ? lensWords(lensState.lens.slug, t).name : null;
    document.title = lens ? `${lens} · ${view} — Orion` : `${view} — Orion`;
  }, [location.pathname, location.search, lensState, t, i18n.language]);
}
