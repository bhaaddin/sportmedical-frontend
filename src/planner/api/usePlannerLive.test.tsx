import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const watch = vi.fn();
const handlers = new Map<string, (data: unknown) => void>();
vi.mock('../../services/socketService', () => ({
  SOCKET_EVENTS: { CALENDAR_CHANGED: 'calendarChanged' },
  socketService: {
    init: vi.fn(),
    connect: vi.fn(),
    on: (event: string, cb: (data: unknown) => void) => {
      handlers.set(event, cb);
      return () => handlers.delete(event);
    },
    watchCalendars: (ids: string[]) => {
      watch(ids);
      return () => watch('released');
    },
  },
}));
const announce = vi.fn();
vi.mock('../../api/requestPolicy', () => ({ announceRemoteWrite: () => announce() }));

const { usePlannerLive, LIVE_DEBOUNCE_MS } = await import('./usePlannerLive');

const source = { id: 'api-1', getCalendars: async () => [{ id: 'cal-a' }, { id: 'cal-b' }] } as never;

function setup() {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, invalidate, ...renderHook(() => usePlannerLive(source), { wrapper }) };
}

afterEach(() => {
  vi.useRealTimers();
  watch.mockClear();
  announce.mockClear();
  handlers.clear();
});

describe('usePlannerLive', () => {
  it('joins the calendars it shows and leaves them when it goes', async () => {
    const { unmount } = setup();
    await vi.waitFor(() => expect(watch).toHaveBeenCalledWith(['cal-a', 'cal-b']));
    unmount();
    expect(watch).toHaveBeenLastCalledWith('released');
  });

  it('a change of a shown calendar drops the calendar reads and the planner queries, once for a burst', async () => {
    const { invalidate } = setup();
    await vi.waitFor(() => expect(handlers.has('calendarChanged')).toBe(true));
    vi.useFakeTimers();
    const send = handlers.get('calendarChanged')!;
    send({ calendarIds: ['cal-a'], from: '2026-11-02', to: '2026-11-02', kinds: ['appointment'] });
    send({ calendarIds: ['cal-b'], from: '2026-11-03', to: '2026-11-03', kinds: ['block'] });
    expect(invalidate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(LIVE_DEBOUNCE_MS + 10);
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toEqual([['day-range'], ['blocks'], ['club-blocks'], ['planner', 'api-1']]);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('a change of a calendar that is not shown is ignored', async () => {
    const { invalidate } = setup();
    await vi.waitFor(() => expect(handlers.has('calendarChanged')).toBe(true));
    vi.useFakeTimers();
    handlers.get('calendarChanged')!({ calendarIds: ['elsewhere'], from: '', to: '', kinds: [] });
    await vi.advanceTimersByTimeAsync(LIVE_DEBOUNCE_MS + 10);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('a source that cannot list calendars does nothing (and nothing throws)', async () => {
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    renderHook(() => usePlannerLive({ id: 'x' } as never), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(watch).not.toHaveBeenCalled();
  });
});
