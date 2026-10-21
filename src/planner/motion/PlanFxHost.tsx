/*
 * Mounted once inside the planner: turns a refusal into `data-refuse` on the planner's root for a moment. The CSS
 * (`planner.fx.css`) does the rest - a gentle shake of the board and the armed card under `plné`, a quiet flash under
 * `omezené`, nothing under `vypnuto` - so this component never touches a transform itself.
 */
import { useEffect, useRef } from 'react';
import { useRefusals } from './planFx';

export const REFUSE_MS = 460;

export function PlanFxHost() {
  const refusals = useRefusals();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const root = document.querySelector<HTMLElement>('.sm-planner');
    if (!root) return undefined;
    root.removeAttribute('data-refuse');
    /* a frame in between, so a second refusal restarts the animation */
    const raf = requestAnimationFrame(() => root.setAttribute('data-refuse', String(refusals % 2)));
    const timer = window.setTimeout(() => root.removeAttribute('data-refuse'), REFUSE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [refusals]);
  return null;
}
