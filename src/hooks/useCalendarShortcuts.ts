/* ══════════════════════════════════════════════════════════════
   CALENDAR SHORTCUTS — PLAN-01 Feature B151-B160
   - Keyboard navigation
   - Quick actions
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useCallback } from 'react';

interface Props {
  onNavigateToday: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onToggleView: () => void;
  onAddEvent: () => void;
  onSearch: () => void;
  onRefresh: () => void;
}

export function useCalendarShortcuts({
  onNavigateToday, onNavigatePrev, onNavigateNext,
  onToggleView, onAddEvent, onSearch, onRefresh,
}: Props) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 't': event.preventDefault(); onNavigateToday(); break;
        case 'k': event.preventDefault(); onSearch(); break;
        case 'r': event.preventDefault(); onRefresh(); break;
        case 'n': event.preventDefault(); onAddEvent(); break;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); onNavigatePrev(); break;
      case 'ArrowRight': event.preventDefault(); onNavigateNext(); break;
      case 'd': event.preventDefault(); onToggleView(); break;
    }
  }, [onNavigateToday, onNavigatePrev, onNavigateNext, onToggleView, onAddEvent, onSearch, onRefresh]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
