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

/* ── Is the server up yet? (speed-fe-6) ──
   'idle'    nobody asked (tests, a page that never calls warmUpServer): treated as ready, nothing waits;
   'pending' the first ping has not been answered: poll /health/live every POLL_MS until it is;
   'ready'   it answered (or the polling gave up after GIVE_UP_MS: the sign-in's own retry stays the safety net). */
export type ServerState = 'idle' | 'pending' | 'ready';
export const POLL_MS = 2_000;
export const GIVE_UP_MS = 120_000;

let serverState: ServerState = 'idle';
let pollTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setServerState(next: ServerState): void {
  if (serverState === next) return;
  serverState = next;
  listeners.forEach((listener) => listener());
}

export const getServerState = (): ServerState => serverState;

export function subscribeServerState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function answers(init: RequestInit): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health/live`, init);
    return response.ok;
  } catch {
    return false;
  }
}

function pollUntilReady(startedAt: number): void {
  if (pollTimer !== null) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void answers({ cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5_000) }).then((ok) => {
      if (ok || Date.now() - startedAt >= GIVE_UP_MS) setServerState('ready');
      else pollUntilReady(startedAt);
    });
  }, POLL_MS);
}

/** Resolves when the server has answered (or the polling gave up, or nobody started it): then the sign-in is sent ONCE. */
export function whenServerReady(): Promise<void> {
  if (serverState !== 'pending') return Promise.resolve();
  return new Promise((resolve) => {
    const off = subscribeServerState(() => {
      if (serverState !== 'pending') {
        off();
        resolve();
      }
    });
  });
}

export function warmUpServer(): void {
  if (warmed || typeof fetch !== 'function') return;
  warmed = true;
  setServerState('pending');
  const startedAt = Date.now();
  try {
    void answers({ cache: 'no-store', credentials: 'omit', keepalive: true }).then((ok) => {
      if (ok) setServerState('ready');
      else pollUntilReady(startedAt);
    });
  } catch {
    /* A failing wake-up call must never disturb the page. */
    setServerState('ready');
  }
}

/** Tests only. */
export function resetWarmUpForTests(): void {
  warmed = false;
  serverState = 'idle';
  if (pollTimer !== null) clearTimeout(pollTimer);
  pollTimer = null;
  listeners.clear();
}
