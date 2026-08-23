import type { CSSProperties, ReactElement } from "react";

import { OrbitGlyph, WingGlyph } from "@/components/lens-glyphs";

/** La matière optique de la Lens Room, PARTAGÉE (pivot 2026-08-22) :
 *  la salle (/lenses), la section lentilles de la landing publique et
 *  la signature du header lisent les MÊMES tokens et le MÊME alphabet
 *  de glyphes — un seul langage, jamais deux copies. Module de lib
 *  séparé des composants (règle fast-refresh : un fichier de
 *  composants n'exporte que des composants). */

export const ROOM_TOKENS = {
  "--background": "#0b0d12",
  "--foreground": "#f5f5f7",
  "--accent": "#8b9aff",
  "--accent-soft": "#1b2040",
  "--muted-foreground": "#9d9da6",
  "--border": "rgba(255,255,255,0.14)",
  "--border-soft": "rgba(255,255,255,0.08)",
  "--surface": "#11141b",
} as CSSProperties;

/** UN dessin par monde (chantier scène optique, 2026-08-20) : deux
 *  dessins qui divergent seraient deux mondes qui divergent. */
export const WORLD_GLYPHS: Record<
  string,
  (props: { awake?: boolean; once?: boolean; stroke?: number }) => ReactElement
> = {
  space: OrbitGlyph,
  aviation: WingGlyph,
};
