/* A nudge that brings no new row (a read or removal elsewhere) asks for the whole list; one that brings a row asks since. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { get, nudge } = vi.hoisted(() => ({ get: vi.fn(), nudge: { fn: (() => undefined) as () => void } }));
vi.mock('../../api/client', () => ({ default: { get, patch: vi.fn(), post: vi.fn(), delete: vi.fn() }, client: { get } }));
vi.mock('../../hooks/useRealtimeSync', () => ({
  useRealtimeSync: (o: { onNotificationsChanged?: () => void }) => {
    if (o.onNotificationsChanged) nudge.fn = o.onNotificationsChanged;
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { useNotificationFeed, resetNotificationFeedForTests } = await import('./useNotificationFeed');
const row = (id: string, read = false, timestamp = '2026-10-18T10:00:00Z') => ({ id, type: 'info', title: id, message: '', timestamp, read });
const quiet = { success: vi.fn(), error: vi.fn() };
const listCalls = () => get.mock.calls.filter(([u]) => u === '/api/notifications');

beforeEach(() => {
  resetNotificationFeedForTests();
  get.mockReset();
});

describe('notification nudge', () => {
  it('no new row: the whole list is fetched, so a read elsewhere shows', async () => {
    get.mockImplementation(async (url: string, cfg?: { params?: unknown }) => {
      if (url === '/api/notifications/seen') return { data: {} };
      if (cfg?.params) return { data: [row('a')] }; // since: server answers the overlap, unchanged
      return { data: [row('a', get.mock.calls.length > 3)] };
    });
    const { result } = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    await act(async () => nudge.fn());
    await waitFor(() => expect(listCalls().some(([, c]) => c === undefined)).toBe(true));
    expect(listCalls()).toHaveLength(3);
    expect(listCalls()[1]![1]).toEqual({ params: { since: '2026-10-18T09:59:59.999Z' } });
    expect(result.current.notifications[0]!.read).toBe(true);
  });

  it('a new row: only the since answer is merged', async () => {
    get.mockImplementation(async (url: string, cfg?: { params?: unknown }) => {
      if (url === '/api/notifications/seen') return { data: {} };
      if (cfg?.params) return { data: [row('b', false, '2026-10-18T11:00:00Z'), row('a')] };
      return { data: [row('a')] };
    });
    const { result } = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    await act(async () => nudge.fn());
    await waitFor(() => expect(result.current.notifications.map((n) => n.id)).toEqual(['b', 'a']));
    expect(listCalls()).toHaveLength(2);
  });
});
