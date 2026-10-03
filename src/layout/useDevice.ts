import { useSyncExternalStore } from 'react';

/*
 * The three interfaces. Not a shrunk desktop: each width gets its own layout
 * (phone: bottom bar, tablet: narrow rail, desktop: full sidebar).
 *
 *   phone    ≤ 767
 *   tablet   768 – 1279
 *   desktop  ≥ 1280
 *
 * One place for the numbers, so the shell, the screens and the tests agree.
 */
export type Device = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX = 767;
export const TABLET_MAX = 1279;

const PHONE_QUERY = `(max-width: ${PHONE_MAX}px)`;
const TABLET_QUERY = `(max-width: ${TABLET_MAX}px)`;

function read(): Device {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  if (window.matchMedia(PHONE_QUERY).matches) return 'phone';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const lists = [window.matchMedia(PHONE_QUERY), window.matchMedia(TABLET_QUERY)];
  lists.forEach((list) => list.addEventListener?.('change', onChange));
  return () => lists.forEach((list) => list.removeEventListener?.('change', onChange));
}

export function useDevice(): Device {
  return useSyncExternalStore(subscribe, read, () => 'desktop');
}

export const useIsPhone = (): boolean => useDevice() === 'phone';
export const useIsTablet = (): boolean => useDevice() === 'tablet';
export const useIsDesktop = (): boolean => useDevice() === 'desktop';

/** What a width means, for code that has a number rather than a hook. */
export function deviceForWidth(width: number): Device {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}
