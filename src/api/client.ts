import axios, { type AxiosError } from 'axios';
import { reportReachable, reportUnreachable } from './connection';
import { clearLocalSession } from '../auth/localSession';
import { socketService } from '../services/socketService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * How long one request may take before it counts as "no answer". Long enough
 * for a PDF or an export, short enough that a hung server turns into the
 * "Server je nedostupný" banner instead of a spinner that never ends.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/** The one HTTP client. Every API call goes through it and its handlers. */
const client = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ── Refusals: somebody else decides what a 403 means ──
   The account refresh listens here: a refusal is the likeliest moment for the
   permissions this screen holds to be out of date. */
type ForbiddenListener = () => void;
const forbiddenListeners = new Set<ForbiddenListener>();

export function onForbidden(listener: ForbiddenListener): () => void {
  forbiddenListeners.add(listener);
  return () => forbiddenListeners.delete(listener);
}

/** Where a sign-out the user did not ask for sends them, and why. */
export const SESSION_EXPIRED_PATH = '/login?reason=expired';

let signingOut = false;

/**
 * The session is gone - expired, revoked, the account switched off. Clear
 * this browser the same way "Odhlásit se" does, stop the live connection, and
 * go to the sign-in, which says in Czech why.
 *
 * Only when this browser thought it was signed in: a public page (the online
 * booking, the questionnaire) carries no token and must never be thrown to a
 * staff login screen.
 */
function endExpiredSession(): void {
  if (signingOut) return;
  if (localStorage.getItem('token') === null) return;
  signingOut = true;

  clearLocalSession();
  void socketService.stop();

  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = SESSION_EXPIRED_PATH;
  }
}

/** Test hook: allow the next expiry to be handled again. */
export function resetClientStateForTests(): void {
  signingOut = false;
  forbiddenListeners.clear();
}

/**
 * Whether an error means "nobody answered" rather than "the server said no".
 * The proxy in front of the API answers 502/503/504 when the API is down;
 * that is the same thing to the person at the desk.
 */
export function isUnreachable(error: unknown): boolean {
  const err = error as AxiosError | undefined;
  if (!err || axios.isCancel(err)) return false;
  if (!err.response) return err.code !== 'ERR_CANCELED';
  return err.response.status === 502 || err.response.status === 503 || err.response.status === 504;
}

// Unwrap ApiResult + 401 / 403 / network handling
client.interceptors.response.use(
  (res) => {
    reportReachable();

    // Backend wraps responses in { success, data, message, isSuccess }
    // Unwrap to return the inner data field directly
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err: AxiosError) => {
    if (isUnreachable(err)) {
      reportUnreachable();
      return Promise.reject(err);
    }

    if (err.response) reportReachable();

    const status = err.response?.status;
    const isSignIn = err.config?.url?.includes('/api/v1/session') && err.config?.method === 'post';

    if (status === 401 && !isSignIn) {
      endExpiredSession();
    } else if (status === 403) {
      forbiddenListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error('[client] forbidden listener failed:', error);
        }
      });
    }

    return Promise.reject(err);
  }
);

export { client };
export default client;
