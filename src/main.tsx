/*
 * Two bundles share one domain:
 *   /web, /web/…  the public site — prerendered at build time, hydrated here (src/web/entry-client);
 *   everything else  the application — staff screens and the patient's /objednat, /portal, /klub … (src/web/appEntry).
 *
 * Each is imported on demand, so a visitor of the public site never downloads the staff
 * application and the other way round. Shared base CSS is imported here, once.
 */
import './styles/reset.css';

const container = document.getElementById('root')!;
const onPublicSite = /^\/web(?:\/|$)/.test(window.location.pathname);

if (onPublicSite) {
  void import('./web/entry-client').then((entry) => entry.mountWeb(container));
} else {
  void import('./web/appEntry').then((entry) => entry.mountApp(container));
}
