import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

function HeaderSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    navigate(`/projects?q=${encodeURIComponent(String(q ?? "")).trim()}`);
  };

  return (
    <form onSubmit={submit} role="search" className="hidden md:block">
      <input
        name="q"
        type="search"
        placeholder={`⌕  ${t("searchPlaceholder")}`}
        className="w-[230px] rounded-full bg-surface px-4 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
      />
    </form>
  );
}

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
  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground";

export function Layout() {
  const { t } = useTranslation();
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
            <HeaderSearch />
            <ScopeBadge />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-16 border-t">
        <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© 2026 Orion</span>
          <div className="flex gap-5">
            <Link to="/about-data" className="hover:text-foreground">
              {t("footer.data")}
            </Link>
            <span>{t("footer.phase")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
