/*
 * Small media-query helper of the compact layouts (tablet / phone). `useDevice()` knows the three
 * widths; the compact layout has one more breakpoint of its own (the left column that is pinned
 * from 1000 px) and a few things measured on the element rather than the window.
 */
import { useSyncExternalStore } from 'react';

/** From this window width the tablet keeps the mini calendar + agenda as a left column instead of a drawer. */
export const PIN_SIDEBAR_MIN = 1000;

/** A board narrower than this (px) opens on one day instead of the whole week. */
export const WEEK_FIT_MIN_WIDTH = 840;

/** The touch targets of the compact layouts. */
export const TOUCH_TARGET_PX = 44;

export function useMatchMedia(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
    const list = window.matchMedia(query);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  };
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, read, () => false);
}

/** The tablet keeps the left column pinned from 1000 px. */
export const usePinnedSidebar = (): boolean => useMatchMedia(`(min-width: ${PIN_SIDEBAR_MIN}px)`);
