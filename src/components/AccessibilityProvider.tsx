import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';

interface AccessibilityContextValue {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  announce: () => {},
});

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      setTimeout(() => setAssertiveMessage(message), 100);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 100);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Alt+1 → Dashboard
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        window.location.href = '/';
      }
      // Alt+2 → Calendar
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        window.location.href = '/calendar';
      }
      // Alt+3 → Patients
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        window.location.href = '/patients';
      }
      // Escape → close dialogs
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('a11y:escape'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ announce }}>
      {children}
      {/* ARIA live regions for screen readers */}
      <Box component="span" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </Box>
      <Box component="span" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </Box>
    </AccessibilityContext.Provider>
  );
}
