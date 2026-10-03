/* ══════════════════════════════════════════════════════════════
   IS A STAFF MEMBER SIGNED IN IN THIS BROWSER?

   The public site is for everybody and is prerendered, so it must look the same to the
   server, to the first client render and to a visitor with no session: `false` until the
   page has mounted. Only then is the browser's storage read, and only a signed-in staff
   member sees the discreet "Do aplikace" link that follows from it.

   "Signed in" means what the application itself means (App's AuthGuard): a token is stored.
   Whether it is still valid is the server's say; the link only opens the portal, which asks.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';

/** The token the staff sign-in stores. Kept in step with src/auth/localSession.ts (SESSION_KEYS). */
const TOKEN_KEY = 'token';

export function readStaffSession(): boolean {
  try {
    return window.localStorage.getItem(TOKEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function useStaffSession(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(readStaffSession());
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) setSignedIn(readStaffSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return signedIn;
}
