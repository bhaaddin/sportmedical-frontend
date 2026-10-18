import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DemoDataSource } from './DemoDataSource';
import { useDemoDataSource } from './useDemoDataSource';

describe('useDemoDataSource', () => {
  it('stays null, and loads nothing, while the demo is off', async () => {
    const { result } = renderHook(() => useDemoDataSource(false, { today: '2026-11-10' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBeNull();
  });

  it('hands over a DemoDataSource once it has loaded', async () => {
    const { result } = renderHook(() => useDemoDataSource(true, { today: '2026-11-10' }));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBeInstanceOf(DemoDataSource);
  });

  it('keeps the same source while its options do not change', async () => {
    const { result, rerender } = renderHook(() => useDemoDataSource(true, { today: '2026-11-10' }));
    await waitFor(() => expect(result.current).not.toBeNull());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
