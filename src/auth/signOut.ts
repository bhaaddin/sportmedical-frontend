import { authApi } from '../api/auth';
import { clearLocalSession } from './localSession';
import { socketService } from '../services/socketService';

/**
 * Sign out: on the server first, then in this browser, then to the login
 * screen.
 *
 * The server half is the point. Clearing only `localStorage` left the session
 * valid for the rest of its eight hours - anybody holding a copy of the token
 * could keep using it, and System Health went on listing the person as signed
 * in.
 *
 * A refused or unreachable revoke does not keep anybody signed in here: the
 * browser is cleared either way, because somebody pressing "Odhlásit se" at a
 * shared desk must be able to walk away.
 *
 * A full page load rather than a router navigation, so nothing the previous
 * person loaded stays in memory for the next one.
 */
export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* Expired already, or the server is down; the browser is cleared below. */
  }

  clearLocalSession();

  /* The live connection authenticated as this person; it ends with them. */
  await socketService.stop();

  window.location.href = '/login';
}
