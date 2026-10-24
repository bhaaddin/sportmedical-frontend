/*
 * The board's own reads (the shown week's bookings, working-hours previews and blocks, `boardCalendar.ts`) start the moment
 * its calendars are known. When the server has the planner screen, that one request brings all of them, so those reads wait
 * for it (one short, shared request) instead of running beside it. When it has not - an older server, no permission, a failed
 * answer, everything already fresh - this is `true` at once or after the same single refused request, and the reads are
 * exactly the ones the board always made.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { plannerScreenFor } from './plannerScreen';

export function usePlannerScreenReady(from: string, to: string): boolean {
  const queryClient = useQueryClient();
  const seeder = plannerScreenFor(queryClient);
  const key = `${from}|${to}`;
  const [settled, setSettled] = useState<string | null>(null);
  const waits = from !== '' && seeder.willAsk({ from, to });

  useEffect(() => {
    if (!waits) return undefined;
    let current = true;
    void seeder.seed({ from, to }).then(() => {
      if (current) setSettled(key);
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one ask per window; `waits` only says whether it is needed
  }, [seeder, key, waits]);

  return !waits || settled === key;
}
