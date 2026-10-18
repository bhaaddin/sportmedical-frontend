/*
 * Wakes a sleeping server while the person is still looking at the first screen.
 *
 * The live API runs on a plan that puts it to sleep after a quarter of an hour of nobody using it, and the first
 * request afterwards is answered only when it has woken up (about a minute). A scheduled ping from outside cannot
 * promise to prevent that - GitHub runs its schedules late and rarely - but a visitor who merely OPENS any page of
 * the site (the clinic website, the booking page, the staff sign-in) can start the wake-up at once: by the time the
 * password is typed or the date is chosen the server is up.
 *
 * One tiny anonymous request to /health/live, once per page load, with the answer ignored. The address is the same
 * `VITE_API_BASE_URL` every other call uses (empty in development, where the dev proxy answers).
 */
const API_BASE: string = import.meta.env.VITE_API_BASE_URL || '';

let warmed = false;

export function warmUpServer(): void {
  if (warmed || typeof fetch !== 'function') return;
  warmed = true;
  try {
    void fetch(`${API_BASE}/health/live`, { cache: 'no-store', credentials: 'omit', keepalive: true }).catch(() => undefined);
  } catch {
    /* A failing wake-up call must never disturb the page. */
  }
}

/** Tests only. */
export function resetWarmUpForTests(): void {
  warmed = false;
}
