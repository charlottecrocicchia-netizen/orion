import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { CommandK } from "@/components/command-k";
import { IntentNav } from "@/components/intent-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { useDossier } from "@/lib/dossier";
import { lensWords, useActiveLensState, useCarriedLens, withLens } from "@/lib/lens";
import { formatCompactEur } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/use-document-title";

/** The geographic-scope selector. HIDDEN while a single zone exists
 *  (fondatrice, 2026-08-02): a selector with one option says nothing.
 *  The URL mechanics stay underneath — wave 1 brings the zones back and
 *  P6 maps subscriptions onto them; the honest coverage note lives on
 *  the countries page meanwhile. */
function ScopeBadge() {
  const { t } = useTranslation();
  const zones = 1;
  if (zones <= 1) return null;
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-muted-foreground lg:inline-flex"
      title={t("scope.label")}
    >
      <span aria-hidden="true">🌍</span>
      {t("scope.coverage")}
    </span>
  );
}

/** Le second terme de la marque : la lentille qui cadre la vue. Un
 *  lien vers la Lens Room — l'identité EST la porte de la salle. */
function ComposedIdentity() {
  const { t } = useTranslation();
  const lensState = useActiveLensState();
  if (lensState.kind !== "valid") return null;
  const name = lensWords(lensState.lens.slug, t).name.toUpperCase();
  return (
    <Link
      to="/lenses"
      className="display-tight -ml-3 hidden text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
      aria-label={t("lensRoom.open")}
    >
      <span aria-hidden="true" className="mx-1 text-muted-foreground/50">/</span>
      <span className="text-accent">{name}</span>
    </Link>
  );
}

/** The discreet session-dossier counter (lot 4): appears once something
 *  is collected, one click opens the assembly. */
function DossierBadge() {
  const { t } = useTranslation();
  const dossier = useDossier();
  const carried = useCarriedLens();
  if (dossier.items.length === 0) return null;
  return (
    <Link
      to={withLens("/dossier", carried)}
      className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-foreground transition-colors hover:border-accent hover:text-accent sm:inline-flex"
    >
      <span aria-hidden="true">▤</span>
      {t("dossier.counter", { count: dossier.items.length })}
    </Link>
  );
}

/** The dense parchment footer (doctrine: "dense et assumé", Apple's) — the
 *  whole information architecture exposed, corpus figures in tabular nums. */
function Footer() {
  const carried = useCarriedLens();
  const { t, i18n } = useTranslation();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const columnTitle = "text-label uppercase text-muted-foreground";
  const link = "block py-1 text-[13px] transition-colors hover:text-accent";

  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-[13px] text-muted-foreground">{t("footer.tagline")}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{t("footer.scope")}</p>
        </div>
        <nav aria-label={t("footer.product")}>
          <h2 className={columnTitle}>{t("footer.product")}</h2>
          <ul className="mt-3">
            <li><Link to={withLens("/projects", carried)} className={link}>{t("footer.projects")}</Link></li>
            <li><Link to={withLens("/organisations", carried)} className={link}>{t("footer.organisations")}</Link></li>
            <li><Link to={withLens("/explore", carried)} className={link}>{t("footer.explorer")}</Link></li>
            <li><Link to={withLens("/compare", carried)} className={link}>{t("footer.compareOrgs")}</Link></li>
            <li><Link to={withLens("/dossier", carried)} className={link}>{t("footer.dossierLink")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("footer.exploreCol")}>
          <h2 className={columnTitle}>{t("footer.exploreCol")}</h2>
          <ul className="mt-3">
            <li><Link to={withLens("/explore/countries", carried)} className={link}>{t("footer.countries")}</Link></li>
            <li><Link to={withLens("/explore/programmes", carried)} className={link}>{t("footer.programmes")}</Link></li>
            <li><Link to={withLens("/explore/themes", carried)} className={link}>{t("footer.themesLink")}</Link></li>
            <li><Link to={withLens("/analyses", carried)} className={link}>{t("footer.analysesLink")}</Link></li>
            <li><Link to={withLens("/calls", carried)} className={link}>{t("footer.callsLink")}</Link></li>
            <li><Link to={withLens("/workspace", carried)} className={link}>{t("footer.workspaceLink")}</Link></li>
            <li><Link to={withLens("/about-data", carried)} className={link}>{t("footer.data")}</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className={columnTitle}>{t("footer.corpus")}</h2>
          <ul className="tnum mt-3 text-[13px] leading-7 text-muted-foreground">
            <li>{t("footer.figProjects", { count: stats?.totals.projects ?? 0 })}</li>
            <li>{t("footer.figOrgs", { count: stats?.totals.organisations ?? 0 })}</li>
            <li>
              {t("footer.figFunding", {
                amount: formatCompactEur(stats?.totals.funding_eur ?? null, i18n.language),
              })}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex h-12 w-full max-w-[1240px] items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© 2026 {BRAND}</span>
          <span className="font-mono text-[11px]">{t("footer.phase")}</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  // Le titre du document et la langue du document suivent la navigation,
  // la langue active et la lentille de la vue (M1.3) — sans rechargement.
  useDocumentTitle();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // La lentille TRANSPORTÉE (lot navigation) : celle d'une vue
  // validement cadrée — jamais un paramètre invalide.
  const carried = useCarriedLens();
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header>
        <nav className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-6 px-6">
          {/* Le logo TRANSPORTE la lentille (lot navigation) : depuis
              une vue cadrée il ramène à la home cadrée — les sorties du
              monde sont ailleurs, explicites. */}
          <Link to={withLens("/", carried)} aria-label={`${BRAND} — home`}>
            <Logo />
          </Link>
          {/* L'identité composée (D5, exécutée à la publication
              d'Aviation) : sur une vue cadrée, la marque dit la
              lentille — ORION / ESPACE — cohérente avec la Lens Room.
              Le chip, lui, continue de dire le périmètre précis. */}
          <ComposedIdentity />
          <div className="ml-2">
            <IntentNav />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-6 rounded-full bg-surface py-1.5 pl-4 pr-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <span>⌕ {t("searchShort")}</span>
              <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>
            <DossierBadge />
            <ScopeBadge />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main id="main" key={pathname} className="page-enter flex-1">
        <Outlet />
      </main>
      <Footer />
      <CommandK open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
