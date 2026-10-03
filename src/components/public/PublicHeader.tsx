/* ══════════════════════════════════════════════════════════════
   PUBLIC HEADER  (artboard V-Web2)

   Sticky near-black bar: the brand, the sections (with the "Služby ▾" dropdown),
   "Můj portál" and the orange "Objednat termín". Below 1100 px the sections fold
   into a menu panel (every target ≥ 44 px); the booking button stays in the bar
   on an iPad and moves to the pinned bottom bar on a phone (WebLayout).

   The same header sits on the prerendered public pages and on the application's
   public pages (PublicLayout); `SiteLink` takes care of which links are
   client-side and which are real page loads.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { SiteLink } from '../../web/SiteLink';
import { ArrowIcon, ChevronDownIcon, CtaButton, PersonIcon } from '../../web/ui';
import { FONT_HEAD, GUTTER, MAX_WIDTH, MQ, W } from '../../web/tokens';
import { SITE } from '../../pages/public/content';
import { SITE_HOME_PATH, STAFF_HOME_PATH } from '../../web/sitePaths';
import { useStaffSession } from '../../web/useStaffSession';

export interface HeaderSection {
  label: string;
  /** The section id on /objednat, without the '#'. Kept for old callers. */
  anchor: string;
}

/** @deprecated The sections are pages of the public site now (see NAV_LINKS); kept so old imports compile. */
export const LANDING_SECTIONS: HeaderSection[] = [
  { label: 'Služby', anchor: 'sluzby' },
  { label: 'Ceník', anchor: 'cenik' },
  { label: 'Dokumenty', anchor: 'dokumenty' },
  { label: 'Kontakt', anchor: 'kontakt' },
];

/** The online booking (an application page, not part of the prerendered site). */
export const LANDING_PATH = '/objednat';
export const BOOKING_PATH = LANDING_PATH;
export const PORTAL_SIGN_IN_PATH = '/portal/prihlaseni';
export const WEB_HOME_PATH = SITE_HOME_PATH;

export interface NavLinkDef { label: string; to: string }
export interface ServiceMenuItem { label: string; hint: string; to: string }

export const SERVICE_MENU: ServiceMenuItem[] = [
  { label: 'Sportovní lékařské prohlídky', hint: 'Základní · Komplexní · Spiroergometrie', to: '/prohlidky' },
  { label: 'Sportovní diagnostika', hint: 'VO₂max · ForceDecks · HumanTrak', to: '/diagnostika' },
  { label: 'InBody 770', hint: 'Složení těla · výživový plán', to: '/inbody' },
];

export const NAV_BEFORE_SERVICES: NavLinkDef[] = [{ label: 'O nás', to: '/o-nas' }];
export const SERVICES_LINK: NavLinkDef = { label: 'Služby', to: '/sluzby' };
export const NAV_AFTER_SERVICES: NavLinkDef[] = [
  { label: 'Ceník', to: '/cenik' },
  { label: 'Pro kluby', to: '/kluby' },
  { label: 'Dokumenty', to: '/dokumenty' },
  { label: 'Kontakt', to: '/kontakt' },
];

/**
 * Smooth-scrolls to a section when it is on this page. Guarded for environments
 * without scrollIntoView (jsdom).
 */
export function scrollToSection(anchor: string): boolean {
  if (typeof document === 'undefined') return false;
  const target = document.getElementById(anchor);
  if (target === null) return false;
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return true;
}

export function Brand({ onInk = true, to = WEB_HOME_PATH }: { onInk?: boolean; to?: string }) {
  return (
    <Box
      component={SiteLink}
      to={to}
      aria-label={`${SITE.brand} ${SITE.brandSuffix} — úvod`}
      sx={{
        fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', textDecoration: 'none',
        whiteSpace: 'nowrap', color: onInk ? W.white : W.text, display: 'inline-block', lineHeight: 1.15,
        minHeight: 44, py: '4px', '&:hover': { color: onInk ? W.white : W.text },
      }}
    >
      {SITE.brand}
      <Box component="span" sx={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.3em', color: W.orange, mt: '1px' }}>
        {SITE.brandSuffix.toUpperCase()}
      </Box>
    </Box>
  );
}

export interface PublicHeaderProps {
  /** Extra action rendered before the standard buttons (e.g. "Odhlásit"). */
  extra?: ReactNode;
  /** Hide "Můj portál" — on the sign-in page itself, and inside the portal. */
  hidePortalLink?: boolean;
}

const navItem = {
  color: W.onInkNav, textDecoration: 'none', fontSize: 15, px: '12px', py: '10px', minHeight: 44, display: 'flex', alignItems: 'center',
  transition: 'color .15s ease', [MQ.reduceMotion]: { transition: 'none' },
  '&:hover': { color: W.white }, '&[aria-current="page"]': { color: W.white, fontWeight: 600 },
} as const;

export function PublicHeader({ extra, hidePortalLink = false }: PublicHeaderProps) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  /* False on the server and on the first client render (the page is prerendered), true after mount for a signed-in staff member. */
  const staffSignedIn = useStaffSession();

  // A navigation closes the panel; Escape too.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const current = (to: string) => (pathname.replace(/\/$/, '') === to ? 'page' : undefined);

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky', top: 0, zIndex: 50, bgcolor: W.ink, color: W.white, borderBottom: `1px solid ${W.inkLine}`,
      
      }}
    >
      <Box sx={{ maxWidth: MAX_WIDTH, mx: 'auto', px: GUTTER, height: { xs: 60, md: 72 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: '16px', lg: '38px' }, minWidth: 0 }}>
          <Brand />
          <Box
            component="nav"
            aria-label="Hlavní"
            sx={{ display: 'none', [MQ.nav]: { display: 'flex' }, alignItems: 'center', gap: '4px' }}
          >
            {NAV_BEFORE_SERVICES.map((item) => (
              <Box key={item.to} component={SiteLink} to={item.to} aria-current={current(item.to)} sx={navItem}>{item.label}</Box>
            ))}
            <Box
              component="span"
              sx={{
                position: 'relative', display: 'inline-flex',
                '&:hover .menu, &:focus-within .menu': { opacity: 1, visibility: 'visible', transform: 'translateY(0)' },
              }}
            >
              <Box
                component={SiteLink}
                to={SERVICES_LINK.to}
                aria-haspopup="true"
                aria-current={current(SERVICES_LINK.to)}
                sx={{ ...navItem, color: W.white, fontWeight: 600, gap: '6px' }}
              >
                {SERVICES_LINK.label}
                <ChevronDownIcon />
              </Box>
              <Box
                className="menu"
                sx={{
                  position: 'absolute', top: 54, left: 0, width: 320, bgcolor: W.white, border: `1px solid ${W.lineStrong}`, borderRadius: '14px',
                  boxShadow: '0 18px 46px rgba(10,14,18,0.28)', p: '8px', display: 'flex', flexDirection: 'column', gap: '1px',
                  opacity: 0, visibility: 'hidden', transform: 'translateY(-6px)',
                  transition: 'opacity .16s ease, transform .16s ease, visibility .16s', [MQ.reduceMotion]: { transition: 'none' },
                  // A bridge over the gap between the link and the panel, so the pointer does not lose the hover on the way.
                  '&::before': { content: '""', position: 'absolute', left: 0, right: 0, top: -12, height: 12 },
                }}
              >
                {SERVICE_MENU.map((item) => (
                  <Box
                    key={item.to}
                    component={SiteLink}
                    to={item.to}
                    sx={{
                      display: 'flex', flexDirection: 'column', gap: '1px', px: '13px', py: '11px', borderRadius: '9px', textDecoration: 'none',
                      color: W.text, transition: 'background-color .14s ease', '&:hover': { bgcolor: W.warmHover, color: W.text },
                      [MQ.reduceMotion]: { transition: 'none' },
                    }}
                  >
                    <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>{item.label}</Box>
                    <Box component="span" sx={{ fontSize: 13, color: W.muted }}>{item.hint}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
            {NAV_AFTER_SERVICES.map((item) => (
              <Box key={item.to} component={SiteLink} to={item.to} aria-current={current(item.to)} sx={navItem}>{item.label}</Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {extra}
          {staffSignedIn && (
            <Box
              component={SiteLink}
              to={STAFF_HOME_PATH}
              data-testid="to-app-link"
              sx={{
                ...navItem, display: 'none', [MQ.nav]: { display: 'flex' }, p: 0, fontSize: 13, color: W.onInkMuted,
                textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: W.inkBorder,
              }}
            >
              Do aplikace
            </Box>
          )}
          {!hidePortalLink && (
            <Box
              component={SiteLink}
              to={PORTAL_SIGN_IN_PATH}
              sx={{ ...navItem, display: 'none', [MQ.nav]: { display: 'flex' }, gap: '8px', p: 0 }}
            >
              <PersonIcon />
              Můj portál
            </Box>
          )}
          {/* The booking button: in the bar from an iPad up; on a phone it is pinned at the bottom of the screen. */}
          <Box sx={{ display: 'none', [MQ.tablet]: { display: 'block' } }}>
            <CtaButton to={BOOKING_PATH} height={46} px={22} fontSize={15}>Objednat termín</CtaButton>
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            aria-expanded={open}
            aria-controls="web-mobile-menu"
            onClick={() => setOpen((value) => !value)}
            sx={{
              display: 'inline-flex', [MQ.nav]: { display: 'none' }, alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
              border: `1px solid ${W.inkBorder}`, borderRadius: '12px', bgcolor: 'transparent', color: W.white, cursor: 'pointer', p: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </Box>
        </Box>
      </Box>

      {open && (
        <Box
          id="web-mobile-menu"
          component="nav"
          aria-label="Hlavní menu"
          sx={{
            [MQ.nav]: { display: 'none' }, position: 'absolute', top: '100%', left: 0, right: 0, bgcolor: W.ink, borderTop: `1px solid ${W.inkLine}`,
            borderBottom: `1px solid ${W.inkLine}`, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', px: GUTTER, pt: '8px', pb: '24px',
            boxShadow: '0 24px 40px rgba(0,0,0,0.35)',
          }}
        >
          <Box sx={{ maxWidth: MAX_WIDTH, mx: 'auto', display: 'flex', flexDirection: 'column' }}>
            {[...NAV_BEFORE_SERVICES].map((item) => (
              <MobileLink key={item.to} to={item.to} current={current(item.to)}>{item.label}</MobileLink>
            ))}
            <MobileLink to={SERVICES_LINK.to} current={current(SERVICES_LINK.to)} strong>{SERVICES_LINK.label}</MobileLink>
            {SERVICE_MENU.map((item) => (
              <MobileLink key={item.to} to={item.to} current={current(item.to)} sub>
                {item.label}
                <Box component="span" sx={{ display: 'block', fontSize: 13, color: W.onInkMuted, fontWeight: 400 }}>{item.hint}</Box>
              </MobileLink>
            ))}
            {NAV_AFTER_SERVICES.map((item) => (
              <MobileLink key={item.to} to={item.to} current={current(item.to)}>{item.label}</MobileLink>
            ))}
            {staffSignedIn && <MobileLink to={STAFF_HOME_PATH}>Do aplikace</MobileLink>}
            {!hidePortalLink && (
              <MobileLink to={PORTAL_SIGN_IN_PATH}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <PersonIcon size={18} />
                  Můj portál
                </Box>
              </MobileLink>
            )}
            <Box sx={{ pt: '16px' }}>
              <CtaButton to={BOOKING_PATH} height={54} arrow sx={{ width: '100%' }}>Objednat termín</CtaButton>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function MobileLink({
  to, current, strong = false, sub = false, children,
}: { to: string; current?: 'page'; strong?: boolean; sub?: boolean; children: ReactNode }) {
  return (
    <Box
      component={SiteLink}
      to={to}
      aria-current={current}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, py: '10px', pl: sub ? '16px' : 0,
        color: current === 'page' ? W.white : strong ? W.white : W.onInkNav, fontSize: sub ? 16 : 17, fontWeight: strong || current === 'page' ? 600 : sub ? 600 : 500,
        textDecoration: 'none', borderBottom: sub ? 'none' : `1px solid ${W.inkLine}`, '&:hover': { color: W.white },
      }}
    >
      <span>{children}</span>
      {!sub && <ArrowIcon size={15} stroke={2.2} />}
    </Box>
  );
}
