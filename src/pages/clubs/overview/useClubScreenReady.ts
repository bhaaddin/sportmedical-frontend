/*
 * The club page's own reads (the club, its orders, windows and summary) start with the page. When the server has the club
 * screen, one request brings all of them, so those reads wait for it (a single short request) instead of running beside it.
 * When it has not - an older server, no permission, a failed answer, everything already fresh - this is `true` at once or
 * after the same single refused request, and the reads are exactly the ones the page always made.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { clubScreenFor } from '../../../api/clubScreen';

export function useClubScreenReady(clubId: string, orderId: string | null = null): boolean {
  const queryClient = useQueryClient();
  const seeder = clubScreenFor(queryClient);
  const [settled, setSettled] = useState<string | null>(null);
  const waits = seeder.willAsk(clubId);

  useEffect(() => {
    if (!waits) return undefined;
    let current = true;
    void seeder.seed(clubId, orderId).then(() => {
      if (current) setSettled(clubId);
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one ask per club; `waits` only says whether it is needed
  }, [seeder, clubId, orderId, waits]);

  return !waits || settled === clubId;
}
