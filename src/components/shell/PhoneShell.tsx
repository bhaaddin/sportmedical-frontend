/*
 * The phone's navigation (≤767): no sidebar at all.
 *
 *   top bar     the "where am I" trail, search, the bell and a "+" for a new
 *               appointment (the main action, always one tap away);
 *   bottom bar  Kalendář · Pacienti · Kluby · Fakturace and "Více", fixed,
 *               safe-area aware, every target at least 56px tall;
 *   "Více"      a bottom sheet: Nová objednávka (primary), then - inside a
 *               section - "Všechny sekce", the section's title and ONLY its
 *               own screens; elsewhere Přehled, Nastavení and the screens of
 *               the entries above; then the account, appearance and sign out.
 *
 * In settings the bars stay; "Více → Nastavení" opens the settings hub.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, ButtonBase, Drawer, IconButton } from '@mui/material';
import { Add, Close, Logout, MoreHoriz, Search } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter';
import { openUniversalSearch } from '../UniversalSearch';
import { signOut } from '../../auth/signOut';
import { NewOrderChooser } from '../booking/NewOrderChooser';
import { AppearanceControls } from './AccountMenu';
import { Trail, type Crumb } from './whereAmI';
import { childIsActive, isActivePath, sectionGroups, sectionOf, shortLabel } from './shellModel';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { BAR_HEIGHT, activeBg, focusRing } from './shellStyles';
import type { MenuEntry, ShellNav } from './shellTypes';

/** The four entries that live in the bottom bar, in order. */
const BAR_PATHS = ['/planovani', '/patients', '/clubs', '/billing'];

export const PHONE_TOP_BAR = `calc(${BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`;
export const PHONE_BOTTOM_BAR = `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

export function PhoneTopBar({ nav, crumbs }: { nav: ShellNav; crumbs: Crumb[] }) {
  const [chooser, setChooser] = useState(false);
  return (
    <>
    <Box
      component="header"
      data-shell="topbar"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: PHONE_TOP_BAR,
        boxSizing: 'border-box',
        pt: 'env(safe-area-inset-top, 0px)',
        pl: 2,
        pr: 0.5,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        zIndex: (t) => t.zIndex.appBar,
      }}
    >
      <Box
        aria-label="Kde jsem"
        sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 14, color: 'text.secondary', overflow: 'hidden' }}
      >
        {crumbs.length > 0 ? (
          <Trail crumbs={crumbs} nowrap />
        ) : (
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>SportMedical</Box>
        )}
      </Box>
      <IconButton aria-label="Hledat" onClick={openUniversalSearch} sx={{ width: 44, height: 44 }}>
        <Search />
      </IconButton>
      <NotificationCenter buttonSx={{ width: 44, height: 44 }} />
      <IconButton
        aria-label="Nová objednávka"
        onClick={() => setChooser(true)}
        sx={{
          width: 44,
          height: 44,
          ml: 0.25,
          mr: 0.5,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <Add />
      </IconButton>
    </Box>
    <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}

function BarItem({ to, label, fullLabel, icon, active }: { to: string; label: string; fullLabel: string; icon: React.ReactNode; active: boolean }) {
  return (
    <ButtonBase
      component={Link}
      to={to}
      aria-label={fullLabel}
      aria-current={active ? 'page' : undefined}
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: BAR_HEIGHT,
        flexDirection: 'column',
        gap: '3px',
        color: active ? 'primary.main' : 'text.secondary',
        '& svg': { fontSize: 24 },
        ...focusRing,
      }}
    >
      <Box sx={{ height: 28, width: 52, borderRadius: 14, display: 'grid', placeItems: 'center', bgcolor: active ? activeBg : 'transparent' }}>
        {icon}
      </Box>
      <Box component="span" sx={{ fontSize: 11, lineHeight: 1, fontWeight: active ? 700 : 500 }}>{label}</Box>
    </ButtonBase>
  );
}

/** A row of the "Více" sheet: 48px, a link that closes the sheet. */
function SheetLink({ to, state, children, active, indent = false, onClick }: { to: string; state?: unknown; children: React.ReactNode; active: boolean; indent?: boolean; onClick: () => void }) {
  return (
    <Box
      component={Link}
      to={to}
      state={state}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 48,
        pl: indent ? 4 : 1.5,
        pr: 1.5,
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: 15,
        fontWeight: active ? 600 : 500,
        color: active ? 'primary.main' : 'text.primary',
        bgcolor: active ? activeBg : 'transparent',
        '&:hover': { bgcolor: active ? activeBg : 'action.hover' },
        ...focusRing,
      }}
    >
      {children}
    </Box>
  );
}

function SheetHeading({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="h3"
      sx={{ m: 0, mt: 2, mb: 0.5, px: 1.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}
    >
      {children}
    </Box>
  );
}

export function PhoneBottomBar({ nav }: { nav: ShellNav }) {
  const [more, setMore] = useState(false);
  const [chooser, setChooser] = useState(false);
  const close = () => setMore(false);
  useEffect(() => { setMore(false); }, [nav.pathname]);

  const bar = BAR_PATHS
    .map((path) => nav.menu.find((e) => e.path === path))
    .filter((e): e is MenuEntry => e !== undefined);
  const barActive = (entry: MenuEntry) =>
    isActivePath(nav.pathname, entry.path) ||
    (entry.children?.some((c) => isActivePath(nav.pathname, c.path)) ?? false) ||
    (entry.path === '/planovani' && nav.pathname.startsWith('/kalendar/'));
  const anyBarActive = !nav.settingsMode && bar.some(barActive);

  const entry = (path: string) => nav.menu.find((e) => e.path === path);
  const section = sectionOf(nav);
  const overview = entry(STAFF_HOME_PATH);
  const settings = entry('/settings');
  /* The screens that belong under the bar's entries - there is no sidebar to show them. */
  const withScreens = bar.filter((e) => (e.children?.length ?? 0) > 0);

  const name = [nav.user.firstName, nav.user.lastName].filter(Boolean).join(' ') || 'Účet';
  const here = (path: string) => !nav.settingsMode && nav.pathname === path;

  return (
    <>
      <Box
        component="nav"
        aria-label="Hlavní navigace"
        data-shell="bottombar"
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: PHONE_BOTTOM_BAR,
          boxSizing: 'border-box',
          pb: 'env(safe-area-inset-bottom, 0px)',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          zIndex: (t) => t.zIndex.appBar,
        }}
      >
        {bar.map((e) => (
          <BarItem
            key={e.path}
            to={e.path}
            label={shortLabel(e.text)}
            fullLabel={e.text}
            icon={e.icon}
            active={!nav.settingsMode && barActive(e)}
          />
        ))}
        <ButtonBase
          onClick={() => setMore(true)}
          aria-label="Více"
          aria-haspopup="dialog"
          aria-expanded={more}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: BAR_HEIGHT,
            flexDirection: 'column',
            gap: '3px',
            color: !anyBarActive ? 'primary.main' : 'text.secondary',
            '& svg': { fontSize: 24 },
            ...focusRing,
          }}
        >
          <Box sx={{ height: 28, width: 52, borderRadius: 14, display: 'grid', placeItems: 'center', bgcolor: !anyBarActive ? activeBg : 'transparent' }}>
            <MoreHoriz />
          </Box>
          <Box component="span" sx={{ fontSize: 11, lineHeight: 1, fontWeight: !anyBarActive ? 700 : 500 }}>Více</Box>
        </ButtonBase>
      </Box>

      <Drawer
        anchor="bottom"
        open={more}
        onClose={close}
        transitionDuration={{ enter: 150, exit: 120 }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Více',
            sx: {
              borderRadius: '16px 16px 0 0',
              maxHeight: '88dvh',
              boxSizing: 'border-box',
              px: 2,
              pt: 1,
              pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <Box component="h2" sx={{ m: 0, px: 1.5, fontSize: 18, fontWeight: 700 }}>Více</Box>
          <IconButton aria-label="Zavřít" onClick={close} sx={{ width: 44, height: 44 }}>
            <Close />
          </IconButton>
        </Box>

        <Box
          component="button"
          type="button"
          onClick={() => { close(); setChooser(true); }}
          sx={{
            height: 48,
            width: '100%',
            mt: 0.5,
            mb: 1,
            border: 0,
            borderRadius: '10px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            ...focusRing,
          }}
        >
          Nová objednávka
        </Box>

        {nav.settingsMode && <SheetLink to={STAFF_HOME_PATH} active={false} onClick={close}>← Všechny sekce</SheetLink>}
        {section ? (
          <Box component="nav" aria-label={`Sekce ${section.text}`}>
            <SheetLink to={STAFF_HOME_PATH} active={false} onClick={close}>← Všechny sekce</SheetLink>
            <SheetHeading>{section.text}</SheetHeading>
            {sectionGroups(nav, section).map((group, gi) => (
              <Box key={gi}>
                {group.heading && <SheetHeading>{group.heading}</SheetHeading>}
                {group.items.map((c) => (
                  <SheetLink
                    key={c.path + c.text}
                    to={c.path}
                    state={c.state}
                    active={childIsActive(nav, c, group.items, group.exact)}
                    onClick={close}
                  >
                    {c.text}
                  </SheetLink>
                ))}
              </Box>
            ))}
          </Box>
        ) : (
          <>
        {overview && <SheetLink to={overview.path} active={here(overview.path)} onClick={close}>{overview.text}</SheetLink>}
        {settings && <SheetLink to={settings.path} active={nav.settingsMode} onClick={close}>{settings.text}</SheetLink>}

        {withScreens.map((e) => (
          <Box key={e.path}>
            <SheetHeading>{e.text}</SheetHeading>
            {(e.children ?? []).map((c) => (
              <SheetLink key={c.path} to={c.path} state={c.state} active={!c.shortcut && here(c.path)} onClick={close}>{c.text}</SheetLink>
            ))}
          </Box>
        ))}
          </>
        )}

        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, mb: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: 15, fontWeight: 600 }}>{name}</Box>
              {nav.user.role && <Box sx={{ fontSize: 13, color: 'text.secondary' }}>{nav.user.role}</Box>}
            </Box>
          </Box>
          <Box sx={{ px: 1.5 }}>
            <AppearanceControls />
          </Box>
          <ButtonBase
            onClick={() => { close(); void signOut(); }}
            sx={{ mt: 1, width: '100%', justifyContent: 'flex-start', gap: 1.25, minHeight: 48, px: 1.5, borderRadius: '8px', fontSize: 15, fontWeight: 500, ...focusRing }}
          >
            <Logout fontSize="small" /> Odhlásit se
          </ButtonBase>
        </Box>
      </Drawer>
      <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}
