/* ══════════════════════════════════════════════════════════════
   COUNT-UP - a number that counts to its value ONCE, when it first comes into view.

   - The server, the first client render and everything but 'plné' show the final number: the count is a flourish,
     never the only way to read the figure.
   - The count starts only when `motion` is already loaded (it is warmed after the first paint), so a figure is never
     parked at 0 waiting for a download.
   - A later change of `value` (a refetch) updates the text at once. It never counts again.
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { ElementType } from 'react';
import { DUR } from './tokens';
import { canObserve, motionIfLoaded } from './engine';
import { useIsoLayoutEffect } from './hooks';
import { useMotionPreference } from './useMotionPreference';

/** An eased counter on requestAnimationFrame (ease-out expo, like the rest of the site). Returns its stop function. */
export function countTo(from: number, to: () => number, seconds: number, onUpdate: (n: number) => void, onDone: () => void): () => void {
  // Time is measured on the animation frames' own clock, from the first frame (never mixed with performance.now()).
  let started = -1;
  let frame = 0;
  const step = (now: number) => {
    if (started < 0) started = now;
    const t = Math.max(0, Math.min(1, (now - started) / (seconds * 1000)));
    const eased = t >= 1 ? 1 : 1 - 2 ** (-10 * t);
    onUpdate(from + (to() - from) * eased);
    if (t < 1) frame = requestAnimationFrame(step);
    else onDone();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

const cs = new Intl.NumberFormat('cs-CZ');
export const defaultFormat = (n: number): string => cs.format(Math.round(n));

export interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  /** Seconds. */
  duration?: number;
  as?: ElementType;
  className?: string;
}

export function CountUp({ value, format = defaultFormat, duration = DUR.slow * 1.6, as = 'span', className }: CountUpProps) {
  const { cinematic } = useMotionPreference();
  const ref = useRef<HTMLElement>(null);
  const counted = useRef(false);
  const latest = useRef({ value, format });
  latest.current = { value, format };

  // The text node React owns; we only ever write its nodeValue.
  const setText = (text: string) => {
    const node = ref.current?.firstChild;
    if (node) node.nodeValue = text;
  };

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (el === null || counted.current || !cinematic || !canObserve() || !Number.isFinite(value)) return undefined;
    const api = motionIfLoaded();
    if (api === null) return undefined;
    counted.current = true;
    setText(latest.current.format(0));
    let stopView: (() => void) | undefined;
    let stopCount: (() => void) | undefined;
    stopView = api.inView(el, () => {
      stopView?.();
      stopCount = countTo(0, () => latest.current.value, duration, (n) => setText(latest.current.format(n)), () => setText(latest.current.format(latest.current.value)));
    });
    return () => {
      stopView?.();
      stopCount?.();
      counted.current = false;
      setText(latest.current.format(latest.current.value));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once per mount, by design
  }, [cinematic]);

  // A refetched value after (or during) the count shows at once.
  const firstValue = useRef(true);
  useEffect(() => {
    if (firstValue.current) {
      firstValue.current = false;
      return;
    }
    setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return createElement(as, { ref, className }, format(value));
}
