import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) }, client: {} }));

const { usePlannerScreenReady } = await import('./usePlannerScreenReady');
const { resetPlannerScreenForTests } = await import('./plannerScreen');

function setup(from = '2026-10-26', to = '2026-11-01') {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => usePlannerScreenReady(from, to), { wrapper });
}

beforeEach(() => {
  get.mockReset();
  resetPlannerScreenForTests();
  localStorage.clear();
});

describe('usePlannerScreenReady', () => {
  it('without the permission the board never waits and nothing is asked', () => {
    localStorage.setItem('permissions', JSON.stringify(['bookings.create']));
    const { result } = setup();
    expect(result.current).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('an older server: the board waits for the one refused request, then reads as it always did', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    get.mockRejectedValue({ response: { status: 404 } });
    const { result } = setup();
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a window not yet shown is never waited for when the screen is known to be missing', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    get.mockRejectedValue({ response: { status: 404 } });
    const first = setup();
    await waitFor(() => expect(first.result.current).toBe(true));
    const second = setup('2026-11-02', '2026-11-08');
    expect(second.result.current).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
