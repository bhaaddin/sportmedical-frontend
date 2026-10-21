/*
 * A figure that ticks to its new value instead of jumping (the planner's "need counter"): 7 -> 8 runs through 7.x on
 * the animation frames, ~340 ms, ease-out. Only under `plné` (`<html data-motion="full">`); under `omezené`, `vypnuto`,
 * without the attribute (tests, no script) the number is simply the new number, at once. It never counts on mount
 * (a card that appears shows its figure) and it never waits: the text is the final value from the first frame of a
 * change when motion is off, and it ends exactly on the final value when it is on.
 */
import { useEffect, useRef } from 'react';
import { countTo } from '../../motion/CountUp';

const SECONDS = 0.34;

export function TickNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const target = value;
    const from = shown.current;
    stop.current?.();
    stop.current = null;
    const full = document.documentElement.getAttribute('data-motion') === 'full';
    if (!full || from === target || !Number.isFinite(from)) {
      shown.current = target;
      el.textContent = String(target);
      return undefined;
    }
    stop.current = countTo(
      from,
      () => target,
      SECONDS,
      (n) => {
        shown.current = n;
        el.textContent = String(Math.round(n));
      },
      () => {
        shown.current = target;
        el.textContent = String(target);
        stop.current = null;
      },
    );
    return () => {
      stop.current?.();
      stop.current = null;
      shown.current = target;
      el.textContent = String(target);
    };
  }, [value]);

  return <span ref={ref}>{value}</span>;
}
