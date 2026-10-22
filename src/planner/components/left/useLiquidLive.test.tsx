/*
 * R20: the liquid only moves while the days are on screen and the tab is visible - the hook that tells the stylesheet
 * (`#mini-days[data-liquid='paused']` pauses every wave).
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLiquidLive } from '../MiniCalendarPanel';

let observers: { cb: IntersectionObserverCallback }[] = [];

class FakeObserver {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    observers.push(this);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

function Probe() {
  const ref = useRef<HTMLDivElement | null>(null);
  const live = useLiquidLive(ref);
  return <div ref={ref} data-testid="days" data-liquid={live ? 'live' : 'paused'} />;
}

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  observers = [];
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
});
afterEach(() => {
  cleanup();
  setVisibility('visible');
});

describe('useLiquidLive', () => {
  it('is live while the days are on screen and the tab is visible', () => {
    render(<Probe />);
    expect(screen.getByTestId('days')).toHaveAttribute('data-liquid', 'live');
  });

  it('pauses when the days leave the screen (a closed drawer / sheet) and resumes when they come back', () => {
    render(<Probe />);
    act(() => observers[0]!.cb([{ isIntersecting: false } as IntersectionObserverEntry], observers[0] as unknown as IntersectionObserver));
    expect(screen.getByTestId('days')).toHaveAttribute('data-liquid', 'paused');
    act(() => observers[0]!.cb([{ isIntersecting: true } as IntersectionObserverEntry], observers[0] as unknown as IntersectionObserver));
    expect(screen.getByTestId('days')).toHaveAttribute('data-liquid', 'live');
  });

  it('pauses while the tab is hidden', () => {
    render(<Probe />);
    act(() => setVisibility('hidden'));
    expect(screen.getByTestId('days')).toHaveAttribute('data-liquid', 'paused');
    act(() => setVisibility('visible'));
    expect(screen.getByTestId('days')).toHaveAttribute('data-liquid', 'live');
  });
});
