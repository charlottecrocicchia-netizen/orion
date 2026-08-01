import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { CommandK } from "@/components/command-k";
import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

function ScopeBadge() {
  const { t } = useTranslation();
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-muted-foreground lg:inline-flex"
      title={t("scope.label")}
    >
      <span aria-hidden="true">🌍</span>
      {t("scope.europeFr")}
    </span>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-foreground"
    : "text-muted-foreground transition-colors hover:text-foreground";

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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
          <Link to="/" aria-label="Orion — home">
            <Logo />
          </Link>
          <div className="ml-2 flex items-center gap-5 text-sm">
            <NavLink to="/projects" className={navLinkClass}>
              {t("nav.projects")}
            </NavLink>
            <NavLink to="/organisations" className={navLinkClass}>
              {t("nav.organisations")}
            </NavLink>
            <NavLink to="/explore/countries" className={navLinkClass}>
              {t("nav.explore")}
            </NavLink>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-6 rounded-full bg-surface py-1.5 pl-4 pr-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <span>⌕ {t("searchShort")}</span>
              <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-sans text-[10px]">
                ⌘K
              </kbd>
            </button>
            <ScopeBadge />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main id="main" key={pathname} className="page-enter flex-1">
        <Outlet />
      </main>
      <footer className="mt-24 border-t">
        <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© 2026 Orion</span>
          <div className="flex gap-5">
            <Link to="/about-data" className="transition-colors hover:text-foreground">
              {t("footer.data")}
            </Link>
            <span>{t("footer.phase")}</span>
          </div>
        </div>
      </footer>
      <CommandK open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
