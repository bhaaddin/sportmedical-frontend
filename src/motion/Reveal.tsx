/* ══════════════════════════════════════════════════════════════
   REVEAL / STAGGER — an element (or its children, one after another) arrives when it scrolls into view.

   Built on `motion` (animate + inView), loaded lazily. The contract that makes it safe on a prerendered page:
     - the server and the first client render are the PLAIN element - fully visible, no inline style;
     - after the first paint, and only when the library is there, whatever is still BELOW the fold is hidden and
       animated in when it comes into view; whatever is already in view (or scrolled past) is left alone, so
       nothing ever flashes;
     - 'omezené' = a short fade, nothing travels; 'vypnuto' = nothing at all (no style is ever written).
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { DIST, DUR, EASE, STAGGER } from './tokens';
import { afterFirstPaint } from '../utils/afterFirstPaint';
import { canObserve, loadMotion } from './engine';
import { useMotionPreference } from './useMotionPreference';
import type { MotionPreference } from './preference';

export type RevealVariant = 'fade' | 'rise' | 'scale' | 'wipe' | 'left' | 'right';

interface VariantDef {
  /** The hidden state, as inline CSS. */
  hidden: Record<string, string>;
  /** motion keyframes. */
  keyframes: Record<string, unknown>;
}

export const REVEAL_VARIANTS: Record<RevealVariant, VariantDef> = {
  fade: { hidden: { opacity: '0' }, keyframes: { opacity: [0, 1] } },
  rise: { hidden: { opacity: '0', transform: `translateY(${DIST.rise}px)` }, keyframes: { opacity: [0, 1], y: [DIST.rise, 0] } },
  scale: { hidden: { opacity: '0', transform: 'scale(0.92)' }, keyframes: { opacity: [0, 1], scale: [0.92, 1] } },
  wipe: { hidden: { clipPath: 'inset(0 100% 0 0)' }, keyframes: { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] } },
  left: { hidden: { opacity: '0', transform: `translateX(${-DIST.slide}px)` }, keyframes: { opacity: [0, 1], x: [-DIST.slide, 0] } },
  right: { hidden: { opacity: '0', transform: `translateX(${DIST.slide}px)` }, keyframes: { opacity: [0, 1], x: [DIST.slide, 0] } },
};

/** What a state is allowed to do with a variant: 'plné' as asked, 'omezené' a fade, 'vypnuto' nothing (null). */
export function variantFor(mode: MotionPreference, asked: RevealVariant): RevealVariant | null {
  if (mode === 'vypnuto') return null;
  return mode === 'omezené' ? 'fade' : asked;
}

const HIDDEN_PROPS = ['opacity', 'transform', 'clip-path', 'will-change'];
function clear(target: HTMLElement): void {
  for (const prop of HIDDEN_PROPS) target.style.removeProperty(prop);
}

export interface RevealOptions {
  variant?: RevealVariant;
  /** Seconds before it starts. */
  delay?: number;
  duration?: number;
  /** Seconds between the targets (Stagger). */
  step?: number;
  /** Which elements arrive: default the element itself. */
  targets?: (root: HTMLElement) => HTMLElement[];
  /** Root margin of the viewport test; default: when 8 % of the viewport's height is above the element's top. */
  margin?: string;
  /** False = do nothing (the caller has its own reason). */
  enabled?: boolean;
}

export function useReveal<T extends HTMLElement>(ref: React.RefObject<T | null>, options: RevealOptions = {}): void {
  const { mode } = useMotionPreference();
  const { variant: asked = 'rise', delay = 0, duration, step, targets, margin = '0px 0px -8% 0px', enabled = true } = options;
  const variant = variantFor(mode, asked);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useEffect(() => {
    const root = ref.current;
    if (root === null || variant === null || !enabled || !canObserve()) return undefined;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const armed: HTMLElement[] = [];

    void afterFirstPaint().then(loadMotion).then(({ animate, inView, stagger }) => {
      if (cancelled) return;
      const all = targetsRef.current ? targetsRef.current(root) : [root];
      const horizon = window.innerHeight * 0.92;
      const waiting = all.filter((el) => el.getBoundingClientRect().top > horizon);
      if (waiting.length === 0) return;
      const def = REVEAL_VARIANTS[variant];
      for (const el of waiting) {
        for (const [prop, value] of Object.entries(def.hidden)) el.style.setProperty(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), value);
        el.style.willChange = 'opacity, transform';
        armed.push(el);
      }
      stop = inView(
        root,
        () => {
          stop?.();
          void animate(waiting, def.keyframes as never, {
            duration: mode === 'omezené' ? DUR.base : (duration ?? DUR.slow),
            ease: EASE.out as never,
            delay: step !== undefined && waiting.length > 1 ? stagger(step) : delay,
          }).then(() => waiting.forEach(clear));
        },
        { margin: margin as never },
      );
    });

    return () => {
      cancelled = true;
      stop?.();
      armed.forEach(clear);
    };
    // targets is read through a ref: a new function every render must not re-arm the element.
  }, [ref, variant, delay, duration, step, margin, enabled, mode]);
}

export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'children'>, RevealOptions {
  as?: ElementType;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Reveal({ as = 'div', variant, delay, duration, margin, enabled, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, { variant, delay, duration, margin, enabled });
  return createElement(as, { ref, ...rest }, children);
}

export interface StaggerProps extends RevealProps {
  /** Seconds between the children. */
  step?: number;
  /** CSS selector of what arrives, relative to the element; default its direct children. */
  selector?: string;
}

export function Stagger({ as = 'div', variant, step = STAGGER.items, duration, margin, enabled, selector, children, ...rest }: StaggerProps) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, {
    variant,
    step,
    duration,
    margin,
    enabled,
    targets: (root) => Array.from(selector ? root.querySelectorAll<HTMLElement>(selector) : (root.children as HTMLCollectionOf<HTMLElement>)),
  });
  return createElement(as, { ref, ...rest }, children);
}
