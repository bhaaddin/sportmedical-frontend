/* ══════════════════════════════════════════════════════════════
   PRESENCE - things that appear and disappear WITH a visible reason.

   `PopIn`        a panel/dialog that pops from where the person pointed (spring), and leaves quickly;
   `PresenceList` a keyed list whose new items rise in and whose removed items collapse before they unmount.

   Both keep the content mounted until the exit has played, and both degrade the same way: 'omezené' = a plain fade
   (nothing travels), 'vypnuto' (or the library not there yet) = instant mount and unmount.
   ══════════════════════════════════════════════════════════════ */

import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { DIST, DUR, EASE, POP_CURVE } from './tokens';
import { loadMotion, motionIfLoaded } from './engine';
import { useMotionPreference } from './useMotionPreference';

/** Keeps `show`'s content mounted until `done()` is called after the exit. */
export function usePresence(show: boolean): { mounted: boolean; done: () => void } {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) setMounted(true);
  }, [show]);
  const done = useCallback(() => setMounted(false), []);
  return { mounted: show || mounted, done };
}

export interface PopOrigin {
  /** Viewport coordinates of the thing that was pressed (a pointer position or the middle of a button). */
  x: number;
  y: number;
}

/** The middle of an element, or a pointer event's position - what a dialog pops out of. */
export function originOf(source: HTMLElement | MouseEvent | PopOrigin | null | undefined): PopOrigin | null {
  if (!source) return null;
  if ('clientX' in source) return { x: source.clientX, y: source.clientY };
  if ('getBoundingClientRect' in source) {
    const r = source.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return source;
}

export interface PopInProps {
  open: boolean;
  origin?: PopOrigin | null;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onExited?: () => void;
}

export function PopIn({ open, origin = null, as = 'div', className, style, children, onExited }: PopInProps) {
  const { mode } = useMotionPreference();
  const { mounted, done } = usePresence(open);
  const ref = useRef<HTMLElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;
  const entered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!mounted || el === null) return;
    const api = motionIfLoaded();
    const finish = () => {
      entered.current = false;
      done();
      exitedRef.current?.();
    };
    if (open) {
      entered.current = true;
      if (mode === 'vypnuto' || api === null) return;
      if (origin) {
        const r = el.getBoundingClientRect();
        el.style.transformOrigin = `${origin.x - r.left}px ${origin.y - r.top}px`;
      }
      const reduced = mode === 'omezené';
      const keyframes = reduced ? { opacity: [0, 1] } : { opacity: [0, 1], transform: [`scale(${DIST.popFrom})`, 'scale(1)'] };
      // The spring is SPRING.pop as an easing function (tokens.ts); motion/mini samples it into a CSS linear() the browser runs.
      const transition = reduced ? { duration: DUR.instant * 1.5 } : { duration: 0.34, ease: POP_CURVE };
      void api.animate(el, keyframes as never, transition as never).then(() => {
        el.style.removeProperty('transform');
        el.style.removeProperty('opacity');
      });
    } else if (entered.current) {
      if (mode === 'vypnuto' || api === null) {
        finish();
        return;
      }
      const keyframes = mode === 'omezené' ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' };
      void api.animate(el, keyframes as never, { duration: DUR.quick, ease: EASE.in as never }).then(finish, finish);
    } else {
      finish();
    }
  }, [open, mounted, mode, origin, done]);

  if (!mounted) return null;
  return createElement(as, { ref, className, style }, children);
}

/* ── a keyed list with enter and exit ── */

export interface PresenceListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  render: (item: T) => ReactNode;
  as?: ElementType;
  itemAs?: ElementType;
  className?: string;
  itemClassName?: string;
}

interface Entry<T> {
  key: string;
  item: T;
  leaving: boolean;
}

/** The new list, with the removed entries kept (leaving) right after the entry that preceded them. */
export function mergeEntries<T>(prev: readonly Entry<T>[], items: readonly T[], getKey: (item: T) => string): Entry<T>[] {
  const merged: Entry<T>[] = items.map((item) => ({ key: getKey(item), item, leaving: false }));
  const alive = new Set(merged.map((e) => e.key));
  prev.forEach((entry, index) => {
    if (alive.has(entry.key)) return;
    let at = 0;
    for (let p = index - 1; p >= 0; p -= 1) {
      const where = merged.findIndex((e) => e.key === prev[p].key);
      if (where >= 0) {
        at = where + 1;
        break;
      }
    }
    merged.splice(at, 0, { ...entry, leaving: true });
  });
  return merged;
}

export function PresenceList<T>({ items, getKey, render, as = 'ul', itemAs = 'li', className, itemClassName }: PresenceListProps<T>) {
  const { mode } = useMotionPreference();
  const [entries, setEntries] = useState<Entry<T>[]>(() => items.map((item) => ({ key: getKey(item), item, leaving: false })));
  const nodes = useRef(new Map<string, HTMLElement>());
  const seen = useRef(new Set(entries.map((e) => e.key)));

  useEffect(() => {
    setEntries((prev) => mergeEntries(prev, items, getKey));
  }, [items, getKey]);

  useEffect(() => {
    if (mode !== 'vypnuto') void loadMotion();
    const api = motionIfLoaded();
    for (const entry of entries) {
      const el = nodes.current.get(entry.key);
      const fresh = !seen.current.has(entry.key);
      if (!entry.leaving) seen.current.add(entry.key);
      if (entry.leaving) {
        const drop = () => setEntries((prev) => prev.filter((e) => e.key !== entry.key));
        if (api === null || mode === 'vypnuto' || el === undefined) {
          drop();
        } else if (el.dataset.leaving !== '1') {
          el.dataset.leaving = '1';
          const keyframes = mode === 'omezené' ? { opacity: 0 } : { opacity: 0, height: 0, transform: 'scale(0.98)' };
          void api.animate(el, keyframes as never, { duration: DUR.quick, ease: EASE.in as never }).then(drop, drop);
        }
      } else if (fresh && api !== null && mode !== 'vypnuto' && el !== undefined) {
        const keyframes = mode === 'omezené' ? { opacity: [0, 1] } : { opacity: [0, 1], transform: [`translateY(${DIST.nudge}px)`, 'translateY(0px)'] };
        void api.animate(el, keyframes as never, { duration: DUR.quick, ease: EASE.out as never }).then(() => {
          el.style.removeProperty('transform');
          el.style.removeProperty('opacity');
        });
      }
    }
  }, [entries, mode]);

  return createElement(
    as,
    { className },
    entries.map((entry) =>
      createElement(
        itemAs,
        {
          key: entry.key,
          className: itemClassName,
          style: entry.leaving ? { overflow: 'hidden' } : undefined,
          ref: (node: HTMLElement | null) => {
            if (node) nodes.current.set(entry.key, node);
            else nodes.current.delete(entry.key);
          },
        },
        render(entry.item),
      ),
    ),
  );
}
