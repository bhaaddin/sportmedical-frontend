/*
 * Přehled hears about other people's changes (speed-fe-7): like the planner (usePlannerLive.ts) it joins the hub groups of
 * the calendars and, on `calendarChanged`, marks the week read stale (same 300 ms debounce). While the hub is up the 60 s
 * poll can be slow (5 min, only a fallback); with the hub down it stays 60 s. Nothing here is required: no hub, no message.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { calendarsApi } from '../../api/calendars';
import { socketService, SOCKET_EVENTS, type CalendarChanged } from '../../services/socketService';
import { LIVE_DEBOUNCE_MS } from '../../planner/api/usePlannerLive';

export const POLL_MS = 60_000;
export const POLL_LIVE_MS = 5 * 60_000;

/** The refetch interval for the week read: slow while the push channel is connected. */
export function useOverviewLive(): number {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const calendars = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60_000, retry: false });
  const ids = (calendars.data ?? []).map((c) => c.id).join(',');

  useEffect(() => {
    if (ids === '') return;
    const shown = new Set(ids.split(','));
    let timer: ReturnType<typeof setTimeout> | null = null;
    let release: (() => void) | null = null;
    let offChanged: (() => void) | null = null;
    let offConnected: (() => void) | null = null;
    try {
      socketService.init();
      socketService.connect();
      setLive(socketService.isConnected());
      offConnected = socketService.on(SOCKET_EVENTS.CONNECTED, () => setLive(true));
      offChanged = socketService.on(SOCKET_EVENTS.CALENDAR_CHANGED, (message: CalendarChanged) => {
        if (!message.calendarIds.some((id) => shown.has(id)) || timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          void queryClient.invalidateQueries({ queryKey: ['overview', 'week'] });
        }, LIVE_DEBOUNCE_MS);
      });
      release = socketService.watchCalendars([...shown]);
    } catch {
      /* no hub: the poll stays at 60 s */
    }
    return () => {
      if (timer !== null) clearTimeout(timer);
      offChanged?.();
      offConnected?.();
      release?.();
    };
  }, [ids, queryClient]);

  return live ? POLL_LIVE_MS : POLL_MS;
}
