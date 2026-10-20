import { useCallback, useSyncExternalStore } from 'react';
import {
  allowanceFor,
  getMotionSnapshot,
  getServerMotionSnapshot,
  osPrefersReducedMotion,
  readStoredMotion,
  setMotionPreference,
  subscribeMotion,
} from './preference';
import type { MotionAllowance, MotionPreference } from './preference';

export interface MotionPreferenceState extends MotionAllowance {
  /** The effective state: the stored choice, else the system's. */
  mode: MotionPreference;
  /** Choose a state ('null' = follow the system again). Applies at once, everywhere. */
  setMode: (next: MotionPreference | null) => void;
  /** True when nothing travels: 'omezené' or 'vypnuto'. */
  reduced: boolean;
  /** True for 'vypnuto': not even a fade. */
  off: boolean;
  /** True while nothing is chosen and the system's "reduce motion" decides. */
  followsSystem: boolean;
}

/**
 * The motion setting as a hook. During hydration it reads the server's value ('plné', the same HTML as the
 * prerender), then the browser's real one - React re-renders once if they differ, so a page prerendered for
 * everybody never mismatches.
 */
export function useMotionPreference(): MotionPreferenceState {
  const mode = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getServerMotionSnapshot);
  const setMode = useCallback((next: MotionPreference | null) => setMotionPreference(next), []);
  return { mode, setMode, ...allowanceFor(mode), reduced: mode !== 'plné', off: mode === 'vypnuto', followsSystem: readStoredMotion() === null };
}

/** For code outside React (event handlers, scenes): the effective state right now. */
export { currentMotion } from './preference';
export { osPrefersReducedMotion };
