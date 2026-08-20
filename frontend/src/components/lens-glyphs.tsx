import type { ReactElement } from "react";

function cnOrbit(awake: boolean, once: boolean): string {
  if (once) return "glyph-orbit glyph-orbit-once";
  return awake ? "glyph-orbit" : "glyph-orbit glyph-orbit-asleep";
}

/** L'alphabet des mondes (chantier scène optique, 2026-08-20).
 *
 *  UN dessin par monde, UNE teinte par monde — partagés par la Lens
 *  Room, la signature du header et l'overlay de transition : deux
 *  dessins qui divergent seraient deux mondes qui divergent.
 *
 *  Les glyphes sont wireframe, trait fin — jamais photoréalistes. La
 *  teinte est PÉRIPHÉRIQUE (halo, anneau, signature) : l'accent
 *  outremer des actions ne bouge jamais, et aucune page n'est teintée. */

/** L'orbite — le monde spatial. `awake` anime (dessin + satellite) ;
 *  `once` joue la signature UNE fois (~2 s) puis se fige — l'événement
 *  d'entrée, jamais une boucle (arbitrage ②). */
export function OrbitGlyph({
  awake = false,
  once = false,
  stroke = 3.2,
}: {
  awake?: boolean;
  once?: boolean;
  stroke?: number;
}) {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth={stroke}>
        <circle cx="160" cy="160" r="26" strokeOpacity=".55" />
        <circle cx="160" cy="160" r="5" fill="currentColor" stroke="none" />
        <ellipse
          cx="160"
          cy="160"
          rx="126"
          ry="54"
          strokeOpacity=".8"
          transform="rotate(-24 160 160)"
          pathLength={1}
          className={awake || once ? "glyph-draw" : undefined}
        />
        <ellipse
          cx="160"
          cy="160"
          rx="88"
          ry="112"
          strokeOpacity=".18"
          transform="rotate(-24 160 160)"
        />
      </g>
      {/* Le satellite en CSS offset-path — le SMIL d'origine ignorait
          animation-play-state et tournait en permanence (recette ②,
          2026-08-20) : en CSS, il DORT jusqu'au survol. */}
      <circle
        r="7"
        fill="var(--glyph-tint, currentColor)"
        className={cnOrbit(awake, once)}
        style={{
          offsetPath:
            'path("M 44.9 211.2 A 126 54 24 1 1 275.1 108.8 A 126 54 24 1 1 44.9 211.2 Z")',
        }}
      />
    </svg>
  );
}

/** Le profil d'aile — le monde aéronautique : extrados, intrados,
 *  corde, trois flux qui le contournent. */
export function WingGlyph({
  awake = false,
  once = false,
  stroke = 3.2,
}: {
  awake?: boolean;
  once?: boolean;
  stroke?: number;
}) {
  const play = awake || once;
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      <g fill="none" strokeWidth={stroke}>
        {[104, 160, 216].map((y, i) => (
          <path
            key={y}
            d={
              i === 1
                ? "M 12 160 C 80 160 96 138 160 138 C 224 138 240 160 308 160"
                : `M 12 ${y} C 90 ${y} 120 ${y + (i === 0 ? 14 : -14)} 160 ${y + (i === 0 ? 14 : -14)} C 200 ${y + (i === 0 ? 14 : -14)} 230 ${y} 308 ${y}`
            }
            stroke="var(--glyph-tint, currentColor)"
            strokeOpacity=".42"
            strokeDasharray="7 9"
            className={play ? (once ? "glyph-flow-once" : "glyph-flow") : undefined}
            style={play ? { animationDelay: `${i * 0.35}s` } : undefined}
          />
        ))}
        <path
          d="M 56 176 C 92 138 180 126 264 152 C 228 174 120 186 56 176 Z"
          stroke="currentColor"
          strokeOpacity=".85"
          pathLength={1}
          className={play ? "glyph-draw" : undefined}
        />
        <path d="M 56 176 L 264 152" stroke="currentColor" strokeOpacity=".3" />
      </g>
    </svg>
  );
}

/** La constellation — « Tout le corpus » n'est pas une absence : c'est
 *  le troisième monde, et il a SON objet. */
export function ConstellationGlyph({
  awake = false,
  once = false,
  stroke = 3.2,
}: {
  awake?: boolean;
  once?: boolean;
  stroke?: number;
}) {
  const play = awake || once;
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      <path
        d="M 42 246 L 118 122 L 178 156 L 278 58"
        stroke="var(--glyph-tint, currentColor)"
        strokeOpacity=".4"
        strokeWidth={stroke}
        fill="none"
        pathLength={1}
        className={play ? "glyph-draw" : undefined}
      />
      <circle cx="42" cy="246" r="8" fill="currentColor" />
      <circle cx="118" cy="122" r="8" fill="currentColor" />
      <circle
        cx="178"
        cy="156"
        r="8"
        fill="currentColor"
        className={play ? (once ? "glyph-twinkle-once" : "glyph-twinkle") : undefined}
      />
      <circle cx="278" cy="58" r="10" fill="var(--glyph-tint, currentColor)" />
    </svg>
  );
}

export const WORLD_GLYPHS: Record<
  string,
  (props: { awake?: boolean; once?: boolean; stroke?: number }) => ReactElement
> = {
  space: OrbitGlyph,
  aviation: WingGlyph,
};
