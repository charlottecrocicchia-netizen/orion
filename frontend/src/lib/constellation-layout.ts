/** B2.7 — le moteur de layout de la Constellation Trace. PUR et
 *  DÉTERMINISTE : même chemin + même largeur → mêmes coordonnées,
 *  toujours. Il ne connaît que la profondeur, la largeur disponible
 *  et le focus — JAMAIS les montants (la géométrie représente le
 *  parcours, pas la quantité financière), jamais d'aléatoire, jamais
 *  de simulation de forces.
 *
 *  Composition : un axe général horizontal avec une très légère
 *  descente vers le focus ; les distances inter-nœuds se resserrent
 *  vers les ancêtres anciens et respirent vers le focus (le zoom
 *  sémantique s'applique aussi à l'espace). La hauteur reste bornée
 *  (~120–180 px) : la constellation ne doit jamais avaler l'écran. */

export interface ConstellationPoint {
  x: number;
  y: number;
}

export interface ConstellationLayout {
  points: ConstellationPoint[];
  /** Largeur maximale du label de chaque nœud, bornée par l'espace
   *  jusqu'au voisin — un label ne mord jamais le nœud suivant. */
  labelWidths: number[];
  height: number;
}

const MARGIN_LEFT = 24;
/** La place réservée au bloc du focus (nom sur 2 lignes, montant,
 *  part) qui s'étend à droite et sous son nœud. */
const MARGIN_RIGHT = 300;
/** Le tronc est quasi horizontal : une micro-ondulation alternée
 *  (±5 px) donne le rythme, les labels alternent dessus / dessous —
 *  un trait ne traverse jamais un label (constat de recette à
 *  profondeur 5 avec l'ancienne pente cumulée). */
const TRUNK_Y = 46;
const WAVE = 5;
const FOCUS_Y = 56;

export function layoutTracePath(count: number, width: number): ConstellationLayout {
  const safeWidth = Math.max(360, width);
  if (count <= 1) {
    return { points: [{ x: MARGIN_LEFT + 6, y: FOCUS_Y - 12 }], labelWidths: [280], height: 128 };
  }
  const usable = Math.max(220, safeWidth - MARGIN_LEFT - MARGIN_RIGHT);
  // Les segments s'élargissent vers le focus : poids 1, 1.45, 1.9, …
  const weights: number[] = [];
  for (let i = 0; i < count - 1; i += 1) weights.push(1 + i * 0.45);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const points: ConstellationPoint[] = [{ x: MARGIN_LEFT + 6, y: TRUNK_Y }];
  for (let i = 0; i < count - 1; i += 1) {
    const isFocus = i + 1 === count - 1;
    points.push({
      x: points[i].x + (usable * weights[i]) / total,
      y: isFocus ? FOCUS_Y : TRUNK_Y + ((i + 1) % 2) * WAVE,
    });
  }
  const labelWidths = points.map((point, index) => {
    if (index === count - 1) return 290;
    const gap = points[index + 1].x - point.x - 16;
    const cap = count - 1 - index === 1 ? 170 : 120;
    return Math.max(64, Math.min(cap, gap));
  });
  return { points, labelWidths, height: 136 };
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
