/* ══════════════════════════════════════════════════════════════
   THE LAZY HANDLE ON `motion`

   Nothing in a first load imports the animation library. A primitive calls `loadMotion()` from an effect (so: after
   the first paint, in the browser only) and animates when the promise resolves. Until then the page is simply
   static and fully visible - which is also what the server rendered. `warmMotion()` starts the download in an idle
   moment after load so the first scroll or click already finds it.
   ══════════════════════════════════════════════════════════════ */

import { afterFirstPaint } from '../utils/afterFirstPaint';
import { currentMotion } from './preference';

export type MotionApi = typeof import('./vendor');

let pending: Promise<MotionApi> | null = null;
let loaded: MotionApi | null = null;

export function loadMotion(): Promise<MotionApi> {
  pending ??= import('./vendor').then((api) => {
    loaded = api;
    return api;
  });
  return pending;
}

/** The library when it is already there, else null (callers then skip the animation, never wait for it). */
export function motionIfLoaded(): MotionApi | null {
  return loaded;
}

/** Starts the download after the first paint, unless the person turned motion off. Idempotent. */
export function warmMotion(): void {
  if (typeof window === 'undefined' || currentMotion() === 'vypnuto') return;
  void afterFirstPaint().then(() => {
    if (currentMotion() !== 'vypnuto') void loadMotion();
  });
}

export const canObserve = (): boolean => typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';

/** Tests: forget the loaded module. */
export function resetEngineForTests(): void {
  pending = null;
  loaded = null;
}
