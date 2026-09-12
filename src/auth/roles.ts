/*
 * Who is logged in, and whether they are an administrator.
 *
 * These two lived in `App.tsx`. Settings needs them to decide which rows to
 * show, and importing them from `App.tsx` would close a circle - `App` lazily
 * imports `Settings`, `Settings` imports `App` - which bundlers resolve by
 * handing one side an empty module, at runtime, on whichever screen happens to
 * load first. That is a failure that moves when you look at it.
 *
 * This is presentation only. It decides what to draw, never what is allowed:
 * `localStorage` is the viewer's to edit, so every one of these screens is
 * also guarded on the server.
 */
const ADMIN_ROLES = ['Owner', 'Administrator', 'Admin', 'SuperAdmin'];

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.includes(role ?? '');
}

export function currentUserRole(): string {
  try {
    return (JSON.parse(localStorage.getItem('user') || '{}') as { role?: string }).role ?? '';
  } catch {
    return '';
  }
}
