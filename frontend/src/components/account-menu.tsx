import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { auth, useClearMe, useMe } from "@/lib/auth";

/** L'entrée compte du header (D4) : UNE entrée sobre à droite — jamais
 *  de bannière, jamais de modal. Anonyme : « Se connecter ». Connecté :
 *  l'initiale + un menu de deux lignes (mon espace, se déconnecter). */
export function AccountMenu() {
  const { t } = useTranslation();
  const { me, loading } = useMe();
  const clearMe = useClearMe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (loading) return null;

  if (!me) {
    return (
      <Link
        to="/login"
        className="hidden rounded-full border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-accent hover:text-accent sm:inline-flex"
      >
        {t("auth.signIn")}
      </Link>
    );
  }

  const initial = (me.display_name || me.email)[0]?.toUpperCase() ?? "?";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("auth.accountMenu")}
        title={me.email}
        className="flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-medium transition-colors hover:border-accent hover:text-accent"
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 min-w-[190px] rounded-lg border bg-background py-1.5 shadow-lg"
        >
          <p className="truncate px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
            {me.email}
          </p>
          <Link
            role="menuitem"
            to="/workspace"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-1.5 text-[13.5px] hover:bg-surface"
          >
            {t("auth.mySpace")}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await auth.logout();
              clearMe();
              navigate("/");
            }}
            className="block w-full px-3.5 py-1.5 text-left text-[13.5px] hover:bg-surface"
          >
            {t("auth.signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
