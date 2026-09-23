/* ══════════════════════════════════════════════════════════════
   WHAT MAY THIS PERSON DO - RIGHT NOW

   The permissions used to be read once, from the sign-in answer, and trusted
   for eight hours. An owner who switched something on for a receptionist saw
   nothing change on her screen until she signed out and in again, and one
   who switched something off left a menu item that only produced refusals.
   A login stored before a permission existed hid menu items for good.

   GET /api/v1/account answers the same effective list the server checks
   every request against. It is read:
     - when the signed-in application starts,
     - when the window gets focus back (somebody changed something while the
       tab sat in the background),
     - after any 403 (the likeliest moment the list is out of date).
   ══════════════════════════════════════════════════════════════ */
import { useEffect } from 'react';
import { client, onForbidden } from '../api/client';
import { savePermissions, saveUser, type AccountSummary } from './localSession';

export interface CurrentAccount {
  account: AccountSummary;
  permissions: string[];
}

/** No more than one ordinary refresh in this window. */
export const REFRESH_THROTTLE_MS = 10_000;

/**
 * A forced refresh (start, a 403) waits only this long after the last one, so
 * a screen that keeps getting refused does not turn into a stream of reads.
 */
export const FORCED_REFRESH_GAP_MS = 2_000;

let inFlight: Promise<void> | null = null;
let lastRefreshAt = 0;

/**
 * Reads the account and stores what it says. Failures change nothing here:
 * a 401 signs out through the client, a dead server raises the banner, and
 * the permissions held stay as they were until an answer arrives.
 */
export function refreshAccount(options: { force?: boolean } = {}): Promise<void> {
  if (localStorage.getItem('token') === null) return Promise.resolve();
  if (inFlight) return inFlight;
  const gap = options.force ? FORCED_REFRESH_GAP_MS : REFRESH_THROTTLE_MS;
  if (lastRefreshAt !== 0 && Date.now() - lastRefreshAt < gap) return Promise.resolve();

  lastRefreshAt = Date.now();
  inFlight = client
    .get<CurrentAccount>('/api/v1/account')
    .then(({ data }) => {
      if (!data || !Array.isArray(data.permissions)) return;
      savePermissions(data.permissions);
      if (data.account) saveUser(data.account);
    })
    .catch(() => {
      /* See above: the client's handlers already said what went wrong. */
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Test hook. */
export function resetAccountRefreshForTests(): void {
  inFlight = null;
  lastRefreshAt = 0;
}

/**
 * Keeps the stored permissions current while the signed-in application is on
 * screen. Mounted once, in the signed-in layout.
 */
export function useAccountRefresh(): void {
  useEffect(() => {
    void refreshAccount({ force: true });

    const onFocus = () => void refreshAccount();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshAccount();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    /* A refusal is forced past the throttle: it is evidence, not a habit. */
    const stopListening = onForbidden(() => void refreshAccount({ force: true }));

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      stopListening();
    };
  }, []);
}
