import { WORLD_TINTS } from "@/lib/world-tints";

/** L'ornement d'ACCUEIL (recette ② du 2026-08-20, second retour) :
 *  l'avion et la fusée ne sont plus un sas de navigation — ils vivent
 *  sur la home cadrée. À l'arrivée dans un monde, l'objet passe UNE
 *  fois, discrètement (~1,3 s), puis c'est fini. Il ne bloque rien
 *  (pointer-events none), ne gêne pas la lecture (tiers haut de
 *  l'écran, opacité contenue), et ne joue jamais sous reduced-motion.
 *  La home nue n'a pas d'ornement. */

const CRAFT: Record<string, string> = {
  aviation:
    '<path d="M6 34 L58 30 L74 32 L58 36 Z" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 32 L20 10 L28 10 L44 31" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 33 L22 54 L30 54 L44 33" fill="none" stroke-width="2.4"/>' +
    '<path d="M10 33 L4 22 L9 22 L16 33" fill="none" stroke-width="2"/>' +
    '<path d="M10 34 L5 44 L10 44 L16 34" fill="none" stroke-width="2"/>',
  space:
    '<path d="M46 12 C54 18 58 26 58 34 L58 46 L34 46 L34 34 C34 26 38 18 46 12 Z" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 40 L24 52 L34 50 Z" fill="none" stroke-width="2.2"/>' +
    '<path d="M58 40 L68 52 L58 50 Z" fill="none" stroke-width="2.2"/>' +
    '<path d="M46 46 L46 66" stroke-dasharray="3 5" stroke-width="2.6"/>' +
    '<path d="M40 48 L38 60 M52 48 L54 60" stroke-dasharray="2 5" stroke-width="2"/>',
};

let live: (() => void) | null = null;

export function playWorldOrnament(slug: string): void {
  const craft = CRAFT[slug];
  if (!craft || typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  live?.();

  const dark = document.documentElement.classList.contains("dark");
  const tint = WORLD_TINTS[slug]?.[dark ? "dark" : "light"] ?? "#8b9aff";
  const DURATION = 1300;
  const plane = slug === "aviation";

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.worldOrnament = slug;
  // L'avion TRAVERSE l'écran dans le tiers haut, de gauche à droite,
  // léger cabré ; la fusée DÉCOLLE le long du bord droit, du bas du
  // premier écran vers le haut.
  const startX = plane ? -90 : window.innerWidth * 0.86;
  const startY = plane ? window.innerHeight * 0.24 : window.innerHeight * 0.78;
  const dx = plane ? window.innerWidth + 180 : 24;
  const dy = plane ? -window.innerHeight * 0.08 : -(window.innerHeight * 0.92);
  const angle = plane ? "-6deg" : "0deg";
  el.style.cssText =
    `position:fixed;z-index:70;pointer-events:none;` +
    `left:${startX}px;top:${startY}px;width:56px;height:56px;` +
    `color:${tint};opacity:0;` +
    `filter:drop-shadow(0 0 7px color-mix(in srgb, ${tint} 55%, transparent));` +
    `transform:translate(0,0) rotate(${angle});` +
    `transition:transform ${DURATION}ms cubic-bezier(.35,.1,.55,.95), opacity 260ms ease-out;` +
    `will-change:transform,opacity;`;
  el.innerHTML =
    `<svg viewBox="0 0 78 66" width="56" height="56" stroke="currentColor" fill="none">${craft}</svg>`;
  document.body.append(el);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
    live = null;
  };
  live = finish;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.style.opacity = "0.6";
      el.style.transform = `translate(${dx}px,${dy}px) rotate(${angle})`;
      window.setTimeout(() => {
        el.style.opacity = "0";
      }, DURATION - 280);
    }),
  );
  window.setTimeout(finish, DURATION + 60);
}
