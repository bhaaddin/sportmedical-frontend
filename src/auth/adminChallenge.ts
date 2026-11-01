/*
 * The two things the server can ask of an administrator in the middle of a request, kept apart from the HTTP client so the
 * client can call them without importing any screen.
 *
 *   403 { code: "reconfirm_required" }   "Potvrďte, že jste to vy": the window (src/pages/settings/security/ReconfirmHost) asks
 *                                         for the password (and the 2FA code), and the client retries the request once.
 *   403 { code: "two_factor_required" }  the Administrace shows only "Pro administraci zapněte dvoufázové ověření".
 *
 * Nothing here holds a password or a code - only whether a window is available and whether the 2FA notice is up.
 */

/** The `code` of a ProblemDetails body, wherever the server put it. */
export function problemCodeOf(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object') return undefined;
  const body = data as { code?: unknown; extensions?: { code?: unknown } };
  if (typeof body.code === 'string') return body.code;
  if (body.extensions !== undefined && body.extensions !== null && typeof body.extensions.code === 'string') return body.extensions.code;
  return undefined;
}

type Asker = () => Promise<boolean>;

let asker: Asker | null = null;
let pending: Promise<boolean> | null = null;

/** The window registers itself while it is mounted; returns the way to unregister. */
export function registerReconfirmAsker(fn: Asker): () => void {
  asker = fn;
  return () => { if (asker === fn) asker = null; };
}

export function canAskReconfirm(): boolean {
  return asker !== null;
}

/** Ask once for however many requests were refused together; true = confirmed, retry them. */
export function askReconfirm(): Promise<boolean> {
  if (asker === null) return Promise.resolve(false);
  if (pending === null) {
    pending = asker().catch(() => false).finally(() => { pending = null; });
  }
  return pending;
}

/* ── "two_factor_required" ── */
let twoFactorRequired = false;
const listeners = new Set<() => void>();

export const subscribeTwoFactorRequired = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const twoFactorRequiredSnapshot = (): boolean => twoFactorRequired;

export function setTwoFactorRequired(value: boolean): void {
  if (twoFactorRequired === value) return;
  twoFactorRequired = value;
  listeners.forEach((l) => l());
}

export function resetAdminChallengeForTests(): void {
  asker = null;
  pending = null;
  setTwoFactorRequired(false);
}
