import { afterFirstPaint } from '../utils/afterFirstPaint';

/**
 * After the first paint AND `ms` more: the heavy libraries of the public site do not parse at the same moment. The animation
 * library comes right after the first paint (a reveal needs it first), the scroll scenes 0.6 s later, smooth scroll 1.2 s,
 * the shaders 1.5 s - each its own task, so no single one of them blocks the main thread for long (the sum of the long tasks
 * is what a page's blocking time is made of).
 */
export function afterFirstPaintPlus(ms: number): Promise<void> {
  return afterFirstPaint().then(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
}

export const STAGE = { scenes: 600, smoothScroll: 1200, shaders: 1500 } as const;
