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
import { DUR, EASE } from './tokens';
import { canObserve, motionIfLoaded } from './engine';
import { useIsoLayoutEffect } from './hooks';
import { useMotionPreference } from './useMotionPreference';

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
    let controls: { stop: () => void } | undefined;
    stopView = api.inView(el, () => {
      stopView?.();
      controls = api.animate(0, latest.current.value, {
        duration,
        ease: EASE.out as never,
        onUpdate: (n: number) => setText(latest.current.format(n)),
        onComplete: () => setText(latest.current.format(latest.current.value)),
      });
    });
    return () => {
      stopView?.();
      controls?.stop();
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
