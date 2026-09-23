/* ══════════════════════════════════════════════════════════════
   MAY THIS PERSON DO THIS?

   One question, one answer, and the answer comes from the server.

   ── What this replaces ──

   src/auth/rbac.ts held a table of 28 permission names against 5 role names
   and decided locally. The server has 13 permissions and 3 roles, and none of
   the 28 names matched any of the 13: the screen hid things by one model while
   the API refused them by another, and a permission the administrator revoked
   changed nothing the user could see.

   The server sends the effective list — the role's defaults with that person's
   own grants and revocations applied — when they log in, and again from
   GET /api/v1/account on start, on focus and after a refusal
   (accountRefresh.ts). This reads it, and redraws when it changes.

   ── It hides, it does not protect ──

   Every one of these checks is a courtesy: it keeps a button off a screen
   where pressing it would only produce a refusal. The refusal itself is the
   server's, on every request, whatever the client believes.
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useSyncExternalStore } from 'react';
import { parsePermissions, permissionsSnapshot, subscribePermissions } from './localSession';

/**
 * Exactly the permissions the server defines. Adding one here without adding
 * it there gives a check that is false for everybody, for ever.
 */
export type Permission =
  | 'patients.view'
  | 'patients.register'
  | 'patients.edit'
  | 'patients.sensitive_identity.view'
  | 'patients.view_all'
  | 'settings.clinic.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.cancel'
  | 'questionnaires.manage'
  | 'billing.manage'
  | 'documents.view'
  | 'documents.manage'
  | 'communication.manage';

/**
 * What the server said this person may do.
 *
 * An empty list when nothing is stored — a session that predates this, or one
 * that never logged in. Empty hides optional controls and shows nothing that
 * would be refused, which is the safe direction to be wrong in.
 */
export function storedPermissions(): string[] {
  return parsePermissions(permissionsSnapshot());
}

/**
 * Whether the server has told this browser anything at all.
 *
 * ── Why "empty" and "never told" have to be told apart ──
 *
 * `storedPermissions()` answers `[]` for both, and for hiding a single button
 * that is the right answer either way. For a whole menu it is not: a session
 * created before the list was stored would draw a settings screen with almost
 * nothing on it, and the owner would read that as features having vanished
 * rather than as a sign-in that predates them.
 *
 * So the screen that hides a lot asks this first and says "sign in again"
 * instead of showing a gutted menu.
 */
export function hasStoredPermissions(): boolean {
  try {
    return window.localStorage.getItem('permissions') !== null;
  } catch {
    return false;
  }
}

/**
 * Everything the signed-in user may do, redrawn whenever the list changes -
 * a refresh from GET /api/v1/account after focus or a refusal, or another tab.
 */
export function usePermissions(): readonly string[] {
  const raw = useSyncExternalStore(subscribePermissions, permissionsSnapshot, () => null);
  return useMemo(() => parsePermissions(raw), [raw]);
}

/** Whether the signed-in user has one permission. Follows refreshes live. */
export function usePermission(permission: Permission): boolean {
  return usePermissions().includes(permission);
}
