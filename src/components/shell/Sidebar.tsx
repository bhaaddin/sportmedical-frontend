/*
 * The full sidebar (desktop ≥1280, and the tablet's overlay when it is opened).
 *
 * Taken from the board's artboards (Main.dc.html, P-Pacient.dc.html): 258px,
 * white, a hairline on its right, padding 22/20; the brand as text, a 44px
 * button "Nová objednávka", the six entries as 44px rows (the open one on the
 * soft accent with accent text at 600), and what hangs under the OPEN entry
 * indented beneath it - nothing is shown for the others. Between the
 * navigation and the account row sits the slot a page can portal into (the
 * calendar's mini calendar and service legend, see SidebarSlot.tsx).
 *
 * On a settings route the whole content is replaced - never two sidebars:
 * "← Zpět do aplikace", the brand, the settings search and its groups.
 */
import { Link } from 'react-router-dom';
import { Avatar, Box, Button, ButtonBase, IconButton } from '@mui/material';
import { ArrowBack, Search } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter';
import { openUniversalSearch } from '../UniversalSearch';
import { SettingsNav } from '../../pages/settings/SettingsFrame';
import { SidebarSlot } from './SidebarSlot';
import { childIsActive, entryState, mainEntries } from './shellModel';
import { SIDEBAR_WIDTH, activeBg, focusRing } from './shellStyles';
import type { MenuEntry, ShellNav } from './shellTypes';

/** The row every entry shares: 44px, 14px, the open one soft with accent text. */
const rowSx = (active: boolean, inSection = false, child = false) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: child ? 40 : 44,
  px: '13px',
  py: child ? '8px' : '11px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: 14,
  lineHeight: 1.3,
  fontWeight: active || inSection ? 600 : 400,
  color: active || inSection ? 'primary.main' : 'text.secondary',
  bgcolor: active ? activeBg : 'transparent',
  '&:hover': {
    bgcolor: active ? activeBg : 'action.hover',
    color: active || inSection ? 'primary.main' : 'text.primary',
  },
  ...focusRing,
});

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Box
      component={Link}
      to="/"
      onClick={onNavigate}
      aria-label="SportMedical — přehled"
      sx={{
        alignSelf: 'flex-start',
        color: 'text.primary',
        textDecoration: 'none',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: '24px',
        ...focusRing,
      }}
    >
      SportMedical
    </Box>
  );
}

export function NewAppointmentButton({ nav, onNavigate }: { nav: ShellNav; onNavigate?: () => void }) {
  return (
    <Button
      variant="contained"
      fullWidth
      onClick={() => { onNavigate?.(); nav.onNewAppointment(); }}
      sx={{ height: 44, minHeight: 44, flexShrink: 0, fontSize: 14 }}
    >
      Nová objednávka
    </Button>
  );
}

/** The six entries, and under the open one what belongs to it. */
export function MainNav({ nav, onNavigate }: { nav: ShellNav; onNavigate?: () => void }) {
  return (
    <Box component="nav" aria-label="Hlavní navigace" sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {mainEntries(nav.menu).map((entry) => {
        const state = entryState(nav, entry);
        return (
          <Box key={entry.path}>
            <Box
              component={Link}
              to={entry.path}
              onClick={onNavigate}
              aria-current={state.self ? 'page' : undefined}
              sx={rowSx(state.self, state.childActive)}
            >
              {entry.text}
            </Box>
            {state.inSection && state.items.length > 0 && (
              <Box
                sx={{
                  ml: '20px',
                  pl: '6px',
                  mt: '2px',
                  mb: '6px',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                }}
              >
                {state.items.map((child: MenuEntry) => {
                  const active = childIsActive(nav, child, state.exact);
                  return (
                    <Box
                      key={child.path}
                      component={Link}
                      to={child.path}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      sx={rowSx(active, false, true)}
                    >
                      {child.text}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** The signed-in person, search and the bell: reachable on every width. */
export function AccountRow({ nav }: { nav: ShellNav }) {
  const name = [nav.user.firstName, nav.user.lastName].filter(Boolean).join(' ') || 'Účet';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        pt: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <ButtonBase
        onClick={(e) => nav.onOpenAccountMenu(e.currentTarget)}
        aria-label="Účet a vzhled"
        aria-haspopup="menu"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.25,
          borderRadius: '8px',
          textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
          ...focusRing,
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#FFF', fontSize: 13, fontWeight: 600 }}>
          {nav.user.firstName?.[0]}{nav.user.lastName?.[0]}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </Box>
          <Box sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nav.user.role || ''}
          </Box>
        </Box>
      </ButtonBase>
      <IconButton title="Hledat (Ctrl+K)" aria-label="Hledat" onClick={openUniversalSearch} sx={{ width: 40, height: 40 }}>
        <Search fontSize="small" />
      </IconButton>
      <NotificationCenter placement="side" buttonSx={{ width: 40, height: 40 }} />
    </Box>
  );
}

/**
 * The sidebar's content for one width. `onNavigate` runs on every link, so an
 * overlay can close itself even when the click does not change the address.
 */
export function SidebarBody({
  nav,
  onNavigate,
  withSlot,
}: {
  nav: ShellNav;
  onNavigate?: () => void;
  /** Draw the page's slot (desktop only; tablet and phone pages show that content themselves). */
  withSlot: boolean;
}) {
  if (nav.settingsMode) {
    return (
      <>
        <ButtonBase
          component={Link}
          to={nav.backToAppPath}
          onClick={onNavigate}
          sx={{
            alignSelf: 'stretch',
            justifyContent: 'flex-start',
            gap: 1,
            minHeight: 44,
            px: '13px',
            mb: 2,
            borderRadius: '8px',
            color: 'text.secondary',
            fontSize: 14,
            fontWeight: 600,
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            ...focusRing,
          }}
        >
          <ArrowBack sx={{ fontSize: 20 }} />
          Zpět do aplikace
        </ButtonBase>
        <Brand onNavigate={onNavigate} />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', mt: 2.5, mx: '-6px', px: '6px' }}>
          <SettingsNav plain query={nav.settingsQuery} onQueryChange={nav.onSettingsQueryChange} />
        </Box>
        <AccountRow nav={nav} />
      </>
    );
  }

  return (
    <>
      <Brand onNavigate={onNavigate} />
      <Box sx={{ mt: '22px', flexShrink: 0 }}>
        <NewAppointmentButton nav={nav} onNavigate={onNavigate} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', mt: 2.5, mx: '-6px', px: '6px' }}>
        <MainNav nav={nav} onNavigate={onNavigate} />
        {withSlot && <SidebarSlot />}
      </Box>
      <AccountRow nav={nav} />
    </>
  );
}

/** The desktop sidebar: fixed to the left edge, 258px, full height. */
export function DesktopSidebar({ nav }: { nav: ShellNav }) {
  return (
    <Box
      component="aside"
      aria-label={nav.settingsMode ? 'Nastavení' : 'Postranní panel'}
      data-shell="sidebar"
      sx={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        boxSizing: 'border-box',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        px: '20px',
        pt: '22px',
        pb: '14px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: (t) => t.zIndex.drawer,
      }}
    >
      <SidebarBody nav={nav} withSlot />
    </Box>
  );
}
