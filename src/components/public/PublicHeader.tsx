/* ══════════════════════════════════════════════════════════════
   PUBLIC HEADER

   The website's black bar: brand on the left, the landing's sections in the
   middle, "Můj portál" and the orange "Objednat se" on the right. On a phone
   the sections fold into a menu; the two buttons stay.

   The section links are anchors on /objednat. From any other public page they
   navigate there first, so "Ceník" works from the portal as well as from the
   landing.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Button, Container, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { MenuOutlined, PersonOutlined } from '@mui/icons-material';
import { BRAND } from './brand';
import { SITE } from '../../pages/public/content';

export interface HeaderSection {
  label: string;
  /** The section id on /objednat, without the '#'. */
  anchor: string;
}

export const LANDING_SECTIONS: HeaderSection[] = [
  { label: 'Služby', anchor: 'sluzby' },
  { label: 'Ceník', anchor: 'cenik' },
  { label: 'Dokumenty', anchor: 'dokumenty' },
  { label: 'Kontakt', anchor: 'kontakt' },
];

export const LANDING_PATH = '/objednat';
export const PORTAL_SIGN_IN_PATH = '/portal/prihlaseni';

/**
 * Smooth-scrolls to a section when it is on this page; otherwise the link's
 * own navigation (to /objednat#id) takes over. Guarded for environments
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

export function Brand({ onInk = true }: { onInk?: boolean }) {
  return (
    <Box
      component={RouterLink}
      to={LANDING_PATH}
      aria-label={`${SITE.brand} ${SITE.brandSuffix} — úvod`}
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.9,
        textDecoration: 'none',
        color: onInk ? '#FFFFFF' : BRAND.text,
      }}
    >
      <Typography component="span" sx={{ fontWeight: 800, fontSize: { xs: 17, md: 19 }, letterSpacing: '-0.01em' }}>
        {SITE.brand}
      </Typography>
      <Typography
        component="span"
        sx={{ fontWeight: 600, fontSize: { xs: 12, md: 13 }, letterSpacing: 2.2, color: BRAND.accent, textTransform: 'uppercase' }}
      >
        {SITE.brandSuffix}
      </Typography>
    </Box>
  );
}

export interface PublicHeaderProps {
  /** Extra action rendered before the two standard buttons (e.g. "Odhlásit"). */
  extra?: ReactNode;
  /** Hide "Můj portál" — on the sign-in page itself, and inside the portal. */
  hidePortalLink?: boolean;
}

export function PublicHeader({ extra, hidePortalLink = false }: PublicHeaderProps) {
  const location = useLocation();
  const [menuAt, setMenuAt] = useState<HTMLElement | null>(null);
  const onLanding = location.pathname === LANDING_PATH;

  const sectionClick = (anchor: string) => (event: React.MouseEvent) => {
    setMenuAt(null);
    if (onLanding && scrollToSection(anchor)) {
      event.preventDefault();
      window.history.replaceState(null, '', `#${anchor}`);
    }
  };

  const navLink = {
    color: BRAND.onInk,
    fontWeight: 600,
    fontSize: 14,
    px: 1.25,
    minHeight: 36,
    borderRadius: 999,
    '&:hover': { color: '#FFFFFF', bgcolor: BRAND.onInkWash },
  } as const;

  return (
    <Box
      component="header"
      sx={{
        bgcolor: BRAND.ink,
        color: '#FFFFFF',
        borderBottom: `1px solid ${BRAND.onInkLine}`,
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: { xs: 60, md: 68 } }}>
        <Brand />

        <Box component="nav" aria-label="Sekce" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.25, ml: 2 }}>
          {LANDING_SECTIONS.map((section) => (
            <Button
              key={section.anchor}
              component={RouterLink}
              to={`${LANDING_PATH}#${section.anchor}`}
              onClick={sectionClick(section.anchor)}
              sx={navLink}
            >
              {section.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        {extra}

        {!hidePortalLink && (
          <Button
            component={RouterLink}
            to={PORTAL_SIGN_IN_PATH}
            startIcon={<PersonOutlined sx={{ fontSize: 18 }} />}
            sx={{
              ...navLink,
              display: { xs: 'none', sm: 'inline-flex' },
              border: `1px solid ${BRAND.onInkLine}`,
              px: 1.75,
              minHeight: 38,
            }}
          >
            Můj portál
          </Button>
        )}

        <Button
          component={RouterLink}
          to={`${LANDING_PATH}#sluzby`}
          onClick={sectionClick('sluzby')}
          variant="contained"
          sx={{ minHeight: 38, px: { xs: 1.75, md: 2.25 }, fontSize: 14, color: BRAND.ink, whiteSpace: 'nowrap' }}
        >
          Objednat se
        </Button>

        <IconButton
          aria-label="Menu"
          onClick={(event) => setMenuAt(event.currentTarget)}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#FFFFFF', ml: -0.5 }}
        >
          <MenuOutlined />
        </IconButton>

        <Menu
          open={menuAt !== null}
          anchorEl={menuAt}
          onClose={() => setMenuAt(null)}
          slotProps={{ paper: { sx: { minWidth: 220, borderRadius: 3, mt: 1 } } }}
        >
          {LANDING_SECTIONS.map((section) => (
            <MenuItem
              key={section.anchor}
              component={RouterLink}
              to={`${LANDING_PATH}#${section.anchor}`}
              onClick={sectionClick(section.anchor)}
              sx={{ fontWeight: 600 }}
            >
              {section.label}
            </MenuItem>
          ))}
          {!hidePortalLink && (
            <MenuItem
              component={RouterLink}
              to={PORTAL_SIGN_IN_PATH}
              onClick={() => setMenuAt(null)}
              sx={{ fontWeight: 600, borderTop: `1px solid ${BRAND.line}`, mt: 0.5, pt: 1.25 }}
            >
              Můj portál
            </MenuItem>
          )}
        </Menu>
      </Container>
    </Box>
  );
}
