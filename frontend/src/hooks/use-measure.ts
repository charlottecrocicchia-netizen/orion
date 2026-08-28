import { useEffect, useRef, useState } from "react";

/** Width of a container, tracked through resizes — charts lay out in real
 *  pixels so text keeps a constant, readable size at every viewport. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    // jsdom n'a pas ResizeObserver (et certains harnais retirent son
    // stub) : sans observateur, la largeur reste à sa valeur initiale.
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
