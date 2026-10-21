/* ══════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH - the shortcut and the loader of the command palette.

   Ctrl/Cmd+K (or any search button in the shell, which calls `openUniversalSearch`) opens the palette. The palette itself
   - the box, the ranking, the lookups - lives in `src/ui/shelf/palette/` and is a chunk of its own: this file is all the
   shell imports, so the staff portal's first load carries a listener and a `lazy()`, not the palette. The chunk is fetched
   in idle time after the first paint, so the first Ctrl+K usually finds it ready; if not, it opens as soon as it arrives.
   ══════════════════════════════════════════════════════════════ */
import { lazy, Suspense, useEffect, useState } from 'react';
import { afterFirstPaint } from '../utils/afterFirstPaint';

/** Event the shell's search buttons fire; the palette listens for it (and for Ctrl+K). */
export const OPEN_SEARCH_EVENT = 'sm-open-search';

/**
 * Opens the palette from a button.
 *
 * The buttons used to dispatch a synthetic Ctrl+K on `document`; a keyboard
 * event made by hand does not bubble, so the listener on `window` never
 * heard it. A named event on `window` itself cannot be missed.
 */
export function openUniversalSearch(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

const loadPalette = () => import('../ui/shelf/palette/CommandPalette');
const CommandPalette = lazy(loadPalette);

export default function UniversalSearch() {
  const [open, setOpen] = useState(false);
  /* Mounted from the first request on and kept, so closing it plays its exit and reopening is instant. */
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setArmed(true);
        setOpen((prev) => !prev);
      }
    };
    const openFromButton = () => {
      setArmed(true);
      setOpen(true);
    };
    window.addEventListener('keydown', toggle);
    window.addEventListener(OPEN_SEARCH_EVENT, openFromButton);
    return () => {
      window.removeEventListener('keydown', toggle);
      window.removeEventListener(OPEN_SEARCH_EVENT, openFromButton);
    };
  }, []);

  /* Fetch the chunk once the shell has painted and the browser is idle. Never in a test (nothing there waits for it). */
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    let live = true;
    void afterFirstPaint(5_000).then(() => { if (live) void loadPalette().catch(() => undefined); });
    return () => { live = false; };
  }, []);

  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </Suspense>
  );
}
