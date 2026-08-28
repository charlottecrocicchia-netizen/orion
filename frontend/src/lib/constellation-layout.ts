/** B2.7 — le moteur de layout de la Constellation Trace. PUR et
 *  DÉTERMINISTE : même chemin + même largeur → mêmes coordonnées,
 *  toujours. Il ne connaît que la profondeur, la largeur disponible
 *  et le focus — JAMAIS les montants (la géométrie représente le
 *  parcours, pas la quantité financière), jamais d'aléatoire, jamais
 *  de simulation de forces.
 *
 *  Composition (révision fondatrice, 2026-08-28) :
 *  - la zone graphique est PLAFONNÉE (~1050 px) et centrée quand la
 *    largeur le permet — le chemin n'est plus étiré sur tout le
 *    viewport ;
 *  - le pas horizontal est adaptatif mais borné (150–220 px ; il ne
 *    descend sous 150 que si la fenêtre l'impose physiquement) ;
 *  - l'ondulation verticale est une vraie sinusoïde affirmée
 *    (amplitude crête-à-crête ≈ 28 px, phase 1,6 rad → alternance
 *    quasi systématique), pas un zigzag de parité ;
 *  - chaque label se place selon la GÉOMÉTRIE LOCALE : du côté
 *    opposé à la courbe SORTANTE du nœud, jamais superposé au
 *    trait. */

export interface ConstellationPoint {
  x: number;
  y: number;
}

export type LabelSide = "above" | "below";

export interface ConstellationLayout {
  points: ConstellationPoint[];
  /** Largeur maximale du label de chaque nœud, bornée par le pas —
   *  un label ne mord jamais le nœud suivant. */
  labelWidths: number[];
  /** Le côté de chaque label, choisi par la géométrie locale. */
  labelSides: LabelSide[];
  height: number;
}

/** La zone graphique plafonnée — au-delà, l'espace sert à respirer. */
const GRAPH_MAX = 1050;
const STEP_MIN = 150;
const STEP_MAX = 220;
/** La place réservée au bloc du focus (nom sur 2 lignes, montant,
 *  part) qui s'étend à droite et sous son nœud. */
const FOCUS_LABEL = 280;
const EDGE = 16;

/** L'ondulation : y(i) = MID + A·sin(PHASE·i + SHIFT). Amplitude
 *  affirmée (recette fondatrice : ±14 px — l'ondulation est une
 *  intention, pas une devinette), phase 1,6 rad (alternance
 *  dessus/dessous quasi systématique) — continue, jamais un motif
 *  mécanique, jamais reliée aux montants. */
const MID_Y = 64;
const AMP = 14;
const PHASE = 1.6;
const SHIFT = -0.55;

const HEIGHT = 164;

function waveY(index: number): number {
  return MID_Y + AMP * Math.sin(PHASE * index + SHIFT);
}

export function layoutTracePath(count: number, width: number): ConstellationLayout {
  const safeWidth = Math.max(360, width);
  if (count <= 1) {
    const x = Math.max(EDGE + 6, (safeWidth - FOCUS_LABEL) / 2);
    return {
      points: [{ x, y: waveY(0) }],
      labelWidths: [FOCUS_LABEL],
      labelSides: ["below"],
      height: 138,
    };
  }
  // Le pas : adaptatif dans [150, 220] pour tenir dans la zone
  // plafonnée ; il ne se comprime davantage que si la fenêtre
  // l'impose physiquement.
  const zone = Math.min(GRAPH_MAX, safeWidth - EDGE * 2);
  const ideal = (zone - FOCUS_LABEL) / (count - 1);
  let step = Math.max(STEP_MIN, Math.min(STEP_MAX, ideal));
  const hardMax = (safeWidth - EDGE * 2 - FOCUS_LABEL) / (count - 1);
  if (step > hardMax) step = Math.max(110, hardMax);

  const graphWidth = step * (count - 1) + FOCUS_LABEL;
  const offsetX = Math.max(EDGE, (safeWidth - graphWidth) / 2);

  const points: ConstellationPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push({ x: offsetX + step * i, y: waveY(i) });
  }

  const labelWidths = points.map((_, index) => {
    if (index === count - 1) return FOCUS_LABEL;
    const cap = count - 1 - index === 1 ? 170 : 140;
    return Math.max(72, Math.min(cap, step - 24));
  });

  // Le label va du côté où la courbe ne passe pas. Les labels
  // s'étendent à DROITE du point : seule la courbe SORTANTE traverse
  // leur zone (l'entrante arrive à tangente horizontale par la
  // gauche). Règle : sortante descendante → label au-dessus ;
  // montante → au-dessous. Le focus, sans sortante, est toujours
  // au-dessous. Garantie structurelle : aucun label sur le trait,
  // quelle que soit l'amplitude.
  const labelSides: LabelSide[] = points.map((point, index) =>
    index === count - 1 ? "below" : points[index + 1].y >= point.y ? "above" : "below",
  );

  return { points, labelWidths, labelSides, height: HEIGHT };
}

export interface PreviewSlot extends ConstellationPoint {
  /** true quand la bifurcation part vers le haut — le lien s'incurve
   *  dans le même sens. */
  up: boolean;
}

/** Les bifurcations temporaires autour d'un pivot : une couche à
 *  part, des positions déterministes en éventail — elles ne déplacent
 *  jamais les nœuds actifs. */
export function layoutPreviews(
  pivot: ConstellationPoint,
  count: number,
  height: number,
): PreviewSlot[] {
  const offsets = [
    { dx: 108, dy: -34 },
    { dx: 116, dy: 34 },
    { dx: 84, dy: -62 },
    { dx: 92, dy: 62 },
  ];
  return offsets.slice(0, count).map((offset) => ({
    x: pivot.x + offset.dx,
    y: Math.max(16, Math.min(height - 18, pivot.y + offset.dy)),
    up: offset.dy < 0,
  }));
}

/** Le tracé d'un lien : une Bézier extrêmement légère, normalisée
 *  (`pathLength="1"` côté SVG). Même géométrie → même chaîne. */
export function linkPath(from: ConstellationPoint, to: ConstellationPoint): string {
  const dx = to.x - from.x;
  const c1x = from.x + dx * 0.45;
  const c2x = to.x - dx * 0.45;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}
