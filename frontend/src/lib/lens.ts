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

/** « Cette valeur cadre-t-elle vraiment une vue ? » — la question que
 *  posent la recherche (liste cadrée ou invite ?) et le chip.
 *
 *  Tant que le registre n'est pas chargé, une valeur bien formée est
 *  admise : sans cela, une vue cadrée clignoterait en « non cadrée » au
 *  premier rendu. Le verdict sur une valeur inconnue, draft ou retirée
 *  appartient au lot M1.2 (refus explicite), pas à ce socle. */
export function useLensGate(): (value: string | null | undefined) => boolean {
  const { data, isPending } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  return (value) => {
    const active = parseLens(value);
    if (!active) return false;
    if (isPending || !data) return true;
    return data.lenses.some((lens) => lens.slug === active.slug);
  };
}
