/*
 * The navigation on the planner routes (`/planovani`, `/planner-lab`): there is NO sidebar and NO tablet rail there -
 * the stage is the whole screen and brings its own panels - so the shell keeps one compact "Menu" button at the left of
 * the where-am-I row. It opens the full list of pages (the icon rail's entries with the same icons, the section's own screens, the account
 * widget) as a slide-over drawer: scrim, Esc and a tap outside close it, focus returns
 * to the button.
 *
 * Drawn by `IconRail` in place of itself (they own the nav model). The button itself is
 * portalled into the where-am-I row's slot (SidebarSlot.tsx), and the page's left margin that the sidebar/rail used to
 * claim is given back here.
 *
 * On a club's calendar (`/clubs/:clubId/kalendar`) a second button of the same tokens, "Zpět na klub", stands next to Menu and
 * leads to the club's own page (an ordinary page with the normal shell).
 *
 * Button tokens are copied from the prototype's `#club-edit-link` (the secondary header button in
 * `design/planner-v65.html`): 32px, radius 7px, 1px #32b5c7c9, gradient 105deg #063649 -> #072a3d, ink #ddffff,
 * 700 12.3px, icon 15px #6af8f0; hover border #74fff4, gradient #07576b -> #074154, glow 0 0 12px #04ebdd36.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, GlobalStyles } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { ArrowBack, Menu as MenuIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavDrawer } from './Sidebar';
import { clubIdOfRoute, clubPagePath } from './plannerRoutes';
import { usePlannerMenuEl } from './SidebarSlot';
import type { ShellNav } from './shellTypes';
import { accentLiteral } from '../../theme';

const buttonSx = (t: Theme) => ({
        mr: 1.5,
        minWidth: 0,
        height: 32,
        minHeight: 32,
        px: '9px',
        gap: '8px',
        borderRadius: '7px',
        fontSize: 12.3,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        textTransform: 'none',
        '& .MuiButton-startIcon': { m: 0 },
        ...(t.palette.mode === 'dark'
          ? { '& .MuiButton-startIcon svg': { color: accentLiteral(t, '#6AF8F0') } }
          : {}),
});

export function PlannerMenu({ nav }: { nav: ShellNav }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const clubId = clubIdOfRoute(useLocation().pathname);
  const slot = usePlannerMenuEl();

  const button = (
    <Button
      variant="outlined"
      size="small"
      data-testid="planner-menu-button"
      aria-label="Menu"
      aria-haspopup="dialog"
      aria-expanded={open}
      startIcon={<MenuIcon sx={{ fontSize: '15px !important' }} />}
      onClick={() => setOpen(true)}
      sx={buttonSx}
    >
      Menu
    </Button>
  );

  return (
    <>
      {/* The sidebar's / rail's margin is the page's no more: the stage gets the whole width. */}
      <GlobalStyles styles={{ 'main#main-content': { marginLeft: 0 } }} />
      {slot !== null ? createPortal(
        <>
          {button}
          {clubId !== null ? (
            <Button
              variant="outlined"
              size="small"
              data-testid="club-back-button"
              startIcon={<ArrowBack sx={{ fontSize: '15px !important' }} />}
              onClick={() => navigate(clubPagePath(clubId))}
              sx={buttonSx}
            >
              Zpět na klub
            </Button>
          ) : null}
        </>,
        slot,
      ) : null}
      <NavDrawer nav={nav} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
