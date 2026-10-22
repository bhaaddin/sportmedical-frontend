/*
 * R15c (e) - the main calendar's keyboard shortcuts (the map and the rules for typing are `booking/extras/shortcutMap.ts`).
 *
 * One capture-phase listener on `window`, only while the main calendar is on screen (`enabled`): a handled key is consumed
 * (`preventDefault` + `stopPropagation`) so the older planner-wide `N` ("Vytvořit termín" of club planning) does not also fire here.
 * Ctrl / Cmd+K is the shell's palette (`UniversalSearch`), which already listens for it: it is left alone, never opened twice.
 * "/" opens the same palette. Holding a key down repeats nothing.
 */
import { useEffect, useRef } from 'react';
import { shortcutOf, type ShortcutAction } from '../../../components/booking/extras/shortcutMap';

/* The palette's own event (`OPEN_SEARCH_EVENT` of UniversalSearch.tsx - a test pins the two together): importing that module here would put the palette into the planner's first load. */
const OPEN_SEARCH_EVENT = 'sm-open-search';
const openUniversalSearch = (): void => void window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

export function useBoardShortcuts(enabled: boolean, handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      const action = shortcutOf({ key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.isComposing, target: e.target instanceof Element ? e.target : null });
      if (action === null) return;
      /* the palette's own toggle handles Ctrl / Cmd+K */
      if (action === 'search' && (e.ctrlKey || e.metaKey)) return;
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const run = action === 'search' ? (latest.current.search ?? openUniversalSearch) : latest.current[action];
      if (!run) return;
      e.preventDefault();
      e.stopPropagation();
      run();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}
