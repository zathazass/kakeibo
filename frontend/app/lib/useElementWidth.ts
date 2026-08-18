import { useEffect, useLayoutEffect, useRef, useState } from "react";

// SPA mode never renders on a server, but guard anyway so the import stays safe.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Measures an element's rendered width.
 *
 * Charts use this to draw at true pixel size: the SVG viewBox matches the
 * measured width, so nothing is scaled — axis text stays the size it was
 * authored at, and the plot gets wider rather than taller as the window grows.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 960) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const next = Math.round(element.clientWidth);
      if (next > 0) setWidth(next);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
