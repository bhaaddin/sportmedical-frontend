import { useBoardShortcuts, type ShortcutHandlers } from './useBoardShortcuts';

/** R15c (e): registers the main calendar's keyboard shortcuts. Loaded lazily right after the first paint; draws nothing (a hidden marker says it is listening). */
export function BoardShortcuts({ handlers }: { handlers: ShortcutHandlers }) {
  useBoardShortcuts(true, handlers);
  return <span hidden data-testid="board-shortcuts-on" />;
}

export default BoardShortcuts;
