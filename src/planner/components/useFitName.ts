/*
 * useFitName - the club / clinic name in the header's identity block must show in full (owner, 18. 10. 2026: the clinic's
 * "SportMedical Diagnostics" was cut at the right edge). The file draws the name at 25.5 px on one line
 * (planner.css `#club-identity-name`); a name that is wider than the block is drawn smaller - never smaller than
 * `MIN_NAME_SCALE` - and only a name that still does not fit at that size gets an ellipsis. The full name is in the tooltip
 * exactly when it was shrunk or cut, so a name that fits has no tooltip.
 *
 * The element carries `--name-fit` (1 = the file's size); `planner.fluid.css` turns it into the font size.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

/** 25.5 px x 0.62 = 15.8 px: the smallest the name is drawn before it is cut with an ellipsis. */
export const MIN_NAME_SCALE = 0.62;

export interface NameFit {
  /** font-size factor, 1 = the file's size */
  scale: number;
  /** true when even the smallest size does not fit and the ellipsis cuts the name */
  cut: boolean;
}

export const NAME_FITS: NameFit = { scale: 1, cut: false };

/** `natural` = width of the text at the file's size, `available` = width the block gives it (both layout px). */
export function nameFit(natural: number, available: number): NameFit {
  if (!(natural > 0) || !(available > 0) || natural <= available + 0.5) return NAME_FITS;
  const want = available / natural;
  if (want >= MIN_NAME_SCALE) return { scale: Math.floor(want * 1000) / 1000, cut: false };
  return { scale: MIN_NAME_SCALE, cut: true };
}

export function useFitName(ref: RefObject<HTMLElement | null>, text: string): NameFit {
  const [fit, setFit] = useState<NameFit>(NAME_FITS);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      /* measure at the file's size: scrollWidth is the text's own width, clientWidth what the block gives it */
      const had = el.style.getPropertyValue('--name-fit');
      el.style.setProperty('--name-fit', '1');
      const next = nameFit(el.scrollWidth, el.clientWidth);
      if (had) el.style.setProperty('--name-fit', had); else el.style.removeProperty('--name-fit');
      setFit((prev) => (prev.scale === next.scale && prev.cut === next.cut ? prev : next));
    };
    measure();
    const parent = el.parentElement;
    const observer = typeof ResizeObserver === 'undefined' || !parent ? null : new ResizeObserver(measure);
    if (observer && parent) observer.observe(parent);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    let alive = true;
    void fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; observer?.disconnect(); };
  }, [ref, text]);
  return fit;
}
