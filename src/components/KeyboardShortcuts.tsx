import { useEffect } from 'react';
import { storedPermissions } from '../auth/usePermission';

/* Alt+1 Přehled, Alt+2 Plánování, Alt+3 Pacienti - the last only for somebody
   who may see patients; for anybody else /patients is NotFound. */
export function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        window.location.href = '/';
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        window.location.href = '/planovani';
      }
      if (e.altKey && e.key === '3' && storedPermissions().includes('patients.view')) {
        e.preventDefault();
        window.location.href = '/patients';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
