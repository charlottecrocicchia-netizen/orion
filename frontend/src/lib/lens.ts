import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { api, type LensMeta } from "@/lib/api";

/** L'AUTORITÉ de la lentille active (M1.1 du chantier multi-lentilles).
 *
 *  UNE seule autorité au front : ce module résout la lentille depuis
 *  l'URL, et tous les consommateurs la lisent ici — le chip, la
 *  recherche, l'Explorateur, le dossier, la bibliothèque d'analyses.
 *  Plus aucune surface ne sait ce qu'est « space ».
 *
 *  I1 : le NOM du paramètre (`sector` aujourd'hui, `lens` demain) vit
 *  ici et nulle part ailleurs — le basculement sera un diff d'une ligne
 *  plus une normalisation d'URL, jamais une chasse à travers les pages.
 *
 *  D2 : la grammaire est `<slug>` (cœur + habilitant) et `<slug>-direct`
 *  (le cœur seul). D3 : zéro ou UNE lentille par vue — la valeur est
 *  scalaire, jamais une liste.
 *
 *  I3 : les MOTS d'une lentille sont sa curation (`lens.<slug>.*`) ;
 *  sans eux, les motifs génériques prennent le relais — c'est ce que
 *  voit une lentille qui n'a pas encore ses mots, jamais une clé nue. */

/** La signature minimale d'un traducteur : `useTranslation()` la
 *  satisfait, et les fonctions pures (dossier) peuvent la passer sans
 *  dépendre du typage complet d'i18next. */
export type Translate = (key: string, opts?: Record<string, unknown>) => string;

export const LENS_PARAM = "sector";
const DIRECT_SUFFIX = "-direct";

export interface ActiveLens {
  /** La valeur d'URL, telle quelle — ce qui se partage. */
  value: string;
  slug: string;
  /** `<slug>-direct` : le cœur seul, sans les technologies habilitantes. */
  coreOnly: boolean;
}

/** Lit une valeur de périmètre. Pure : le dossier s'en sert sur un état
 *  sauvegardé, qui n'est pas l'URL courante. */
export function parseLens(value: string | null | undefined): ActiveLens | null {
  if (!value) return null;
  const coreOnly = value.endsWith(DIRECT_SUFFIX);
  const slug = coreOnly ? value.slice(0, -DIRECT_SUFFIX.length) : value;
  return slug ? { value, slug, coreOnly } : null;
}

/** Écrit une valeur de périmètre — l'inverse exact de `parseLens`. */
export function lensValue(slug: string, coreOnly: boolean): string {
  return coreOnly ? `${slug}${DIRECT_SUFFIX}` : slug;
}

/** Les lentilles PUBLIÉES, en ordre de rang (I2 : l'API n'expose
 *  qu'elles ; le front n'a donc aucune liste en dur). */
export function usePublishedLenses(): LensMeta[] {
  const { data } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  return data?.lenses ?? [];
}

/** La lentille active de la vue courante, lue dans l'URL. */
export function useActiveLens(): ActiveLens | null {
  const [params] = useSearchParams();
  return parseLens(params.get(LENS_PARAM));
}

/** Les mots d'une lentille. Curés (`lens.<slug>.*`) ou, à défaut, les
 *  motifs génériques — une lentille sans ses mots reste lisible. */
export function lensWords(slug: string, t: Translate) {
  const name = t(`lens.${slug}.name`, { defaultValue: slug });
  return {
    name,
    direct: t(`lens.${slug}.direct`, {
      defaultValue: t("explorer.sector.directPattern", { lens: name }),
    }),
    enabling: t(`lens.${slug}.enabling`, {
      defaultValue: t("explorer.sector.enablingPattern", { lens: name }),
    }),
    chipLabel: t(`lens.${slug}.chipLabel`, {
      defaultValue: t("explorer.sector.chipLabel"),
    }),
  };
}

/** Le libellé d'un périmètre, pour une phrase (dossier, cartes). */
export function lensPhrase(value: string | null | undefined, t: Translate): string | null {
  const active = parseLens(value);
  if (!active) return null;
  const words = lensWords(active.slug, t);
  return active.coreOnly ? words.direct : words.enabling;
}

/** Les QUATRE états de la lentille d'une vue (invariant ①, 2026-08-18).
 *
 *  `pending` couvre le chargement ET la panne : une impossibilité de
 *  lire le registre n'est JAMAIS un verdict — ni « invalide », ni
 *  « pas de lentille ». Le front s'abstient alors et rend la vue :
 *  l'API reste l'autorité, et c'est elle qui refusera s'il le faut.
 *  Sans cette distinction, un incident d'infrastructure ferait mentir
 *  des liens parfaitement justes. */
export type LensState =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "valid"; lens: ActiveLens }
  | { kind: "invalid"; value: string; reason?: "multiple_values" };

/** L'état du registre, vu par la décision — trois cas seulement. */
export type LensRegistry =
  | { status: "pending" }
  | { status: "ready"; slugs: string[] };

/** La décision, PURE : toutes les occurrences du paramètre d'un côté,
 *  l'état du registre de l'autre. U5 strict — deux occurrences sont un
 *  refus, jamais une réduction à la première ou à la dernière ; une
 *  valeur vide est un refus, car le paramètre a bel et bien été envoyé. */
export function decideLensState(values: string[], registry: LensRegistry): LensState {
  if (values.length === 0) return { kind: "none" };
  if (values.length > 1) {
    return { kind: "invalid", value: values.join(","), reason: "multiple_values" };
  }
  const raw = values[0];
  const active = parseLens(raw);
  if (!active) return { kind: "invalid", value: raw };
  if (registry.status === "pending") return { kind: "pending" };
  return registry.slugs.includes(active.slug)
    ? { kind: "valid", lens: active }
    : { kind: "invalid", value: raw };
}

/** L'état de la vue courante — l'URL d'un côté, le registre de l'autre. */
export function useActiveLensState(): LensState {
  const [params] = useSearchParams();
  const { data, isPending, isError } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  // Chargement ET erreur donnent le MÊME état : pas de verdict.
  // Un payload sans registre lisible n'est pas non plus un verdict.
  const registry: LensRegistry =
    isPending || isError || !data?.lenses
      ? { status: "pending" }
      : { status: "ready", slugs: data.lenses.map((lens) => lens.slug) };
  return decideLensState(params.getAll(LENS_PARAM), registry);
}

/** L'URL courante SANS le paramètre de lentille — toutes ses
 *  occurrences retirées, tout le reste préservé : requête, filtres,
 *  années, comparaisons. C'est la porte de sortie du refus. */
export function withoutLens(pathname: string, search: string): string {
  const next = new URLSearchParams(search);
  next.delete(LENS_PARAM);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
