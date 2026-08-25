import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent, ReactNode } from "react";

import { AnglesDeck } from "@/components/angles-deck";
import { BarsChart, LinesChart } from "@/components/charts";
import { BumpChart } from "@/components/bump-chart";
import { DonutChart } from "@/components/donut-chart";
import { DumbbellChart } from "@/components/dumbbell-chart";
import { CoverageNote } from "@/components/coverage-note";
import { ReferenceNote } from "@/components/reference-note";
import { ReferenceSelector } from "@/components/reference-selector";
import { LensUnavailable } from "@/components/lens-unavailable";
import { SectorChip } from "@/components/sector-chip";
import { SeriesLegend } from "@/components/series-legend";
import {
  LENS_PARAM,
  useActiveLensState,
  useCarriedLens,
  withLens,
} from "@/lib/lens";
import { ExploreTable } from "@/components/explore-table";
import { WorldMap } from "@/components/world-map";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { regionColor } from "@/lib/regions";
import { addToDossier, isCollected, removeByParams } from "@/lib/dossier";
import { parseIntent } from "@/lib/intent";
import { STORIES } from "@/lib/stories";
import {
  pppAvailable,
  pppViewEligible,
  readState,
  resolveView,
  toApiParams,
} from "@/lib/explore-state";
import {
  applyTrend,
  indexBaseCandidates,
  resolveIndexBase,
  robustDomain,
} from "@/lib/trend";
import { excludedYears } from "@/lib/excluded";
import type { ExplorerState } from "@/lib/explore-state";
import {
  countryFlag,
  formatValue,
  isMoneyUnit,
  moneySymbol,
  seriesColor,
  seriesLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const METRICS = [
  "funding",
  "projects",
  "organisations",
  "avg",
  "coordination",
] as const;
const DIMENSIONS = [
  "country",
  "region",
  "subdivision",
  "programme",
  "theme",
  "organisation",
  "funder",
  "orgtype",
  "year",
] as const;
const ORG_TYPE_OPTIONS = [
  "research",
  "university",
  "company",
  "sme",
  "public",
  "health",
  "nonprofit",
  "other",
];
const YEAR_MIN = 2005;
const YEAR_MAX = 2027;

/* ————— A dotted-underline sentence segment opening a small menu ————— */

/** Le message d'un refus PPP suit le CODE renvoyé, jamais le mode.
 *
 *  Trois refus, trois faits distincts : la vue ne cadre pas une seule
 *  année (prédictible ici, aucune requête n'est émise) ; l'année n'est
 *  publiée par aucune juridiction ; ou aucun territoire de CETTE vue
 *  n'a de référence pour elle. Se tromper de phrase dirait quelque
 *  chose de faux — par exemple accuser la source de ne pas avoir publié
 *  2025 alors qu'elle l'a publiée pour deux cent trente pays. */
function pppRefusalKey(predictive: boolean, error: unknown): string {
  if (predictive) return "explorer.reference.pppRequiresSingleYear";
  const detail = error instanceof ApiError ? error.detail : null;
  if (detail === "ppp_year_unavailable")
    return "explorer.reference.pppYearUnavailable";
  if (detail === "ppp_reference_unavailable_for_view")
    return "explorer.reference.pppReferenceUnavailableForView";
  return "explorer.reference.pppRequiresSingleYear";
}

function Segment({
  display,
  children,
  chip = false,
  menuLabel,
}: {
  display: ReactNode;
  children: (close: () => void) => ReactNode;
  chip?: boolean;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={menuLabel}
        onClick={() => setOpen(!open)}
        className={cn(
          "whitespace-nowrap text-accent",
          chip
            ? "rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium"
            : "border-b-2 border-dotted border-accent/45 pb-px",
        )}
      >
        {display}
        {!chip ? (
          <span
            aria-hidden="true"
            className="ml-1 align-[2px] text-[0.6em] opacity-60"
          >
            ▾
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-30 min-w-[240px] rounded-xl border bg-background p-1.5 text-left text-[14px] font-normal tracking-normal shadow-key"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </span>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "block w-full rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface",
        selected && "font-medium text-accent",
      )}
    >
      {children}
    </button>
  );
}

/* ————— The page ————— */

export function ExplorerPage() {
  const carried = useCarriedLens();
  const lensState = useActiveLensState();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Angles mode (lot 3): a story with a deck opens as a carousel; the
  // composer below mirrors the ACTIVE angle, and any composer interaction
  // writes a clean URL (no angles param) — the story is a starting point,
  // never a cage.
  const anglesStory = STORIES.find(
    (candidate) => candidate.key === params.get("angles") && candidate.deck,
  );
  const angleIndex = anglesStory
    ? Math.min(
        Math.max(Number(params.get("angle") ?? "0") || 0, 0),
        anglesStory.deck!.length - 1,
      )
    : 0;
  const activeSlide = anglesStory?.deck?.[angleIndex];
  const state = readState(
    activeSlide ? new URLSearchParams(activeSlide.params) : params,
  );

  const setAngle = (index: number) => {
    if (!anglesStory) return;
    const out = new URLSearchParams();
    out.set("angles", anglesStory.key);
    out.set("angle", String(index));
    setParams(out, { replace: true, preventScrollReset: true });
  };
  const openInComposer = (query: string) =>
    setParams(new URLSearchParams(query), { preventScrollReset: true });
  const [copied, setCopied] = useState(false);
  // L'état « au dossier » vient du store, par VUE — le bouton dit la
  // vérité et sait défaire (recette 2026-08-04). `dossierTick` force la
  // relecture après chaque bascule.
  const [dossierTick, setDossierTick] = useState(0);
  // Map rule: the first click on a country SELECTS it (summary bar below);
  // a second click on the selected shape zooms into its file.
  const [mapSelected, setMapSelected] = useState<string | null>(null);

  // "Add to dossier" collects the CURRENT view — the board's URL, or the
  // active angle in a deck. A TOGGLE: added views remove on the spot.
  const collect = (query: string, title: string) => {
    if (isCollected(query)) removeByParams(query);
    else addToDossier(query, title);
    setDossierTick((tick) => tick + 1);
  };
  void dossierTick;

  const patch = (changes: Partial<ExplorerState>) => {
    const next = { ...state, ...changes };
    const out = new URLSearchParams();
    if (next.metric !== "funding") out.set("metric", next.metric);
    if (next.by !== "country") out.set("by", next.by);
    if (next.by !== "year") out.set("split", next.split ? "1" : "0");
    if (next.compare.length > 0) out.set("compare", next.compare.join("~"));
    if (next.from != null && next.to != null)
      out.set("time", `${next.from}..${next.to}`);
    if (next.q) out.set("q", next.q);
    if (next.country) out.set("country", next.country);
    if (next.programme && next.by === "programme")
      out.set("programme", next.programme);
    if (next.limit !== 5) out.set("limit", String(next.limit));
    if (next.view !== "auto") out.set("view", next.view);
    // Les cadrages traversent l'interaction (Space natif, lot 0) : les
    // perdre en silence était l'aspérité relevée au mémo produit.
    if (next.sector) out.set(LENS_PARAM, next.sector);
    if (next.subdivision) out.set("subdivision", next.subdivision);
    if (next.organisation) out.set("organisation", next.organisation);
    // Le mode de lecture (Reference Engine, grammaire R0 § D10) : toute
    // URL produite en real porte son année de référence ; la devise
    // d'affichage ne s'écrit que hors défaut (EUR omis). La
    // reconstruction efface d'elle-même les paramètres d'un mode quitté.
    if (next.value === "real" || next.value === "capita") {
      // real et capita partagent année de référence et devise (R0 § D1).
      out.set("value", next.value);
      if (next.base != null) out.set("base", String(next.base));
      if (next.cur) out.set("cur", next.cur);
    } else if (next.value === "gdp") {
      // % PIB : aucun paramètre — la perspective est forcée par la
      // dimension, elle n'entre jamais dans l'URL (R0 § D3).
      out.set("value", "gdp");
    } else if (next.value === "ppp") {
      // PURCHASING POWER (R4) : un seul paramètre. Pas de `base` (il n'y
      // a pas d'année de référence), pas de `cur` (le dollar
      // international ne se choisit pas), pas de `perspective` (forcée),
      // et pas de second paramètre d'année — elle vit déjà dans `time`.
      out.set("value", "ppp");
    } else if (next.value === "index") {
      // TREND (R2) : l'index porte son année de base, la croissance n'a
      // aucun paramètre — et aucune interaction (légende, fenêtre,
      // filtres) ne fait tomber le mode en silence.
      out.set("value", "index");
      if (next.base != null) out.set("base", String(next.base));
    } else if (next.value === "growth") {
      out.set("value", "growth");
      // L'échelle d'affichage (recette R2) : présentation pure mais
      // représentation substantielle — l'URL la porte, l'API jamais.
      if (next.range === "full") out.set("range", "full");
    }
    // Les séries masquées (chantier légende) : clés canoniques, jamais
    // des labels — l'URL rejoue exactement la même composition.
    if (next.hidden.length > 0) out.set("hidden", next.hidden.join("~"));
    setParams(out, { preventScrollReset: true });
  };

  const apiParams = toApiParams(state);
  const { temporal, availableViews, view } = resolveView(state);

  // TREND (R2, conception R0 § D1) : index et growth sont des
  // transformations CLIENT de la série real — le backend les ignore.
  // Sur une vue sans axe temporel, le mode se refuse explicitement
  // (jamais une interprétation silencieuse différente) et rien n'est
  // demandé à l'API.
  const trendMode =
    state.value === "index" || state.value === "growth"
      ? (state.value as "index" | "growth")
      : null;
  const trendInvalid = trendMode != null && !temporal;
  // ECONOMIC SCALE (R3, R0 § D3/D4) : la vue doit fournir un
  // dénominateur résoluble — financeurs (effort), pays ou vue annuelle
  // cadrée pays (intensité reçue), métrique funding. La perspective est
  // FORCÉE par la dimension : aucun contrôle inutile, rien dans l'URL.
  const scaleAvailable =
    state.metric === "funding" &&
    (state.by === "funder" ||
      state.by === "country" ||
      (state.by === "year" && !!state.country));
  const scalePerspective: "funder" | "recipient" =
    state.by === "funder" ? "funder" : "recipient";
  // PURCHASING POWER (R4) : les prédicats vivent dans `explore-state` —
  // la page, le rejeu et les tests lisent la même règle.
  //
  // Deux questions distinctes, et les confondre donnerait un message
  // faux. La VUE est-elle structurée pour le mode (une année, la bonne
  // dimension) ? Et la RÉFÉRENCE existe-t-elle pour cette année-là ?
  // Le refus PRÉDICTIF ne juge que la première — comme pour TREND, il
  // n'émet aucune requête. Une année sans référence, elle, doit
  // atteindre l'API pour recevoir `ppp_year_unavailable` plutôt que
  // « choisissez une année », qui serait faux.
  const pppInvalid = state.value === "ppp" && !pppViewEligible(state);

  const {
    data: rawData,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["explore", apiParams.toString()],
    queryFn: () => api.explore(apiParams),
    placeholderData: keepPreviousData,
    // Une vue déjà refusée ne demande rien : l'API dirait la même chose.
    enabled: lensState.kind !== "invalid" && !trendInvalid && !pppInvalid,
  });
  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: api.countries,
  });
  // Les années que le mode PPP peut honorer — référentiel, jamais une
  // borne codée en dur. Une nouvelle publication de la source les fait
  // apparaître d'elles-mêmes.
  const { data: pppYears } = useQuery({
    queryKey: ["ppp-years"],
    queryFn: api.pppYears,
  });
  // Le SÉLECTEUR, lui, exige les DEUX conditions : il n'offre que ce que
  // la vue peut honorer (R0 § D6).
  const isPppAvailable = pppAvailable(state, pppYears?.years);
  const { data: programmes } = useQuery({
    queryKey: ["programmes"],
    queryFn: api.programmes,
    enabled: state.by === "programme",
  });
  const { data: themes } = useQuery({
    queryKey: ["explore-themes"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "projects", by: "theme", limit: "25" }),
      ),
    enabled: state.by === "theme",
  });
  const { data: flows } = useQuery({
    queryKey: ["country-flows"],
    queryFn: api.countryFlows,
    enabled: state.view === "map",
  });

  // LA transformation TREND, en un point unique juste après la réponse
  // (lib/trend.ts) : graphique, table, CSV, légende et note lisent tous
  // `data` transformé — jamais deux calculs légèrement différents. La
  // base d'index est CANONIQUE : dans la fenêtre visible et
  // exploitable, sinon ré-ancrée (l'URL est réécrite plus bas).
  const indexBases = rawData
    ? indexBaseCandidates(rawData, state.from, state.to)
    : [];
  const canonicalBase =
    trendMode === "index" && rawData
      ? resolveIndexBase(rawData, state.from, state.to, state.base)
      : null;
  const trend =
    trendMode && !trendInvalid && rawData
      ? applyTrend(rawData, trendMode, canonicalBase)
      : null;
  const data = trend ? trend.data : rawData;

  // L'année de référence dans l'URL, TOUJOURS (arbitrage du 2026-08-22,
  // repris sous la grammaire R0) : la bascule peut partir sans année
  // (lecture tolérée) — dès que l'API répond, l'année réellement
  // utilisée s'écrit dans l'URL, en remplacement d'historique. Un lien
  // copié ensuite reste des valeurs de CE millésime après la bascule
  // d'Orion vers 2026.
  const referenceMeta = data?.meta.reference;
  useEffect(() => {
    if (anglesStory) return;
    if (
      (state.value === "real" || state.value === "capita") &&
      state.base == null &&
      referenceMeta?.base != null
    ) {
      const out = new URLSearchParams(params);
      out.set("base", String(referenceMeta.base));
      setParams(out, { replace: true, preventScrollReset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, state.base, referenceMeta?.base, anglesStory]);

  // L'année de base d'index, CANONIQUE dans l'URL (GO R2, § 3 et 12) :
  // absente, hors de la fenêtre visible ou inexploitable, elle se
  // ré-ancre sur la première année pleine valide et se réécrit en
  // remplacement d'historique — l'URL reste cohérente avec ce que
  // l'utilisateur voit, aucun lien partagé ne dépend d'un défaut
  // implicite.
  useEffect(() => {
    if (anglesStory) return;
    if (
      trendMode === "index" &&
      canonicalBase != null &&
      state.base !== canonicalBase
    ) {
      const out = new URLSearchParams(params);
      out.set("base", String(canonicalBase));
      setParams(out, { replace: true, preventScrollReset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendMode, canonicalBase, state.base, anglesStory]);

  // La ligne d'unité (R0 § D7, ajustée en recette R1) : portée par le
  // sélecteur « View funding as », l'axe du graphique et l'en-tête du
  // CSV — pas de répétition dans le sous-titre. En TREND, plus aucun
  // symbole monétaire : l'unité dit l'indice ou le pourcentage.
  const countryName =
    state.country !== ""
      ? (() => {
          try {
            return new Intl.DisplayNames([i18n.language || "en"], {
              type: "region",
            }).of(state.country);
          } catch {
            return state.country;
          }
        })()
      : null;
  // La période affichée — celle du chip temporel, la seule que
  // l'utilisateur voit. Les agrégats pluriannuels la DISENT (verrou
  // R3) : un % PIB agrégé porte sur la période, un par-habitant agrégé
  // est un cumul sur la période.
  const period = `${state.from ?? YEAR_MIN}–${state.to ?? YEAR_MAX}`;
  const unitLine =
    // PURCHASING POWER : l'unité nomme la perspective, comme « % of GDP
    // · European Union » en R3 — jamais « Intl $ » nu, qui laisserait
    // croire à une comparaison de montants reçus.
    data && state.value === "ppp"
      ? t("explorer.reference.unitPppRecipient")
      : data && state.value === "gdp"
        ? (state.by === "year" && countryName
            ? t("explorer.reference.unitGdpOf", { name: countryName })
            : t(
                scalePerspective === "funder"
                  ? "explorer.reference.unitGdpFunder"
                  : "explorer.reference.unitGdpRecipient",
              )) + (temporal ? "" : ` · ${period}`)
        : data && state.value === "capita" && referenceMeta
          ? temporal
            ? t("explorer.reference.unitCapita", {
                year: referenceMeta.base,
                cur: referenceMeta.cur,
                symbol: moneySymbol((referenceMeta.cur ?? "EUR").toLowerCase()),
              })
            : t("explorer.reference.unitCapitaCumulative", {
                period,
                year: referenceMeta.base,
                cur: referenceMeta.cur,
                symbol: moneySymbol((referenceMeta.cur ?? "EUR").toLowerCase()),
              })
          : data && trendMode === "index"
            ? t("explorer.reference.csvIndex", { base: canonicalBase ?? "" })
            : data && trendMode === "growth"
              ? t("explorer.reference.csvGrowth")
              : data && isMoneyUnit(data.unit)
                ? referenceMeta
                  ? t("explorer.reference.unit", {
                      year: referenceMeta.base,
                      cur: referenceMeta.cur,
                      symbol: moneySymbol(data.unit),
                    })
                  : t("explorer.reference.unitNominal")
                : null;

  const toggleCompare = (key: string) => {
    const next = state.compare.includes(key)
      ? state.compare.filter((k) => k !== key)
      : [...state.compare, key].slice(0, 6);
    patch({ compare: next });
  };

  const share = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCsv = () => {
    if (!data) return;
    const rows: string[][] = [];
    if (temporal) {
      const years = [
        ...new Set(
          data.series.flatMap((s) => (s.points ?? []).map((p) => p.year)),
        ),
      ].sort();
      rows.push(["year", ...data.series.map((s) => seriesLabel(s, t))]);
      for (const year of years) {
        rows.push([
          String(year),
          ...data.series.map((s) =>
            String((s.points ?? []).find((p) => p.year === year)?.value ?? ""),
          ),
        ]);
      }
    } else {
      // La ligne d'unité voyage avec l'export (R0 § D7) : une colonne
      // monétaire dit son référentiel dans son propre en-tête.
      rows.push([
        "key",
        "label",
        unitLine ? `${data.metric} (${unitLine})` : data.metric,
      ]);
      for (const s of data.series)
        rows.push([String(s.key), seriesLabel(s, t), String(s.value ?? "")]);
    }
    const csv = [
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      ),
      ...(unitLine ? [`# ${unitLine}`] : []),
      `# ${t("explorer.sources")} — orion ${new URL(window.location.href).search}`,
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `orion-${data.metric}-by-${data.by}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const compareDisplay =
    state.compare.length > 0
      ? state.compare
          .map((key) => {
            if (state.by === "orgtype") return t(`orgType.${key}`);
            if (state.by === "programme")
              return (
                programmes?.find((p) => String(p.id) === key)?.label ?? key
              );
            if (state.by === "theme")
              return themes?.series.find((s) => s.key === key)?.label ?? key;
            return key;
          })
          .join(" · ")
      : t("explorer.top", { count: state.limit });

  // The active angle, said in one quiet read-only sentence (the deck's
  // header) — the full composer only reappears through "Open in the
  // composer", which leaves angles mode cleanly.
  const anglePhrase = [
    `${t(`explorer.metric.${state.metric}`)} ${t("explorer.by")} ${t(`explorer.dim.${state.by}`)}`,
    state.by !== "year" ? compareDisplay : null,
    state.by !== "year" && state.split ? t("explorer.overTime") : null,
    state.q ? `« ${state.q} »` : null,
    state.country ? `${countryFlag(state.country)} ${state.country}` : null,
    state.from != null || state.to != null
      ? `${state.from ?? YEAR_MIN} → ${state.to ?? YEAR_MAX}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Programme drill context (board only — deck slides drill locally).
  const drilledLabel = state.programme
    ? (data?.meta.programme_label ?? "…")
    : null;
  const leafDrill =
    state.programme != null &&
    state.programme !== "" &&
    data != null &&
    data.series.length === 1 &&
    String(data.series[0].key) === state.programme;
  const donutSeries =
    data && state.programme
      ? data.series.map((serie) =>
          String(serie.key) === state.programme
            ? { ...serie, label: t("explorer.donutDirect") }
            : serie,
        )
      : (data?.series ?? []);

  const boardTitle = `${t(`explorer.metric.${state.metric}`)} · ${t(`explorer.dim.${state.by}`)}`;

  // La visibilité des séries (chantier légende, 2026-08-22) — état de
  // PRÉSENTATION pur : le backend rend les mêmes données, seules les
  // séries dessinées et l'échelle changent. Les vues part-du-tout
  // (donut), la carte et la table restent entières — masquer une part
  // d'un donut mentirait sur le total.
  const LEGEND_VIEWS = ["lines", "bump", "delta", "bars"];
  const legendActive =
    LEGEND_VIEWS.includes(view) && (data?.series.length ?? 0) > 1;
  // La couleur suit l'entité : figée sur l'ordre COMPLET du top, jamais
  // recompactée quand une série se masque.
  const colorByKey = new Map(
    (data?.series ?? []).map((serie, index) => [
      String(serie.key),
      seriesColor(index),
    ]),
  );
  const shownSeries = legendActive
    ? (data?.series ?? []).filter(
        (serie) => !state.hidden.includes(String(serie.key)),
      )
    : (data?.series ?? []);
  // `range=full` canonique (recette R2) : calculé sur les observations
  // effectivement VISIBLES (après hidden=) — une série masquée ne dicte
  // plus l'échelle. Si le jeu visible n'a aucun débordement, les deux
  // échelles sont identiques : le paramètre sort de l'URL (replace).
  const growthRobust =
    trendMode === "growth" && data
      ? robustDomain(
          shownSeries
            .flatMap((s) => (s.points ?? []).map((p) => p.value))
            .filter((v): v is number => v != null),
        )
      : null;
  useEffect(() => {
    if (anglesStory) return;
    if (
      state.range === "full" &&
      trendMode === "growth" &&
      data &&
      growthRobust == null
    ) {
      const out = new URLSearchParams(params);
      out.delete("range");
      setParams(out, { replace: true, preventScrollReset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.range, trendMode, growthRobust == null, data != null, anglesStory]);

  const toggleHidden = (key: string) =>
    patch({
      hidden: state.hidden.includes(key)
        ? state.hidden.filter((k) => k !== key)
        : [...state.hidden, key],
    });

  const submitFreeText = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const intent = parseIntent(
      String(new FormData(form).get("free") ?? ""),
      i18n.language,
    );
    if (!intent) return;
    if (intent.to === "explore") {
      setParams(new URLSearchParams(intent.params), {
        preventScrollReset: true,
      });
    } else {
      navigate(
        withLens(
          `/${intent.to === "projects" ? "projects" : "compare"}?${intent.params}`,
          carried,
        ),
      );
    }
    form.reset();
  };

  // Le refus unifié (M1.2) : une lentille inconnue, indisponible, vide
  // ou répétée ne cadre rien — et ne se replie JAMAIS en silence sur le
  // corpus entier. Un registre illisible, lui, n'est pas un verdict :
  // l'état `pending` laisse la vue se rendre, l'API tranchera.
  if (lensState.kind === "invalid") return <LensUnavailable />;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pt-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-sm font-medium text-accent">
          {t("explorer.eyebrow")}
        </p>
        <form
          onSubmit={submitFreeText}
          className="min-w-[260px] flex-1 sm:max-w-[380px]"
        >
          <input
            name="free"
            type="text"
            placeholder={`⌕ ${t("explorer.freeText")}`}
            aria-label={t("explorer.freeText")}
            className="w-full rounded-full bg-surface px-4 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
          />
        </form>
      </div>

      {/* In angles mode the interactive composer stays out of the way: the
          deck presents itself — the question as title, the active angle as
          one read-only sentence, ONE exit to the composer. */}
      {anglesStory ? (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="display-tight max-w-[30ch] text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.12]">
              {t(`explorer.stories.${anglesStory.key}.title`)}
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-snug text-muted-foreground">
              {anglePhrase}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-pressed={
                activeSlide ? isCollected(activeSlide.params) : false
              }
              onClick={() =>
                activeSlide &&
                collect(activeSlide.params, t(activeSlide.titleKey))
              }
              className={
                activeSlide && isCollected(activeSlide.params)
                  ? "rounded-full border border-accent bg-accent-soft px-4 py-2 text-[13px] text-accent transition-colors hover:border-destructive hover:bg-transparent hover:text-destructive"
                  : "rounded-full border px-4 py-2 text-[13px] transition-colors hover:border-accent hover:text-accent"
              }
            >
              {activeSlide && isCollected(activeSlide.params)
                ? `✓ ${t("dossier.inDossier")}`
                : `+ ${t("dossier.add")}`}
            </button>
            <button
              type="button"
              onClick={() => activeSlide && openInComposer(activeSlide.params)}
              className="rounded-full border px-4 py-2 text-[13px] transition-colors hover:border-accent hover:text-accent"
            >
              {t("explorer.angles.open")} →
            </button>
          </div>
        </div>
      ) : (
        /* The composition sentence — the interface itself */
        <p className="display-tight mt-3 max-w-[34ch] text-[clamp(24px,3.2vw,34px)] font-semibold leading-[1.5]">
          {t("explorer.show")}{" "}
          <Segment
            menuLabel={t("explorer.show")}
            display={t(`explorer.metric.${state.metric}`)}
          >
            {(close) =>
              METRICS.map((metric) => (
                <MenuItem
                  key={metric}
                  selected={metric === state.metric}
                  onClick={() => {
                    patch({ metric });
                    close();
                  }}
                >
                  {t(`explorer.metric.${metric}`)}
                </MenuItem>
              ))
            }
          </Segment>{" "}
          {t("explorer.by")}{" "}
          <Segment
            menuLabel={t("explorer.by")}
            display={t(`explorer.dim.${state.by}`)}
          >
            {(close) =>
              DIMENSIONS.map((by) => (
                <MenuItem
                  key={by}
                  selected={by === state.by}
                  onClick={() => {
                    patch({
                      by,
                      compare: [],
                      programme: "",
                      view: "auto",
                      split: by === "year" ? false : state.split,
                      // Les identifiants masqués appartiennent à LEUR
                      // dimension : changer de dimension repart net.
                      hidden: [],
                    });
                    close();
                  }}
                >
                  {t(`explorer.dim.${by}`)}
                </MenuItem>
              ))
            }
          </Segment>
          {state.by !== "year" ? (
            <>
              {", "}
              <Segment
                menuLabel={t("explorer.top", { count: state.limit })}
                display={compareDisplay}
              >
                {(close) => (
                  <>
                    <div className="flex gap-1 border-b px-2 pb-1.5 pt-0.5">
                      {[5, 10, 25].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            patch({ limit: n, compare: [] });
                            close();
                          }}
                          className={cn(
                            "rounded-full px-3 py-1 text-[12.5px] hover:bg-surface",
                            state.compare.length === 0 &&
                              state.limit === n &&
                              "bg-foreground text-background",
                          )}
                        >
                          {t("explorer.top", { count: n })}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto pt-1">
                      {state.by === "country" &&
                        countries?.slice(0, 24).map((c) => (
                          <MenuItem
                            key={c.code}
                            selected={state.compare.includes(c.code)}
                            onClick={() => toggleCompare(c.code)}
                          >
                            {countryFlag(c.code)} {c.name}
                          </MenuItem>
                        ))}
                      {state.by === "programme" &&
                        programmes?.slice(0, 12).map((p) => (
                          <MenuItem
                            key={p.id}
                            selected={state.compare.includes(String(p.id))}
                            onClick={() => toggleCompare(String(p.id))}
                          >
                            {p.label}
                          </MenuItem>
                        ))}
                      {state.by === "orgtype" &&
                        ORG_TYPE_OPTIONS.map((key) => (
                          <MenuItem
                            key={key}
                            selected={state.compare.includes(key)}
                            onClick={() => toggleCompare(key)}
                          >
                            {t(`orgType.${key}`)}
                          </MenuItem>
                        ))}
                      {state.by === "theme" &&
                        themes?.series.map((serie) => (
                          <MenuItem
                            key={String(serie.key)}
                            selected={state.compare.includes(String(serie.key))}
                            onClick={() => toggleCompare(String(serie.key))}
                          >
                            {serie.label ?? String(serie.key)}
                          </MenuItem>
                        ))}
                    </div>
                  </>
                )}
              </Segment>
              {", "}
              <button
                type="button"
                aria-pressed={state.split}
                onClick={() => patch({ split: !state.split, view: "auto" })}
                className={cn(
                  "whitespace-nowrap border-b-2 pb-px",
                  state.split
                    ? "border-accent/45 border-dotted text-accent"
                    : "border-transparent text-muted-foreground hover:text-accent",
                )}
              >
                {t("explorer.overTime")}
              </button>
            </>
          ) : null}{" "}
          <Segment
            chip
            menuLabel={t("search.filters.years")}
            display={`${state.from ?? YEAR_MIN} → ${state.to ?? YEAR_MAX}`}
          >
            {(close) => (
              <div className="flex items-center gap-2 p-2">
                {(["from", "to"] as const).map((bound) => (
                  <select
                    key={bound}
                    aria-label={t(`search.filters.${bound}`)}
                    value={
                      bound === "from"
                        ? (state.from ?? YEAR_MIN)
                        : (state.to ?? YEAR_MAX)
                    }
                    onChange={(event) => {
                      const year = Number(event.target.value);
                      patch({
                        from:
                          bound === "from" ? year : (state.from ?? YEAR_MIN),
                        to: bound === "to" ? year : (state.to ?? YEAR_MAX),
                      });
                    }}
                    className="rounded-lg border bg-background px-2 py-1.5 text-[13px]"
                  >
                    {Array.from(
                      { length: YEAR_MAX - YEAR_MIN + 1 },
                      (_, i) => YEAR_MIN + i,
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                ))}
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-foreground px-3 py-1.5 text-[12.5px] text-background"
                >
                  {t("explorer.apply")}
                </button>
              </div>
            )}
          </Segment>{" "}
          {state.q ? (
            <button
              type="button"
              onClick={() => patch({ q: "" })}
              className="rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium text-accent"
            >
              « {state.q} » <span className="opacity-55">×</span>
            </button>
          ) : null}
          {state.country ? (
            <button
              type="button"
              onClick={() => patch({ country: "" })}
              className="rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium text-accent"
            >
              {countryFlag(state.country)} {state.country}{" "}
              <span className="opacity-55">×</span>
            </button>
          ) : null}
          {drilledLabel ? (
            <button
              type="button"
              onClick={() => patch({ programme: "" })}
              className="rounded-full bg-accent-soft px-3.5 py-1 align-middle text-[0.55em] font-medium text-accent"
            >
              {t("explorer.donutWithin", { label: drilledLabel })}{" "}
              <span className="opacity-55">×</span>
            </button>
          ) : null}
          {/* Le périmètre spatial, NOMMÉ dans la phrase même (Space natif,
            lot 1) : trois états, l'URL comme seule vérité. */}
          <span className="align-middle text-[0.55em] font-normal tracking-normal">
            <SectorChip
              sector={state.sector}
              onChange={(next) => patch({ sector: next })}
            />
          </span>
          <Segment
            chip
            menuLabel={t("explorer.addFilter")}
            display={t("explorer.addFilter")}
          >
            {(close) => (
              <form
                className="w-[280px] p-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  patch({
                    q: String(form.get("q") ?? "").trim(),
                    country:
                      state.by === "country"
                        ? ""
                        : String(form.get("country") ?? ""),
                  });
                  close();
                }}
              >
                <label
                  className="block text-[12px] text-muted-foreground"
                  htmlFor="explorer-q"
                >
                  {t("explorer.theme")} · {t("explorer.themeHint")}
                </label>
                <input
                  id="explorer-q"
                  name="q"
                  defaultValue={state.q}
                  placeholder="hydrogen, quantum…"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-accent"
                />
                {state.by !== "country" ? (
                  <>
                    <label
                      className="mt-3 block text-[12px] text-muted-foreground"
                      htmlFor="explorer-country"
                    >
                      {t("explorer.countryFilter")}
                    </label>
                    <select
                      id="explorer-country"
                      name="country"
                      defaultValue={state.country}
                      className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-[13.5px]"
                    >
                      <option value="">{t("explorer.anyCountry")}</option>
                      {countries?.slice(0, 24).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <button
                  type="submit"
                  className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-[12.5px] text-background"
                >
                  {t("explorer.apply")}
                </button>
              </form>
            )}
          </Segment>
        </p>
      )}

      {/* The view — or, for a story with a deck, its Angles */}
      {anglesStory ? (
        <>
          {/* La loi du chip vaut aussi dans les decks (lot 3) : l'angle
              actif porte son périmètre à l'écran ; le changer sort vers
              le composeur — le deck est un point de départ, jamais une
              cage. */}
          {state.sector ? (
            <p className="mb-4">
              <SectorChip
                sector={state.sector}
                onChange={(next) => {
                  const out = new URLSearchParams(activeSlide?.params ?? "");
                  if (next) out.set(LENS_PARAM, next);
                  else out.delete(LENS_PARAM);
                  openInComposer(out.toString());
                }}
              />
            </p>
          ) : null}
          <AnglesDeck
            slides={anglesStory.deck!.map((slide) => ({
              query: slide.params,
              title: t(slide.titleKey),
            }))}
            active={angleIndex}
            onActive={setAngle}
          />
        </>
      ) : (
        <section className="mt-9 rounded-[20px] border p-7 pb-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="text-[15px] font-semibold">{boardTitle}</h1>
            <span className="text-[12.5px] text-muted-foreground">
              {data ? t(`explorer.basis.${data.basis}`) : ""}
              {state.by === "theme" ? ` · ${t("explorer.multiTheme")}` : ""}
            </span>
            {/* Le sélecteur de lecture (R0 § D5) : LE contrôle, explicite,
              porté par l'URL — jamais activé en silence. En TREND,
              l'unité transformée n'est plus monétaire : la condition
              lit la réponse BRUTE. */}
            {(rawData && isMoneyUnit(rawData.unit)) || state.value !== "" ? (
              <ReferenceSelector
                value={state.value}
                base={state.base}
                cur={state.cur}
                bases={referenceMeta?.bases ?? []}
                resolvedBase={referenceMeta?.base ?? null}
                temporal={temporal}
                indexBases={indexBases}
                scaleAvailable={scaleAvailable}
                pppAvailable={isPppAvailable}
                onChange={(next) => patch(next)}
              />
            ) : null}
            {/* L'accès ⓘ voisin du contrôle (verrou de recette R3) :
              il OUVRE la note Reference sous le graphique — jamais une
              méthodologie dupliquée. */}
            {data ? (
              <button
                type="button"
                aria-label={t("explorer.reference.title")}
                onClick={() => {
                  const note = document.getElementById("reference-note");
                  if (note) {
                    note.setAttribute("open", "");
                    note.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }}
                className="rounded-full border px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                ⓘ
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                aria-pressed={isCollected(params.toString())}
                onClick={() => collect(params.toString(), boardTitle)}
                className={
                  isCollected(params.toString())
                    ? "rounded-full border border-accent bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition-colors hover:border-destructive hover:bg-transparent hover:text-destructive"
                    : "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
                }
              >
                {isCollected(params.toString())
                  ? `✓ ${t("dossier.inDossier")}`
                  : `+ ${t("dossier.add")}`}
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
              >
                {t("explorer.csv")}
              </button>
              <button
                type="button"
                onClick={share}
                className="rounded-full bg-foreground px-3.5 py-1.5 text-[12.5px] text-background hover:opacity-90"
              >
                {copied ? t("explorer.shared") : t("explorer.share")}
              </button>
            </div>
          </div>

          <div className="mt-5">
            {state.programme && data ? (
              <button
                type="button"
                onClick={() => patch({ programme: "" })}
                className="mb-3 text-[13px] text-accent underline-offset-2 hover:underline"
              >
                ‹ {drilledLabel}
              </button>
            ) : null}
            {trendInvalid || pppInvalid ? (
              /* Refus PRÉDICTIBLES, décidés depuis l'état de la vue :
               TREND sans axe temporel (GO R2 § 4), PPP sans année
               d'attribution unique (R4 § 4.4). Ils passent AVANT le
               squelette — une requête désactivée reste « pending », et
               le refus ne s'afficherait jamais derrière lui. */
              <div className="py-24 text-center text-muted-foreground">
                <p className="mx-auto max-w-[52ch]">
                  {t(
                    pppInvalid
                      ? "explorer.reference.pppRequiresSingleYear"
                      : "explorer.reference.trendUnavailable",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => patch({ value: "", base: null, cur: "" })}
                  className="mt-4 rounded-full border px-4 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
                >
                  {t("explorer.reference.nominal")}
                </button>
              </div>
            ) : isPending ? (
              <Skeleton className="h-[380px] w-full" />
            ) : isError &&
              (state.value === "real" ||
                state.value === "gdp" ||
                state.value === "capita" ||
                state.value === "ppp") ? (
              /* Le refus explicite du mode (422) : jamais un repli
               silencieux — la sortie est un geste. En PPP le message
               suit le CODE du refus, jamais le mode : « l'année n'est
               pas publiée » et « aucun territoire de cette vue n'a de
               référence » sont deux faits différents, et se tromper de
               phrase serait dire quelque chose de faux. */
              <div className="py-24 text-center text-muted-foreground">
                <p className="mx-auto max-w-[52ch]">
                  {state.value === "ppp"
                    ? t(pppRefusalKey(false, error), {
                        year: state.from ?? "",
                      })
                    : t(
                        state.value === "real"
                          ? "explorer.reference.unavailable"
                          : "explorer.reference.scaleUnavailable",
                      )}
                </p>
                <button
                  type="button"
                  onClick={() => patch({ value: "", base: null, cur: "" })}
                  className="mt-4 rounded-full border px-4 py-1.5 text-[12.5px] transition-colors hover:border-accent hover:text-accent"
                >
                  {t("explorer.reference.nominal")}
                </button>
              </div>
            ) : isError || !data || data.series.length === 0 ? (
              <p className="py-24 text-center text-muted-foreground">
                {t("explorer.emptyView")}
              </p>
            ) : leafDrill ? (
              <p className="py-24 text-center text-[14px] text-muted-foreground">
                {t("explorer.donutNoChildren")}
              </p>
            ) : view === "lines" ? (
              <LinesChart
                series={shownSeries}
                unit={data.unit}
                ariaLabel={boardTitle}
                unavailableYears={excludedYears(data)}
                unavailableLabel={t("explorer.reference.bandLabel")}
                colorOf={(key) => colorByKey.get(key) ?? "var(--color-border)"}
                fullRange={state.range === "full"}
                onFullRange={(full) => patch({ range: full ? "full" : "" })}
              />
            ) : view === "bump" ? (
              <BumpChart
                series={shownSeries}
                ariaLabel={boardTitle}
                colorOf={(key) => colorByKey.get(key) ?? "var(--color-border)"}
              />
            ) : view === "delta" ? (
              <DumbbellChart
                series={shownSeries}
                unit={data.unit}
                ariaLabel={boardTitle}
              />
            ) : view === "bars" ? (
              <BarsChart
                series={shownSeries}
                unit={data.unit}
                ariaLabel={boardTitle}
              />
            ) : view === "map" ? (
              <>
                <WorldMap
                  countries={data.series
                    .filter(
                      (serie) =>
                        typeof serie.key === "string" && serie.value != null,
                    )
                    .map((serie) => ({
                      code: String(serie.key),
                      name: serie.label ?? String(serie.key),
                      eu_member: false,
                      // La région vient de l'index des pays (le référentiel
                      // backend) — jamais devinée côté front. La classe de
                      // couverture voyage avec (aspérité du mémo,
                      // 2026-08-17) : la carte de l'Explorateur hachure les
                      // financements domestiques non couverts comme toutes
                      // les cartes géographiques.
                      region:
                        countries?.find(
                          (entry) => entry.code === String(serie.key),
                        )?.region ?? null,
                      coverage: countries?.find(
                        (entry) => entry.code === String(serie.key),
                      )?.coverage,
                      projects_count: 0,
                      funding_eur: serie.value ?? 0,
                    }))}
                  flows={flows ?? []}
                  legendLabel={`${t(`explorer.metric.${state.metric}`)} · ${moneySymbol(data.unit)}`}
                  selected={mapSelected}
                  onSelect={setMapSelected}
                />
                {(() => {
                  const picked = mapSelected
                    ? data.series.find(
                        (serie) => String(serie.key) === mapSelected,
                      )
                    : null;
                  return picked ? (
                    <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border-soft pt-3 text-[13.5px]">
                      <span>
                        {countryFlag(mapSelected!)}{" "}
                        <b className="font-semibold">
                          {seriesLabel(picked, t)}
                        </b>
                        <span className="tnum ml-2 text-muted-foreground">
                          {formatValue(picked.value, data.unit, i18n.language)}
                        </span>
                      </span>
                      <Link
                        to={withLens(
                          `/explore/countries/${mapSelected}`,
                          carried,
                        )}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        {t("explorer.mapOpenCountry")} →
                      </Link>
                      <button
                        type="button"
                        aria-label={t("explorer.mapDeselect")}
                        onClick={() => setMapSelected(null)}
                        className="ml-auto rounded-md px-2 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ) : null;
                })()}
              </>
            ) : view === "donut" ? (
              <DonutChart
                series={donutSeries}
                unit={data.unit}
                total={data.total}
                ariaLabel={boardTitle}
                colorOf={
                  state.by === "region" ? (key) => regionColor(key) : undefined
                }
                onSlice={
                  state.by === "programme" && !state.programme
                    ? (key) => patch({ programme: key })
                    : undefined
                }
              />
            ) : (
              <ExploreTable data={data} temporal={temporal} />
            )}
          </div>

          {/* La légende interactive : LE contrôle de visibilité — jamais
            un clic sur la courbe. Masquer = composer sa lecture, les
            données et les tops ne bougent pas. */}
          {data && legendActive && !leafDrill && !isError ? (
            <SeriesLegend
              series={data.series}
              hidden={state.hidden}
              colorOf={(key) => colorByKey.get(key) ?? "var(--color-border)"}
              onToggle={toggleHidden}
              onShowAll={() => patch({ hidden: [] })}
            />
          ) : null}

          {/* L'honnêteté au POINT DE COMPARAISON (lot E) : la phrase naît
            quand la vue mélange des couvertures, et seulement là. */}
          {data ? <CoverageNote meta={data.meta} /> : null}
          {/* ⓘ Reference (R0 § D8) : la méthodologie au point d'usage —
            part exclue chiffrée depuis le périmètre affiché (A1) ; en
            TREND, la transformation se dit d'abord, la méthode Real
            dont elle hérite ensuite. */}
          {data ? (
            <ReferenceNote
              id="reference-note"
              data={data}
              period={{
                label: period,
                multiYear: (state.from ?? YEAR_MIN) !== (state.to ?? YEAR_MAX),
              }}
              trend={
                trend && trendMode
                  ? {
                      mode: trendMode,
                      base: canonicalBase,
                      nonIndexable: trend.nonIndexable.map((key) => {
                        const serie = data.series.find(
                          (s) => String(s.key) === key,
                        );
                        return serie ? seriesLabel(serie, t) : key;
                      }),
                    }
                  : undefined
              }
            />
          ) : null}

          <div className="mt-4 flex items-center gap-1.5 border-t border-border-soft pt-3.5">
            {availableViews.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => patch({ view: candidate })}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px]",
                  view === candidate
                    ? "bg-foreground text-background"
                    : "text-muted-foreground transition-colors hover:text-foreground",
                )}
              >
                {t(`explorer.views.${candidate}`)}
              </button>
            ))}
            <span className="ml-auto hidden text-[11.5px] text-muted-foreground sm:block">
              {t("explorer.sources")}
            </span>
          </div>
        </section>
      )}

      {/* The ready-made analyses moved to their own library (/analyses);
          the short renvoi keeps the old habit alive. */}
      <div className="mb-16 mt-14 border-t border-border-soft pt-5">
        <Link
          to={withLens("/analyses", carried)}
          className="group flex items-baseline gap-4 text-[14.5px] font-medium"
        >
          <span className="transition-colors group-hover:text-accent">
            {t("explorer.libraryLink")}
          </span>
          <span className="text-[12.5px] font-normal text-muted-foreground">
            {t("explorer.libraryCount", { count: STORIES.length })}
          </span>
          <span aria-hidden="true" className="text-accent">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
