import { useEffect } from 'react';
import { usePermission } from '../auth/usePermission';

/* Alt+1 Přehled, Alt+2 Plánování, Alt+3 Pacienti - the last only for somebody
   who may see patients; for anybody else /patients is NotFound. Read live, so
   a grant or revocation from the account refresh reaches the shortcut too. */
export function KeyboardShortcuts() {
  const maySeePatients = usePermission('patients.view');

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
      if (e.altKey && e.key === '3' && maySeePatients) {
        e.preventDefault();
        window.location.href = '/patients';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maySeePatients]);

  return null;
}
