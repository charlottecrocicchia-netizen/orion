import type { ReactNode } from "react";

import { ConstellationGlyph, WORLD_GLYPHS } from "@/components/lens-glyphs";
import { worldTintVars } from "@/lib/world-tints";

/** La matière optique de la Lens Room, PARTAGÉE (pivot 2026-08-22) :
 *  la salle (/lenses) et la section lentilles de la landing publique
 *  rendent les MÊMES verres — tokens sombres, dérive, teintes,
 *  glyphes, fond constellé. Un seul langage, jamais deux copies
 *  (styles : .lens-hit / .lens-glass dans index.css). */

export const ROOM_TOKENS = {
  "--background": "#0b0d12",
  "--foreground": "#f5f5f7",
  "--accent": "#8b9aff",
  "--accent-soft": "#1b2040",
  "--muted-foreground": "#9d9da6",
  "--border": "rgba(255,255,255,0.14)",
  "--border-soft": "rgba(255,255,255,0.08)",
  "--surface": "#11141b",
} as React.CSSProperties;

/** Trois profondeurs (pseudo-3D) : échelle au repos + amplitude de
 *  parallaxe. Le monde du milieu est le plus proche de l'œil. */
export const DEPTH: Record<string, number> = { space: 0.4, aviation: 0.9, all: 0.25 };
// Le DÉSACCORD (recette du 2026-08-20) : phases fixées à la main,
// écartées d'un demi-tour — l'œil doit voir des flottements en
// désaccord, jamais une respiration commune.
const PHASE: Record<string, number> = { space: 0, aviation: 0.45, all: 0.8 };
export const driftTime = (depth: number) => 5.5 + depth * 2.2;
export const floatDelay = (slug: string, depth: number) => -(PHASE[slug] ?? 0.5) * driftTime(depth);

/** Le monde d'Orion, flou, derrière les verres — la constellation de
 *  fond de la salle. `parallax` : la salle branche son pointeur dessus
 *  (data-depth) ; la landing la laisse immobile. */
export function RoomBackdrop({ parallax = false }: { parallax?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50 blur-[1.5px]"
      data-depth={parallax ? "0.12" : undefined}
      style={parallax ? { transform: "translate3d(var(--par-x,0),var(--par-y,0),0)" } : undefined}
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
    >
      <g fill="currentColor">
        <circle cx="140" cy="120" r="1.6" /><circle cx="320" cy="520" r="1.3" />
        <circle cx="540" cy="90" r="1.2" /><circle cx="820" cy="600" r="1.6" />
        <circle cx="1020" cy="180" r="1.4" /><circle cx="1130" cy="420" r="1.2" />
        <circle cx="240" cy="330" r="1.1" /><circle cx="700" cy="260" r="1.1" />
        <circle cx="920" cy="380" r="1.3" />
      </g>
      <g stroke="var(--accent)" fill="none">
        <path d="M140 120 320 260 540 210 700 260 920 380 1130 420" strokeOpacity=".16" />
        <path d="M240 330 320 520 820 600" strokeOpacity=".1" />
      </g>
    </svg>
  );
}

/** Un verre de la salle : glyphe, nom, ligne de chiffres — le même
 *  objet que le geste d'entrée. `slug: "all"` rend le verre du corpus
 *  entier (glyphe constellation, sans teinte de monde). */
export function LensGlass({
  slug,
  name,
  figures,
  onClick,
  ariaLabel,
}: {
  slug: string;
  name: string;
  figures: ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
}) {
  const depth = DEPTH[slug] ?? 0.5;
  const Glyph = slug === "all" ? ConstellationGlyph : WORLD_GLYPHS[slug];
  if (!Glyph) return null;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="lens-hit group"
      style={{
        ...(slug === "all" ? {} : worldTintVars(slug)),
        "--rest-scale": String(0.88 + depth * 0.24),
        "--drift-delay": `${(1 - depth) * 0.22}s`,
        "--drift-time": `${driftTime(depth)}s`,
        "--float-delay": `${floatDelay(slug, depth)}s`,
        "--float-x": `${8 + depth * 8}px`,
        "--float-y": `${11 + depth * 6}px`,
      } as React.CSSProperties}
    >
      <span className="lens-glass">
        <span aria-hidden="true" className="lens-glass-glyph">
          <Glyph />
        </span>
        <span className="display-tight mt-4 text-[19px] font-medium">{name}</span>
        <span className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">{figures}</span>
      </span>
    </button>
  );
}
