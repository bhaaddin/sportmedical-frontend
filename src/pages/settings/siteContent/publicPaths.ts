/* ══════════════════════════════════════════════════════════════
   "ZOBRAZIT NA WEBU" — WHERE EACH PAGE OF THE ADMIN'S LIST LIVES

   The public site is the root of the domain: the landing page is '/', the others '/sluzby',
   '/cenik', … Derived from the one list of public addresses (src/web/sitePaths.ts, which
   imports no page component), so the admin never keeps a second copy and never drifts when a
   page is added. 'spolecne' (texts shared by all pages: header, footer) is shown on the
   landing page.
   ══════════════════════════════════════════════════════════════ */

import { SITE_HOME_PATH, SITE_PAGES } from '../../../web/sitePaths';

/** Registry page id → the public address it is shown on. */
export const PUBLIC_PATHS: Record<string, string> = {
  spolecne: SITE_HOME_PATH,
  ...Object.fromEntries(SITE_PAGES.map((page) => [page.id, page.path])),
};

/** Where the partners and the FAQ (which are not registry pages) are shown. */
export const PARTNERS_PATH = SITE_HOME_PATH;
export const FAQ_PATH = SITE_HOME_PATH;
