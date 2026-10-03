/* ══════════════════════════════════════════════════════════════
   LINKS BETWEEN THE TWO APPLICATIONS

   The public site (/, /sluzby, /cenik, … see sitePaths.ts) and the application (/login,
   /objednat, /portal, /klub, the staff screens, …) are two separate bundles served from one
   domain. A link inside one of them is a client-side `Link`; a link into the other must be a
   real page load, or the router of the bundle you are in would answer "not found".
   `SiteLink` decides: `WebRouterContext` says which bundle this is.

     inside the public site → a public path client-side,  anything else → plain <a href>
     inside the application → a public path plain <a href>, anything else → client-side

   An address from before the site moved to the root ('/web/cenik') is accepted and
   rewritten to its new place ('/cenik'), so an old link in a text slot never breaks.
   ══════════════════════════════════════════════════════════════ */

import { createContext, forwardRef, useContext } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';
import { isPublicSitePath, legacyWebRedirect } from './sitePaths';

/** True inside the prerendered public bundle (see WebApp). */
export const WebRouterContext = createContext<boolean>(false);

/** The address as it is today: '/web/cenik#x' → '/cenik#x'; anything else unchanged. */
export const currentSiteAddress = (to: string): string => legacyWebRedirect(to) ?? to;

/** '/', '/cenik', '/cenik#x', and the old '/web/…' spelling — a page of the public site. */
export const isWebTarget = (to: string): boolean => isPublicSitePath(currentSiteAddress(to));

const isExternal = (to: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(to) || to.startsWith('#');

export interface SiteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}

export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(function SiteLink({ to: rawTo, children, ...rest }, ref) {
  const inWeb = useContext(WebRouterContext);
  const hasRouter = useInRouterContext();
  const to = currentSiteAddress(rawTo);

  if (hasRouter && !isExternal(to) && isWebTarget(to) === inWeb) {
    return (
      <RouterLink ref={ref} to={to} {...rest}>
        {children}
      </RouterLink>
    );
  }
  return (
    <a ref={ref} href={to} {...rest}>
      {children}
    </a>
  );
});
