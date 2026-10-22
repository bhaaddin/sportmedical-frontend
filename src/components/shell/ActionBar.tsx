/*
 * The top action bar (R19): where the desk STARTS things, on the right of the where-am-I row, on every desktop and tablet
 * screen (not on a phone - its top bar has Hledat, the bell and "+" - and not on the planner routes, whose stage brings its
 * own controls, nor in settings).
 *
 *   Hledat (Ctrl K)    the command palette
 *   Nový pacient       the full registration            (patients.register)
 *   Rychlá registrace  the four-facts registration      (patients.register)
 *   Nová objednávka    the chooser, then the booking drawer - the one filled button
 *
 * These four exist ONLY here (and on the page that owns each: Pacienti has "Nový pacient"): the navigation draws no
 * action entries, and a screen that is itself this bar's duplicate (Přehled's old "Rychlé akce") does not exist.
 * On a tablet the first three are icon buttons with a tooltip and an accessible name; every target is 44px.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import { Add, BoltOutlined, PersonAddAlt1Outlined, Search } from '@mui/icons-material';
import { usePermission } from '../../auth/usePermission';
import { useDevice } from '../../layout/useDevice';
import { NewOrderChooser } from '../booking/NewOrderChooser';
import { openUniversalSearch } from '../UniversalSearch';
import { focusRing } from './shellStyles';

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

const outlined = { minHeight: 44, height: 44, px: 1.75, whiteSpace: 'nowrap', fontWeight: 600, ...focusRing } as const;

/** An icon-only action: tooltip + accessible name, 44px. */
function IconAction({ label, children, ...rest }: { label: string; children: React.ReactNode } & Record<string, unknown>) {
  return (
    <Tooltip title={label} enterDelay={250}>
      <IconButton aria-label={label} {...rest} sx={{ width: 44, height: 44, border: '1px solid', borderColor: 'divider', borderRadius: '8px', ...focusRing }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

export function ActionBar() {
  const device = useDevice();
  const wide = device === 'desktop';
  const mayRegister = usePermission('patients.register');
  const [chooser, setChooser] = useState(false);
  const { pathname } = useLocation();
  /* The screen that already owns the action does not offer it a second time: Pacienti has its own "Nový pacient", the registration page IS it. */
  const showNewPatient = pathname !== '/patients' && pathname !== '/patients/register';
  const key = isMac() ? '⌘ K' : 'Ctrl K';

  return (
    <Box data-shell="actions" role="toolbar" aria-label="Rychlé akce" sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexShrink: 0 }}>
      {wide ? (
        <Button
          variant="outlined"
          color="inherit"
          onClick={openUniversalSearch}
          aria-label="Hledat"
          aria-keyshortcuts="Control+K Meta+K"
          title={`Hledat (${key})`}
          startIcon={<Search sx={{ fontSize: 18 }} />}
          sx={{ ...outlined, color: 'text.secondary', borderColor: 'divider', fontWeight: 500 }}
        >
          Hledat
          <Box component="kbd" sx={{ ml: 1.25, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, px: 0.75, py: 0.125, borderRadius: 0.75, border: '1px solid', borderColor: 'divider' }}>
            {key}
          </Box>
        </Button>
      ) : (
        <IconAction label={`Hledat (${key})`} aria-keyshortcuts="Control+K Meta+K" onClick={openUniversalSearch}>
          <Search />
        </IconAction>
      )}

      {mayRegister && (wide ? (
        <>
          {showNewPatient && <Button component={Link} to="/patients/register" variant="outlined" startIcon={<PersonAddAlt1Outlined />} sx={outlined}>Nový pacient</Button>}
          <Button component={Link} to="/patients/register?mode=quick" variant="outlined" startIcon={<BoltOutlined />} sx={outlined}>Rychlá registrace</Button>
        </>
      ) : (
        <>
          {showNewPatient && <IconAction label="Nový pacient" component={Link} to="/patients/register"><PersonAddAlt1Outlined /></IconAction>}
          <IconAction label="Rychlá registrace" component={Link} to="/patients/register?mode=quick"><BoltOutlined /></IconAction>
        </>
      ))}

      <Button variant="contained" startIcon={<Add />} onClick={() => setChooser(true)} sx={{ ...outlined }}>
        Nová objednávka
      </Button>
      <NewOrderChooser open={chooser} onClose={() => setChooser(false)} />
    </Box>
  );
}
