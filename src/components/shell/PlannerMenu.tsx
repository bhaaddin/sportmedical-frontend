/*
 * The navigation on the planner routes (`/planovani`, `/planner-lab`): there is NO sidebar and NO tablet rail there -
 * the stage is the whole screen and brings its own panels - so the shell keeps one compact "Menu" button at the left of
 * the where-am-I row. It opens the very same navigation the sidebar had (Všechny sekce, the section's entries,
 * "Nová objednávka", the account widget) as a slide-over drawer: scrim, Esc and a tap outside close it, focus returns
 * to the button.
 *
 * Drawn by `DesktopSidebar` / `TabletRail` in place of themselves (they own the nav model). The button itself is
 * portalled into the where-am-I row's slot (SidebarSlot.tsx), and the page's left margin that the sidebar/rail used to
 * claim is given back here.
 *
 * Button tokens are copied from the prototype's `#club-edit-link` (the secondary header button in
 * `design/planner-v65.html`): 32px, radius 7px, 1px #32b5c7c9, gradient 105deg #063649 -> #072a3d, ink #ddffff,
 * 700 12.3px, icon 15px #6af8f0; hover border #74fff4, gradient #07576b -> #074154, glow 0 0 12px #04ebdd36.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, GlobalStyles } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { NewOrderChooser } from '../booking/NewOrderChooser';
import { NavDrawer } from './Sidebar';
import { usePlannerMenuEl } from './SidebarSlot';
import type { ShellNav } from './shellTypes';

export function PlannerMenu({ nav }: { nav: ShellNav }) {
  const [open, setOpen] = useState(false);
  const [chooser, setChooser] = useState(false);
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
      sx={(t) => ({
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
          ? { '& .MuiButton-startIcon svg': { color: '#6AF8F0' } }
          : {}),
      })}
    >
      Menu
    </Button>
  );

  return (
    <>
      {/* The sidebar's / rail's margin is the page's no more: the stage gets the whole width. */}
      <GlobalStyles styles={{ 'main#main-content': { marginLeft: 0 } }} />
      {slot !== null ? createPortal(button, slot) : null}
      <NavDrawer nav={nav} open={open} onClose={() => setOpen(false)} onNewOrder={() => setChooser(true)} />
      <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </>
  );
}
