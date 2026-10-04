/*
 * The tablet's navigation (768-1279): a narrow 72px rail - an icon with a
 * one-line label under it per entry - and a menu button that opens the full
 * 258px sidebar as an OVERLAY over the content (scrim, nothing is pushed).
 * The overlay closes on any navigation, on a tap outside it and on Esc.
 *
 * There is no hover here: iPad is touch plus keyboard, so the rail changes
 * state only by a tap. In settings the rail shows "Zpět" and the settings
 * entry; the overlay then holds the settings sidebar.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Box, ButtonBase, Drawer, IconButton } from '@mui/material';
import { Add, ArrowBack, Menu as MenuIcon, Search, Settings } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter';
import { openUniversalSearch } from '../UniversalSearch';
import { NewOrderChooser } from '../booking/NewOrderChooser';
import { SidebarBody } from './Sidebar';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { childIsActive, entryState, mainEntries, sectionGroups, sectionOf, shortLabel } from './shellModel';
import { RAIL_WIDTH, SIDEBAR_WIDTH, activeBg, focusRing } from './shellStyles';
import type { ShellNav } from './shellTypes';

/** One rail entry: the icon, its label under it, 56px tall. */
function RailItem({
  to,
  label,
  fullLabel,
  icon,
  active,
  inSection = false,
  state,
}: {
  to: string;
  label: string;
  fullLabel?: string;
  icon: React.ReactNode;
  active: boolean;
  inSection?: boolean;
  state?: unknown;
}) {
  const lit = active || inSection;
  return (
    <ButtonBase
      component={Link}
      to={to}
      state={state}
      aria-label={fullLabel ?? label}
      aria-current={active ? 'page' : undefined}
      sx={{
        width: 64,
        minHeight: 56,
        flexShrink: 0,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '3px',
        borderRadius: '8px',
        color: lit ? 'primary.main' : 'text.secondary',
        bgcolor: active ? activeBg : 'transparent',
        '&:hover': { bgcolor: active ? activeBg : 'action.hover' },
        '& svg': { fontSize: 22 },
        ...focusRing,
      }}
    >
      {icon}
      <Box
        component="span"
        sx={{
          fontSize: 11,
          lineHeight: 1.1,
          fontWeight: lit ? 700 : 500,
          maxWidth: 62,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Box>
    </ButtonBase>
  );
}

export function TabletRail({ nav }: { nav: ShellNav }) {
  const [open, setOpen] = useState(false);
  const [chooser, setChooser] = useState(false);
  const close = () => setOpen(false);
  const section = sectionOf(nav);

  /* Opening is a tap; every navigation closes it again. */
  useEffect(() => { setOpen(false); }, [nav.pathname, nav.settingsMode]);

  return (
    <>
      <Box
        component="nav"
        aria-label={nav.settingsMode ? 'Nastavení' : section ? `Sekce ${section.text}` : 'Hlavní navigace'}
        data-shell="rail"
        sx={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: RAIL_WIDTH,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          pt: 1.25,
          pb: 1.25,
          zIndex: (t) => t.zIndex.drawer,
        }}
      >
        <IconButton
          aria-label="Otevřít menu"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          sx={{ width: 48, height: 48, flexShrink: 0 }}
        >
          <MenuIcon />
        </IconButton>

        {!nav.settingsMode && (
          <IconButton
            aria-label="Nová objednávka"
            onClick={() => setChooser(true)}
            sx={{
              width: 48,
              height: 48,
              flexShrink: 0,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <Add />
          </IconButton>
        )}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            mt: 0.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {nav.settingsMode ? (
            <>
              <RailItem to={nav.backToAppPath} label="Zpět" fullLabel="Zpět do aplikace" icon={<ArrowBack />} active={false} />
              <RailItem to="/settings" label="Nastavení" icon={<Settings />} active />
            </>
          ) : section ? (
            <>
              <RailItem to={STAFF_HOME_PATH} label="Sekce" fullLabel="Všechny sekce" icon={<ArrowBack />} active={false} />
              {sectionGroups(nav, section).flatMap((group) =>
                group.items.map((child) => (
                  <RailItem
                    key={child.path + child.text}
                    to={child.path}
                    state={child.state}
                    label={child.text}
                    fullLabel={child.text}
                    icon={child.icon}
                    active={childIsActive(nav, child, group.items, group.exact)}
                  />
                )),
              )}
            </>
          ) : (
            mainEntries(nav.menu).map((entry) => {
              const state = entryState(nav, entry);
              return (
                <RailItem
                  key={entry.path}
                  to={entry.path}
                  label={shortLabel(entry.text)}
                  fullLabel={entry.text}
                  icon={entry.icon}
                  active={state.self}
                  inSection={state.childActive}
                />
              );
            })
          )}
        </Box>

        <IconButton title="Hledat (Ctrl+K)" aria-label="Hledat" onClick={openUniversalSearch} sx={{ width: 44, height: 44, flexShrink: 0 }}>
          <Search />
        </IconButton>
        <NotificationCenter placement="side" buttonSx={{ width: 44, height: 44, flexShrink: 0 }} />
        <ButtonBase
          onClick={(e) => nav.onOpenAccountMenu(e.currentTarget)}
          aria-label="Účet a vzhled"
          aria-haspopup="menu"
          sx={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, ...focusRing }}
        >
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#FFF', fontSize: 13, fontWeight: 600 }}>
            {nav.user.firstName?.[0]}{nav.user.lastName?.[0]}
          </Avatar>
        </ButtonBase>
      </Box>

      <Drawer
        anchor="left"
        open={open}
        onClose={close}
        transitionDuration={{ enter: 150, exit: 120 }}
        slotProps={{
          paper: {
            'aria-label': nav.settingsMode ? 'Nastavení — menu' : 'Menu',
            role: 'dialog',
            sx: {
              width: SIDEBAR_WIDTH,
              maxWidth: '86vw',
              boxSizing: 'border-box',
              borderRadius: 0,
              px: '20px',
              pt: '22px',
              pb: '14px',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <SidebarBody nav={nav} onNavigate={close} withSlot={false} onNewOrder={() => setChooser(true)} />
      </Drawer>
      <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}
