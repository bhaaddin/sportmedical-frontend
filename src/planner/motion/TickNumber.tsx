/*
 * A figure that ticks to its new value instead of jumping (the planner's "need counter"): 7 -> 8 runs through 7.x on
 * the animation frames, ~340 ms, ease-out. Only under `plné` (`<html data-motion="full">`); under `omezené`, `vypnuto`,
 * without the attribute (tests, no script) the number is simply the new number, at once. It never counts on mount
 * (a card that appears shows its figure) and it never waits: React owns the text, so the final value is what a render
 * says and a reader (or a test) never sees anything else once the animation has ended - or when there is none.
 */
import { useEffect, useRef, useState } from 'react';
import { countTo } from '../../motion/CountUp';

const SECONDS = 0.34;

export function TickNumber({ value }: { value: number }) {
  const [tick, setTick] = useState<number | null>(null);
  const shown = useRef(value);
  shown.current = tick ?? value;
  const last = useRef(value);

  useEffect(() => {
    const from = shown.current;
    const changed = last.current !== value;
    last.current = value;
    const full = document.documentElement.getAttribute('data-motion') === 'full';
    if (!changed || !full || from === value || !Number.isFinite(from)) {
      setTick(null);
      return undefined;
    }
    const stop = countTo(from, () => value, SECONDS, (n) => setTick(Math.round(n)), () => setTick(null));
    return () => stop();
  }, [value]);

  return <span>{tick ?? value}</span>;
}
