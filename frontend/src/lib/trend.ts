import type { ExploreResponse } from "@/lib/api";

/** Le groupe TREND du Reference Engine (R2, conception R0 § D1) — LA
 *  source unique des transformations `index` et `growth`. Graphique,
 *  table, CSV, dossier et decks passent tous par ici : jamais deux
 *  calculs légèrement différents.
 *
 *  Les deux modes reposent sur la série REAL déjà livrée par l'API
 *  (`toApiParams` traduit index/growth vers `value=real`) — jamais sur
 *  le nominal, qui mélangerait inflation et croissance réelle. Le
 *  backend ne connaît ni `index` ni `growth` en R2.
 *
 *  Règles gravées :
 *  - index(a) = 100 × real(a) / real(base) — une série sans valeur
 *    réelle VALIDE (non nulle, non zéro) à l'année de base est NON
 *    INDEXABLE pour cette base : jamais rebasée en silence sur sa
 *    première année disponible, ses points passent à null (la légende
 *    la garde, ⓘ Reference la nomme) ;
 *  - growth(a) = real(a) / real(a-1) − 1, en % — première année null,
 *    année précédente absente ou nulle → null, zéro au dénominateur →
 *    null (jamais une division par zéro maquillée), aucune
 *    interpolation ;
 *  - un trou reste un trou : une année réelle absente reste null ;
 *  - les agrégats sommés (value de série, total) n'ont AUCUN sens en
 *    TREND : ils passent à null — pas de KPI monétaire trompeur ;
 *  - la ré-expression EUR/USD est un scalaire commun (R1) : elle
 *    s'annule dans les deux ratios — Index et Growth sont identiques
 *    quelle que soit la devise d'affichage sous-jacente (test-or). */

export type TrendMode = "index" | "growth";

export interface TrendResult {
  data: ExploreResponse;
  /** Clés canoniques des séries non indexables à la base demandée
   *  (mode index uniquement) — dites à l'écran par ⓘ Reference. */
  nonIndexable: string[];
}

const valid = (value: number | null | undefined): value is number =>
  value != null && value !== 0;

/** Les années de la fenêtre VISIBLE qui peuvent réellement servir de
 *  base : une valeur réelle valide sur au moins une série. C'est la
 *  liste que le sélecteur offre — jamais une année qui produirait une
 *  vue entièrement vide. */
export function indexBaseCandidates(
  data: ExploreResponse,
  from: number | null,
  to: number | null,
): number[] {
  const years = new Set<number>();
  for (const serie of data.series) {
    for (const point of serie.points ?? []) {
      if (valid(point.value)) years.add(point.year);
    }
  }
  return [...years]
    .filter((year) => (from == null || year >= from) && (to == null || year <= to))
    .sort((a, b) => a - b);
}

/** La base CANONIQUE (R0 § D10, arbitrage fenêtre du GO R2) : la base
 *  doit appartenir à la fenêtre temporelle visible ET y être réellement
 *  exploitable. Si la base demandée en sort (changement de fenêtre) ou
 *  n'est exploitable pour aucune série, elle se ré-ancre sur la
 *  première année pleine valide de la fenêtre — et l'URL est réécrite
 *  (replace) par la page : l'URL reste cohérente avec ce que
 *  l'utilisateur voit, aucun lien partagé ne dépend d'un défaut
 *  implicite. */
export function resolveIndexBase(
  data: ExploreResponse,
  from: number | null,
  to: number | null,
  requested: number | null,
): number | null {
  const candidates = indexBaseCandidates(data, from, to);
  if (candidates.length === 0) return null;
  if (requested != null && candidates.includes(requested)) return requested;
  return candidates[0];
}

/** LA transformation — appliquée UNE fois, juste après la réponse
 *  real, avant tout rendu ou export. */
export function applyTrend(
  data: ExploreResponse,
  mode: TrendMode,
  base: number | null,
): TrendResult {
  const nonIndexable: string[] = [];
  const series = data.series.map((serie) => {
    const points = serie.points ?? [];
    if (mode === "index") {
      const atBase = points.find((point) => point.year === base)?.value;
      if (!valid(atBase)) {
        nonIndexable.push(String(serie.key));
        return { ...serie, value: null, points: points.map((p) => ({ ...p, value: null })) };
      }
      return {
        ...serie,
        value: null,
        points: points.map((p) => ({
          ...p,
          value: valid(p.value) || p.value === 0 ? (100 * (p.value as number)) / atBase : null,
        })),
      };
    }
    // growth : % d'une année sur l'autre, sur l'axe réellement présent
    // (une année qui manque à l'axe rend la suivante incalculable).
    const byYear = new Map(points.map((p) => [p.year, p.value]));
    return {
      ...serie,
      value: null,
      points: points.map((p) => {
        const previous = byYear.get(p.year - 1);
        if (p.value == null || !valid(previous)) return { ...p, value: null };
        return { ...p, value: (p.value / (previous as number) - 1) * 100 };
      }),
    };
  });
  return {
    data: {
      ...data,
      unit: mode,
      series,
      total: null,
    },
    nonIndexable,
  };
}
