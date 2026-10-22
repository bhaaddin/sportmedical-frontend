/*
 * R15c (e) - keyboard shortcuts of the main calendar. Pure: a key event -> an action name, or null.
 *
 *   N new booking · T today · left / right previous / next period · D W M day / week / month · / or Ctrl+K search · ? the list
 *
 * Never while typing: a key pressed in an input, textarea, select or editable element, or while a dialog / menu holds the focus,
 * is the field's. Only a plain press counts (no Ctrl / Alt / Meta) - except Ctrl+K, which is the search everywhere (also in a field,
 * where "/" would be a typed character). Letters work on Czech and Latin layouts alike (case ignored, `code` as a fallback).
 */
export type ShortcutAction = 'new' | 'today' | 'prev' | 'next' | 'day' | 'week' | 'month' | 'search' | 'help';

export interface ShortcutKeyEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  /** The element the key went to. */
  target: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
}

export const SHORTCUT_LIST: readonly { keys: string; label: string }[] = [
  { keys: 'N', label: 'Nová rezervace' },
  { keys: 'T', label: 'Dnes' },
  { keys: '←  →', label: 'Předchozí / další období' },
  { keys: 'D  W  M', label: 'Den / týden / měsíc' },
  { keys: '/  nebo  Ctrl+K', label: 'Hledat' },
  { keys: '?', label: 'Tento seznam' },
];

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

export function isTypingTarget(target: ShortcutKeyEvent['target']): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (typeof target.closest !== 'function') return false;
  const hit = target.closest(TYPING);
  return hit !== null && hit !== undefined;
}

export function shortcutOf(e: ShortcutKeyEvent): ShortcutAction | null {
  if (e.isComposing) return null;
  const key = e.key;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && key.toLowerCase() === 'k') return 'search';
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (isTypingTarget(e.target)) return null;
  switch (key) {
    case '/':
      return 'search';
    case '?':
      return 'help';
    case 'ArrowLeft':
      return 'prev';
    case 'ArrowRight':
      return 'next';
    default:
      break;
  }
  const letter = key.length === 1 ? key.toLowerCase() : '';
  const fromCode = e.code?.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
  switch (letter || fromCode) {
    case 'n':
      return 'new';
    case 't':
      return 'today';
    case 'd':
      return 'day';
    case 'w':
      return 'week';
    case 'm':
      return 'month';
    default:
      return null;
  }
}
