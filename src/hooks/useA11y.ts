/* ══════════════════════════════════════════════════════════════
   USE A11Y HOOK
   WCAG 2.2 accessibility state: high contrast, reduced motion,
   screen reader announcements, focus management.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface A11yState {
  highContrast: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  forcedColors: boolean;
  announcements: string[];
}

export function useA11y() {
  const [state, setState] = useState<A11yState>({
    highContrast: false,
    reducedMotion: false,
    reducedTransparency: false,
    forcedColors: false,
    announcements: [],
  });

  useEffect(() => {
    const mqHC = window.matchMedia('(prefers-contrast: more)');
    const mqRM = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqRT = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const mqFC = window.matchMedia('(forced-colors: active)');

    const update = () => setState(s => ({
      ...s,
      highContrast: mqHC.matches,
      reducedMotion: mqRM.matches,
      reducedTransparency: mqRT.matches,
      forcedColors: mqFC.matches,
    }));

    update();
    mqHC.addEventListener('change', update);
    mqRM.addEventListener('change', update);
    mqRT.addEventListener('change', update);
    mqFC.addEventListener('change', update);

    return () => {
      mqHC.removeEventListener('change', update);
      mqRM.removeEventListener('change', update);
      mqRT.removeEventListener('change', update);
      mqFC.removeEventListener('change', update);
    };
  }, []);

  const announce = useCallback((message: string) => {
    setState(s => ({ ...s, announcements: [...s.announcements.slice(-4), message] }));
  }, []);

  const clearAnnouncements = useCallback(() => {
    setState(s => ({ ...s, announcements: [] }));
  }, []);

  return { ...state, announce, clearAnnouncements };
}

/**
 * Focus trap hook for modals/dialogs.
 * Returns a ref to attach to the container.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, []);

  return containerRef;
}
