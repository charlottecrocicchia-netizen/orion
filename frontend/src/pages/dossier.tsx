import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ExploreView } from "@/components/explore-view";
import { auth, personalWorkspace, useMe } from "@/lib/auth";
import {
  moveDossierItem,
  removeFromDossier,
  setDossierTitle,
  updateDossierItem,
  useDossier,
} from "@/lib/dossier";
import type { DossierItem } from "@/lib/dossier";
import { lensPhrase, useCarriedLens, withLens } from "@/lib/lens";
import { readState } from "@/lib/explore-state";

/** The dossier (lot 4, mockup v2 validated): an EDITORIAL page, not a
 *  card grid — typography and hairlines structure it, ONE take-away CTA.
 *  Every block is a LIVING Explorer view with its request sentence, its
 *  data date, its sources and a door back to the live view; annotations
 *  read as a margin voice. Print takes one section per page. */

function requestPhrase(
  params: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const state = readState(new URLSearchParams(params));
  return [
    `${t(`explorer.metric.${state.metric}`)} ${t("explorer.by")} ${t(`explorer.dim.${state.by}`)}`,
    state.by !== "year" && state.compare.length === 0
      ? t("explorer.top", { count: state.limit })
      : null,
    state.by !== "year" && state.split ? t("explorer.overTime") : null,
    state.q ? `« ${state.q} »` : null,
    state.country ? state.country : null,
    state.organisation ? t("explorer.entityScoped") : null,
    lensPhrase(state.sector, t),
    state.from != null || state.to != null ? `${state.from ?? ""} → ${state.to ?? ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** La phrase du bandeau dit la vérité de la persistance (D4) : session
 *  seule → « conservé dans ce navigateur — se connecter pour le
 *  garder » ; connecté → le geste « Garder dans mon espace ». Toujours
 *  au point d'usage, jamais un modal. */
function KeepControl({ title }: { title: string }) {
  const { t } = useTranslation();
  const { me } = useMe();
  const dossier = useDossier();
  const workspace = personalWorkspace(me);
  const [kept, setKept] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!me || !workspace) {
    return (
      <span>
        {t("dossier.keepSession")}{" "}
        <Link to="/login?from=/dossier" className="text-accent underline-offset-2 hover:underline">
          {t("dossier.keepSignIn")}
        </Link>
      </span>
    );
  }
  if (kept != null) {
    return (
      <span>
        {t("dossier.keptOk")}{" "}
        <Link
          to={`/workspace/dossiers/${kept}`}
          className="text-accent underline-offset-2 hover:underline"
        >
          {t("dossier.keptOpen")} ↗
        </Link>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // Toujours un NOUVEL objet (verrou 4) — jamais d'écrasement.
          const res = await auth.keepDossier(workspace.id, title, dossier.items);
          setKept(res.id);
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-full border border-border px-3 py-1 text-[12.5px] text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {t("dossier.keepCta")}
    </button>
  );
}

/** Les dossiers gardés du workspace — listés sur la page dossier
 *  (« session ET gardés ») dès qu'un compte est là. */
function SavedDossiers() {
  const { t, i18n } = useTranslation();
  const { me } = useMe();
  const workspace = personalWorkspace(me);
  const { data } = useQuery({
    queryKey: ["dossiers", workspace?.id],
    queryFn: () => auth.listDossiers(workspace!.id),
    enabled: workspace != null,
  });
  const saved = data?.dossiers ?? [];
  if (!me || saved.length === 0) return null;
  return (
    <section className="no-print mt-16 border-t border-border-soft pt-8">
      <h2 className="text-label uppercase text-muted-foreground">{t("dossier.savedTitle")}</h2>
      <ul className="mt-3">
        {saved.map((dossier) => (
          <li key={dossier.id} className="flex items-baseline gap-4 py-1.5">
            <Link
              to={`/workspace/dossiers/${dossier.id}`}
              className="min-w-0 flex-1 truncate text-[14.5px] hover:text-accent"
            >
              {dossier.title}
            </Link>
            <span className="tnum text-[12px] text-muted-foreground">
              {t("workspace.dossierMeta", {
                count: dossier.items_count,
                date: new Date(dossier.created_at).toLocaleDateString(i18n.language),
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Block({
  item,
  index,
  count,
}: {
  item: DossierItem;
  index: number;
  count: number;
}) {
  const carried = useCarriedLens();
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [noting, setNoting] = useState(false);

  return (
    <section className="dossier-section mt-16 border-t border-border-soft pt-10 first:mt-10">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={item.title}
            aria-label={t("dossier.rename")}
            onBlur={(event) => {
              updateDossierItem(item.id, { title: event.target.value.trim() || item.title });
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 border-b border-accent bg-transparent text-[21px] font-semibold leading-tight outline-none"
          />
        ) : (
          <h2 className="text-[21px] font-semibold leading-tight">{item.title}</h2>
        )}
        {/* Every gesture a block affords, SPELLED OUT — the icon row
            was too quiet to be found (recette 2026-08-04 : « le retrait
            est devenu introuvable »). Real bordered buttons, full
            labels, the removal in destructive tone. */}
        <div className="no-print ml-auto flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <button
            type="button"
            onClick={() => moveDossierItem(item.id, -1)}
            disabled={index === 0}
            aria-label={t("dossier.moveUp")}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
          >
            ↑ {t("dossier.moveUp")}
          </button>
          <button
            type="button"
            onClick={() => moveDossierItem(item.id, 1)}
            disabled={index === count - 1}
            aria-label={t("dossier.moveDown")}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
          >
            ↓ {t("dossier.moveDown")}
          </button>
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            ✎ {t("dossier.rename")}
          </button>
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            ＋ {t("dossier.annotate")}
          </button>
          <button
            type="button"
            onClick={() => removeFromDossier(item.id)}
            className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            − {t("dossier.remove")}
          </button>
        </div>
      </div>

      {noting || item.note ? (
        noting ? (
          <textarea
            autoFocus
            defaultValue={item.note}
            aria-label={t("dossier.annotate")}
            placeholder={t("dossier.notePlaceholder")}
            onBlur={(event) => {
              updateDossierItem(item.id, { note: event.target.value.trim() });
              setNoting(false);
            }}
            rows={2}
            className="mt-4 w-full max-w-[62ch] border-l-2 border-accent bg-transparent pl-4 text-[15px] italic leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="mt-4 block max-w-[62ch] border-l-2 border-accent pl-4 text-left text-[15px] italic leading-relaxed text-foreground/85"
          >
            {item.note}
          </button>
        )
      ) : null}

      <div className="mt-6">
        <ExploreView query={item.params} title={item.title} active />
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="font-mono">{requestPhrase(item.params, t)}</span>
        <span aria-hidden="true">·</span>
        <span>{t("dossier.dataAsOf", { date: item.addedAt })}</span>
        <span aria-hidden="true">·</span>
        <span>{t("explorer.sources")}</span>
        <Link
          to={withLens(`/explore?${item.params}`, carried)}
          className="no-print text-accent underline-offset-2 hover:underline"
        >
          {t("dossier.openLive")} ↗
        </Link>
      </p>
    </section>
  );
}

export function DossierPage() {
  const carried = useCarriedLens();
  const { t, i18n } = useTranslation();
  const dossier = useDossier();

  if (dossier.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-6 pt-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {t("dossier.eyebrow")}
        </p>
        <h1 className="mt-4 text-[clamp(26px,3.4vw,36px)] font-semibold">
          {t("dossier.emptyTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-muted-foreground">
          {t("dossier.empty")}
        </p>
        <Link
          to={withLens("/explore", carried)}
          className="mt-8 inline-block rounded-full bg-foreground px-5 py-2.5 text-[14px] text-background hover:opacity-90"
        >
          {t("dossier.emptyCta")} →
        </Link>
        <div className="mx-auto max-w-[880px] text-left">
          <SavedDossiers />
        </div>
      </div>
    );
  }

  const defaultTitle = (() => {
    const queries = dossier.items.map((item) => readState(new URLSearchParams(item.params)).q);
    const dominant = queries.filter(Boolean)[0];
    const month = new Date().toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return dominant
      ? `${dominant.charAt(0).toUpperCase()}${dominant.slice(1)} — ${month}`
      : t("dossier.untitled", { date: month });
  })();

  return (
    <div className="dossier-page mx-auto w-full max-w-[880px] px-6 pt-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("dossier.eyebrow")}
      </p>
      <input
        value={dossier.title || ""}
        placeholder={defaultTitle}
        aria-label={t("dossier.titleLabel")}
        onChange={(event) => setDossierTitle(event.target.value)}
        className="display-tight mt-3 w-full bg-transparent text-[clamp(30px,4.4vw,46px)] font-semibold leading-[1.05] tracking-[-0.024em] outline-none placeholder:text-foreground/90 focus:placeholder:text-muted-foreground/40"
      />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
        <span>{t("dossier.metaCount", { count: dossier.items.length })}</span>
        <span aria-hidden="true">·</span>
        <KeepControl title={dossier.title || defaultTitle} />
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print ml-auto rounded-full bg-foreground px-5 py-2 text-[13.5px] text-background hover:opacity-90"
        >
          {t("dossier.export")} →
        </button>
      </div>

      {dossier.items.map((item, index) => (
        <Block key={item.id} item={item} index={index} count={dossier.items.length} />
      ))}

      <SavedDossiers />

      <p className="mt-16 border-t border-border-soft pt-6 pb-10 text-[11.5px] text-muted-foreground">
        {t("dossier.footer")}
      </p>
    </div>
  );
}
