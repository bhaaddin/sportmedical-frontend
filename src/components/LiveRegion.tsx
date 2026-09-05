/* ══════════════════════════════════════════════════════════════
   LIVE REGION — WCAG 2.2 live announcements (SC 4.1.3)
   ARIA live region for dynamic content announcements.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useRef } from 'react';

interface LiveRegionProps {
  announcements: string[];
  onClear?: () => void;
}

export default function LiveRegion({ announcements, onClear }: LiveRegionProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = announcements.length > 0 ? announcements[announcements.length - 1] : '';

  useEffect(() => {
    if (!latest) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onClear?.(); }, 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [latest, onClear]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {latest}
    </div>
  );
}

/**
 * Assertive live region — for urgent announcements (errors, etc.)
 */
export function AssertiveRegion({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
