/** B2.8 — « Où est passé cet argent ? » (docs/conception-b-chaine-argent-public.md § 15).
 *
 *  Colonnes proportionnelles : le fil d'Ariane textuel dit le chemin
 *  (ancêtres cliquables, focus en fort), les colonnes verticales
 *  disent la répartition — hauteur = montant, échelle linéaire
 *  commune, tri décroissant, godet « + N autres » cliquable, segment
 *  « non ventilé » hachuré jamais caché, hauteur plancher marquée
 *  (« ≈ ») quand le ratio d'échelle écrase une part. La géométrie du
 *  chemin ne code jamais les montants ; celle des colonnes ne code
 *  QUE les montants.
 *
 *  Le contrat métier est inchangé (B0/B1, acquis B2.2→B2.7) : le
 *  moteur fait foi ; le fil enrichi de la réponse courante
 *  reconstruit tout le chemin en UNE requête (deep-link ≡ descente,
 *  aucune dépendance au cache) ; le focus se rend d'après le niveau
 *  des DONNÉES servies, jamais d'après l'URL ; inconnu ≠ zéro ; un
 *  ratio n'existe que si le moteur le déclare valide (appel
 *  transversal : liaison sans pourcentage) ; NIH bénéficiaire, NSF
 *  double système de mesure, aucun total unique inter-financeurs ;
 *  route-outil : pas de footer, pas de défilement du document au
 *  parcours nominal desktop. URL = état du focus. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";

import { ExploreExits } from "@/components/explore-exits";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
  type ChainCallNode,
  type ChainCrumb,
  type ChainFunderBlock,
  type ChainFunderNode,
  type ChainMeasure,
  type ChainNavEntry,
  type ChainNodeShare,
  type ChainProgrammeNode,
  type ChainProjectNode,
  type ChainProvenance,
  type ChainReconciliation,
} from "@/lib/api";
import { useMeasure } from "@/hooks/use-measure";
import { childTo, crumbPath } from "@/lib/chain-routes";
import { displayLabel } from "@/lib/display-label";
import { countryFlag, formatCompactMoney, formatInt, formatOrgName } from "@/lib/format";
import { pct } from "@/lib/format-share";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
/** Au-delà de ce nombre d'enfants ENTIÈREMENT servis, le focus
 *  propose un filtre local ; jamais pour trois enfants. */
const SEARCH_THRESHOLD = 15;

const LEVELS = new Set(["funder", "programme", "call", "project", "organisation", "country"]);

type AggregateNode = ChainFunderNode | ChainProgrammeNode | ChainCallNode;

/* ------------------------------------------------------------------ */
/* Vocabulaire : clés stables du moteur → copy i18n (jamais la prose  */
/* française de l'API).                                               */

const MEASURE_KEYS = new Set([
  "ec_max_contribution",
  "ec_max_contribution_sum",
  "nih_obligations_window_sum",
  "nih_obligations_window_sum_sum",
  "nsf_obligated_cumulative",
  "nsf_obligated_cumulative_sum",
  "ec_contribution",
  "ec_contribution_sum",
  "nsf_award_obligated",
  "nsf_awards_obligated_sum",
  "nih_beneficiary_projects_total",
  "nsf_obligation_fy",
  "total_cost",
]);

function useMoneyCopy() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const money = (value: number | null | undefined, currency: string | null | undefined) =>
    formatCompactMoney(value ?? null, locale, currency === "USD" ? "usd" : "eur");
  const measureLabel = (key: string | null | undefined) =>
    key && MEASURE_KEYS.has(key) ? t(`money.measure.${key}`) : (key ?? "");
  const measureShort = (key: string | null | undefined) =>
    key && MEASURE_KEYS.has(key) ? t(`money.measureShort.${key}`) : (key ?? "");
  const natureLabel = (provenance: ChainProvenance | null | undefined) =>
    provenance ? t(`money.nature.${provenance}`) : "";
  return { t, locale, money, measureLabel, measureShort, natureLabel };
}

function usePagePatch(): [
  number,
  boolean,
  string,
  (patch: Record<string, string | null>) => void,
] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const expanded = params.get("expanded") === "1" || page > 1;
  const q = params.get("q") ?? "";
  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { preventScrollReset: true });
  };
  return [page, expanded, q, patch];
}

function shareFamily(key: string | null | undefined): "cordis" | "nih" | "nsf" | null {
  if (!key) return null;
  if (key.startsWith("ec_")) return "cordis";
  if (key.startsWith("nih_")) return "nih";
  if (key.startsWith("nsf_")) return "nsf";
  return null;
}

/* ------------------------------------------------------------------ */
/* Nature — un signal discret, jamais caché                            */

function NatureMark({ provenance }: { provenance: ChainProvenance | null | undefined }) {
  const { t } = useTranslation();
  if (!provenance) return null;
  return (
    <span
      className="cursor-help text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground underline decoration-border decoration-dotted underline-offset-[3px]"
      title={t(`money.natureHint.${provenance}`)}
    >
      {t(`money.nature.${provenance}`)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* L'inspecteur méthodologique — le détail sans quitter le contexte    */

function MethodologyPanel({
  rows,
  restrictions,
}: {
  rows: { label: string; value: string }[];
  restrictions?: string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const filtered = rows.filter((row) => row.value);
  // La carte flottante s'ancre SOUS son déclencheur (recette
  // fondatrice : le tiroir plein-droite n'était pas un geste du
  // site) — même clavier, même focus, nouvelle place.
  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">ⓘ</span>
        {t("money.methodology.title")}
      </button>
      {open ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            onClick={close}
          />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-label={t("money.methodology.title")}
            tabIndex={-1}
            className="fixed left-1/2 top-1/2 z-50 max-h-[76vh] w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border bg-surface p-6 shadow-[0_0_44px_-10px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
                {t("money.methodology.title")}
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-full border px-2.5 py-0.5 text-[12.5px] transition-colors hover:text-accent"
              >
                {t("money.methodology.close")}
              </button>
            </div>
            <dl className="mt-5 space-y-4 text-[13px] leading-relaxed">
              {filtered.map((row) => (
                <div key={row.label}>
                  <dt className="font-medium text-foreground/75">{row.label}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
            {restrictions && restrictions.length > 0 ? (
              <p className="mt-5 border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
                {restrictions.join(" ")}
              </p>
            ) : null}
            <p className="mt-6">
              <Link
                to="/about-data"
                className="text-[13px] text-accent underline-offset-2 hover:underline"
              >
                {t("money.methodology.aboutData")}
              </Link>
            </p>
          </div>
        </>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Le chemin actif                                                     */

interface PathNode {
  level: string;
  id: number | string;
  label: string;
  code?: string;
  to?: string;
  amount?: number | null;
  currency?: string | null;
  active?: boolean;
}

/** Le chemin complet — ancêtres du fil enrichi B1 + focus courant.
 *  Le fil d'Ariane ne dit que nom et montant : les parts (valides ou
 *  transversales) appartiennent au focus analytique (ShareLine). */
function pathFromSpine(ancestors: ChainCrumb[], current: PathNode): PathNode[] {
  return [
    ...ancestors.map((a) => ({
      level: a.level,
      id: a.id,
      label: a.label ?? a.code ?? String(a.id),
      code: a.code,
      to: crumbPath(a),
      amount: a.amount,
      currency: a.currency,
    })),
    { ...current, active: true },
  ];
}

/** Le fil d'Ariane textuel (B2.8) — les ancêtres du focus en une
 *  ligne sobre : « European Commission · €176B → Horizon 2020 ·
 *  €68,3B → … » ; chaque segment navigue vers son niveau, le focus
 *  courant ferme la ligne en fort. Pas de courbe, pas de point, pas
 *  d'ornement : du texte dans la grammaire Orion, coupé à l'unité de
 *  sens (nom complet en title + libellé du lien). */
function TrailBreadcrumb({ path }: { path: PathNode[] }) {
  const { t, money } = useMoneyCopy();
  return (
    <nav
      aria-label={t("money.rail.title")}
      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-6 pt-4 text-[12.5px] md:px-10"
    >
      <Link
        to="/money"
        aria-label={t("money.backToRoot")}
        className="text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">↩</span>
      </Link>
      {path.map((node, index) => {
        const amountText = node.amount != null ? money(node.amount, node.currency) : "";
        const name = displayLabel(node, 220, 12.5);
        return (
          <span
            key={`${node.level}:${node.id}`}
            className="flex items-baseline gap-x-2.5 whitespace-nowrap"
          >
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground/50">
                →
              </span>
            ) : null}
            {node.to && !node.active ? (
              <Link
                to={node.to}
                title={`${node.label}${amountText ? ` — ${amountText}` : ""}`}
                aria-label={t("money.stack.backTo", { name: node.label, amount: amountText })}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {name}
                {amountText ? (
                  <span className="tnum text-[11.5px] text-muted-foreground/80">
                    {" "}
                    · {amountText}
                  </span>
                ) : null}
              </Link>
            ) : (
              <span aria-current="page" title={node.label} className="font-semibold">
                {name}
                {amountText ? (
                  <span className="tnum text-[11.5px] font-medium text-foreground/70">
                    {" "}
                    · {amountText}
                  </span>
                ) : null}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* La coquille : fil d'Ariane au-dessus, UN focus analytique dessous   */

function TrailWorkspace({ path, children }: { path: PathNode[]; children: ReactNode }) {
  return (
    <div className="chamber-night relative flex flex-col md:h-[calc(100dvh-4rem)] md:overflow-hidden">
      {/* La chambre impose sa nuit — même en thème clair, comme la
          salle des lentilles impose la sienne — et le ciel habite
          TOUTE la page : étoiles fines + sceau d'Orion. */}
      <ChamberBackdrop />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TrailBreadcrumb path={path} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Les destinations : des lignes éditoriales, pas des cartes           */

interface DestinationItem {
  level: string;
  id: number | string;
  to: string;
  name: string;
  code?: string;
  count?: number | null;
  amount: number | null;
}

function DestinationRow({
  item,
  parentLabel,
  parentAmount,
  currency,
}: {
  item: DestinationItem;
  parentLabel: string;
  parentAmount: number | null;
  currency: string | null | undefined;
}) {
  const { t, locale, money } = useMoneyCopy();
  const share =
    parentAmount != null && parentAmount > 0 && item.amount != null
      ? (item.amount / parentAmount) * 100
      : null;
  return (
    <Link
      to={item.to}
      className="group flex items-start justify-between gap-6 border-b border-border-soft py-3.5 transition-colors hover:bg-accent-soft/40"
    >
      <span className="sr-only">{t("money.followTo", { name: item.name })} — </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-[14px] font-medium leading-snug transition-colors group-hover:text-accent">
          {item.name}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
          {item.code && item.code !== item.name ? (
            <span className="font-mono">{item.code}</span>
          ) : null}
          {item.code && item.code !== item.name && item.count != null ? " · " : null}
          {item.count != null ? (
            <span className="tnum">
              {t("money.orgProjects", { count: item.count, n: formatInt(item.count, locale) })}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-start gap-3 text-right">
        <span>
          <span className="tnum block text-[14px] font-medium leading-snug">
            {item.amount == null ? (
              <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                —
              </span>
            ) : (
              money(item.amount, currency)
            )}
          </span>
          {share != null ? (
            <span
              className="tnum mt-0.5 block text-[11.5px] text-muted-foreground"
              title={t("money.shareOf", { pct: pct(share, locale), parent: parentLabel })}
            >
              {pct(share, locale)}
              <span className="sr-only"> {t("money.ofParent", { parent: parentLabel })}</span>
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="mt-0.5 text-[13px] text-muted-foreground/50 transition-colors group-hover:text-accent"
        >
          ›
        </span>
      </span>
    </Link>
  );
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ------------------------------------------------------------------ */
/* B2.11 — la chambre de l'argent, vision « Carte stellaire »          */
/* (recette fondatrice : direction ASSUMÉE). La chambre impose sa      */
/* nuit — même en thème clair, comme la salle des lentilles impose la  */
/* sienne — la constellation d'Orion veille en sceau de fond, le       */
/* focus est l'étoile centrale et ses destinations l'entourent,        */
/* reliées par des rayons. La navigation reste DANS la page : les      */
/* étoiles glissent (transform), jamais un remontage.                  */

/** Le ciel de la chambre : étoiles fines déterministes (position,
 *  taille, scintillement — table fixe, jamais de hasard) et le sceau
 *  d'Orion — les épaules, la ceinture, les pieds — tracé en liaisons
 *  accent discrètes. Reduced-motion : tout est visible, immobile. */
const SKY_STARS: { x: number; y: number; r: number; tw?: number }[] = [
  { x: 4, y: 12, r: 1.2 }, { x: 9, y: 64, r: 1.0, tw: 5.2 }, { x: 13, y: 30, r: 1.4 },
  { x: 18, y: 82, r: 1.1 }, { x: 22, y: 18, r: 1.0, tw: 6.4 }, { x: 27, y: 52, r: 1.3 },
  { x: 32, y: 8, r: 1.1 }, { x: 36, y: 72, r: 1.0 }, { x: 41, y: 38, r: 1.5, tw: 4.6 },
  { x: 47, y: 88, r: 1.0 }, { x: 51, y: 14, r: 1.2 }, { x: 56, y: 58, r: 1.0, tw: 7.1 },
  { x: 60, y: 28, r: 1.1 }, { x: 65, y: 78, r: 1.3 }, { x: 70, y: 6, r: 1.0 },
  { x: 74, y: 46, r: 1.2, tw: 5.8 }, { x: 79, y: 90, r: 1.0 }, { x: 84, y: 22, r: 1.4 },
  { x: 88, y: 62, r: 1.0, tw: 6.9 }, { x: 93, y: 36, r: 1.2 }, { x: 97, y: 74, r: 1.0 },
];
/** Le sceau : les sept étoiles d'Orion (épaules, ceinture, pieds) en
 *  coordonnées de la fenêtre (%), et leurs liaisons. */
const ORION_SEAL = {
  stars: [
    { x: 68, y: 16, r: 2.6 }, // Bételgeuse (épaule gauche vue du ciel)
    { x: 84, y: 20, r: 2.2 }, // Bellatrix
    { x: 73.5, y: 44, r: 2.0 }, // Alnitak
    { x: 76.5, y: 47, r: 2.0 }, // Alnilam
    { x: 79.5, y: 50, r: 2.0 }, // Mintaka
    { x: 70, y: 76, r: 2.2 }, // Saïph
    { x: 87, y: 72, r: 2.8 }, // Rigel
  ],
  links: [
    [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6],
  ] as [number, number][],
};

function ChamberBackdrop() {
  return (
    <div aria-hidden="true" className="chamber-bg">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {SKY_STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r * 0.14}
            className={star.tw ? "chamber-twinkle" : undefined}
            style={star.tw ? { animationDuration: `${star.tw}s` } : undefined}
            fill="currentColor"
          />
        ))}
        <g className="chamber-seal">
          {ORION_SEAL.links.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={ORION_SEAL.stars[a].x}
              y1={ORION_SEAL.stars[a].y}
              x2={ORION_SEAL.stars[b].x}
              y2={ORION_SEAL.stars[b].y}
              stroke="var(--accent)"
              strokeOpacity="0.2"
              strokeWidth="0.08"
            />
          ))}
          {ORION_SEAL.stars.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r * 0.16}
              fill="var(--accent)"
              fillOpacity="0.75"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Nombre d'objets montrés sur la carte — au-delà, le godet
 *  « + N autres » ouvre la liste complète. */
const SHOWN_SLOTS = 11;
/** Rayon maximal d'une étoile (px) — l'AIRE dit le montant
 *  (r ∝ √montant), l'encodage proportionnel vrai du disque. */
const STAR_RMAX = 30;
/** Rayon plancher de visibilité : une part réelle mais minuscule
 *  reste une étoile visible ET marquée « ≈ », sa part réelle au
 *  title — jamais une proportion silencieusement fausse. */
const STAR_FLOOR = 5;
/** Les couleurs des destinations : la palette catégorielle VALIDÉE
 *  d'Orion (--series-*), dans l'ordre du classement. Le godet porte
 *  le neutre « autres » (--donut-others) : une porte, pas une
 *  destination ; le non-ventilé est un astre creux, en pointillés. */
const SERIES_VARS = [1, 2, 3, 4, 5, 6].map((i) => `var(--series-${i})`);

interface BarSpec {
  key: string;
  kind: "child" | "others" | "unallocated";
  name: string;
  /** Montant connu ; null = « + N autres » dont la somme cachée n'est
   *  pas connaissable honnêtement (page partielle hors invariant
   *  d'agrégation) — l'étoile reste au plancher, sans chiffre. */
  amount: number | null;
  /** Part du total du parent (%), seulement quand le parent est connu. */
  share: number | null;
  to?: string;
  onClick?: () => void;
}

interface StarSpec extends BarSpec {
  r: number;
  crushed: boolean;
  color: string | null;
}

/** L'aire de l'étoile dit le montant : r = √(montant/max) × R_MAX,
 *  ancré sur le plus grand objet du niveau — proportion de disque
 *  vraie, plancher marqué. */
function starGeometry(bars: BarSpec[]): StarSpec[] {
  const maxAmount = Math.max(...bars.map((bar) => bar.amount ?? 0), 1);
  let childRank = 0;
  return bars.map((bar) => {
    const raw =
      bar.amount != null ? Math.sqrt(bar.amount / maxAmount) * STAR_RMAX : STAR_FLOOR;
    const star: StarSpec = {
      ...bar,
      r: Math.max(STAR_FLOOR, Math.round(raw)),
      crushed: bar.amount != null && raw < STAR_FLOOR,
      color:
        bar.kind === "child"
          ? SERIES_VARS[childRank % SERIES_VARS.length]
          : bar.kind === "others"
            ? "var(--donut-others)"
            : null,
    };
    if (bar.kind === "child") childRank += 1;
    return star;
  });
}

/** La carte stellaire : le focus au centre (son total au cœur), les
 *  destinations autour sur l'anneau, reliées par des rayons. Chaque
 *  étoile est un vrai lien HTML (focusable, nommé) — la carte EST la
 *  surface accessible ; le godet est un bouton vers la liste
 *  complète. Les positions se posent en transform : au changement de
 *  niveau les étoiles GLISSENT, la page ne se remonte pas. */
function StarMap({
  stars,
  centerAmount,
  centerNote,
  currency,
  ariaLabel,
}: {
  stars: StarSpec[];
  centerAmount: number | null;
  centerNote: string;
  currency: string | null | undefined;
  ariaLabel: string;
}) {
  const { t, locale, money } = useMoneyCopy();
  const { ref, width, height } = useMeasure<HTMLDivElement>();
  const w = width || 960;
  const H = height || 470;
  const cx = w / 2;
  const cy = H / 2 - 6;
  const rx = Math.min(Math.max(w * 0.34, 210), 430);
  const ry = Math.min(Math.max(H * 0.33, 130), 235);
  const placed = stars.map((star, i) => {
    const angle = ((-90 + (360 / stars.length) * i) * Math.PI) / 180;
    return { ...star, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      className="relative h-full min-h-[440px] w-full"
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        {/* L'anneau-guide : l'ellipse où les destinations demeurent. */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        {placed.map((star) => (
          <line
            key={star.key}
            x1={cx}
            y1={cy}
            x2={star.x}
            y2={star.y}
            stroke="var(--foreground)"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
        ))}
      </svg>
      {/* Le cœur : le focus, son total. */}
      <div
        aria-hidden="true"
        className="star-glide pointer-events-none absolute left-0 top-0"
        style={{ transform: `translate(${cx}px, ${cy}px)` }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2 text-center">
          <span className="star-core mx-auto mb-2 block" />
          <span className="tnum block text-[21px] font-semibold leading-none">
            {centerAmount == null ? "—" : money(centerAmount, currency)}
          </span>
          <span className="mt-1 block max-w-[140px] text-[10.5px] leading-snug text-muted-foreground">
            {centerNote}
          </span>
        </div>
      </div>
      {placed.map((star) => {
        const amountText = star.amount == null ? "—" : money(star.amount, currency);
        const shareText = star.share == null ? "" : pct(star.share, locale);
        const floorNote =
          star.crushed && star.share != null
            ? ` ${t("money.columns.floored", { pct: pct(star.share, locale) })}`
            : "";
        const title =
          star.kind === "others"
            ? `${star.name}${shareText ? ` · ${shareText}` : ""}${floorNote}`
            : `${star.name} — ${amountText}${shareText ? ` · ${shareText}` : ""}${floorNote}`;
        const body = (
          <span className="relative block -translate-x-1/2 -translate-y-1/2 text-center">
            {/* La carte-étiquette du survol : le nom ENTIER, le
                montant, la part — révélés en grand, jamais tronqués. */}
            <span aria-hidden="true" className="star-tip">
              <span className="block max-w-[280px] whitespace-normal text-[12.5px] font-medium leading-snug">
                {star.name}
              </span>
              <span className="tnum mt-0.5 block text-[13.5px] font-semibold">
                {star.kind === "others" ? "" : amountText}
                {shareText ? (
                  <span className="ml-1.5 font-normal text-muted-foreground">{shareText}</span>
                ) : null}
              </span>
            </span>
            <span
              aria-hidden="true"
              data-orb
              className={cn(
                "mx-auto block rounded-full transition-[box-shadow,filter] duration-300",
                star.kind === "child" && "star-orb",
                star.kind === "others" && "star-door",
                star.kind === "unallocated" && "star-hollow",
              )}
              style={{
                width: star.r * 2,
                height: star.r * 2,
                "--star-tint": star.color ?? "var(--muted-foreground)",
              } as React.CSSProperties}
            />
            <span aria-hidden="true" className="mt-2 block leading-tight">
              <span className="tnum block text-[14.5px] font-semibold">
                {star.kind === "others" ? "" : amountText}
                {star.crushed ? " ≈" : ""}
              </span>
              <span className="mx-auto block max-w-[150px] truncate font-mono text-[10.5px] text-foreground/65">
                {star.name}
              </span>
              {shareText ? (
                <span className="tnum block text-[10px] text-muted-foreground">
                  {shareText}
                </span>
              ) : null}
            </span>
          </span>
        );
        const glide = { transform: `translate(${star.x}px, ${star.y}px)` };
        return star.kind === "child" && star.to ? (
          <Link
            key={star.key}
            to={star.to}
            title={title}
            aria-label={title}
            data-star="child"
            data-r={star.r}
            data-crushed={star.crushed || undefined}
            className="star-glide group absolute left-0 top-0 hover:z-20 focus-visible:z-20"
            style={glide}
          >
            {body}
          </Link>
        ) : star.kind === "others" ? (
          <button
            key={star.key}
            type="button"
            onClick={star.onClick}
            title={`${title} — ${t("money.columns.othersTitle")}`}
            aria-label={`${title} — ${t("money.columns.othersTitle")}`}
            data-star="others"
            data-r={star.r}
            className="star-glide group absolute left-0 top-0 cursor-pointer hover:z-20 focus-visible:z-20"
            style={glide}
          >
            {body}
          </button>
        ) : (
          <span
            key={star.key}
            title={title}
            data-star="unallocated"
            data-r={star.r}
            className="star-glide absolute left-0 top-0"
            style={glide}
          >
            <span className="sr-only">{title}</span>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/** La question unique du niveau, puis ses destinations : l'orbite au
 *  repos (rosace proportionnelle + légende — godet « + N autres » et
 *  segment « non ventilé » quand ils existent) ; la liste complète —
 *  recherche locale, pagination — au clic sur le godet. Le filtre
 *  local n'existe que si l'ensemble des enfants est entièrement
 *  servi. */
function DestinationsSection({
  data,
  parentLabel,
  page,
  expanded,
  q,
  patch,
}: {
  data: AggregateNode;
  parentLabel: string;
  page: number;
  expanded: boolean;
  q: string;
  patch: (changes: Record<string, string | null>) => void;
}) {
  const { t, locale, money } = useMoneyCopy();

  const children = data.children;
  const parentAmount = data.aggregate?.amount ?? null;
  const currency = data.aggregate?.measure.currency;
  const childrenLabel = t(`money.children.${children.level}`, { count: children.total });
  const items: DestinationItem[] = children.items.map((item) => ({
    level: item.level,
    id: item.id,
    to: childTo(item, { level: data.node.level, id: data.node.id }),
    name: item.label ?? item.code ?? String(item.id),
    code: item.code,
    count: item.projects ?? null,
    amount: item.amount,
  }));

  const fullyLoaded = items.length === children.total;
  const searchable = fullyLoaded && children.total > SEARCH_THRESHOLD;
  const query = searchable ? q.trim() : "";
  const matched = query
    ? items.filter((item) => normalize(`${item.name} ${item.code ?? ""}`).includes(normalize(query)))
    : items;
  const hasMore = !query && expanded && page * PAGE_SIZE < children.total;

  // ----- géométrie de l'orbite (état de repos) ----------------------
  const candidates = [...items]
    .filter((item) => item.amount != null)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const knownSumServed = candidates.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  // Résiduel « non ventilé » : uniquement quand TOUS les enfants sont
  // servis — une page partielle ne sait pas ce qui manque. Négatif
  // (dépassement) ⇒ pas de segment : les parts dépassent le plafond.
  const residual =
    fullyLoaded && parentAmount != null ? parentAmount - knownSumServed : null;
  const showResidual = residual != null && residual > 1;
  const capacity = SHOWN_SLOTS - (showResidual ? 1 : 0);
  const shown =
    candidates.length + (children.total - candidates.length > 0 ? 1 : 0) <= capacity
      ? candidates
      : candidates.slice(0, capacity - 1);
  const hiddenCount = children.total - shown.length;
  const hiddenKnownSum =
    candidates.slice(shown.length).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  // Montant du godet : exact quand tout est servi (somme des cachés) ;
  // exact aussi pour un appel paginé — invariant moteur B1 : le
  // montant d'un appel EST la somme des montants connus de tous ses
  // projets, donc parent − Σ(barres affichées) restitue les cachés.
  const othersAmount = fullyLoaded
    ? hiddenKnownSum > 0
      ? hiddenKnownSum
      : null
    : data.node.level === "call" && parentAmount != null
      ? Math.max(0, parentAmount - knownSumServed + hiddenKnownSum)
      : null;
  const shareOf = (amount: number | null) =>
    amount != null && parentAmount != null && parentAmount > 0
      ? (amount / parentAmount) * 100
      : null;

  // Coupe à l'unité de sens, puis règle de non-ambiguïté : si deux
  // colonnes du même niveau tombent sur le MÊME libellé coupé
  // (« SOCIETAL CHALLENGES » × 4 dans H2020), ces colonnes reprennent
  // leur code stable du moteur — distinct par construction. Le nom
  // complet reste au title et au libellé accessible.
  const cutNames = shown.map((item) => displayLabel({ label: item.name, code: item.code }, 250, 13));
  const nameCounts = new Map<string, number>();
  for (const name of cutNames) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  const bars: BarSpec[] = [
    ...shown.map((item, index) => ({
      key: `${item.level}:${item.id}`,
      kind: "child" as const,
      name:
        (nameCounts.get(cutNames[index]) ?? 0) > 1 && item.code
          ? displayLabel({ label: item.code, code: item.code }, 250, 13)
          : cutNames[index],
      amount: item.amount,
      share: shareOf(item.amount),
      to: item.to,
    })),
    ...(hiddenCount > 0
      ? [
          {
            key: "others",
            kind: "others" as const,
            name:
              othersAmount != null
                ? t("money.columns.others", {
                    count: hiddenCount,
                    n: formatInt(hiddenCount, locale),
                    amount: money(othersAmount, currency),
                  })
                : t("money.columns.othersNoAmount", {
                    count: hiddenCount,
                    n: formatInt(hiddenCount, locale),
                  }),
            amount: othersAmount,
            share: shareOf(othersAmount),
            onClick: () => patch({ expanded: "1" }),
          },
        ]
      : []),
    ...(showResidual
      ? [
          {
            key: "unallocated",
            kind: "unallocated" as const,
            name: t("money.columns.unallocated"),
            amount: residual,
            share: shareOf(residual),
          },
        ]
      : []),
  ];

  const listMode = expanded || Boolean(query) || bars.length === 0;
  const stars = listMode ? [] : starGeometry(bars);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* LA question sépare « comprendre le focus » de « continuer
          l'exploration » — une vraie articulation, pas une méta-ligne. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border-soft pt-5">
        <h2 className="text-[14px] font-semibold uppercase tracking-[.07em]">
          {t("money.nextQuestion")}
        </h2>
        {listMode && searchable ? (
          <input
            type="search"
            value={q}
            onChange={(event) => patch({ q: event.target.value || null, page: null })}
            placeholder={t("money.search.placeholder", {
              n: formatInt(children.total, locale),
              what: childrenLabel.toLocaleLowerCase(locale),
            })}
            aria-label={t("money.search.placeholder", {
              n: formatInt(children.total, locale),
              what: childrenLabel.toLocaleLowerCase(locale),
            })}
            className="w-[230px] border-b border-border bg-transparent py-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
          />
        ) : null}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {query
          ? `${childrenLabel} · ${formatInt(matched.length, locale)} / ${formatInt(children.total, locale)}`
          : `${childrenLabel} · ${formatInt(children.total, locale)}`}
      </p>
      <div
        className={cn(
          "mt-3 min-h-0 flex-1",
          listMode && "md:overflow-y-auto md:overscroll-contain",
        )}
      >
        {children.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("money.emptyLevel")}
          </p>
        ) : !listMode ? (
          <StarMap
            stars={stars}
            centerAmount={parentAmount}
            centerNote={childrenLabel}
            currency={currency}
            ariaLabel={childrenLabel}
          />
        ) : matched.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("money.search.noMatch")}
          </p>
        ) : (
          matched.map((item) => (
            <DestinationRow
              key={`${item.level}:${item.id}`}
              item={item}
              parentLabel={parentLabel}
              parentAmount={parentAmount}
              currency={currency}
            />
          ))
        )}
        {!query ? <Pager page={page} hasMore={hasMore} update={patch} /> : null}
        {listMode && expanded && !query && page === 1 && bars.length > 0 ? (
          <button
            type="button"
            onClick={() => patch({ expanded: null, page: null, q: null })}
            className="mt-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("money.columns.collapse")}
          </button>
        ) : null}
        <div className="space-y-1 pb-4 pt-3">
          {showResidual && !listMode ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.columns.unallocatedNote", {
                amount: money(residual, currency),
                pct: shareOf(residual) != null ? pct(shareOf(residual) as number, locale) : "",
                parent: parentLabel,
              })}
            </p>
          ) : null}
          {children.coverage && children.coverage.unknown_amount > 0 ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.listUnknown", {
                count: children.coverage.unknown_amount,
                n: formatInt(children.coverage.unknown_amount, locale),
              })}
            </p>
          ) : null}
          {children.level === "call" ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.callScopeNote")}
            </p>
          ) : null}
          {children.directly_on_parent ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.directlyOnParent", {
                count: children.directly_on_parent,
                n: formatInt(children.directly_on_parent, locale),
              })}
            </p>
          ) : null}
          {children.no_call_projects ? (
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("money.noCallProjects", {
                count: children.no_call_projects,
                n: formatInt(children.no_call_projects, locale),
              })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Réconciliation — lecture comptable progressive : une situation      */
/* banale est calme, une anomalie mérite davantage d'explication.      */

function ReconRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tnum", strong ? "font-semibold" : "font-medium")}>{value}</dd>
    </div>
  );
}

function ReconciliationBlock({
  reconciliation,
  currency,
  measureKey,
}: {
  reconciliation: ChainReconciliation;
  currency: string | null | undefined;
  measureKey?: string | null;
}) {
  const { t, locale, money } = useMoneyCopy();
  if (reconciliation.status === "not_applicable") {
    return (
      <p className="mt-8 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground/80">{t("money.reconciliation.title")}</b>{" "}
        {t("money.reconciliation.notApplicable")}
      </p>
    );
  }

  const parent = reconciliation.parent_amount;
  const knownSum = reconciliation.children_known_sum;
  const status = reconciliation.status;

  // Le cas exact sans part inconnue est TRIVIAL : trois lignes calmes.
  // « Contribution du projet » ne se dit que d'une contribution
  // (CORDIS) — les natures comptables ne s'interchangent jamais.
  if (
    status === "exact" &&
    (reconciliation.unknown_children == null || reconciliation.unknown_children === 0)
  ) {
    return (
      <section className="mt-10 max-w-[430px]">
        <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("money.reconciliation.exactTitle")}
        </h2>
        <dl className="mt-2.5 space-y-1">
          <ReconRow
            label={
              shareFamily(measureKey) === "cordis"
                ? t("money.reconciliation.exactParent")
                : t("money.reconciliation.parent")
            }
            value={parent == null ? t("money.unknown") : money(parent, currency)}
            strong
          />
          <ReconRow
            label={t("money.reconciliation.childrenSum")}
            value={knownSum == null ? t("money.unknown") : money(knownSum, currency)}
          />
        </dl>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {t("money.reconciliation.noUnallocated")}
        </p>
      </section>
    );
  }

  const zeroGap =
    status === "gap" &&
    reconciliation.unallocated != null &&
    Math.abs(reconciliation.unallocated) < 0.01;
  const exceed = status === "children_exceed_parent";
  const dash = "—";

  const rows: { label: string; value: string; strong?: boolean }[] = [
    {
      label: exceed ? t("money.reconciliation.ceiling") : t("money.reconciliation.parent"),
      value: parent == null ? t("money.unknown") : money(parent, currency),
      strong: true,
    },
    {
      label: t("money.reconciliation.childrenSum"),
      value: knownSum == null ? t("money.unknown") : money(knownSum, currency),
    },
  ];
  if (exceed) {
    rows.push({
      label: t("money.reconciliation.excess"),
      value:
        reconciliation.unallocated == null
          ? dash
          : `+${money(Math.abs(reconciliation.unallocated), currency)}`,
    });
  } else {
    rows.push({
      label: t("money.reconciliation.unallocated"),
      value:
        status === "gap" && !zeroGap && reconciliation.unallocated != null
          ? money(reconciliation.unallocated, currency)
          : dash,
    });
  }
  rows.push({
    label: t("money.reconciliation.unknownChildren"),
    value:
      reconciliation.unknown_children != null && reconciliation.unknown_children > 0
        ? formatInt(reconciliation.unknown_children, locale)
        : dash,
  });

  // Le « 43,5 % non ventilé » : arithmétique d'affichage sur la même
  // réponse — jamais un ratio entre mesures incompatibles.
  const gapShare =
    status === "gap" && !zeroGap && parent != null && parent > 0 && reconciliation.unallocated != null
      ? (reconciliation.unallocated / parent) * 100
      : null;

  // Une anomalie méthodologique (gap, dépassement, total inconnu)
  // porte le filet d'accent : elle mérite l'attention, pas une carte.
  return (
    <section className="mt-10 max-w-[460px] border-l-2 border-accent/35 pl-4">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.reconciliation.title")}
      </h2>
      <dl className="mt-2.5 space-y-1">
        {rows.map((row) => (
          <ReconRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
        ))}
      </dl>
      <p className="mt-2.5 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
        {status === "exact"
          ? t("money.reconciliation.status.exact")
          : zeroGap
            ? t("money.reconciliation.status.gap_zero", {
                count: reconciliation.unknown_children ?? 0,
              })
            : gapShare != null
              ? `${t("money.reconciliation.gapShare", { pct: pct(gapShare, locale) })} ${t(
                  "money.reconciliation.status.gap",
                )}`
              : t(`money.reconciliation.status.${status}`)}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* NSF — deux systèmes de mesure, jamais fondus                        */

function NsfSystemMeta({
  provenance,
  period,
  source,
}: {
  provenance: ChainProvenance | null | undefined;
  period: string;
  source: string;
}) {
  const { t } = useMoneyCopy();
  return (
    <dl className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
      <div>
        <dt className="sr-only">{t("money.methodology.nature")}</dt>
        <dd>
          <NatureMark provenance={provenance} />
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-medium text-foreground/60">{t("money.nsf.period")}</dt>
        <dd>{period}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="font-medium text-foreground/60">{t("money.methodology.source")}</dt>
        <dd>{source}</dd>
      </div>
    </dl>
  );
}

function NsfMeasureSystems({
  cumulative,
  axis,
}: {
  cumulative: { amount: number | null; measure: ChainMeasure };
  axis: NonNullable<ChainProjectNode["annual_obligations"]>;
}) {
  const { t, money, measureShort } = useMoneyCopy();
  return (
    <section className="mt-12">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.nsf.systemsTitle")}
      </h2>
      <div className="mt-4 grid gap-8 md:grid-cols-2 md:gap-0">
        <div className="md:pr-8">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(cumulative.measure.key)}
          </p>
          <p className="display-tight tnum mt-1.5 text-[24px] font-semibold">
            {money(cumulative.amount, "USD")}
          </p>
          <NsfSystemMeta
            provenance={cumulative.measure.provenance}
            period={t("money.nsf.cumulativeNote")}
            source={t("money.nsf.cumulativeProvenance")}
          />
        </div>
        <div className="border-border-soft md:border-l md:pl-8">
          <p className="text-[11px] font-medium uppercase tracking-[.08em] text-muted-foreground">
            {measureShort(axis.measure.key)}
          </p>
          <p className="display-tight tnum mt-1.5 text-[24px] font-semibold">
            {money(axis.window_sum, "USD")}
          </p>
          <NsfSystemMeta
            provenance={axis.measure.provenance}
            period={t("money.nsf.windowNote")}
            source={t("money.nsf.vintage", { vintage: axis.vintage })}
          />
          <table className="mt-4 w-full max-w-[320px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-[10.5px] font-semibold uppercase tracking-[.08em]">
                <th scope="col" className="py-1.5 pr-3">
                  {t("money.nsf.fy")}
                </th>
                <th scope="col" className="py-1.5 text-right">
                  {t("money.nsf.obligation")}
                </th>
              </tr>
            </thead>
            <tbody>
              {axis.fiscal_years.map((row) => (
                <tr key={row.fy} className="border-b border-border-soft">
                  <td className="tnum py-1.5 pr-3">{row.fy}</td>
                  <td className="tnum py-1.5 text-right">{money(row.amount, "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 max-w-[62ch] border-l-2 border-accent/35 pl-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("money.nsf.notDecomposition")}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Participants / bénéficiaires                                        */

function ParticipationsSection({ data }: { data: ChainProjectNode }) {
  const { t, locale, money } = useMoneyCopy();
  const beneficiary = data.children.level === "beneficiary";
  const items = data.children.items;
  const parent = data.measure.amount;

  // L'orbite des participants (B2.11) : tous les participants sont
  // servis (jamais de pagination ici) — chacun son segment coloré, la
  // pastille de rang relie l'anneau à sa rangée. Le « non ventilé »
  // vient du moteur (reconciliation.unallocated) ; un dépassement
  // (exceed) n'a PAS de segment résiduel : l'assiette s'étend à la
  // somme, le texte comptable signé dit le dépassement. NIH
  // bénéficiaire : aucun anneau — le moteur ne ventile pas.
  const shareOf = (amount: number | null) =>
    amount != null && parent != null && parent > 0 ? (amount / parent) * 100 : null;
  const participantBars: BarSpec[] = beneficiary
    ? []
    : [
        ...items
          .filter((item) => item.amount != null)
          .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
          .map((item) => ({
            key: item.source_uid,
            kind: "child" as const,
            name: displayLabel({ label: formatOrgName(item.organisation.label) }, 250, 13),
            amount: item.amount ?? null,
            share: shareOf(item.amount ?? null),
            to: `/money/organisation/${item.organisation.id}`,
          })),
        ...(data.reconciliation.status === "gap" &&
        data.reconciliation.unallocated != null &&
        data.reconciliation.unallocated > 1
          ? [
              {
                key: "unallocated",
                kind: "unallocated" as const,
                name: t("money.columns.unallocated"),
                amount: data.reconciliation.unallocated,
                share: shareOf(data.reconciliation.unallocated),
              },
            ]
          : []),
      ];
  const participantStars = participantBars.length > 0 ? starGeometry(participantBars) : [];
  // La pastille de rang relie chaque rangée à son étoile.
  const segColor = new Map(participantStars.map((star) => [star.key, star.color]));

  return (
    <section className="mt-12">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {beneficiary
          ? t("money.children.beneficiary", { count: data.children.total })
          : t("money.children.participation", { count: data.children.total })}{" "}
        · {formatInt(data.children.total, locale)}
      </h2>
      {beneficiary ? (
        <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {t("money.nih.beneficiaryNote")}
        </p>
      ) : null}
      {participantStars.length > 0 ? (
        <div className="mt-4">
          <StarMap
            stars={participantStars}
            centerAmount={parent}
            centerNote={t("money.children.participation", { count: data.children.total })}
            currency={data.measure.currency}
            ariaLabel={t("money.children.participation", { count: data.children.total })}
          />
        </div>
      ) : null}
      <div className="mt-2">
        {items.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            {beneficiary ? t("money.nih.noBeneficiary") : t("money.emptyLevel")}
          </p>
        ) : (
          items.map((item) => {
            const share =
              !beneficiary && parent != null && parent > 0 && item.amount != null
                ? (item.amount / parent) * 100
                : null;
            return (
              <div
                key={item.source_uid}
                className="flex items-baseline gap-3 border-b border-border-soft py-3"
              >
                {segColor.get(item.source_uid) ? (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: segColor.get(item.source_uid) as string }}
                  />
                ) : null}
                <span className="min-w-0 truncate text-sm leading-snug">
                  <Link
                    to={`/money/organisation/${item.organisation.id}`}
                    className="transition-colors hover:text-accent"
                  >
                    {formatOrgName(item.organisation.label)}
                  </Link>
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {item.role ?? ""}
                </span>
                {item.country ? (
                  <Link
                    to={`/money/country/${item.country}`}
                    className="shrink-0 text-[12.5px] text-muted-foreground transition-colors hover:text-accent"
                  >
                    <span aria-hidden="true">{countryFlag(item.country)}</span> {item.country}
                  </Link>
                ) : null}
                {!beneficiary ? (
                  <>
                    <span className="tnum ml-auto w-24 shrink-0 whitespace-nowrap text-right text-sm font-medium">
                      {item.amount == null ? (
                        <span className="text-muted-foreground" title={t("money.unknownAmount")}>
                          {t("money.unknown")}
                        </span>
                      ) : (
                        money(item.amount, data.measure.currency)
                      )}
                    </span>
                    <span
                      className="tnum hidden w-24 shrink-0 whitespace-nowrap text-right text-[12.5px] text-muted-foreground sm:inline"
                      title={
                        share == null
                          ? undefined
                          : t("money.ofProjectFull", { pct: pct(share, locale) })
                      }
                    >
                      {share == null ? "" : t("money.ofProject", { pct: pct(share, locale) })}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto" />
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* États & petites briques                                             */

function LoadingBlock() {
  // Le squelette mime la composition B2.8 : la ligne du fil d'Ariane,
  // l'en-tête du focus, la rampe de colonnes — jamais un layout que la
  // page n'aura pas.
  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-3 px-6 pt-4 md:px-10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="px-6 pt-6 md:px-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-1/2 max-w-[420px]" />
        <Skeleton className="mt-6 h-12 w-56" />
        <div className="mt-12 flex items-end gap-3">
          {[176, 122, 96, 74, 58, 44, 32].map((h, i) => (
            <Skeleton key={i} className="w-[72px]" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBlock({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-24 text-center">
      <p className="text-lg font-medium">{notFound ? t("money.notFound") : t("money.error")}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? t("money.notFoundHint") : t("money.errorHint")}
      </p>
      <p className="mt-6 flex items-center justify-center gap-4 text-sm">
        {!notFound ? (
          <button
            type="button"
            onClick={retry}
            className="rounded-full border px-4 py-1.5 transition-colors hover:text-accent"
          >
            {t("money.retry")}
          </button>
        ) : null}
        <Link to="/money" className="text-accent underline-offset-2 hover:underline">
          {t("money.backToRoot")}
        </Link>
      </p>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[.1em] text-accent">{children}</p>;
}

function callNotAvailableNote(t: (k: string) => string, down: ChainNavEntry[]): ReactNode {
  const call = down.find((entry) => entry.level === "call");
  if (call?.status !== "not_available") return null;
  return (
    <p className="mt-2 max-w-[62ch] text-[12px] leading-snug text-muted-foreground">
      {t("money.callNotAvailable")}
    </p>
  );
}

/** La part du nœud dans son parent, libellée par famille de mesure —
 *  juste sous le chiffre : c'est la deuxième lecture de l'écran. */
function ShareLine({
  share,
  measureKey,
}: {
  share?: ChainNodeShare | null;
  measureKey: string | null | undefined;
}) {
  const { t, locale } = useMoneyCopy();
  const family = shareFamily(measureKey);
  if (share == null || share.ratio == null || !family) return null;
  return (
    <p className="tnum mt-1.5 text-[13.5px] font-medium text-foreground/85">
      {t(`money.shareLine.${family}`, {
        pct: pct(share.ratio * 100, locale),
        parent: share.parent.label ?? "",
      })}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Racine — la surface de départ, sans ancêtre                         */

function FundersRoot() {
  const { t, locale, money, measureShort } = useMoneyCopy();
  const query = useQuery({ queryKey: ["chain-funders"], queryFn: api.chainFunders });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const { funders, cross_funder_total } = query.data;
  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)] md:overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-10 md:px-16 md:py-14">
        <div className="mx-auto w-full max-w-[860px]">
          <Eyebrow>{t("money.eyebrow")}</Eyebrow>
          <h1 className="display-tight mt-2 text-[clamp(30px,4vw,44px)] font-semibold">
            {t("money.title")}
          </h1>
          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {t("money.lead")}
          </p>
          <p className="mt-10 text-[13px] font-semibold uppercase tracking-[.08em]">
            {t("money.rootGesture")}
          </p>
          {/* Trois univers NON comparables : trois portes, chacune dans
              sa mesure et sa devise — aucun classement, aucun total. */}
          <div className="mt-2">
            {funders.map((funder) => (
              <Link
                key={funder.id}
                to={`/money/funder/${funder.id}`}
                className="group relative flex items-center justify-between gap-8 border-b border-border-soft py-7"
              >
                <span className="min-w-0">
                  <span className="block text-[21px] font-medium leading-snug transition-colors group-hover:text-accent">
                    {funder.label}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-muted-foreground">
                    {measureShort(funder.aggregate.measure.key)}
                    {" · "}
                    <span className="tnum">
                      {t("money.rootProjects", {
                        count: funder.aggregate.projects,
                        n: formatInt(funder.aggregate.projects, locale),
                      })}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="tnum text-[24px] font-semibold">
                    {money(funder.aggregate.amount, funder.aggregate.measure.currency)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-[16px] text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    ›
                  </span>
                </span>
                {/* La hairline mobile du survol : l'accent dit l'action. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-[-1px] left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100"
                />
              </Link>
            ))}
          </div>
          {!cross_funder_total.available ? (
            <p className="mt-7 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
              <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
              {t("money.noTotalBody")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Focus agrégé : financeur, programme, appel                          */

function AggregateFocus({ level, id }: { level: "funder" | "programme" | "call"; id: string }) {
  const { t, locale, money, measureLabel, measureShort } = useMoneyCopy();
  const [page, expanded, q, patch] = usePagePatch();
  const [params] = useSearchParams();
  const programmeContext = level === "call" ? params.get("programme") : null;
  const query = useQuery<AggregateNode>({
    queryKey:
      level === "funder"
        ? ["chain-funder", id]
        : level === "programme"
          ? ["chain-programme", id, page]
          : ["chain-call", id, programmeContext, page],
    queryFn: () => {
      if (level === "funder") return api.chainFunder(id);
      const search = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (level === "call" && programmeContext) search.set("programme", programmeContext);
      return level === "programme" ? api.chainProgramme(id, search) : api.chainCall(id, search);
    },
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  // Pendant le vol d'une navigation, `placeholderData` sert encore le
  // nœud PRÉCÉDENT (l'Outlet reste monté sur les routes-outil) : tout
  // le rendu se type d'après le niveau des DONNÉES servies, jamais
  // d'après l'URL — l'ancienne disposition reste cohérente jusqu'à
  // l'arrivée du nouveau focus, qui déclenche le morphing.
  const shown = data.node.level as "funder" | "programme" | "call";
  const label =
    shown === "funder"
      ? (data as ChainFunderNode).node.label
      : shown === "call"
        ? (data as ChainCallNode).node.code
        : ((data as ChainProgrammeNode).node.label ?? (data as ChainProgrammeNode).node.code);
  const path = pathFromSpine(data.ancestors, {
    level: shown,
    id: data.node.id,
    label,
    code: "code" in data.node ? data.node.code : undefined,
    amount: data.aggregate?.amount,
    currency: data.aggregate?.measure.currency,
  });
  const call = shown === "call" ? (data as ChainCallNode) : null;
  const transversal = Boolean(call && call.programmes.length > 1 && !call.context);
  const funderCode =
    shown === "funder"
      ? String(data.node.id)
      : shown === "programme"
        ? (data as ChainProgrammeNode).node.funder
        : (data as ChainCallNode).node.funder;
  const coverage = data.aggregate?.coverage;
  const coverageText =
    data.aggregate && coverage
      ? `${
          coverage.unknown_amount > 0
            ? t("money.coverageLine", {
                count: coverage.unknown_amount,
                projects: formatInt(data.aggregate.projects, locale),
                unknown: formatInt(coverage.unknown_amount, locale),
              })
            : t("money.coverageFull", { projects: formatInt(data.aggregate.projects, locale) })
        } ${t("money.sumObserved")}`
      : "";

  return (
    <TrailWorkspace path={path}>
      {/* Pas de clé de remontage : la page RESTE — les étoiles
          glissent quand le niveau change (recette fondatrice). La
          carte tient à l'écran : l'astre se range en colonne, la
          carte prend toute la hauteur restante. */}
      <div className="flex h-full min-h-0 flex-col px-6 pb-4 pt-6 md:px-10 xl:flex-row xl:gap-12">
        <header className="flex w-full max-w-[980px] shrink-0 flex-col xl:w-[360px] xl:justify-center xl:pb-16">
          <Eyebrow>
            {t(`money.levels.${shown}`)}
            {"code" in data.node && data.node.code !== label ? (
              <>
                {" "}
                · <span className="font-mono normal-case">{data.node.code}</span>
              </>
            ) : null}
          </Eyebrow>
          <h1
            className={cn(
              "chamber-neon display-tight mt-1.5 text-[clamp(23px,2.4vw,31px)] font-semibold",
              shown === "call" ? "font-mono text-[clamp(17px,1.8vw,22px)]" : undefined,
            )}
          >
            {label}
          </h1>
          {/* Le bloc-chiffre : une étiquette de mesure AU-DESSUS, le
              chiffre en roi (halo froid, jamais un dégradé), la part
              juste dessous — la grammaire d'une fiche de référence. */}
          <div className="mt-7 border-t border-border-soft pt-5">
            <p className="text-[10.5px] font-medium uppercase tracking-[.16em] text-muted-foreground">
              {measureShort(data.aggregate?.measure.key)}
            </p>
            <p className="chamber-figure display-tight tnum mt-2 text-[clamp(38px,3.8vw,54px)] font-semibold leading-none">
              {data.aggregate?.amount == null ? (
                <span title={t("money.unknownAmount")}>—</span>
              ) : (
                money(data.aggregate.amount, data.aggregate.measure.currency)
              )}
            </p>
            <ShareLine share={data.share_of_parent} measureKey={data.aggregate?.measure.key} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-soft pt-4 text-[13px] text-muted-foreground">
            <NatureMark provenance={data.aggregate?.measure.provenance} />
            <MethodologyPanel
              rows={[
                {
                  label: t("money.methodology.measure"),
                  value: measureLabel(data.aggregate?.measure.key),
                },
                { label: t("money.methodology.coverage"), value: coverageText },
                ...(shown === "call"
                  ? [
                      {
                        label: t("money.methodology.callLink"),
                        value: t("money.callReconstructed"),
                      },
                      { label: t("money.methodology.notBudget"), value: t("money.notEnvelope") },
                      ...(transversal && call
                        ? [
                            {
                              label: t("money.methodology.comparability"),
                              value: t("money.callTransversal", {
                                count: call.programmes.length,
                              }),
                            },
                          ]
                        : []),
                    ]
                  : [
                      {
                        label: t("money.methodology.programmeSemantics"),
                        value: t(`money.programmeSemantics.${funderCode}`),
                      },
                      { label: t("money.methodology.notBudget"), value: t("money.notBudget") },
                    ]),
                { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
              ]}
            />
          </div>
          {callNotAvailableNote(t, data.navigation.down)}
          {call?.context ? (
            <p className="mt-2 max-w-[62ch] text-[12px] leading-snug text-muted-foreground">
              {t("money.callContextNote")}{" "}
              <Link to={`/money/call/${call.node.id}`} className="text-accent hover:underline">
                {t("money.callContextAll")}
              </Link>
            </p>
          ) : null}
          {transversal && call ? (
            <p className="mt-2 max-w-[68ch] text-[12px] leading-snug text-muted-foreground">
              {t("money.transversalShort")} {t("money.callProgrammesServed")}{" "}
              {call.programmes.map((programme, index) => (
                <span key={programme.id}>
                  {index > 0 ? " · " : ""}
                  <Link
                    to={`/money/call/${call.node.id}?programme=${programme.id}`}
                    className="font-mono text-[11px] transition-colors hover:text-accent"
                  >
                    {programme.code}
                    <span className="tnum"> ({formatInt(programme.projects, locale)})</span>
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </header>
        <div className="mt-2 flex w-full max-w-[1240px] min-h-0 flex-1 flex-col xl:mt-0 xl:max-w-none">
          <DestinationsSection
            data={data}
            parentLabel={label}
            page={page}
            expanded={expanded}
            q={q}
            patch={patch}
          />
        </div>
      </div>
    </TrailWorkspace>
  );
}

/* ------------------------------------------------------------------ */
/* Focus projet : le focus terminal analytique                         */

function ProjectFocus({ id }: { id: string }) {
  const { t, locale, money, measureLabel, measureShort, natureLabel } = useMoneyCopy();
  const query = useQuery({
    queryKey: ["chain-project", id],
    queryFn: () => api.chainProject(id),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const path = pathFromSpine(data.ancestors, {
    level: "project",
    id: data.node.id,
    label: data.node.label,
    // Dernier recours de la cascade pour un titre long sans acronyme
    // (NIH/NSF) : le code stable de la source, jamais une coupe en
    // plein titre.
    code: data.node.source_id,
    amount: data.measure.amount,
    currency: data.measure.currency,
  });
  const dates =
    data.node.start_date || data.node.end_date
      ? [data.node.start_date, data.node.end_date]
          .map((d) =>
            d ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d)) : "…",
          )
          .join(" → ")
      : null;
  const attribution = data.node.programme?.attribution;

  return (
    <TrailWorkspace path={path}>
      <div
        key={`project:${data.node.id}`}
        className="focus-in h-full min-h-0 overflow-y-auto px-6 pb-10 pt-6 md:px-10"
      >
        {/* Recomposition (recette fondatrice) : l'identité du projet
            en colonne à gauche, la scène — sortie « fiche projet » en
            tête à droite, réconciliation, carte des participants — à
            droite. Rien de plat, rien de perdu en bas. */}
        <div className="xl:flex xl:gap-14">
        <div className="max-w-[720px] xl:w-[350px] xl:shrink-0">
          <Eyebrow>
            {t("money.levels.project")} ·{" "}
            <span className="font-mono normal-case">{data.node.source_id}</span>
          </Eyebrow>
          <h1 className="chamber-neon display-tight mt-1.5 text-[clamp(23px,2.4vw,31px)] font-semibold">
            {data.node.label}
          </h1>
          {data.node.title !== data.node.label ? (
            <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-muted-foreground">
              {data.node.title}
            </p>
          ) : null}
          {dates ? <p className="tnum mt-1.5 text-[12.5px] text-muted-foreground">{dates}</p> : null}
          <div className="mt-7 border-t border-border-soft pt-5">
            <p className="text-[10.5px] font-medium uppercase tracking-[.16em] text-muted-foreground">
              {measureShort(data.measure.key)}
            </p>
            <p className="chamber-figure display-tight tnum mt-2 text-[clamp(38px,3.8vw,54px)] font-semibold leading-none">
              {data.measure.amount == null ? (
                <span title={t("money.unknownAmount")}>—</span>
              ) : (
                money(data.measure.amount, data.measure.currency)
              )}
            </p>
            <ShareLine share={data.share_of_parent} measureKey={data.measure.key} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-soft pt-4 text-[13px] text-muted-foreground">
            <NatureMark provenance={data.measure.provenance} />
            <MethodologyPanel
              rows={[
                { label: t("money.methodology.measure"), value: measureLabel(data.measure.key) },
                {
                  label: t("money.methodology.nature"),
                  value: natureLabel(data.measure.provenance),
                },
                {
                  label: t("money.methodology.attribution"),
                  value: attribution?.provenance
                    ? attribution.provenance === "derived"
                      ? t("money.attributionDerived")
                      : data.node.source.startsWith("cordis")
                        ? t("money.attributionSource")
                        : t("money.attributionDirect")
                    : "",
                },
                { label: t("money.methodology.source"), value: data.node.source },
                {
                  label: t("money.methodology.eurObserved"),
                  value:
                    data.measure.currency === "USD" && data.amount_eur_observed.amount != null
                      ? `${money(data.amount_eur_observed.amount, "EUR")} — ${t("money.eurObservedNote")}`
                      : "",
                },
              ]}
            />
          </div>
          {callNotAvailableNote(t, data.navigation.down)}
          {data.total_cost ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              {t("money.totalCost")}{" "}
              {data.total_cost.status === "available" ? (
                <span className="tnum font-medium text-foreground">
                  {money(data.total_cost.amount, "EUR")}
                </span>
              ) : data.total_cost.status === "not_available" ? (
                <span title={t("money.totalCostZeroHint")}>{t("money.notAvailable")}</span>
              ) : (
                <span title={t("money.unknownAmount")}>{t("money.unknown")}</span>
              )}
            </p>
          ) : null}
        </div>
        <div className="mt-8 min-w-0 flex-1 xl:mt-0">
          {/* La sortie vers la fiche projet : en tête à droite,
              toujours visible, mise en valeur — jamais perdue en bas. */}
          <div className="flex justify-start xl:justify-end">
            <Link to={`/projects/${data.node.id}`} className="chamber-cta">
              {t("money.projectSheet")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ReconciliationBlock
            reconciliation={data.reconciliation}
            currency={data.measure.currency}
            measureKey={data.measure.key}
          />
          <ParticipationsSection data={data} />
          {data.annual_obligations ? (
            <NsfMeasureSystems
              cumulative={{ amount: data.measure.amount, measure: data.measure }}
              axis={data.annual_obligations}
            />
          ) : null}
        </div>
        </div>
      </div>
    </TrailWorkspace>
  );
}

/* ------------------------------------------- organisation / pays (transverse) */

/** Les relations de financement d'une entité transverse : une ligne
 *  par financeur, chacune dans sa mesure et sa devise — plusieurs
 *  chaînes convergent ici, aucun morphing descendant forcé, aucun
 *  total unique. Chaque financeur ouvre sa propre branche. */
function FunderRelations({ blocks }: { blocks: ChainFunderBlock[] }) {
  const { t, locale, money, measureShort } = useMoneyCopy();
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("money.orgRelations")}
      </h2>
      <div className="mt-2 max-w-[620px]">
        {blocks.map((block) => (
          <Link
            key={block.funder}
            to={`/money/funder/${block.funder}`}
            className="group flex items-baseline justify-between gap-6 border-b border-border-soft py-3.5"
          >
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium leading-snug transition-colors group-hover:text-accent">
                {t(`money.funderNames.${block.funder}`)}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                {block.amount == null ? t("money.unknownShare") : measureShort(block.measure.key)}
              </span>
              <span className="tnum block text-[11.5px] text-muted-foreground">
                {t("money.orgProjects", {
                  count: block.projects,
                  n: formatInt(block.projects, locale),
                })}
                {" · "}
                {t("money.orgParticipations", {
                  count: block.participations,
                  n: formatInt(block.participations, locale),
                })}
                {block.coverage.unknown_amount > 0
                  ? ` · ${t("money.orgUnknownCount", {
                      n: formatInt(block.coverage.unknown_amount, locale),
                    })}`
                  : ""}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="tnum text-[15px] font-semibold">
                {block.amount == null ? (
                  <span className="text-muted-foreground" title={t("money.unknownShare")}>
                    {t("money.unknown")}
                  </span>
                ) : (
                  money(block.amount, block.measure.currency)
                )}
              </span>
              <span
                aria-hidden="true"
                className="text-[13px] text-muted-foreground/50 transition-colors group-hover:text-accent"
              >
                ›
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NoTotalNote() {
  const { t } = useTranslation();
  return (
    <p className="mt-6 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
      <b className="font-medium text-foreground/80">{t("money.noTotalTitle")}</b>{" "}
      {t("money.noTotalBody")}
    </p>
  );
}

function TransverseShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)] md:overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-12">
        <p className="text-[12.5px]">
          <Link
            to="/money"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ↩ {t("money.backToRoot")}
          </Link>
        </p>
        <div className="mt-6 max-w-[760px]">{children}</div>
      </div>
    </div>
  );
}

function OrganisationView({ id }: { id: string }) {
  const { t } = useMoneyCopy();
  const query = useQuery({
    queryKey: ["chain-organisation", id],
    queryFn: () => api.chainOrganisation(id),
  });
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const label = formatOrgName(data.node.label);
  return (
    <TransverseShell>
      <Eyebrow>{t("money.levels.organisation")}</Eyebrow>
      <h1 className="display-tight mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold">
        {data.node.country ? (
          <span aria-hidden="true" className="mr-2">
            {countryFlag(data.node.country)}
          </span>
        ) : null}
        {label}
      </h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{t("money.orgLead")}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
            { label: t("money.methodology.dedup"), value: t("money.dedupNote") },
          ]}
        />
      </div>
      {data.by_funder.length === 0 ? (
        <p className="py-14 text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <FunderRelations blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits exits={[{ label: t("money.orgSheet"), to: `/organisations/${data.node.id}` }]} />
    </TransverseShell>
  );
}

function CountryView({ code }: { code: string }) {
  const { t, locale } = useMoneyCopy();
  const { i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["chain-country", code],
    queryFn: () => api.chainCountry(code),
  });
  const countryName =
    new Intl.DisplayNames([i18n.language], { type: "region" }).of(code.toUpperCase()) ??
    code.toUpperCase();
  if (query.isPending) return <LoadingBlock />;
  if (query.isError || !query.data)
    return <ErrorBlock error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <TransverseShell>
      <Eyebrow>{t("money.levels.country")}</Eyebrow>
      <h1 className="display-tight mt-1 text-[clamp(22px,2.4vw,30px)] font-semibold">
        <span aria-hidden="true" className="mr-2">
          {countryFlag(data.node.id)}
        </span>
        {countryName}
      </h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{t("money.countryOrgs", { n: formatInt(data.organisations, locale) })}</span>
        <MethodologyPanel
          rows={[
            { label: t("money.methodology.country"), value: t("money.countryDestination") },
            { label: t("money.methodology.comparability"), value: t("money.noTotalBody") },
          ]}
        />
      </div>
      <p className="mt-2 max-w-[68ch] text-[12px] leading-snug text-muted-foreground">
        {t("money.countryDestination")}
      </p>
      {data.by_funder.length === 0 ? (
        <p className="py-14 text-sm text-muted-foreground">{t("money.emptyLevel")}</p>
      ) : (
        <FunderRelations blocks={data.by_funder} />
      )}
      {!data.cross_funder_total.available ? <NoTotalNote /> : null}
      <ExploreExits exits={[{ label: t("money.countrySheet"), to: `/countries/${data.node.id}` }]} />
    </TransverseShell>
  );
}

/* ------------------------------------------------------------------ */

export function MoneyTrailPage() {
  const { level, id } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  // Surface hors lentille : `lens=` n'a pas cours ici et la porte est
  // canonicalisée (même doctrine que R5B) — l'URL canonique fait foi.
  useEffect(() => {
    if (params.has("lens")) {
      const next = new URLSearchParams(params);
      next.delete("lens");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);
  if (!level) return <FundersRoot />;
  if (!LEVELS.has(level) || !id) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 py-24 text-center">
        <p className="text-lg font-medium">{t("money.notFound")}</p>
        <p className="mt-6 text-sm">
          <Link to="/money" className="text-accent underline-offset-2 hover:underline">
            {t("money.backToRoot")}
          </Link>
        </p>
      </div>
    );
  }
  switch (level) {
    case "funder":
    case "programme":
    case "call":
      return <AggregateFocus level={level} id={id} />;
    case "project":
      return <ProjectFocus id={id} />;
    case "organisation":
      return <OrganisationView id={id} />;
    default:
      return <CountryView code={id} />;
  }
}
