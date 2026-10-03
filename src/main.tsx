/*
 * Two bundles share one domain, and the public patient site is the DEFAULT page of it:
 *   a public page ('/', '/sluzby', '/cenik', … see src/web/sitePaths.ts)
 *                  the public site — prerendered at build time, hydrated here (src/web/entry-client);
 *   everything else  the application — the staff portal behind the sign-in (/prehled, /patients, …)
 *                  and the patient's /objednat, /portal, /klub … (src/web/appEntry).
 *
 * Each is imported on demand, so a visitor of the public site never downloads the staff
 * application and the other way round. Shared base CSS is imported here, once.
 *
 * The site used to live under /web: an address from then is sent to its new place. vercel.json
 * does that with a 308 before this file ever runs; this is the same rule for a host (the dev
 * server, a preview) that does not.
 */
import './styles/reset.css';
import { isPublicSitePath, legacyWebRedirect } from './web/sitePaths';

const container = document.getElementById('root')!;
const { pathname, search, hash } = window.location;
const moved = legacyWebRedirect(`${pathname}${search}${hash}`);

if (moved !== null) {
  window.location.replace(moved);
} else if (isPublicSitePath(pathname)) {
  void import('./web/entry-client').then((entry) => entry.mountWeb(container));
} else {
  void import('./web/appEntry').then((entry) => entry.mountApp(container));
}
