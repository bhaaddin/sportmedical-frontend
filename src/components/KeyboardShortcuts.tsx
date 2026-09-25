import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../auth/usePermission';

/* Alt+1 Přehled, Alt+2 Plánování, Alt+3 Pacienti - the last only for somebody
   who may see patients; for anybody else /patients is NotFound. Read live, so
   a grant or revocation from the account refresh reaches the shortcut too.

   A route change, not `window.location.href`: a reload threw away every
   query the screens held and re-ran the sign-in refresh, so the shortcut was
   slower than the mouse. Mounted inside the router for that reason. */
export function KeyboardShortcuts() {
  const maySeePatients = usePermission('patients.view');
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        navigate('/');
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        navigate('/planovani');
      }
      if (e.altKey && e.key === '3' && maySeePatients) {
        e.preventDefault();
        navigate('/patients');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maySeePatients, navigate]);

  return null;
}
