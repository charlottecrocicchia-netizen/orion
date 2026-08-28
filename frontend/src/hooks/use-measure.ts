import { useEffect, useRef, useState } from "react";

/** Width of a container, tracked through resizes — charts lay out in real
 *  pixels so text keeps a constant, readable size at every viewport. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    // jsdom n'a pas ResizeObserver (et certains harnais retirent son
    // stub) : sans observateur, la taille reste à sa valeur initiale.
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
