import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { PhasePlaceholder } from "@/components/phase-placeholder";
import { auth, personalWorkspace, useClearMe, useMe } from "@/lib/auth";

/** /workspace — connecté : l'espace minimal du lot 1 (nom, dossiers
 *  gardés, suppression de compte). Anonyme : la porte P6 datée reste,
 *  augmentée d'une ligne sobre vers /login — jamais un mur. */
export function WorkspacePage() {
  const { t } = useTranslation();
  const { me, loading } = useMe();

  if (loading) return null;
  if (me) return <ConnectedSpace />;
  return (
    <div>
      <PhasePlaceholder
        eyebrow={t("workspace.eyebrow")}
        title={t("workspace.title")}
        titleAccent={t("workspace.titleAccent")}
        when={t("workspace.when")}
        features={[
          { name: t("workspace.f1"), desc: t("workspace.f1Desc") },
          { name: t("workspace.f2"), desc: t("workspace.f2Desc") },
          { name: t("workspace.f3"), desc: t("workspace.f3Desc") },
          { name: t("workspace.f4"), desc: t("workspace.f4Desc") },
        ]}
        bridgeTitle={t("workspace.bridgeTitle")}
        bridge={[
          { to: "/explore", label: t("workspace.bridgeUrl") },
          { to: "/dossier", label: t("workspace.bridgeDossier") },
        ]}
        honest={t("workspace.honest")}
      />
      <p className="mx-auto w-full max-w-[880px] px-6 pb-16 text-[14px] text-muted-foreground">
        {t("workspace.signInLead")}{" "}
        <Link to="/login?from=/workspace" className="text-accent underline-offset-2 hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}

function ConnectedSpace() {
  const { t, i18n } = useTranslation();
  const { me } = useMe();
  const clearMe = useClearMe();
  const navigate = useNavigate();
  const workspace = personalWorkspace(me);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["dossiers", workspace?.id],
    queryFn: () => auth.listDossiers(workspace!.id),
    enabled: workspace != null,
  });
  const dossiers = data?.dossiers ?? [];

  if (!me || !workspace) return null;

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-14 pb-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("workspace.spaceEyebrow")}
      </p>
      <h1 className="display-tight mt-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.05]">
        {workspace.name}
      </h1>
      <p className="mt-2 text-[13.5px] text-muted-foreground">{t("workspace.spaceLead")}</p>

      <section className="mt-12">
        <h2 className="text-label uppercase text-muted-foreground">
          {t("workspace.savedDossiers")}
        </h2>
        {dossiers.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted-foreground">
            {t("workspace.noDossiers")}{" "}
            <Link to="/dossier" className="text-accent underline-offset-2 hover:underline">
              {t("workspace.noDossiersCta")}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border-soft border-y border-border-soft">
            {dossiers.map((dossier) => (
              <li key={dossier.id} className="flex items-baseline gap-4 py-3">
                <Link
                  to={`/workspace/dossiers/${dossier.id}`}
                  className="min-w-0 flex-1 truncate text-[15.5px] font-medium hover:text-accent"
                >
                  {dossier.title}
                </Link>
                <span className="tnum text-[12.5px] text-muted-foreground">
                  {t("workspace.dossierMeta", {
                    count: dossier.items_count,
                    date: new Date(dossier.created_at).toLocaleDateString(i18n.language),
                  })}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await auth.deleteDossier(workspace.id, dossier.id);
                    refetch();
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  − {t("dossier.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16 border-t border-border-soft pt-8">
        <h2 className="text-label uppercase text-muted-foreground">{t("workspace.account")}</h2>
        <p className="mt-3 font-mono text-[13px]">{me.email}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{t("workspace.identityNote")}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              await auth.logout();
              clearMe();
              navigate("/");
            }}
            className="rounded-full border border-border px-4 py-1.5 text-[13px] hover:border-foreground/40"
          >
            {t("auth.signOut")}
          </button>
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-[13px] text-destructive">{t("workspace.deleteWarning")}</span>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await auth.deleteAccount();
                  clearMe();
                  navigate("/");
                }}
                className="rounded-full border border-destructive px-4 py-1.5 text-[13px] text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                {t("workspace.deleteConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[13px] text-muted-foreground hover:text-foreground"
              >
                {t("workspace.deleteCancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full border border-border px-4 py-1.5 text-[13px] text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              {t("workspace.deleteAccount")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
