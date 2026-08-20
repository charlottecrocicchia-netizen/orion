import { WORLD_TINTS } from "@/lib/world-tints";

/** L'ornement d'ACCUEIL (recette ② du 2026-08-20, second retour ;
 *  tempo du retour final) : l'avion et la fusée ne sont plus un sas de
 *  navigation — ils vivent sur la home cadrée. À l'arrivée dans un
 *  monde, l'objet passe UNE fois, calmement : l'avion fait un tour —
 *  un looping gracieux sur `offset-path`, le nez suivant la tangente —
 *  puis sort (~3,8 s) ; la fusée monte, majestueuse (~3 s). Il ne
 *  bloque rien (pointer-events none), ne gêne pas la lecture (tiers
 *  haut de l'écran, opacité contenue), et ne joue jamais sous
 *  reduced-motion. La home nue n'a pas d'ornement. */

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
  const plane = slug === "aviation";
  // Vol calme, jamais pressé : l'avion prend le temps de son tour, la
  // fusée celui de sa montée.
  const DURATION = plane ? 3800 : 3000;

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.worldOrnament = slug;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  el.style.cssText =
    `position:fixed;z-index:70;pointer-events:none;` +
    `left:0;top:0;width:56px;height:56px;` +
    `color:${tint};opacity:0;` +
    `filter:drop-shadow(0 0 7px color-mix(in srgb, ${tint} 55%, transparent));` +
    `transition:opacity 300ms ease-out;will-change:transform,opacity;`;
  el.innerHTML =
    `<svg viewBox="0 0 78 66" width="56" height="56" stroke="currentColor" fill="none">${craft}</svg>`;

  const canLoop =
    typeof CSS !== "undefined" &&
    CSS.supports("offset-path", 'path("M0 0 L1 1")');

  let flight: Animation | null = null;
  if (plane && canLoop) {
    // Le TOUR : entrée par la gauche en montée douce, un looping
    // complet (deux demi-arcs — la tangente est horizontale au bas du
    // cercle, la continuité est exacte), puis la sortie hors champ à
    // droite. `offset-rotate: auto` oriente le nez le long du chemin —
    // l'avion passe sur le dos au sommet, comme un vrai looping.
    const y0 = vh * 0.3;
    const r = Math.min(62, vh * 0.09);
    const d =
      `M -90 ${y0} ` +
      `C ${vw * 0.14} ${y0 - 8}, ${vw * 0.28} ${y0 - 22}, ${vw * 0.42} ${y0 - 26} ` +
      `a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r} ` +
      `C ${vw * 0.58} ${y0 - 30}, ${vw * 0.78} ${y0 - 48}, ${vw + 150} ${y0 - vh * 0.12}`;
    el.style.offsetPath = `path("${d}")`;
    el.style.offsetRotate = "auto";
    flight = el.animate(
      [{ offsetDistance: "0%" }, { offsetDistance: "100%" }],
      { duration: DURATION, easing: "cubic-bezier(.3,.05,.7,.95)", fill: "forwards" },
    );
    flight.pause();
  } else {
    // Fusée — ou repli sans offset-path : trajectoire droite, au tempo
    // calme. La fusée grimpe le long du bord droit, poussée régulière.
    const startX = plane ? -90 : vw * 0.86;
    const startY = plane ? vh * 0.24 : vh * 0.78;
    const dx = plane ? vw + 180 : 24;
    const dy = plane ? -vh * 0.08 : -(vh * 0.92);
    const angle = plane ? "-6deg" : "0deg";
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.transform = `translate(0,0) rotate(${angle})`;
    el.style.transition = `transform ${DURATION}ms cubic-bezier(.42,.08,.62,.82), opacity 300ms ease-out`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px,${dy}px) rotate(${angle})`;
      }),
    );
  }

  document.body.append(el);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    flight?.cancel();
    el.remove();
    live = null;
  };
  live = finish;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.style.opacity = "0.6";
      flight?.play();
      window.setTimeout(() => {
        el.style.opacity = "0";
      }, DURATION - 420);
    }),
  );
  window.setTimeout(finish, DURATION + 80);
}
