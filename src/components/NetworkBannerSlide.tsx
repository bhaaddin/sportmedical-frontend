/*
 * The slide-in / slide-out of the "offline" and "server not answering" strip. It was the only user of the full animation
 * library (~120 kB of script); it is plain CSS now (keyframes sm-banner-in / sm-banner-out in src/motion/motion.css, the same
 * tokens as the rest of the staff app), so the strip costs no download. NetworkBanner still loads this file lazily.
 * The strip is unmounted a moment after its slide-out has run (a timer, not an animation event: under 'vypnuto' - where
 * <html data-motion="off"> kills animations - it goes at once, and a blocked stylesheet could never strand it on screen).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const SLIDE_OUT_MS = 200;

export default function NetworkBannerSlide({ show, children }: { show: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return undefined;
    }
    const instant = document.documentElement.dataset.motion === 'off';
    const timer = window.setTimeout(() => setMounted(false), instant ? 0 : SLIDE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [show]);
  if (!mounted) return null;
  return (
    <div className={show ? 'sm-banner sm-banner-in' : 'sm-banner sm-banner-out'} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      {children}
    </div>
  );
}
