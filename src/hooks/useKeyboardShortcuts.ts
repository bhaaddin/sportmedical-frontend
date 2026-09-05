import { useEffect, useCallback, useRef } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    for (const shortcut of shortcutsRef.current) {
      if (shortcut.disabled) continue;

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true;
      const shiftMatch = shortcut.shift ? event.shiftKey : true;
      const altMatch = shortcut.alt ? event.altKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        break;
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return shortcuts;
}

export function useGlobalShortcuts() {
  const shortcuts: Shortcut[] = [
    { key: 'k', ctrl: true, description: 'Vyhledávání', action: () => document.dispatchEvent(new CustomEvent('open-search')) },
    { key: 'n', ctrl: true, description: 'Nový záznam', action: () => document.dispatchEvent(new CustomEvent('new-record')) },
    { key: 's', ctrl: true, description: 'Uložit', action: () => document.dispatchEvent(new CustomEvent('save')) },
    { key: 'z', ctrl: true, description: 'Zpět', action: () => document.dispatchEvent(new CustomEvent('undo')) },
    { key: 'y', ctrl: true, description: 'Znovu', action: () => document.dispatchEvent(new CustomEvent('redo')) },
    { key: '/', description: 'Nápověda', action: () => document.dispatchEvent(new CustomEvent('show-help')) },
    { key: 'Escape', description: 'Zavřít', action: () => document.dispatchEvent(new CustomEvent('close')) },
  ];

  return useKeyboardShortcuts(shortcuts);
}
