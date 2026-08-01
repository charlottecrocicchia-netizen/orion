import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animate 0 → value once, easing out; renders the final value immediately
 *  when the user prefers reduced motion. */
export function useCountUp(value: number | null | undefined, duration = 900): number | null {
  const [current, setCurrent] = useState<number | null>(reducedMotion() ? (value ?? null) : 0);
  const done = useRef(false);

  useEffect(() => {
    if (value == null) return;
    if (reducedMotion() || done.current) {
      setCurrent(value);
      return;
    }
    done.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCurrent(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return value == null ? null : current;
}
