/* ══════════════════════════════════════════════════════════════
   KEYBOARD NAVIGATION HOOKS — Phase 10
   - Arrow key navigation for calendar grid
   - Escape to close modals/drawers
   - Tab trap for modals
   - Global keyboard shortcuts
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook to handle Escape key to close modals/drawers.
 * @param onClose - Function to call when Escape is pressed
 * @param enabled - Whether the hook is active (default: true)
 */
export function useEscapeKey(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, enabled]);
}

/**
 * Hook to trap focus within a modal/dialog container.
 * @param containerRef - Ref to the container element
 * @param enabled - Whether the trap is active
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    const container = containerRef.current;

    const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusableElements = container.querySelectorAll(focusableSelectors);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0] as HTMLElement;
      const last = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    // Focus first element
    const firstFocusable = container.querySelector(focusableSelectors) as HTMLElement;
    firstFocusable?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled]);
}

/**
 * Hook for arrow key navigation in a grid/list.
 * @param options.rowCount - Number of rows
 * @param options.colCount - Number of columns
 * @param options.onNavigate - Callback with (row, col)
 */
export function useArrowNavigation(options: {
  rowCount: number;
  colCount: number;
  onNavigate: (row: number, col: number) => void;
  enabled?: boolean;
}) {
  const { rowCount, colCount, onNavigate, enabled = true } = options;
  const position = useRef({ row: 0, col: 0 });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) return;

      // Only handle if focus is within the grid area
      const target = e.target as HTMLElement;
      if (!target.closest('[data-grid-nav]')) return;

      e.preventDefault();
      const pos = position.current;

      switch (e.key) {
        case 'ArrowUp':
          pos.row = Math.max(0, pos.row - 1);
          break;
        case 'ArrowDown':
          pos.row = Math.min(rowCount - 1, pos.row + 1);
          break;
        case 'ArrowLeft':
          pos.col = Math.max(0, pos.col - 1);
          break;
        case 'ArrowRight':
          pos.col = Math.min(colCount - 1, pos.col + 1);
          break;
        case 'Enter':
        case ' ':
          onNavigate(pos.row, pos.col);
          return;
      }
      onNavigate(pos.row, pos.col);
    },
    [rowCount, colCount, onNavigate, enabled],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return position;
}

/**
 * Global keyboard shortcuts hook.
 * @param shortcuts - Map of key combos to handlers
 */
export function useGlobalShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        e.altKey ? 'Alt' : '',
        e.key,
      ]
        .filter(Boolean)
        .join('+');

      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
