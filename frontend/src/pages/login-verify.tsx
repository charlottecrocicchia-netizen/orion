import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { auth, useInvalidateMe } from "@/lib/auth";

/** /login/verify (verrous 1 & 2) : le token voyage en FRAGMENT — lu au
 *  montage, retiré de la barre d'adresse, jamais envoyé en query. La
 *  consommation n'est JAMAIS invisible : une confirmation portant
 *  l'adresse masquée précède le POST, quel que soit le navigateur. */
export function LoginVerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidateMe = useInvalidateMe();
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ email_masked: string; same_browser: boolean } | null>(
    null,
  );
  const [state, setState] = useState<"loading" | "confirm" | "dead" | "busy">("loading");

  useEffect(() => {
    const match = window.location.hash.match(/#token=([A-Za-z0-9_-]+)/);
    // Verrou 1 : l'adresse est nettoyée aussitôt le fragment lu.
    window.history.replaceState(null, "", window.location.pathname);
    if (!match) {
      setState("dead");
      return;
    }
    setToken(match[1]);
    auth
      .preview(match[1])
      .then((res) => {
        setPreview(res);
        setState("confirm");
      })
      .catch(() => setState("dead"));
  }, []);

  async function confirm() {
    if (!token || state === "busy") return;
    setState("busy");
    try {
      await auth.verify(token);
      invalidateMe();
      const from = window.localStorage.getItem("orion.login.from") ?? "/";
      window.localStorage.removeItem("orion.login.from");
      navigate(from, { replace: true });
    } catch {
      setState("dead");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 pt-24 pb-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("auth.eyebrow")}
      </p>
      {state === "loading" ? (
        <p className="mt-6 text-[15px] text-muted-foreground">{t("auth.checking")}</p>
      ) : null}
      {state === "dead" ? (
        <div className="mt-4">
          <h1 className="text-[clamp(24px,3vw,30px)] font-semibold leading-tight">
            {t("auth.deadTitle")}
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            {t("auth.deadBody")}
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-full bg-foreground px-5 py-2.5 text-[14px] text-background hover:opacity-90"
          >
            {t("auth.deadCta")} →
          </Link>
        </div>
      ) : null}
      {(state === "confirm" || state === "busy") && preview ? (
        <div className="mt-4">
          <h1 className="text-[clamp(24px,3vw,30px)] font-semibold leading-tight">
            {t("auth.confirmTitle")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed">
            {t("auth.confirmAs")}{" "}
            <span className="font-mono text-[14px]">{preview.email_masked}</span>
          </p>
          {!preview.same_browser ? (
            <p className="mt-3 max-w-[46ch] border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-muted-foreground">
              {t("auth.otherBrowser")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={confirm}
            disabled={state === "busy"}
            className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-[14px] text-background hover:opacity-90 disabled:opacity-50"
          >
            {t("auth.confirmCta")} →
          </button>
        </div>
      ) : null}
    </div>
  );
}
