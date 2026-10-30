import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import GlobalErrorBoundary, { isChunkLoadError } from './GlobalErrorBoundary';
import { connection, reportUnreachable, reportReachable, resetConnectionForTests } from '../api/connection';

let broken = true;
function Screen() {
  if (broken) throw new Error('Failed to fetch dynamically imported module: /assets/x.js');
  return <p>Načteno</p>;
}

describe('isChunkLoadError', () => {
  it('knows a lazy-screen fetch failure from a normal bug', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /a.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('a lazy screen that could not be fetched', () => {
  const reload = vi.fn();
  beforeEach(() => {
    broken = true;
    reload.mockReset();
    sessionStorage.clear();
    resetConnectionForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('reloads once, not in a loop', () => {
    sessionStorage.setItem('sm.chunkReloadAt', String(Date.now()));
    render(<GlobalErrorBoundary><Screen /></GlobalErrorBoundary>);
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('tries the screen again by itself when the server is back', () => {
    sessionStorage.setItem('sm.chunkReloadAt', String(Date.now()));
    render(<GlobalErrorBoundary><Screen /></GlobalErrorBoundary>);
    broken = false;
    act(() => { reportUnreachable(); reportReachable(); });
    expect(screen.getByText('Načteno')).toBeInTheDocument();
    expect(connection.getState()).toBe('online');
  });
});
