import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ExploreView } from "@/components/explore-view";
import { auth, personalWorkspace, useMe } from "@/lib/auth";
import { replaceDossier } from "@/lib/dossier";
import { useCarriedLens, withLens } from "@/lib/lens";

/** /workspace/dossiers/:id — un dossier GARDÉ, en lecture (pas
 *  d'éditeur serveur au lot 1). « Reprendre comme nouvelle version »
 *  (verrou 4) recharge les items dans la session du navigateur ;
 *  re-garder créera un NOUVEL objet, jamais un écrasement. */
export function SavedDossierPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const carried = useCarriedLens();
  const { me, loading } = useMe();
  const workspace = personalWorkspace(me);

  const { data: dossier, isError } = useQuery({
    queryKey: ["dossier", workspace?.id, id],
    queryFn: () => auth.getDossier(workspace!.id, Number(id)),
    enabled: workspace != null && id != null,
  });

  if (loading) return null;
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-6 pt-24 text-center">
        <p className="text-[15px] text-muted-foreground">{t("workspace.savedNeedsAccount")}</p>
        <Link
          to={`/login?from=/workspace/dossiers/${id}`}
          className="mt-6 inline-block rounded-full bg-foreground px-5 py-2.5 text-[14px] text-background hover:opacity-90"
        >
          {t("auth.signIn")} →
        </Link>
      </div>
    );
  }
  if (isError || !dossier) return null;

  return (
    <div className="dossier-page mx-auto w-full max-w-[880px] px-6 pt-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("workspace.savedEyebrow")}
      </p>
      <h1 className="display-tight mt-3 text-[clamp(30px,4.4vw,46px)] font-semibold leading-[1.05] tracking-[-0.024em]">
        {dossier.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
        <span>{t("dossier.metaCount", { count: dossier.items.length })}</span>
        <span aria-hidden="true">·</span>
        <span>
          {t("workspace.savedOn", {
            date: new Date(dossier.created_at).toLocaleDateString(i18n.language),
          })}
        </span>
        <button
          type="button"
          onClick={() => {
            replaceDossier(dossier.title, dossier.items);
            navigate("/dossier");
          }}
          className="no-print ml-auto rounded-full bg-foreground px-5 py-2 text-[13.5px] text-background hover:opacity-90"
        >
          {t("workspace.resume")} →
        </button>
      </div>

      {dossier.items.map((item, index) => (
        <section
          key={item.id}
          className="dossier-section mt-16 border-t border-border-soft pt-10 first:mt-10"
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="text-[21px] font-semibold leading-tight">{item.title}</h2>
          </div>
          {item.note ? (
            <p className="mt-4 max-w-[62ch] border-l-2 border-accent pl-4 text-[15px] italic leading-relaxed text-foreground/85">
              {item.note}
            </p>
          ) : null}
          <div className="mt-6">
            <ExploreView query={item.params} title={item.title} active />
          </div>
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            <Link
              to={withLens(`/explore?${item.params}`, carried)}
              className="no-print text-accent underline-offset-2 hover:underline"
            >
              {t("dossier.openLive")} ↗
            </Link>
          </p>
        </section>
      ))}

      <p className="mt-16 border-t border-border-soft pt-6 pb-10 text-[11.5px] text-muted-foreground">
        {t("workspace.savedFooter")}
      </p>
    </div>
  );
}
