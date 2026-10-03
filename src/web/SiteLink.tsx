/* ══════════════════════════════════════════════════════════════
   LINKS BETWEEN THE TWO APPLICATIONS

   The public site (/web/*) and the application (/objednat, /portal, /klub, …)
   are two separate bundles served from one domain. A link inside one of them
   is a client-side `Link`; a link into the other must be a real page load, or
   the router of the bundle you are in would answer "not found". `SiteLink`
   decides: `WebRouterContext` says which bundle this is.

     inside /web   → '/web…'  client-side,  anything else → plain <a href>
     inside the app → '/web…' plain <a href>, anything else → client-side
   ══════════════════════════════════════════════════════════════ */

import { createContext, forwardRef, useContext } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';

/** True inside the prerendered public bundle (see WebApp). */
export const WebRouterContext = createContext<boolean>(false);

/** '/web', '/web/…', '/web#…' — a page of the public site. */
export const isWebTarget = (to: string): boolean => /^\/web(?:[/?#]|$)/.test(to);

const isExternal = (to: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(to) || to.startsWith('#');

export interface SiteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}

export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(function SiteLink({ to, children, ...rest }, ref) {
  const inWeb = useContext(WebRouterContext);
  const hasRouter = useInRouterContext();

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
