import { useEffect, useRef, useState } from "react";

/** One eased progress, armed once when the element enters the viewport.
 *  Reduced motion (or no IntersectionObserver, e.g. jsdom) renders the
 *  final state immediately. Drives the StatHero and the record pages'
 *  draw-on-entry trajectory lines. */

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);

export function useRevealProgress(ready: boolean, duration = 1600) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const armed = useRef(false);

  useEffect(() => {
    if (!ready || armed.current) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (reduced || typeof IntersectionObserver === "undefined" || !el) {
      armed.current = true;
      setProgress(1);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || armed.current) return;
        armed.current = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const u = Math.min((t - t0) / duration, 1);
          setProgress(easeOutCubic(u));
          if (u < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ready, duration]);

  return { ref, progress };
}
