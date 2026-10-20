/* ══════════════════════════════════════════════════════════════
   PAGE TRANSITION - the content of the route replays a short arrival when the route changes.

   It never remounts the page and never delays it: the new screen is already there, the element only fades/nudges
   it in. The two personalities differ in length and travel:
     'staff'  <= 180 ms, a 6 px nudge ('omezené': a plain fade) - an answer to a click, not a show;
     'site'   0.45 s with a longer rise (public website only).
   The first render (a prerendered page, a reload) is never animated, and neither is a render before the library
   is there (it is warmed after the first paint; a click never waits for it).

   `usePageArrival` is the hook for an element that already exists (the staff shell's scroll region, which must keep
   its flex/overflow behaviour); `PageTransition` is the same thing as a wrapper element.
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';
import { DIST, DUR, EASE } from './tokens';
import { loadMotion, motionIfLoaded } from './engine';
import { useMotionPreference } from './useMotionPreference';

export type PagePersonality = 'staff' | 'site';

export function usePageArrival(ref: React.RefObject<HTMLElement | null>, routeKey: string, personality: PagePersonality = 'staff'): void {
  const { mode } = useMotionPreference();
  const previous = useRef(routeKey);

  useEffect(() => {
    if (previous.current === routeKey) return;
    previous.current = routeKey;
    const el = ref.current;
    if (el === null || mode === 'vypnuto') return;
    const api = motionIfLoaded();
    if (api === null) {
      void loadMotion();
      return;
    }
    const staff = personality === 'staff';
    const rise = staff ? DIST.nudge : DIST.rise;
    const keyframes = mode === 'omezené' ? { opacity: [0.001, 1] } : { opacity: [0.001, 1], y: [rise, 0] };
    void api
      .animate(el, keyframes as never, { duration: staff ? DUR.staffMax : 0.45, ease: EASE.out as never })
      .then(() => {
        el.style.removeProperty('transform');
        el.style.removeProperty('opacity');
      });
  }, [ref, routeKey, mode, personality]);
}

export interface PageTransitionProps {
  /** Changes when the route changes (usually the pathname). */
  routeKey: string;
  personality?: PagePersonality;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

export function PageTransition({ routeKey, personality = 'staff', as = 'div', className, children }: PageTransitionProps) {
  const ref = useRef<HTMLElement>(null);
  usePageArrival(ref, routeKey, personality);
  return createElement(as, { ref, className }, children);
}
