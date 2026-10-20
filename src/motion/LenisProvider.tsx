/* ══════════════════════════════════════════════════════════════
   LENIS PROVIDER - smooth (inertial) scrolling for the PUBLIC website.

   Mounted by WebLayout and by /motion-lab, never by the staff application (a test walks the staff app's import graph;
   the bundle budget forbids the chunk there). It starts only when ALL of these hold:
     - the setting is 'plné';
     - the main pointer is a mouse or trackpad - on a touch screen the browser's own momentum scrolling is better
       than any imitation of it, and Lenis stays out of the way;
     - the page has been painted (afterFirstPaint).
   The element it eases is the document; the staff application's own scroll containers are not involved.
   ══════════════════════════════════════════════════════════════ */

import { useEffect } from 'react';
import { afterFirstPaint } from '../utils/afterFirstPaint';
import { hasFinePointer } from './hooks';
import { bridgeLenis } from './scrollBridge';
import { useMotionPreference } from './useMotionPreference';

export function LenisProvider(): null {
  const { cinematic } = useMotionPreference();

  useEffect(() => {
    if (!cinematic || !hasFinePointer()) return undefined;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    void afterFirstPaint().then(async () => {
      if (cancelled) return;
      const { default: Lenis } = await import('lenis');
      if (cancelled) return;
      const lenis = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 0.9, anchors: true });
      bridgeLenis(lenis);
      destroy = () => {
        bridgeLenis(null);
        lenis.destroy();
        document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped');
      };
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [cinematic]);

  return null;
}
