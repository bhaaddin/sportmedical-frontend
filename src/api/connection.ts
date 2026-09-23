/* ══════════════════════════════════════════════════════════════
   IS THE SERVER THERE?

   One answer for the whole application, fed by every request the axios
   client makes. A request that got no answer at all - the API is down, the
   proxy in front of it says so, the network is gone - marks the server
   unreachable; the banner says "Server je nedostupný — zkouším znovu" and
   this module keeps asking /health/live with a growing pause until it
   answers. Any answer, from the probe or from a real request, marks it
   reachable again and tells whoever listens that it came back, so the
   screens reload what they missed instead of showing what they had.

   `navigator.onLine` cannot answer this: the browser is online while the
   API is restarting, and that is the case the desk actually meets.
   ══════════════════════════════════════════════════════════════ */

export type ConnectionState = 'online' | 'unreachable';

type Listener = () => void;

const API_BASE: string = import.meta.env.VITE_API_BASE_URL || '';

/** First pause after a failure, then doubled up to the ceiling. */
const FIRST_RETRY_MS = 2_000;
const MAX_RETRY_MS = 15_000;

let state: ConnectionState = 'online';
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const stateListeners = new Set<Listener>();
const recoveredListeners = new Set<Listener>();

function setState(next: ConnectionState): void {
  if (state === next) return;
  state = next;
  stateListeners.forEach((listener) => listener());
}

/** Anonymous and cheap: answers as soon as the process runs. */
async function probe(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health/live`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function scheduleProbe(): void {
  if (timer !== null) return;
  const delay = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** attempt);
  attempt += 1;
  timer = setTimeout(() => {
    timer = null;
    void probe().then((ok) => {
      if (ok) {
        reportReachable();
      } else if (state === 'unreachable') {
        scheduleProbe();
      }
    });
  }, delay);
}

export const connection = {
  getState: (): ConnectionState => state,

  /** For useSyncExternalStore. */
  subscribe(listener: Listener): () => void {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  },

  /** Called once each time the server answers again after a gap. */
  onRecovered(listener: Listener): () => void {
    recoveredListeners.add(listener);
    return () => recoveredListeners.delete(listener);
  },
};

/** A request got no answer. Starts the retry loop if it is not running. */
export function reportUnreachable(): void {
  setState('unreachable');
  scheduleProbe();
}

/** Something answered. Ends the retry loop and announces the recovery. */
export function reportReachable(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  attempt = 0;

  if (state === 'unreachable') {
    setState('online');
    recoveredListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[connection] recovery listener failed:', error);
      }
    });
  }
}

/** Tests only: back to a clean slate. */
export function resetConnectionForTests(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  attempt = 0;
  state = 'online';
  stateListeners.clear();
  recoveredListeners.clear();
}
