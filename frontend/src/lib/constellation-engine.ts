/** B2.7 — Constellation Trace : le moteur de transition déterministe
 *  (addendum technique du 2026-08-28).
 *
 *  Ce module est PUR : il modélise les phases, les chemins et les
 *  transactions de navigation de la constellation — il ne connaît ni
 *  animation, ni durée, ni coordonnée, ni montant financier (la
 *  séparation layout / transition de l'addendum §G). Le rendu joue
 *  les phases qu'on lui donne et rappelle `advance()` à chaque fin
 *  d'étape — jamais de setTimeout ici.
 *
 *  Trois concepts, jamais mélangés (§B) :
 *  - `committedPath` : le chemin réellement navigué, celui de l'URL ;
 *  - `pendingTarget` : la cible cliquée dont les données chargent
 *    encore — la géométrie courante est conservée pendant ce temps ;
 *  - `previewBranches` : les alternatives temporairement révélées —
 *    elles ne touchent JAMAIS `committedPath`.
 *
 *  Toute modification réelle de branche se base sur le plus long
 *  préfixe commun (§C) : `persist` garde ses éléments stables (le
 *  dernier est le pivot visuel), `exit` se résorbe vers le pivot,
 *  `enter` naît depuis lui. Une réponse réseau obsolète ne peut
 *  JAMAIS écraser une sélection plus récente : chaque intention porte
 *  un identifiant de transaction, seul le plus récent peut committer
 *  (§E). Une transition interrompue atterrit structurellement — la
 *  structure est la vérité dès le commit, l'animation n'est qu'un
 *  récit : aucun nœud fantôme, aucun état `entering` permanent (§A). */

export type ConstellationPhase =
  | "idle"
  | "loading_target"
  | "exiting"
  | "repositioning"
  | "entering";

export interface ConstellationNode {
  level: string;
  id: number | string;
}

export function constellationKey(node: ConstellationNode): string {
  return `${node.level}:${node.id}`;
}

export interface BranchDiff<N extends ConstellationNode> {
  /** Les nœuds conservés — leurs éléments DOM/SVG restent stables. */
  persist: N[];
  /** L'ancienne branche, à résorber vers le pivot. */
  exit: N[];
  /** La nouvelle branche, à faire naître depuis le pivot. */
  enter: N[];
  /** Le dernier nœud persistant — le pivot visuel ; null si rien ne
   *  persiste (changement de racine). */
  pivot: N | null;
}

/** Le plus long préfixe commun entre deux chemins (§C). Déterministe :
 *  mêmes chemins → même diff, toujours. */
export function diffPaths<N extends ConstellationNode>(
  oldPath: readonly N[],
  newPath: readonly N[],
): BranchDiff<N> {
  let lcp = 0;
  while (
    lcp < oldPath.length &&
    lcp < newPath.length &&
    constellationKey(oldPath[lcp]) === constellationKey(newPath[lcp])
  ) {
    lcp += 1;
  }
  return {
    persist: newPath.slice(0, lcp),
    exit: oldPath.slice(lcp),
    enter: newPath.slice(lcp),
    pivot: lcp > 0 ? newPath[lcp - 1] : null,
  };
}

export interface TransitionPlan<N extends ConstellationNode> extends BranchDiff<N> {
  txId: number;
  /** Les phases structurelles à jouer, étapes vides exclues — le
   *  rendu les parcourt via `advance()`. */
  phases: ConstellationPhase[];
}

export interface ConstellationState<N extends ConstellationNode> {
  phase: ConstellationPhase;
  committedPath: readonly N[];
  pendingTargetKey: string | null;
  previewBranches: readonly N[];
  plan: TransitionPlan<N> | null;
}

export class ConstellationEngine<N extends ConstellationNode> {
  private phase: ConstellationPhase = "idle";
  private committed: N[];
  private pending: { key: string; txId: number } | null = null;
  private previews: N[] = [];
  private plan: TransitionPlan<N> | null = null;
  private txCounter = 0;

  constructor(initialPath: readonly N[] = []) {
    this.committed = [...initialPath];
  }

  get state(): ConstellationState<N> {
    return {
      phase: this.phase,
      committedPath: [...this.committed],
      pendingTargetKey: this.pending?.key ?? null,
      previewBranches: [...this.previews],
      plan: this.plan,
    };
  }

  /** L'intention du clic (§D-1). La géométrie courante est conservée
   *  (`committedPath` inchangé) ; une intention plus récente REMPLACE
   *  la précédente — l'ancienne transaction devient obsolète et son
   *  commit sera ignoré. Une animation en cours est abandonnée sans
   *  dommage : la structure est déjà la vérité depuis son commit. */
  beginNavigation(targetKey: string): number {
    this.txCounter += 1;
    this.pending = { key: targetKey, txId: this.txCounter };
    this.plan = null;
    this.phase = "loading_target";
    return this.txCounter;
  }

  /** Les données validées (§D-3/4). Seule la transaction LA PLUS
   *  RÉCENTE peut committer : une réponse obsolète retourne null et
   *  ne touche RIEN. Un commit valide rend `newPath` immédiatement
   *  vrai (URL et structure d'abord), puis décrit les phases à jouer
   *  — vides quand il n'y a rien à animer. */
  commitPath(txId: number, newPath: readonly N[]): TransitionPlan<N> | null {
    if (this.pending == null || txId !== this.pending.txId) return null;
    const diff = diffPaths(this.committed, newPath);
    this.committed = [...newPath];
    this.pending = null;
    this.previews = [];
    const phases: ConstellationPhase[] = [];
    if (diff.exit.length > 0) phases.push("exiting");
    if (diff.exit.length > 0 || diff.enter.length > 0) phases.push("repositioning");
    if (diff.enter.length > 0) phases.push("entering");
    const plan: TransitionPlan<N> = { ...diff, txId, phases };
    this.plan = phases.length > 0 ? plan : null;
    this.phase = phases[0] ?? "idle";
    return plan;
  }

  /** Fin d'une étape d'animation, signalée par le RENDU (animationend
   *  / transitionend) — le moteur ne compte jamais le temps. */
  advance(): ConstellationPhase {
    if (this.plan == null || this.phase === "idle" || this.phase === "loading_target") {
      return this.phase;
    }
    const index = this.plan.phases.indexOf(this.phase);
    const next = this.plan.phases[index + 1];
    if (next != null) {
      this.phase = next;
    } else {
      this.phase = "idle";
      this.plan = null;
    }
    return this.phase;
  }

  /** Atterrissage immédiat à l'état final (prefers-reduced-motion,
   *  démontage) : la structure est déjà vraie, on cesse simplement de
   *  la raconter. Une cible encore en chargement reste en charge. */
  settle(): void {
    this.plan = null;
    if (this.phase !== "loading_target") {
      this.phase = "idle";
    }
  }

  /** Les alternatives révélées autour d'un pivot (§I) — une couche à
   *  part : elles n'entrent pas dans le layout du chemin principal et
   *  ne modifient JAMAIS `committedPath`. */
  showPreviewBranches(nodes: readonly N[]): void {
    this.previews = [...nodes];
  }

  clearPreviewBranches(): void {
    this.previews = [];
  }
}
