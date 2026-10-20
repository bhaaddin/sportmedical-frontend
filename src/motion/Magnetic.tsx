/* ══════════════════════════════════════════════════════════════
   MAGNETIC / TILT - hover physics for the public site. A fine pointer and 'plné' only; everything else renders the
   plain element. Both ease one element toward a target in their own requestAnimationFrame loop, so they respond from
   the first pointer move without waiting for any library.
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { DIST } from './tokens';
import { hasFinePointer } from './hooks';
import { useMotionPreference } from './useMotionPreference';

type Pose = Record<'x' | 'y' | 'rx' | 'ry' | 'lift', number>;
const REST: Pose = { x: 0, y: 0, rx: 0, ry: 0, lift: 0 };
const KEYS = Object.keys(REST) as (keyof Pose)[];

/** Eases a pose toward a target and writes it as a transform each frame; sleeps when it has arrived. */
export function createEaser(el: HTMLElement, compose: (pose: Pose) => string, ease = 0.18) {
  const now: Pose = { ...REST };
  const target: Pose = { ...REST };
  let raf = 0;
  const tick = () => {
    let moving = false;
    for (const key of KEYS) {
      const d = target[key] - now[key];
      if (Math.abs(d) > 0.05) {
        now[key] += d * ease;
        moving = true;
      } else now[key] = target[key];
    }
    const atRest = KEYS.every((key) => now[key] === 0 && target[key] === 0);
    el.style.transform = atRest ? '' : compose(now);
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  return {
    to(next: Partial<Pose>) {
      Object.assign(target, next);
      if (raf === 0) raf = requestAnimationFrame(tick);
    },
    stop() {
      if (raf !== 0) cancelAnimationFrame(raf);
      el.style.transform = '';
    },
  };
}

export interface MagneticProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Fraction of the pointer's offset from the centre the element follows. */
  pull?: number;
  /** How far outside the element (px) the pull starts. */
  reach?: number;
  children?: ReactNode;
}

export function Magnetic({ as = 'span', pull = DIST.magnet, reach = 72, children, style, ...rest }: MagneticProps) {
  const ref = useRef<HTMLElement>(null);
  const { cinematic } = useMotionPreference();
  const enabled = cinematic;

  useEffect(() => {
    const el = ref.current;
    if (el === null || !enabled || !hasFinePointer()) return undefined;
    const easer = createEaser(el, (p) => `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`);
    // The element's untransformed centre: its rect minus the offset we applied is what we aim at.
    let home = el.getBoundingClientRect();
    let offset = { x: 0, y: 0 };
    const measure = () => {
      const r = el.getBoundingClientRect();
      home = new DOMRect(r.left - offset.x, r.top - offset.y, r.width, r.height);
    };
    const onMove = (event: PointerEvent) => {
      const cx = home.left + home.width / 2;
      const cy = home.top + home.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const inside = Math.abs(dx) < home.width / 2 + reach && Math.abs(dy) < home.height / 2 + reach;
      offset = inside ? { x: dx * pull, y: dy * pull } : { x: 0, y: 0 };
      easer.to(offset);
    };
    const onScroll = () => measure();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      easer.stop();
    };
  }, [enabled, pull, reach]);

  return createElement(as, { ref, style: { display: 'inline-flex', ...style }, ...rest }, children);
}

export interface TiltProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Degrees at the edge of the element. */
  degrees?: number;
  /** Lift in px while the pointer is over it. */
  lift?: number;
  children?: ReactNode;
}

export function Tilt({ as = 'div', degrees = DIST.tilt, lift = DIST.lift, children, ...rest }: TiltProps) {
  const ref = useRef<HTMLElement>(null);
  const { cinematic } = useMotionPreference();

  useEffect(() => {
    const el = ref.current;
    if (el === null || !cinematic || !hasFinePointer()) return undefined;
    const easer = createEaser(
      el,
      (p) => `perspective(900px) translate3d(0, ${(-p.lift).toFixed(2)}px, 0) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg)`,
    );
    const onMove = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (event.clientX - r.left) / r.width - 0.5;
      const py = (event.clientY - r.top) / r.height - 0.5;
      easer.to({ ry: px * 2 * degrees, rx: -py * 2 * degrees, lift });
    };
    const onLeave = () => easer.to({ rx: 0, ry: 0, lift: 0 });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      easer.stop();
    };
  }, [cinematic, degrees, lift]);

  return createElement(as, { ref, ...rest }, children);
}
