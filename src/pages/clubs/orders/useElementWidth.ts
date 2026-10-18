import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The width of one element, kept up to date as it is resized. `null` until it is known (and always in an environment
 * without ResizeObserver, e.g. jsdom), so a caller can treat "unknown" as "wide enough" and render its roomy layout.
 * Use the returned callback as the element's `ref`.
 */
export function useElementWidth(): [(el: HTMLElement | null) => void, number | null] {
  const [width, setWidth] = useState<number | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setElement(el), []);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;
    setWidth(Math.round(element.getBoundingClientRect().width));
    observer.current = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(Math.round(w));
    });
    observer.current.observe(element);
    return () => { observer.current?.disconnect(); observer.current = null; };
  }, [element]);

  return [ref, width];
}
