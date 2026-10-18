/*
 * A bell that mounts a moment after another one asked starts from what that one was told, so a navigation (every page draws
 * its own bell) does not download the whole list again; a change made through a bell empties that memory.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get, patch, post: vi.fn(), delete: vi.fn() }, client: { get, patch } }));
vi.mock('../../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => undefined }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { useNotificationFeed, resetNotificationFeedForTests } = await import('./useNotificationFeed');

const row = (id: string, read = false) => ({ id, type: 'info', title: id, message: '', timestamp: '2026-10-18T10:00:00Z', read });
const quiet = { success: vi.fn(), error: vi.fn() };

const listCalls = () => get.mock.calls.filter(([url]) => url === '/api/notifications').length;
const seenCalls = () => get.mock.calls.filter(([url]) => url === '/api/notifications/seen').length;

beforeEach(() => {
  resetNotificationFeedForTests();
  get.mockReset().mockImplementation(async (url: string) =>
    url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: '2026-10-18T09:00:00Z' } } : { data: [row('a'), row('b', true)] },
  );
  patch.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => vi.useRealTimers());

describe('notification feed seeding', () => {
  it('a bell mounted right after another one is told the same thing without asking again', async () => {
    const first = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(first.result.current.notifications).toHaveLength(2));
    first.unmount();

    const second = renderHook(() => useNotificationFeed(quiet));

    expect(second.result.current.notifications.map((n) => n.id)).toEqual(['a', 'b']);
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.lastSeenAt).toBe('2026-10-18T09:00:00Z');
    expect(listCalls()).toBe(1);
    expect(seenCalls()).toBe(1);
  });

  it('asks again once the memory is too old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const first = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(first.result.current.notifications).toHaveLength(2));
    first.unmount();

    vi.setSystemTime(Date.now() + 16_000);
    const second = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(listCalls()).toBe(2));
    expect(second.result.current).toBeDefined();
  });

  it('a change made through a bell empties the memory, so the next bell asks', async () => {
    const first = renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(first.result.current.notifications).toHaveLength(2));
    await act(async () => {
      await first.result.current.markRead('a');
    });
    first.unmount();

    renderHook(() => useNotificationFeed(quiet));
    await waitFor(() => expect(listCalls()).toBe(2));
  });
});
