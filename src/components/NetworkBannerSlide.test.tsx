import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import NetworkBannerSlide from './NetworkBannerSlide';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-motion');
});

describe('the offline strip slide (CSS, no library)', () => {
  it('slides in, stays while it slides out, then unmounts', () => {
    document.documentElement.setAttribute('data-motion', 'full');
    const { rerender } = render(<NetworkBannerSlide show><span>offline</span></NetworkBannerSlide>);
    const strip = () => screen.getByText('offline').parentElement as HTMLElement;
    expect(strip().className).toContain('sm-banner-in');
    expect(strip().style.position).toBe('fixed');
    rerender(<NetworkBannerSlide show={false}><span>offline</span></NetworkBannerSlide>);
    expect(strip().className).toContain('sm-banner-out');
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.queryByText('offline')).toBeNull();
  });

  it("goes at once under 'vypnuto'", () => {
    document.documentElement.setAttribute('data-motion', 'off');
    const { rerender } = render(<NetworkBannerSlide show><span>offline</span></NetworkBannerSlide>);
    rerender(<NetworkBannerSlide show={false}><span>offline</span></NetworkBannerSlide>);
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('offline')).toBeNull();
  });

  it('renders nothing before it is needed', () => {
    render(<NetworkBannerSlide show={false}><span>offline</span></NetworkBannerSlide>);
    expect(screen.queryByText('offline')).toBeNull();
  });
});
