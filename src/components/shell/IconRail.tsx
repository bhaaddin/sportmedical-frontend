/*
 * The slim icon navigation (R19, desktop >=1280 and tablet 768-1279): one 56px column on the left edge, icons only.
 *
 *   logo       SportMedical - it is also Přehled, the way home (no second "Přehled" entry)
 *   five       Kalendář, Pacienti, Kluby, Fakturace, Nastavení - one click is the screen
 *   foot       "Všechny stránky" (opens the Menu drawer: every page, the section's own screens), the bell, the account
 *
 * Every icon has a tooltip (hover and keyboard focus) AND an accessible name; the page you are on is lit and is NOT a
 * link (a disabled `link` that says "tady jste"), an area you are inside of (a patient's card under Pacienti) is lit but
 * still leads to the area's own start. An entry the person may not open is not drawn (`nav.menu` is already filtered).
 * Targets are 44px. Nothing here starts an action: "Nový pacient", "Nová objednávka" and "Hledat" live in the top action bar
 * (ActionBar.tsx), so nothing is offered twice.
 *
 * Settings: the rail stays, with Nastavení lit, and the settings' own group list stands beside it on desktop (`SettingsSide`, Sidebar.tsx; on a tablet it is the drawer):
 * a list of settings groups is a different thing from the navigation between the areas.
 * On the planner routes the stage is the whole screen: no rail, a "Menu" button in the where-am-I row (PlannerMenu).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Box, ButtonBase, Tooltip } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter';
import { NavDrawer, SettingsSide } from './Sidebar';
import { PlannerMenu } from './PlannerMenu';
import { useDevice } from '../../layout/useDevice';
import { isPlannerRoute } from './plannerRoutes';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { entryState, mainEntries, shortLabel } from './shellModel';
import { areaAt, isAreaHub } from '../../pages/settings/catalogue';
import { RAIL_WIDTH, activeBg, activeGlow, focusRing, sideGlass } from './shellStyles';
import type { ShellNav } from './shellTypes';

const TARGET = 44;

/** One icon of the rail: a tooltip, an accessible name, lit when it is the screen or the area. */
export function RailIcon({
  to,
  label,
  icon,
  here,
  inArea = false,
  testId,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** This entry's own page is the screen: lit, and not a link. */
  here: boolean;
  /** The screen belongs to this entry (a deeper page): lit, still a link to the entry. */
  inArea?: boolean;
  testId?: string;
}) {
  const lit = here || inArea;
  const sx = {
    width: TARGET,
    height: TARGET,
    flexShrink: 0,
    borderRadius: '10px',
    color: lit ? 'primary.main' : 'text.secondary',
    bgcolor: here || inArea ? activeBg : 'transparent',
    boxShadow: (t: import('@mui/material/styles').Theme) => activeGlow(t, lit),
    '&:hover': { bgcolor: lit ? activeBg : 'action.hover', color: lit ? 'primary.main' : 'text.primary' },
    '& svg': { fontSize: 24 },
    ...focusRing,
  };
  return (
    <Tooltip title={label} placement="right" enterDelay={250} arrow>
      {here ? (
        <ButtonBase
          component="div"
          role="link"
          aria-disabled="true"
          aria-current="page"
          aria-label={`${label} (tady jste)`}
          data-testid={testId}
          tabIndex={0}
          sx={{ ...sx, cursor: 'default' }}
        >
          {icon}
        </ButtonBase>
      ) : (
        <ButtonBase component={Link} to={to} aria-label={label} data-testid={testId} sx={sx}>
          {icon}
        </ButtonBase>
      )}
    </Tooltip>
  );
}

/** The home mark: "SM" on the accent, a link to Přehled (not a link on Přehled itself). */
function Logo({ here }: { here: boolean }) {
  const mark = (
    <Box
      component="span"
      sx={{
        width: 36,
        height: 36,
        borderRadius: '10px',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '-0.03em',
      }}
    >
      SM
    </Box>
  );
  const sx = { width: TARGET, height: TARGET, flexShrink: 0, borderRadius: '10px', mb: 0.5, ...focusRing };
  return (
    <Tooltip title="Přehled" placement="right" enterDelay={250} arrow>
      {here ? (
        <ButtonBase component="div" role="link" aria-disabled="true" aria-current="page" aria-label="SportMedical — přehled (tady jste)" tabIndex={0} sx={{ ...sx, cursor: 'default' }}>
          {mark}
        </ButtonBase>
      ) : (
        <ButtonBase component={Link} to={STAFF_HOME_PATH} aria-label="SportMedical — přehled" sx={sx}>
          {mark}
        </ButtonBase>
      )}
    </Tooltip>
  );
}

export function IconRail({ nav }: { nav: ShellNav }) {
  const [open, setOpen] = useState(false);
  const planner = isPlannerRoute(nav.pathname);
  const desktop = useDevice() === 'desktop';
  /* Opening is a click; every navigation closes it again. */
  useEffect(() => { setOpen(false); }, [nav.pathname, nav.settingsMode]);

  /* The planner's stage is the whole screen: no rail, a Menu button in the top row instead. */
  if (planner) return <PlannerMenu nav={nav} />;

  const here = (path: string) => !nav.settingsMode && nav.pathname === path;
  const initials = `${nav.user.firstName?.[0] ?? ''}${nav.user.lastName?.[0] ?? ''}`;

  return (
    <>
      <Box
        component="nav"
        aria-label="Hlavní navigace"
        data-shell="rail"
        sx={[{
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
          gap: '6px',
          pt: '12px',
          pb: '12px',
          zIndex: (t) => t.zIndex.drawer,
        }, sideGlass]}
      >
        <Logo here={here(STAFF_HOME_PATH)} />

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', pt: 0.5 }}>
          {mainEntries(nav.menu).map((entry) => {
            const state = entryState(nav, entry);
            const settingsEntry = entry.path === '/nastaveni' || entry.path === '/administrace';
            /* Nastavení and Administrace are two entries of the same shell mode: the one whose area the screen is in is lit. */
            const sameArea = settingsEntry && nav.settingsMode && (areaAt(nav.pathname) === 'admin') === (entry.path === '/administrace');
            const isHere = settingsEntry ? sameArea && nav.pathname === entry.path : here(entry.path);
            const inArea = !isHere && (settingsEntry ? sameArea : state.inSection && !nav.settingsMode);
            return (
              <RailIcon
                key={entry.path}
                to={entry.path}
                label={shortLabel(entry.text)}
                icon={entry.icon}
                here={isHere}
                inArea={inArea}
                testId={`rail-${entry.path.slice(1)}`}
              />
            );
          })}
        </Box>

        <Tooltip title="Všechny stránky" placement="right" enterDelay={250} arrow>
          <ButtonBase
            aria-label="Všechny stránky"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            sx={{ width: TARGET, height: TARGET, borderRadius: '10px', flexShrink: 0, color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }, '& svg': { fontSize: 24 }, ...focusRing }}
          >
            <MenuIcon />
          </ButtonBase>
        </Tooltip>
        <NotificationCenter placement="side" buttonSx={{ width: TARGET, height: TARGET, flexShrink: 0 }} />
        <Tooltip title="Účet a vzhled" placement="right" enterDelay={250} arrow>
          <ButtonBase
            onClick={(e) => nav.onOpenAccountMenu(e.currentTarget)}
            aria-label="Účet a vzhled"
            aria-haspopup="menu"
            sx={{ width: TARGET, height: TARGET, borderRadius: '50%', flexShrink: 0, ...focusRing }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 600 }}>
              {initials}
            </Avatar>
          </ButtonBase>
        </Tooltip>
      </Box>

      {/* Desktop: the settings' own list stands beside the rail; tablet: the same list is in the drawer. */}
      {nav.settingsMode && desktop && !isAreaHub(nav.pathname) && <SettingsSide nav={nav} />}
      <NavDrawer nav={nav} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
