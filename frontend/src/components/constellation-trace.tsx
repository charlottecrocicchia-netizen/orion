/** B2.7 — la Constellation Trace (docs/conception-b-chaine-argent-public.md § 15.12).
 *
 *  Le chemin parcouru dans la chaîne devient une constellation de
 *  navigation : des nœuds, des liens, des labels, une branche active,
 *  des bifurcations temporaires. La géométrie représente le PARCOURS,
 *  jamais la quantité financière (les montants restent textuels ;
 *  tous les liens ont la même épaisseur). Le layout est déterministe
 *  (src/lib/constellation-layout.ts) : même chemin + même largeur →
 *  mêmes coordonnées ; aucun moteur physique.
 *
 *  Répartition des techniques (§ 16 du brief) : le SVG ne porte que
 *  les LIENS (couches actives / sortantes / preview, `aria-hidden`,
 *  Bézier normalisées `pathLength="1"`) ; les nœuds et leurs labels
 *  sont du HTML positionné — typographie Orion, noms longs, semantic
 *  zoom, primitives clavier standard. Chaque nœud est UN wrapper
 *  transformé : le point et son label bougent d'un seul mouvement.
 *
 *  Le moteur de transition (src/lib/constellation-engine.ts, commit
 *  b5d4831) fait foi : à chaque changement de chemin, une transaction
 *  begin/commit produit persist / exit / enter autour du pivot LCP.
 *  Les nœuds persistants GLISSENT (transition de transform — le même
 *  élément, jamais démonté) ; l'ancienne branche se résorbe vers le
 *  pivot (couche sortante, opacité + léger déplacement, liens
 *  dash-out) ; la nouvelle pousse depuis le pivot (animations d'
 *  entrée au montage). La fin des sorties fait avancer le moteur ;
 *  un unique filet de sécurité força l'atterrissage si un événement
 *  d'animation se perd — jamais d'état `entering` permanent, jamais
 *  de nœud fantôme. `prefers-reduced-motion` : état final instantané.
 *
 *  Les bifurcations (§ 11-13) : cliquer un nœud ancêtre RÉVÈLE ses
 *  principales destinations (chargées à la demande par les MÊMES clés
 *  de cache que les vues — une descente par clics a déjà tout) plus
 *  « revenir à ce niveau ». Couche à part : les previews ne déplacent
 *  pas les nœuds actifs et ne touchent JAMAIS le chemin committé —
 *  seule la sélection d'un lien navigue. Escape referme. */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  ConstellationEngine,
  constellationKey,
  type ConstellationNode,
} from "@/lib/constellation-engine";
import {
  layoutPreviews,
  layoutTracePath,
  linkPath,
  type ConstellationPoint,
} from "@/lib/constellation-layout";
import { childTo, crumbPath } from "@/lib/chain-routes";
import { pct } from "@/lib/format-share";
import { api, type ChainCallNode, type ChainFunderNode, type ChainProgrammeNode } from "@/lib/api";
import { formatCompactMoney } from "@/lib/format";
import { useMeasure } from "@/hooks/use-measure";
import { cn } from "@/lib/utils";

export interface ConstellationPathNode {
  level: string;
  id: number | string;
  label: string;
  code?: string;
  to?: string;
  amount?: number | null;
  currency?: string | null;
  share?: number | null;
  /** Liaison structurelle sans ratio valide (appel transversal). */
  transversal?: boolean;
  active?: boolean;
}

type AggregateNode = ChainFunderNode | ChainProgrammeNode | ChainCallNode;

const PREVIEW_COUNT = 3;

function previewQuery(node: ConstellationPathNode): {
  queryKey: (string | number | null)[];
  queryFn: () => Promise<AggregateNode>;
} {
  const id = String(node.id);
  if (node.level === "funder") {
    return { queryKey: ["chain-funder", id], queryFn: () => api.chainFunder(id) };
  }
  if (node.level === "programme") {
    return {
      queryKey: ["chain-programme", id, 1],
      queryFn: () => api.chainProgramme(id, new URLSearchParams({ page: "1", size: "50" })),
    };
  }
  return {
    queryKey: ["chain-call", id, null, 1],
    queryFn: () => api.chainCall(id, new URLSearchParams({ page: "1", size: "50" })),
  };
}

interface PreviewItem {
  key: string;
  label: string;
  amount: number | null;
  currency: string | null | undefined;
  to: string;
  self?: boolean;
}

interface ExitingNode {
  key: string;
  point: ConstellationPoint;
  dx: number;
  dy: number;
}

interface ExitingLink {
  key: string;
  d: string;
}

function useMoneyText() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return {
    locale,
    money: (value: number | null | undefined, currency: string | null | undefined) =>
      formatCompactMoney(value ?? null, locale, currency === "USD" ? "usd" : "eur"),
  };
}

/** Le nom court d'un nœud compacté : le nom réel s'il tient, sinon le
 *  code stable du moteur — jamais une troncature qui rend deux
 *  niveaux indistincts. Le nom complet reste dans l'accessibilité. */
function shortLabel(node: ConstellationPathNode): string {
  if (node.code && node.label.length > 26) return node.code;
  return node.label;
}

export function ConstellationTrace({ path }: { path: ConstellationPathNode[] }) {
  const { t } = useTranslation();
  const { locale, money } = useMoneyText();
  const queryClient = useQueryClient();
  const { ref, width } = useMeasure<HTMLDivElement>();
  const measured = width || 960;

  const layout = layoutTracePath(path.length, measured);
  const keys = path.map((node) => constellationKey(node));
  const signature = keys.join("→");

  const engineRef = useRef<ConstellationEngine<ConstellationNode> | null>(null);
  if (engineRef.current == null) {
    engineRef.current = new ConstellationEngine<ConstellationNode>(path);
  }
  const prevRef = useRef<{ keys: string[]; points: Map<string, ConstellationPoint> } | null>(null);
  const [exitingNodes, setExitingNodes] = useState<ExitingNode[]>([]);
  const [exitingLinks, setExitingLinks] = useState<ExitingLink[]>([]);
  const exitRemaining = useRef(0);
  const safetyRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ key: string; items: PreviewItem[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const previewToken = useRef(0);

  const finishTransition = () => {
    if (safetyRef.current != null) {
      window.clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    setExitingNodes([]);
    setExitingLinks([]);
    const engine = engineRef.current;
    if (engine) {
      let phase = engine.state.phase;
      while (phase !== "idle" && phase !== "loading_target") phase = engine.advance();
    }
  };

  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const points = new Map(keys.map((key, index) => [key, layout.points[index]]));
    const prev = prevRef.current;
    prevRef.current = { keys, points };
    if (prev == null || prev.keys.join("→") === signature) return;
    // Le chemin committé a changé : transaction unique via le moteur.
    setPreview(null);
    const tx = engine.beginNavigation(keys[keys.length - 1] ?? "root");
    const plan = engine.commitPath(tx, path.map((n) => ({ level: n.level, id: n.id })));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (plan == null || plan.phases.length === 0 || reduced) {
      finishTransition();
      engine.settle();
      return;
    }
    // La couche sortante : l'ancienne branche, aux ANCIENNES
    // positions, se résorbe vers le pivot.
    const persistSet = new Set(plan.persist.map((n) => constellationKey(n)));
    const pivotPoint = plan.pivot ? prev.points.get(constellationKey(plan.pivot)) : null;
    const nodes: ExitingNode[] = [];
    for (const exitNode of plan.exit) {
      const key = constellationKey(exitNode);
      const from = prev.points.get(key);
      if (from == null) continue;
      const towardX = pivotPoint ? pivotPoint.x - from.x : -40;
      const towardY = pivotPoint ? pivotPoint.y - from.y : 0;
      const norm = Math.max(1, Math.hypot(towardX, towardY));
      nodes.push({
        key,
        point: from,
        dx: (towardX / norm) * 26,
        dy: (towardY / norm) * 26,
      });
    }
    const links: ExitingLink[] = [];
    for (let i = 0; i < prev.keys.length - 1; i += 1) {
      const childKey = prev.keys[i + 1];
      if (persistSet.has(childKey)) continue;
      const from = prev.points.get(prev.keys[i]);
      const to = prev.points.get(childKey);
      if (from && to) links.push({ key: `x:${childKey}`, d: linkPath(from, to) });
    }
    exitRemaining.current = nodes.length;
    setExitingNodes(nodes);
    setExitingLinks(links);
    if (safetyRef.current != null) window.clearTimeout(safetyRef.current);
    // L'unique filet de sécurité : si un animationend se perd
    // (onglet caché…), la transaction atterrit quand même — jamais
    // d'`entering` permanent.
    safetyRef.current = window.setTimeout(finishTransition, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, measured]);

  useEffect(() => () => finishTransition(), []); // démontage : atterrissage
  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preview == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const onExitEnd = () => {
    exitRemaining.current -= 1;
    if (exitRemaining.current <= 0) {
      engineRef.current?.advance();
      finishTransition();
    }
  };

  const openPreview = async (node: ConstellationPathNode, index: number) => {
    const key = constellationKey(node);
    if (preview?.key === key) {
      setPreview(null);
      return;
    }
    const committedChild = path[index + 1];
    const committedChildKey = committedChild ? constellationKey(committedChild) : null;
    const token = (previewToken.current += 1);
    setPreviewLoading(key);
    try {
      const { queryKey, queryFn } = previewQuery(node);
      const data = await queryClient.fetchQuery({ queryKey, queryFn, staleTime: 60_000 });
      if (previewToken.current !== token) return; // intention plus récente
      const alternatives: PreviewItem[] = data.children.items
        .filter((item) => constellationKey(item) !== committedChildKey)
        .slice(0, PREVIEW_COUNT)
        .map((item) => ({
          key: constellationKey(item),
          label: item.label ?? item.code ?? String(item.id),
          amount: item.amount,
          currency: data.aggregate?.measure.currency,
          to: childTo(item, node),
        }));
      setPreview({
        key,
        items: [
          {
            key: `self:${key}`,
            label: node.label,
            amount: node.amount ?? null,
            currency: node.currency,
            to: node.to ?? crumbPath(node),
            self: true,
          },
          ...alternatives,
        ],
      });
    } finally {
      if (previewToken.current === token) setPreviewLoading(null);
    }
  };

  const previewPivotIndex = preview ? keys.indexOf(preview.key) : -1;
  const previewSlots =
    preview && previewPivotIndex >= 0
      ? layoutPreviews(layout.points[previewPivotIndex], preview.items.length, layout.height)
      : [];

  return (
    <nav
      aria-label={t("money.rail.title")}
      className="hidden shrink-0 border-b border-border-soft md:block"
    >
      <div ref={ref} className="relative mx-auto w-full" style={{ height: layout.height }}>
        <svg
          aria-hidden="true"
          width={measured}
          height={layout.height}
          className="absolute inset-0"
        >
          <g data-clayer="exiting">
            {exitingLinks.map((link) => (
              <path
                key={link.key}
                d={link.d}
                pathLength={1}
                className="const-link const-link-out text-muted-foreground/40"
                stroke="currentColor"
              />
            ))}
          </g>
          <g data-clayer="active">
            {path.slice(1).map((_node, index) => (
              <path
                key={`l:${keys[index + 1]}`}
                data-clink="active"
                d={linkPath(layout.points[index], layout.points[index + 1])}
                pathLength={1}
                className="const-link const-link-in text-accent/45"
                stroke="currentColor"
                style={{ d: `path("${linkPath(layout.points[index], layout.points[index + 1])}")` }}
              />
            ))}
          </g>
          <g data-clayer="preview">
            {preview && previewPivotIndex >= 0
              ? previewSlots.map((slot, j) => (
                  <path
                    key={`p:${preview.items[j].key}`}
                    data-clink="preview"
                    d={linkPath(layout.points[previewPivotIndex], slot)}
                    pathLength={1}
                    className="const-link const-link-in text-border"
                    stroke="currentColor"
                  />
                ))
              : null}
          </g>
        </svg>

        {/* La couche sortante : points aux anciennes positions, qui se
            résorbent vers le pivot. */}
        {exitingNodes.map((exit) => (
          <span
            key={exit.key}
            data-cexit={exit.key}
            className="const-node pointer-events-none absolute left-0 top-0"
            style={{ transform: `translate(${exit.point.x}px, ${exit.point.y}px)` }}
          >
            <span
              className="const-node-out block h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60"
              style={
                {
                  "--exit-dx": `${exit.dx}px`,
                  "--exit-dy": `${exit.dy}px`,
                } as CSSProperties
              }
              onAnimationEnd={onExitEnd}
            />
          </span>
        ))}

        {/* Le chemin actif : chaque nœud est un élément STABLE (clé par
            nœud) — il glisse, il ne réapparaît pas. */}
        <ol className="m-0 list-none p-0">
          {path.map((node, index) => {
            const distance = path.length - 1 - index;
            const point = layout.points[index];
            const isFocus = distance === 0;
            const amountText = node.amount != null ? money(node.amount, node.currency) : "";
            const shareText =
              node.share != null
                ? t("money.trace.ofPrevious", {
                    pct: pct(node.share * 100, locale),
                    parent: path[index - 1]?.label ?? "",
                  })
                : node.transversal
                  ? t("money.stack.transversal")
                  : "";
            const stepText = t("money.constellation.step", { i: index + 1, n: path.length });
            return (
              <li
                key={keys[index]}
                data-cnode={node.level}
                data-distance={distance}
                className="const-node absolute left-0 top-0"
                style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
              >
                {isFocus ? (
                  <span aria-current="true" className="const-node-in block">
                    <span
                      aria-hidden="true"
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                      style={{ width: 10, height: 10 }}
                    />
                    <span
                      className="absolute top-[9px] block pl-2 leading-tight"
                      style={{ width: layout.labelWidths[index] }}
                    >
                      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                        {node.label}
                      </span>
                      <span className="tnum block text-[11.5px] text-foreground/75">
                        {amountText}
                      </span>
                      {node.share != null ? (
                        <span
                          className="tnum block text-[10.5px] text-accent"
                          title={shareText}
                        >
                          {pct(node.share * 100, locale)}
                          <span className="sr-only"> {shareText}</span>
                        </span>
                      ) : node.transversal ? (
                        <span className="block text-[10px] text-muted-foreground">
                          {t("money.stack.transversal")}
                        </span>
                      ) : null}
                    </span>
                    <span className="sr-only">
                      {node.label} — {amountText} — {stepText}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-expanded={preview?.key === keys[index]}
                    aria-busy={previewLoading === keys[index] || undefined}
                    onClick={() => void openPreview(node, index)}
                    aria-label={`${t("money.constellation.branches", { name: node.label })} — ${amountText}${
                      shareText ? ` — ${shareText}` : ""
                    } — ${stepText}`}
                    className={cn(
                      "const-node-in group block cursor-pointer text-left",
                      previewLoading === keys[index] ? "animate-pulse" : undefined,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
                        distance === 1
                          ? "bg-foreground/60 group-hover:bg-accent"
                          : "bg-muted-foreground/55 group-hover:bg-accent",
                      )}
                      style={
                        distance === 1 ? { width: 7, height: 7 } : { width: 6, height: 6 }
                      }
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute block pl-2 leading-tight",
                        layout.labelSides[index] === "above" ? "bottom-[9px]" : "top-[9px]",
                      )}
                      style={{ width: layout.labelWidths[index] }}
                    >
                      <span
                        className={cn(
                          "block truncate leading-snug transition-colors group-hover:text-accent",
                          distance === 1
                            ? "text-[11.5px] text-foreground/80"
                            : "text-[10.5px] text-foreground/60",
                        )}
                      >
                        {distance === 1 ? node.label : shortLabel(node)}
                      </span>
                      <span className="tnum block text-[10px] text-muted-foreground/90">
                        {amountText}
                      </span>
                      {distance === 1 && node.share != null ? (
                        <span className="tnum block text-[9.5px] text-muted-foreground">
                          {pct(node.share * 100, locale)}
                        </span>
                      ) : distance === 1 && node.transversal ? (
                        <span className="block text-[9.5px] text-muted-foreground">
                          {t("money.stack.transversal")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {/* Les bifurcations : une couche à part — elles ne déplacent
            pas le chemin actif et ne le modifient jamais ; seule la
            sélection d'un lien navigue. */}
        {preview && previewPivotIndex >= 0 ? (
          <ul className="m-0 list-none p-0">
            {preview.items.map((item, j) => {
              const slot = previewSlots[j];
              return (
                <li
                  key={item.key}
                  data-cpreview={item.self ? "self" : "alt"}
                  className="absolute left-0 top-0"
                  style={{ transform: `translate(${slot.x}px, ${slot.y}px)` }}
                >
                  <Link
                    to={item.to}
                    className="const-node-in group block"
                    title={
                      item.self
                        ? t("money.stack.backTo", {
                            name: item.label,
                            amount: item.amount != null ? money(item.amount, item.currency) : "",
                          })
                        : t("money.followTo", { name: item.label })
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted-foreground/60 bg-background transition-colors group-hover:border-accent"
                      style={{ width: 7, height: 7 }}
                    />
                    <span
                      className={cn(
                        "absolute block w-[150px] pl-2 leading-tight",
                        slot.up ? "-translate-y-full pb-1" : "pt-1.5",
                      )}
                    >
                      <span className="block truncate text-[10.5px] leading-snug text-muted-foreground transition-colors group-hover:text-accent">
                        {item.self ? <span aria-hidden="true">↩ </span> : null}
                        {item.label}
                      </span>
                      {item.amount != null ? (
                        <span className="tnum block text-[10px] text-muted-foreground/90">
                          {money(item.amount, item.currency)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */

export interface TransverseBranch {
  key: string;
  label: string;
  amountText: string;
  to: string;
}

/** L'entité transverse (organisation, pays) : PLUSIEURS provenances
 *  convergent — la constellation devient réellement multi-bras, et
 *  c'est le SEUL cas. Les liens signifient « provenance », jamais un
 *  flux proportionnel : même épaisseur, aucun total unique. */
export function TransverseConstellation({
  branches,
  centerLabel,
}: {
  branches: TransverseBranch[];
  centerLabel: string;
}) {
  const { t } = useTranslation();
  const { ref, width } = useMeasure<HTMLDivElement>();
  const measured = width || 760;
  const height = Math.max(96, 30 + branches.length * 40);
  const centerX = Math.min(measured - 200, Math.max(300, measured * 0.45));
  const centerY = height / 2;
  return (
    <nav aria-label={t("money.orgRelations")} className="hidden md:block">
      <div ref={ref} className="relative w-full" style={{ height }}>
        <svg aria-hidden="true" width={measured} height={height} className="absolute inset-0">
          {branches.map((branch, index) => (
            <path
              key={branch.key}
              d={linkPath({ x: 34, y: 30 + index * 40 }, { x: centerX, y: centerY })}
              pathLength={1}
              className="const-link const-link-in text-border"
              stroke="currentColor"
            />
          ))}
        </svg>
        <ul className="m-0 list-none p-0">
          {branches.map((branch, index) => (
            <li
              key={branch.key}
              className="absolute left-0 top-0"
              style={{ transform: `translate(34px, ${30 + index * 40}px)` }}
            >
              <Link
                to={branch.to}
                className="const-node-in group block"
                title={t("money.followTo", { name: branch.label })}
              >
                <span
                  aria-hidden="true"
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60 transition-colors group-hover:bg-accent"
                  style={{ width: 6, height: 6 }}
                />
                <span className="absolute block w-[190px] pl-2 pt-1 leading-tight">
                  <span className="block truncate text-[11px] text-muted-foreground transition-colors group-hover:text-accent">
                    {branch.label}
                  </span>
                  <span className="tnum block text-[10px] text-muted-foreground/90">
                    {branch.amountText}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <span
          aria-current="true"
          className="const-node-in absolute left-0 top-0"
          style={{ transform: `translate(${centerX}px, ${centerY}px)` }}
        >
          <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ width: 9, height: 9 }}
          />
          <span className="absolute block w-[240px] pl-2 pt-1.5 text-[12.5px] font-semibold leading-snug">
            {centerLabel}
          </span>
        </span>
      </div>
    </nav>
  );
}
