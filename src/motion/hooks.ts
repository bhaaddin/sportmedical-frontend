import { useEffect, useLayoutEffect } from 'react';

/** useLayoutEffect that does not warn while the server renders. */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** A mouse or a trackpad is the main pointer (hover exists, aiming is precise). Touch screens answer false. */
export function hasFinePointer(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}
