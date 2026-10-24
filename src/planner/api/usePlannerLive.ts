/*
 * The planner hears about other people's changes (network plan c1): it joins the hub groups of the calendars it shows and,
 * when the server says `calendarChanged` for one of them, drops what it holds of the day, the blocks and the club blocks
 * and lets the planner's reads run again (the reads then come from the planner screen, one request).
 *
 * Nothing here is required. A server without the groups never sends the message, a hub that is down just does not join; the
 * planner then shows what it has read, exactly as before. The message carries only calendar ids and days - never a patient.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { announceRemoteWrite } from '../../api/requestPolicy';
import { socketService, SOCKET_EVENTS, type CalendarChanged } from '../../services/socketService';
import { plannerKeys, type PlannerDataSource } from '../data/PlannerDataSource';

/** Bursts (a club order books many days) become one refresh. */
export const LIVE_DEBOUNCE_MS = 300;

/** The keys of the planner's reads of the calendar itself (see `defaultApiDeps`). */
const CALENDAR_READ_KEYS = ['day-range', 'blocks', 'club-blocks', 'club-orders'] as const;

/** Marks the calendar reads stale and the planner's own queries to run again. */
export function refreshCalendarReads(queryClient: QueryClient, sourceId: string): Promise<unknown> {
  announceRemoteWrite();
  return Promise.all([
    ...CALENDAR_READ_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    queryClient.invalidateQueries({ queryKey: plannerKeys.all(sourceId) }),
  ]);
}

export function usePlannerLive(source: Pick<PlannerDataSource, 'id' | 'getCalendars'>): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let stopped = false;
    let release: (() => void) | null = null;
    let off: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const shown = new Set<string>();

    const onChanged = (message: CalendarChanged) => {
      if (!message.calendarIds.some((id) => shown.has(id))) return;
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!stopped) void refreshCalendarReads(queryClient, source.id);
      }, LIVE_DEBOUNCE_MS);
    };

    void (source.getCalendars?.() ?? Promise.resolve([]))
      .then((calendars) => {
        if (stopped) return;
        for (const c of calendars) shown.add(c.id);
        if (shown.size === 0) return;
        socketService.init();
        socketService.connect();
        off = socketService.on(SOCKET_EVENTS.CALENDAR_CHANGED, onChanged);
        release = socketService.watchCalendars([...shown]);
      })
      .catch(() => undefined);

    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      off?.();
      release?.();
    };
  }, [queryClient, source]);
}
