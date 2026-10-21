import { useCallback, useEffect, useRef, useState } from 'react';
import {
  securityCenterApi,
  securityErrorText,
  toSecurityCenterError,
  type SecurityCenterError,
  type SecurityEvent,
  type SecurityOverview,
} from '../../../api/securityCenter';

/*
 * The data of the screen: the overview, and the events feed beside it (paged on its own, so the first paint
 * does not wait for an old page of history). Plain state and effects, like the other system screens: it needs
 * no query cache, and a screen that is mounted without a provider (the tests) must still work.
 */

export interface SecurityCenterData {
  overview: SecurityOverview | null;
  /** The overview could not be read at all: the frame stays and says so. */
  failure: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  events: SecurityEvent[];
  eventsTotal: number | null;
  eventsFailure: string | null;
  eventsLoading: boolean;
  loadMoreEvents: () => Promise<void>;
}

const PAGE = 20;

export function useSecurityCenter(): SecurityCenterData {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState<number | null>(null);
  const [eventsFailure, setEventsFailure] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const alive = useRef(true);
  const eventsCount = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadEvents = useCallback(async (skip: number, replace: boolean) => {
    setEventsLoading(true);
    try {
      const page = await securityCenterApi.events(skip, PAGE);
      if (!alive.current) return;
      setEvents((current) => (replace ? page.items : [...current, ...page.items]));
      eventsCount.current = (replace ? 0 : eventsCount.current) + page.items.length;
      setEventsTotal(page.totalCount);
      setEventsFailure(null);
    } catch (error) {
      if (!alive.current) return;
      setEventsFailure(securityErrorText(toSecurityCenterError(error) as SecurityCenterError));
    } finally {
      if (alive.current) setEventsLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const next = await securityCenterApi.overview();
      if (!alive.current) return;
      setOverview(next);
      setFailure(null);
    } catch (error) {
      if (!alive.current) return;
      setFailure(securityErrorText(toSecurityCenterError(error)));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadEvents(0, true);
  }, [loadOverview, loadEvents]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(), loadEvents(0, true)]);
    if (alive.current) setRefreshing(false);
  }, [loadOverview, loadEvents]);

  const loadMoreEvents = useCallback(() => loadEvents(eventsCount.current, false), [loadEvents]);

  return { overview, failure, loading, refreshing, refresh, events, eventsTotal, eventsFailure, eventsLoading, loadMoreEvents };
}
