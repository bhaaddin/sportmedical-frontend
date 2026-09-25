/* ══════════════════════════════════════════════════════════════
   WHAT A SIGN-IN LEAVES IN THIS BROWSER

   The token, the user's name for the avatar, and the permissions the server
   last said this person holds. Written by the sign-in and by every refresh
   of GET /api/v1/account, cleared by signing out and by a 401.

   The permission list is a small store rather than a value read once: a
   refresh that finds the owner granted or revoked something redraws the
   menu and the buttons straight away, instead of on the next sign-in.
   ══════════════════════════════════════════════════════════════ */

/** Everything a sign-in stores. Nothing else in localStorage is touched. */
export const SESSION_KEYS = ['token', 'user', 'permissions', 'preferences'] as const;

type Listener = () => void;

const permissionListeners = new Set<Listener>();

function notify(): void {
  permissionListeners.forEach((listener) => listener());
}

/** Subscribe to changes of the stored permission list (useSyncExternalStore). */
export function subscribePermissions(listener: Listener): () => void {
  permissionListeners.add(listener);

  /* Another tab signing in, out, or refreshing writes the same key. */
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'permissions' || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    permissionListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The raw stored list, as a stable snapshot for useSyncExternalStore. */
export function permissionsSnapshot(): string | null {
  try {
    return window.localStorage.getItem('permissions');
  } catch {
    return null;
  }
}

/** Parses what `permissionsSnapshot` returned. Anything malformed is "nothing". */
export function parsePermissions(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** Stores what the server says this person may do, and redraws whoever listens. */
export function savePermissions(permissions: readonly string[]): void {
  const next = JSON.stringify([...permissions].sort());
  try {
    if (window.localStorage.getItem('permissions') === next) return;
    window.localStorage.setItem('permissions', next);
  } catch {
    /* Private mode or a full quota: the server still refuses what it refuses. */
  }
  notify();
}

/** The account as the avatar and the menus read it. */
export interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

/** The shape the sign-in and GET /api/v1/account both answer with. */
export interface AccountSummary {
  userId: string;
  email: string;
  displayName: string;
  role: string;
}

/**
 * "MUDr. Jana Nováková" is Jana Nováková with a title in front, not somebody
 * whose first name is "MUDr.". The avatar used to read "MJ" for every doctor
 * at the clinic; a title is a word that ends with a full stop, and it is
 * skipped when there is a name behind it.
 */
export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  const named = parts.filter((part) => !part.endsWith('.'));
  const source = named.length > 0 ? named : parts;
  return {
    firstName: source[0] || displayName,
    lastName: source.slice(1).join(' ') || '',
  };
}

export function saveUser(account: AccountSummary): void {
  const user: StoredUser = {
    id: account.userId,
    email: account.email,
    ...splitDisplayName(account.displayName),
    role: account.role,
  };
  try {
    window.localStorage.setItem('user', JSON.stringify(user));
  } catch {
    /* See savePermissions. */
  }
}

/** Removes exactly what a sign-in stored. */
export function clearLocalSession(): void {
  for (const key of SESSION_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* Leaving is more important than tidying. */
    }
  }
  notify();
}
