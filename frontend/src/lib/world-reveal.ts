import { WORLD_TINTS } from "@/lib/world-tints";

/** La révélation de monde (arbitrages ③+⑤, 2026-08-20) — UN SEUL
 *  langage pour entrer et pour changer : un anneau teinté part d'une
 *  origine (le verre de la salle, ou le header pour un changement de
 *  lentille) et s'ouvre sur le monde ; le contenu réel rend DESSOUS —
 *  on voit la vraie home à travers le verre, jamais une copie.
 *
 *  Mécanique : un disque TRANSPARENT (le trou) porte un box-shadow
 *  géant qui fait le voile ; scaler le disque agrandit le trou. Un
 *  seul transform, rasterisé une fois — le chemin 60 fps.
 *
 *  Impératif et hors React à dessein : l'overlay vit au-dessus des
 *  routes, une navigation le traverse sans le démonter. Réglages
 *  validés : 900 ms (l'entrée), 380 ms (le changement) ; interruptible
 *  au clic ; reduced-motion = aucune animation. */

const EASE = "cubic-bezier(.3,.7,.25,1)";
let live: (() => void) | null = null;

export function playWorldReveal(options: {
  slug: string;
  origin?: { x: number; y: number; radius: number };
  duration?: number;
}): void {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  live?.();

  const dark = document.documentElement.classList.contains("dark");
  const tint = WORLD_TINTS[options.slug]?.[dark ? "dark" : "light"] ?? "#8b9aff";
  const duration = options.duration ?? 380;
  const cx = options.origin?.x ?? window.innerWidth / 2;
  const cy = options.origin?.y ?? window.innerHeight / 2;
  const r0 = Math.max(options.origin?.radius ?? 24, 12);
  const r1 = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy),
  );
  const scale = (r1 + 60) / r0;

  const hole = document.createElement("div");
  hole.setAttribute("aria-hidden", "true");
  hole.style.cssText =
    `position:fixed;z-index:80;pointer-events:none;border-radius:50%;` +
    `left:${cx - r0}px;top:${cy - r0}px;width:${r0 * 2}px;height:${r0 * 2}px;` +
    `box-shadow:0 0 0 200vmax var(--color-background);` +
    `transform:scale(1);transform-origin:center;will-change:transform;` +
    `transition:transform ${duration}ms ${EASE};`;

  const ring = document.createElement("div");
  ring.setAttribute("aria-hidden", "true");
  ring.dataset.worldReveal = options.slug;
  ring.style.cssText =
    `position:fixed;z-index:81;pointer-events:none;border-radius:50%;` +
    `left:${cx - r0}px;top:${cy - r0}px;width:${r0 * 2}px;height:${r0 * 2}px;` +
    `border:2.5px solid ${tint};box-shadow:0 0 80px -10px ${tint}, inset 0 0 40px -20px ${tint};` +
    `transform:scale(1);transform-origin:center;will-change:transform;` +
    `transition:transform ${duration}ms ${EASE}, opacity 200ms ease ${Math.max(duration - 160, 0)}ms;`;

  document.body.append(hole, ring);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    hole.remove();
    ring.remove();
    removeEventListener("pointerdown", finish, true);
    live = null;
  };
  live = finish;
  // Interruptible : un clic pendant le vol saute à l'état final.
  addEventListener("pointerdown", finish, true);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      hole.style.transform = `scale(${scale})`;
      ring.style.transform = `scale(${scale})`;
      ring.style.opacity = "0";
    }),
  );
  window.setTimeout(finish, duration + 80);
}
