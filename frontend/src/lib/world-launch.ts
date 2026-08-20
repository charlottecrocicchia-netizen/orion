import { WORLD_TINTS } from "@/lib/world-tints";

/** Le DÉCOLLAGE (recette ③ du 2026-08-20) : au clic sur une lentille,
 *  un objet du monde choisi apparaît et PART — un avion pour
 *  l'aéronautique, une fusée pour le spatial — environ une seconde,
 *  puis la navigation s'accomplit. Wireframe, trait de l'alphabet,
 *  jamais photoréaliste.
 *
 *  Le contrat de temps : la navigation n'est JAMAIS retardée au-delà
 *  de l'animation — un clic pendant le vol saute à la fin, et
 *  reduced-motion navigue immédiatement, sans rien jouer. */

const CRAFT: Record<string, string> = {
  // L'avion — silhouette wireframe vue de dessus : fuselage, voilure
  // en flèche, empennage.
  aviation:
    '<path d="M6 34 L58 30 L74 32 L58 36 Z" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 32 L20 10 L28 10 L44 31" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 33 L22 54 L30 54 L44 33" fill="none" stroke-width="2.4"/>' +
    '<path d="M10 33 L4 22 L9 22 L16 33" fill="none" stroke-width="2"/>' +
    '<path d="M10 34 L5 44 L10 44 L16 34" fill="none" stroke-width="2"/>',
  // La fusée — ogive, corps, ailerons, et la flamme en pointillés.
  space:
    '<path d="M46 12 C54 18 58 26 58 34 L58 46 L34 46 L34 34 C34 26 38 18 46 12 Z" fill="none" stroke-width="2.4"/>' +
    '<path d="M34 40 L24 52 L34 50 Z" fill="none" stroke-width="2.2"/>' +
    '<path d="M58 40 L68 52 L58 50 Z" fill="none" stroke-width="2.2"/>' +
    '<path d="M46 46 L46 66" stroke-dasharray="3 5" stroke-width="2.6"/>' +
    '<path d="M40 48 L38 60 M52 48 L54 60" stroke-dasharray="2 5" stroke-width="2"/>',
};

let live: (() => void) | null = null;

export function playWorldLaunch(options: {
  slug: string;
  origin: { x: number; y: number };
  onDone: () => void;
}): void {
  const craft = CRAFT[options.slug];
  const reduce =
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!craft || reduce) {
    options.onDone();
    return;
  }
  live?.();

  const dark = document.documentElement.classList.contains("dark");
  const tint = WORLD_TINTS[options.slug]?.[dark ? "dark" : "light"] ?? "#8b9aff";
  const DURATION = 950;

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.dataset.worldLaunch = options.slug;
  // La fusée part droit vers le haut, l'avion monte en diagonale — et
  // l'objet est orienté vers son cap.
  const plane = options.slug === "aviation";
  const angle = plane ? "-18deg" : "0deg";
  const dx = plane ? 260 : 40;
  const dy = plane ? -190 : -320;
  el.style.cssText =
    `position:fixed;z-index:82;pointer-events:none;` +
    `left:${options.origin.x - 39}px;top:${options.origin.y - 39}px;` +
    `width:78px;height:78px;color:${tint};` +
    `filter:drop-shadow(0 0 8px color-mix(in srgb, ${tint} 60%, transparent));` +
    `transform:translate(0,0) rotate(${angle}) scale(.8);opacity:0;` +
    `transition:transform ${DURATION}ms cubic-bezier(.45,.05,.6,1), opacity 240ms ease-out;` +
    `will-change:transform,opacity;`;
  el.innerHTML =
    `<svg viewBox="0 0 78 66" width="78" height="78" stroke="currentColor" fill="none">${craft}</svg>`;
  document.body.append(el);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
    removeEventListener("pointerdown", finish, true);
    live = null;
    options.onDone();
  };
  live = finish;
  addEventListener("pointerdown", finish, true);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = `translate(${dx}px,${dy}px) rotate(${angle}) scale(1)`;
      // le fondu de fin : l'objet s'éloigne, il ne s'écrase pas
      window.setTimeout(() => {
        el.style.transition = `transform ${DURATION}ms cubic-bezier(.45,.05,.6,1), opacity 260ms ease-in`;
        el.style.opacity = "0";
      }, DURATION - 260);
    }),
  );
  window.setTimeout(finish, DURATION + 40);
}
