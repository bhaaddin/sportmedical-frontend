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
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link as RouterLink, useInRouterContext, useNavigate } from 'react-router-dom';
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

/**
 * A client-side link between two pages of the public site. With full motion (<html data-motion="full">, read at click time:
 * the sign-in page carries this file and must not carry the motion kit) and a browser that has View Transitions, the click
 * runs the navigation inside document.startViewTransition, so the old page recedes and the new one is drawn over it like a
 * curtain (styled in src/motion/motion.css; the header keeps its place). React Router's own `viewTransition` option exists
 * only for data routers; this site uses a declarative BrowserRouter, so the transition is started here. Modified clicks
 * (new tab), hash links and anything else fall through to the normal link.
 */
const PageLink = forwardRef<HTMLAnchorElement, SiteLinkProps & { inWeb: boolean }>(function PageLink({ to, inWeb, children, onClick, ...rest }, ref) {
  const navigate = useNavigate();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !inWeb || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || rest.target) return;
    const start = (document as Document & { startViewTransition?: (update: () => void) => unknown }).startViewTransition;
    if (typeof start !== 'function' || document.documentElement.dataset.motion !== 'full') return;
    if (to.split('#')[0] === window.location.pathname) return;
    event.preventDefault();
    start.call(document, () => {
      flushSync(() => navigate(to));
    });
  };
  return (
    <RouterLink ref={ref} to={to} {...rest} onClick={handle}>
      {children}
    </RouterLink>
  );
});

export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(function SiteLink({ to: rawTo, children, ...rest }, ref) {
  const inWeb = useContext(WebRouterContext);
  const hasRouter = useInRouterContext();
  const to = currentSiteAddress(rawTo);

  if (hasRouter && !isExternal(to) && isWebTarget(to) === inWeb) {
    return (
      <PageLink ref={ref} to={to} inWeb={inWeb} {...rest}>
        {children}
      </PageLink>
    );
  }
  return (
    <a ref={ref} href={to} {...rest}>
      {children}
    </a>
  );
});
