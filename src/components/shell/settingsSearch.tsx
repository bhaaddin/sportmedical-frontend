/*
 * One search box for the settings, wherever it is drawn.
 *
 * On desktop the sidebar carries it (on a settings route the sidebar IS the
 * settings navigation), and /settings narrows its cards by the same query, so
 * the person types once. On tablet and phone the sidebar is an overlay or not
 * there at all, so /settings draws the box itself (`inRail` is false). A
 * screen rendered outside the shell - the unit tests do that - gets its own
 * local state and its own box.
 */
import { createContext, useContext, useState } from 'react';

export interface SettingsSearch {
  query: string;
  setQuery: (query: string) => void;
  /** True when the desktop sidebar is drawing the box, so the page must not draw a second one. */
  inRail: boolean;
}

export const SettingsSearchContext = createContext<SettingsSearch | null>(null);

/** The shared query when the shell provides one; a private one otherwise. */
export function useSettingsSearch(): SettingsSearch {
  const shared = useContext(SettingsSearchContext);
  const [query, setQuery] = useState('');
  return shared ?? { query, setQuery, inRail: false };
}
