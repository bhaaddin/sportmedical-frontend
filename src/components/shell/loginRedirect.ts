/* ══════════════════════════════════════════════════════════════
   "AFTER THE SIGN-IN, TAKE ME BACK"

   The staff portal is behind the sign-in. Opening a staff address without a session sends the
   person to /login?next=<where they wanted to go>; after the sign-in they land there, or on
   the overview (/prehled) when nothing was asked for.

   `next` comes from the address bar, so it is data from outside: only a same-origin path is
   ever followed ('/patients?x=1' yes; 'https://evil.example', '//evil.example', '/\evil' no),
   and never the sign-in itself.
   ══════════════════════════════════════════════════════════════ */

import { LOGIN_PATH, STAFF_HOME_PATH } from '../../web/sitePaths';

/** '/login?next=%2Fpatients%3Fq%3D1' for a person who wanted '/patients?q=1'; plain '/login' for nothing worth returning to. */
export function loginUrl(wanted?: string): string {
  const next = safeNextPath(wanted);
  return next === null || next === STAFF_HOME_PATH ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/** The same-origin application path to return to, or null when `raw` is missing, foreign or the sign-in itself. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(raw)) return null;
  const pathname = raw.split('?')[0].split('#')[0];
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return null;
  return raw;
}

/** Where a person goes once signed in: the page they came for (`?next=`), else the staff overview. */
export function afterLoginPath(search: string): string {
  return safeNextPath(new URLSearchParams(search).get('next')) ?? STAFF_HOME_PATH;
}
