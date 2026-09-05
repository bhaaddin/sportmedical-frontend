import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client';

/**
 * Polls for new public bookings and notifies staff.
 * Runs only when logged in (skips public pages like /book, /login).
 */
export default function NewBookingNotifier() {
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const check = async () => {
      try {
        const res = await client.get('/api/booking/admin/bookings');
        const list = res.data?.value ?? res.data ?? [];
        if (!Array.isArray(list)) return;

        const fresh: string[] = [];
        list.forEach((b: any) => {
          const id = String(b.id ?? b.bookingId ?? '');
          if (!id) return;
          if (!knownIds.current.has(id)) {
            knownIds.current.add(id);
            if (!firstLoad.current) fresh.push(id);
          }
        });

        if (!firstLoad.current && fresh.length > 0) {
          const latest = list.find((b: any) => String(b.id ?? b.bookingId ?? '') === fresh[fresh.length - 1]);
          const when = latest?.startAt
            ? new Date(latest.startAt).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }) +
              ' ' + new Date(latest.startAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
            : '';
          toast.success(
            fresh.length === 1
              ? `Nová rezervace: ${latest?.inviteeName ?? ''} — ${latest?.eventName ?? ''} (${when})`
              : `${fresh.length} nové rezervace`,
            { duration: 8000 }
          );
          window.dispatchEvent(new CustomEvent('booking:created'));
        }
        firstLoad.current = false;
      } catch {
        /* ignore — will retry next poll */
      }
    };

    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  return null;
}
