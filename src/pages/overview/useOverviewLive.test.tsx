import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ list: vi.fn(), listeners: new Map<string, (m: unknown) => void>(), connected: false, release: vi.fn() }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: h.list } }));
vi.mock('../../services/socketService', () => ({
  SOCKET_EVENTS: { CALENDAR_CHANGED: 'calendarChanged', CONNECTED: 'connected' },
  socketService: {
    init: vi.fn(),
    connect: vi.fn(),
    isConnected: () => h.connected,
    on: (e: string, cb: (m: unknown) => void) => {
      h.listeners.set(e, cb);
      return () => h.listeners.delete(e);
    },
    watchCalendars: () => h.release,
  },
}));

const { useOverviewLive, POLL_MS, POLL_LIVE_MS } = await import('./useOverviewLive');

function setup() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { spy, ...renderHook(() => useOverviewLive(), { wrapper }) };
}

describe('useOverviewLive', () => {
  beforeEach(() => {
    h.list.mockReset().mockResolvedValue([{ id: 'c1' }]);
    h.listeners.clear();
    h.connected = false;
  });

  it('polls every 60 s while the hub is down, every 5 min once it is up', async () => {
    const { result } = setup();
    await waitFor(() => expect(h.listeners.has('connected')).toBe(true));
    expect(result.current).toBe(POLL_MS);
    act(() => h.listeners.get('connected')!({}));
    expect(result.current).toBe(POLL_LIVE_MS);
  });

  it('marks the week stale (debounced) for a shown calendar, ignores another', async () => {
    const { spy } = setup();
    await waitFor(() => expect(h.listeners.has('calendarChanged')).toBe(true));
    h.listeners.get('calendarChanged')!({ calendarIds: ['zzz'] });
    h.listeners.get('calendarChanged')!({ calendarIds: ['c1'] });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['overview', 'week'] }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
