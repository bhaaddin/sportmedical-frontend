/* ══════════════════════════════════════════════════════════════
   PARALLAX - an image (or anything) inside a frame that lags behind the scroll, so the picture has depth.

   The frame crops (overflow hidden) and the inner layer is scaled a little larger than the frame, so its edges never
   show while it moves. One shared scroll listener drives every parallax on the page, and only the ones in view
   (an IntersectionObserver keeps that set), so ten of them cost one rAF per scroll frame. 'plné' only: any other
   state renders the frame and the layer without a transform.
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { DIST } from './tokens';
import { useMotionPreference } from './useMotionPreference';

interface Item {
  frame: HTMLElement;
  layer: HTMLElement;
  strength: number;
}

const visible = new Set<Item>();
let listening = false;
let queued = false;

function frame(): void {
  queued = false;
  const vh = window.innerHeight;
  const reads: [Item, number][] = [];
  for (const item of visible) {
    const r = item.frame.getBoundingClientRect();
    // -1 when the frame's centre is at the bottom edge of the screen, +1 at the top edge.
    const progress = (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
    reads.push([item, Math.max(-1, Math.min(1, progress))]);
  }
  for (const [item, progress] of reads) {
    const shift = progress * item.strength * item.frame.offsetHeight;
    item.layer.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(${(1 + item.strength * 2).toFixed(3)})`;
  }
}

function schedule(): void {
  if (!queued) {
    queued = true;
    requestAnimationFrame(frame);
  }
}

function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}

export interface ParallaxProps {
  as?: ElementType;
  /** Fraction of the frame's height the layer travels at the extremes (also sets the oversize). */
  strength?: number;
  className?: string;
  style?: CSSProperties;
  layerClassName?: string;
  layerStyle?: CSSProperties;
  children?: ReactNode;
}

export function Parallax({ as = 'div', strength = DIST.parallax, className, style, layerClassName, layerStyle, children }: ParallaxProps) {
  const { cinematic } = useMotionPreference();
  const frameRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = frameRef.current;
    const layer = layerRef.current;
    if (host === null || layer === null || !cinematic || typeof IntersectionObserver === 'undefined') return undefined;
    const item: Item = { frame: host, layer, strength };
    listen();
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        visible.add(item);
        schedule();
      } else visible.delete(item);
    }, { rootMargin: '10% 0px' });
    observer.observe(host);
    return () => {
      observer.disconnect();
      visible.delete(item);
      layer.style.transform = '';
    };
  }, [cinematic, strength]);

  return createElement(
    as,
    { ref: frameRef, className, style: { position: 'relative', overflow: 'hidden', ...style } },
    <div ref={layerRef} className={layerClassName} style={{ height: '100%', willChange: cinematic ? 'transform' : undefined, ...layerStyle }}>
      {children}
    </div>,
  );
}
