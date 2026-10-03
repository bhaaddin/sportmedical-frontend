/* ══════════════════════════════════════════════════════════════
   WHICH ADDRESSES BELONG TO THE PUBLIC SITE

   The public patient site is the default page of the domain: `/` is its landing page and
   its other pages sit directly under the root (`/sluzby`, `/cenik`, …). Everything that is
   not listed here belongs to the application (the staff portal behind the sign-in, and the
   patient-facing app pages `/objednat`, `/portal`, …).

   This file is deliberately tiny and imports nothing: `main.tsx` reads it to pick the bundle,
   `SiteLink` reads it to tell a client-side link from a real page load, and the Vite preview
   plugin reads it — none of them may pull the page components in. The page components, titles
   and descriptions live in `routes.ts`, keyed by the ids below.

   To add a public page: one line in SITE_PAGES here, and the matching entry in `PAGE_DETAILS`
   of routes.ts (TypeScript refuses to compile until it exists), plus a rewrite line in
   vercel.json (a test compares vercel.json with this list). A path that is not listed
   falls through to the application, which answers it (the sign-in, or its own not-found).
   ══════════════════════════════════════════════════════════════ */

export const SITE_PAGES = [
  { id: 'landing', path: '/' },
  { id: 'sluzby', path: '/sluzby' },
  { id: 'prohlidky', path: '/prohlidky' },
  { id: 'diagnostika', path: '/diagnostika' },
  { id: 'inbody', path: '/inbody' },
  { id: 'cenik', path: '/cenik' },
  { id: 'dokumenty', path: '/dokumenty' },
  { id: 'kontakt', path: '/kontakt' },
  { id: 'onas', path: '/o-nas' },
  { id: 'kluby', path: '/kluby' },
  { id: 'otazky', path: '/faq' },
  { id: 'podminky', path: '/obchodni-podminky' },
  { id: 'soukromi', path: '/ochrana-osobnich-udaju' },
  { id: 'storno', path: '/storno-a-reklamace' },
  { id: 'vybaveni', path: '/vybaveni' },
  { id: 'partneri', path: '/partneri' },
  { id: 'diagzakladni', path: '/diagnostika/zakladni' },
  { id: 'diagkomplexni', path: '/diagnostika/komplexni' },
  { id: 'diagvo2max', path: '/diagnostika/vo2max' },
  { id: 'diagkompenzacni', path: '/diagnostika/kompenzacni-plan' },
] as const;

export type SitePageId = (typeof SITE_PAGES)[number]['id'];
export type SitePath = (typeof SITE_PAGES)[number]['path'];

/** The landing page: where the domain opens. */
export const SITE_HOME_PATH = '/';

/** Where the staff portal opens once somebody is signed in. */
export const STAFF_HOME_PATH = '/prehled';

/** The staff sign-in. */
export const LOGIN_PATH = '/login';

/** '/sluzby/?x=1#y' → '/sluzby'; '' → '/'. */
export function normalizeSitePath(url: string): string {
  const path = url.split('#')[0].split('?')[0];
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed === '' ? '/' : trimmed;
}

/** Is this address (any url shape) a page of the public site? */
export function isPublicSitePath(url: string): boolean {
  const path = normalizeSitePath(url);
  return SITE_PAGES.some((page) => page.path === path);
}

/**
 * The public site used to live under /web. Where an old address must go, or null when it is not
 * an old one. Query string and hash are kept. This is the one rule behind three places: the 308
 * redirects in vercel.json (a test holds them to it), `vite preview`, and the browser fallback
 * in main.tsx for a host that does not redirect.
 *
 *   '/web' → '/'      '/web/sluzby' → '/sluzby'      '/web/cenik?x=1#y' → '/cenik?x=1#y'
 */
export function legacyWebRedirect(url: string): string | null {
  const match = /^\/web(?:\/+([^?#]*))?([?#].*)?$/.exec(url);
  if (match === null) return null;
  const rest = (match[1] ?? '').replace(/\/+$/, '');
  return `/${rest}${match[2] ?? ''}`;
}
