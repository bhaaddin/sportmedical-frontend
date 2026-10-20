/* ══════════════════════════════════════════════════════════════
   ROW STAGGER - the rows of a list arrive one after another, ONCE: the first time the list has anything to show.

   A refetch, a filter, a page change or a re-sort never replays it (the hook remembers it ran, per mount), and it never
   delays the rows: they are in the DOM and clickable from the first frame, the fade is 140 ms and the whole cascade is
   capped (14 rows, 22 ms apart = 0.3 s). Full motion only; 'omezené' and 'vypnuto' show the rows at once. When the
   animation library has not arrived yet (it is fetched after the first paint) the rows simply appear.
   ══════════════════════════════════════════════════════════════ */

import { useRef } from 'react';
import { DIST, DUR, EASE, STAGGER } from './tokens';
import { loadMotion, motionIfLoaded } from './engine';
import { useIsoLayoutEffect } from './hooks';
import { useMotionPreference } from './useMotionPreference';

const MAX_ROWS = 14;

export function useRowStagger<T extends HTMLElement>(ref: React.RefObject<T | null>, ready: boolean, selector = ':scope > *'): void {
  const { cinematic } = useMotionPreference();
  const done = useRef(false);

  useIsoLayoutEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const root = ref.current;
    if (root === null || !cinematic) return;
    const api = motionIfLoaded();
    if (api === null) {
      void loadMotion();
      return;
    }
    const rows = Array.from(root.querySelectorAll<HTMLElement>(selector)).slice(0, MAX_ROWS);
    if (rows.length === 0) return;
    for (const row of rows) row.style.opacity = '0';
    void api
      .animate(rows, { opacity: [0, 1], transform: [`translateY(${DIST.nudge}px)`, 'translateY(0px)'] } as never, { duration: DUR.quick, ease: EASE.out as never, delay: api.stagger(STAGGER.rows) })
      .then(() => {
        for (const row of rows) {
          row.style.removeProperty('opacity');
          row.style.removeProperty('transform');
        }
      });
  }, [ready, cinematic]);
}
