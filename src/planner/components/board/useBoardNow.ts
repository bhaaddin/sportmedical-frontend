/*
 * The board's clock: a `Date` that lands on every wall-clock minute, so the now-line moves when
 * the clock on the wall does (the calendar page's rule).
 */
import { useEffect, useState } from 'react';

export function useBoardNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: number | undefined;
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);
  return now;
}
