import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { api, type LensMeta } from "@/lib/api";
import { STORIES } from "@/lib/stories";

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

/** La lentille VEDETTE : le rang 1 du registre publié. C'est elle que
 *  l'accueil raconte — jamais un slug écrit en dur. Sans lentille
 *  publiée, l'accueil garde son visage général : une base sans lentille
 *  reste honnête. */
export function useLeadLens(): LensMeta | null {
  return usePublishedLenses()[0] ?? null;
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

/** Les mots ÉDITORIAUX d'une lentille à l'accueil. Ils sont sa
 *  curation : tant que l'espace est la vedette, l'accueil parle
 *  spatial — la mécanique est générique, la voix ne s'aplatit pas. À
 *  défaut de mots curés, des motifs qui nomment la lentille. */
export function lensHeroWords(slug: string, t: Translate) {
  const name = t(`lens.${slug}.name`, { defaultValue: slug });
  return {
    sub: (from: number, to: number) =>
      t(`lens.${slug}.hero.sub`, {
        from,
        to,
        defaultValue: t("hero.subLens", { lens: name, from, to }),
      }),
    projects: t(`lens.${slug}.hero.projects`, {
      defaultValue: t("hero.lensProjects", { lens: name }),
    }),
    orgs: t(`lens.${slug}.hero.orgs`, {
      defaultValue: t("hero.lensOrgs", { lens: name }),
    }),
    groups: t(`lens.${slug}.hero.groups`, { defaultValue: t("hero.lensGroups") }),
    cta: t(`lens.${slug}.hero.cta`, { defaultValue: t("home.lensCta", { lens: name }) }),
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

/** La propagation de la lentille active (lot navigation, 2026-08-19).
 *
 *  L'URL reste la SEULE vérité — mais tant qu'une vue porte
 *  `sector=<slug>`, la navigation le transporte : header, recherche,
 *  portes internes. Les SORTIES du monde restent explicites — la Lens
 *  Room par l'identité composée, « Tout le corpus » par le chip — et ne
 *  passent jamais par ici. Sans paramètre, rien ne change : le site nu
 *  est un état de plein droit, sans défaut, sans session, sans
 *  mémoire.
 *
 *  Un lien qui porte DÉJÀ un `sector=` garde le sien : la propagation
 *  ne réécrit jamais un cadrage explicite. */
/** Les surfaces qui ne peuvent pas honnêtement CONSOMMER une lentille
 *  ne la reçoivent pas : porter le paramètre sans l'appliquer serait
 *  une URL qui ment sur son périmètre (U2 ; bug de doctrine du
 *  2026-08-19). Deux familles :
 *
 *  - les FICHES d'une entité et les hubs, dont les chiffres sont
 *    encore des chiffres monde — tant qu'ils ne savent pas se cadrer,
 *    ils restent nus plutôt que menteurs ;
 *  - les ARTEFACTS de l'utilisateur (dossier, atelier) et les pages de
 *    service, qui n'ont pas de périmètre à porter.
 *
 *  Retirer une entrée d'ici est un ENGAGEMENT : la surface consomme. */
const LENS_BLIND = [
  /^\/projects\/[^/]+$/,
  /^\/organisations\/[^/]+$/,
  /^\/groups\//,
  /^\/compare$/,
  /^\/explore\/countries\/[^/]+$/,
  /^\/explore\/regions\//,
  /^\/explore\/programmes\/[^/]+$/,
  /^\/dossier$/,
  /^\/workspace/,
  // /calls porte la lentille depuis E1 (le filtre est réel) ; seule la
  // FICHE appel reste aveugle — elle montre un appel, pas une vue cadrée.
  /^\/calls\/[^/]+$/,
  /^\/lenses$/,
];

export function withLens(to: string, slug: string | null): string {
  if (!slug) return to;
  const route = to.split("?", 1)[0].split("#", 1)[0];
  if (LENS_BLIND.some((pattern) => pattern.test(route))) return to;
  const [beforeHash, hash] = to.split("#", 2);
  const [path, search] = beforeHash.split("?", 2);
  const params = new URLSearchParams(search ?? "");
  if (!params.has(LENS_PARAM)) params.set(LENS_PARAM, slug);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Le périmètre de l'ANGLE actif d'un deck, dérivé de l'URL seule
 *  (fuite ② de la recette du 2026-08-19) : en mode angles, l'adresse
 *  dit `angles=<key>&angle=N` — le sector de la vue vit dans les
 *  params de l'angle. Il est donc DÉRIVABLE de l'URL, et le transport
 *  doit savoir le dériver : l'URL reste la seule vérité. */
function useAngleLensSlug(): string | null {
  const [params] = useSearchParams();
  const story = STORIES.find(
    (candidate) => candidate.key === params.get("angles") && candidate.deck,
  );
  if (!story) return null;
  const index = Math.min(
    Math.max(Number(params.get("angle") ?? "0") || 0, 0),
    story.deck!.length - 1,
  );
  const raw = new URLSearchParams(story.deck![index].params).get(LENS_PARAM);
  const active = raw ? parseLens(raw) : null;
  return active?.slug ?? null;
}

/** Le slug à transporter : celui de la vue — par le paramètre, ou par
 *  l'angle actif d'un deck — sinon rien.
 *
 *  Tant que le registre n'a pas parlé (stats en route), le transport
 *  fait CONFIANCE au candidat brut : pré-valider contre un registre
 *  absent faisait perdre le cadre au premier clic rapide (recette du
 *  2026-08-19, fuite ① sous charge). La validation reste l'affaire des
 *  pages qui LISENT — un slug invalide sera refusé à l'arrivée (M1.2),
 *  et une fois le registre là, un slug inconnu ne se propage plus. */
export function useCarriedLens(): string | null {
  const [params] = useSearchParams();
  const fromAngle = useAngleLensSlug();
  const lenses = usePublishedLenses();
  const raw = params.getAll(LENS_PARAM);
  const parsed = raw.length === 1 ? parseLens(raw[0]) : null;
  const candidate = parsed?.slug ?? fromAngle;
  if (!candidate) return null;
  if (lenses.length === 0) return candidate;
  return lenses.some((lens) => lens.slug === candidate) ? candidate : null;
}
