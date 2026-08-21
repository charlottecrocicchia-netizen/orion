import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { auth, useMe } from "@/lib/auth";

/** /login (lot 1) : un champ email, une confirmation sobre. La réponse
 *  du serveur est identique quoi qu'il arrive (anti-énumération) — la
 *  page ne peut donc jamais dire « compte inconnu », et c'est voulu. */
export function LoginPage() {
  const { t } = useTranslation();
  const { me, loading } = useMe();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && me) return <Navigate to="/workspace" replace />;

  const from = params.get("from") ?? "/";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      window.sessionStorage.setItem("orion.login.from", from);
      const res = await auth.requestLink(email.trim());
      setDevLink(res.dev_link ?? null);
      setSent(true);
    } catch {
      // Même un échec réseau reste sobre : la page ne spécule pas.
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 pt-24 pb-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("auth.eyebrow")}
      </p>
      <h1 className="mt-3 text-[clamp(26px,3.4vw,34px)] font-semibold leading-tight">
        {t("auth.title")}
      </h1>
      {sent ? (
        <div className="mt-6">
          <p className="text-[15px] leading-relaxed text-foreground/90">{t("auth.sent")}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t("auth.sentHint")}</p>
          {devLink ? (
            <a
              href={devLink}
              className="mt-4 inline-block rounded-full border border-border px-4 py-2 font-mono text-[12px] text-accent hover:border-accent"
            >
              {t("auth.devLink")} →
            </a>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <p className="text-[14px] leading-relaxed text-muted-foreground">{t("auth.how")}</p>
          <label className="mt-5 block text-[13px] text-muted-foreground" htmlFor="login-email">
            {t("auth.emailLabel")}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-[14px] text-background hover:opacity-90 disabled:opacity-50"
          >
            {t("auth.submit")} →
          </button>
          <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
            {t("auth.identityNote")}
          </p>
        </form>
      )}
    </div>
  );
}
