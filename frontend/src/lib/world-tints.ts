/** Les teintes des mondes (arbitrage ②, 2026-08-20) — PÉRIPHÉRIQUES :
 *  halo du header, anneau de la salle, signature. L'accent outremer
 *  des actions ne bouge jamais ; aucune page n'est teintée. */
export const WORLD_TINTS: Record<string, { light: string; dark: string }> = {
  space: { light: "#4f46e5", dark: "#7c86f8" },
  aviation: { light: "#0891b2", dark: "#67d8e9" },
};

export function worldTintVars(slug: string): Record<string, string> | undefined {
  const tint = WORLD_TINTS[slug];
  if (!tint) return undefined;
  return { "--world-tint-light": tint.light, "--world-tint-dark": tint.dark };
}
