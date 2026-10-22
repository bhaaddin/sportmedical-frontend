/*
 * "Where am I" - one quiet line at the top of every screen, so a click never
 * costs the sense of place: the sidebar's entry, then the screen inside it
 * (Pacienti › Karta pacienta › Termíny; Kluby a týmy › Hráči). The browser tab
 * says the same, so ten open tabs are tellable apart.
 *
 * The trail is computed once here and drawn twice: as the line over the page
 * on tablet and desktop, and inside the phone's top bar. Settings screens draw
 * their own breadcrumbs, so the line is not shown on a settings route - the tab
 * title still follows it.
 */
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { accentLiteral } from '../../theme';
import { PATIENT_SECTIONS, sectionPath } from '../../pages/patients/sections';
import { ActionBar } from './ActionBar';
import { PlannerMenuSlot } from './SidebarSlot';
import { clubIdOfRoute, clubPageIdOfRoute, clubPagePath, isPlannerRoute } from './plannerRoutes';
import type { SettingsItemAt } from './settingsTypes';
import type { MenuEntry } from './shellTypes';

export interface Crumb {
  label: string;
  to?: string;
}

export function computeCrumbs({
  pathname,
  patientId,
  settingsHere,
  menu,
}: {
  pathname: string;
  patientId: string | null;
  settingsHere: SettingsItemAt;
  menu: MenuEntry[];
}): Crumb[] {
  const crumbs: Crumb[] = [];
  if (settingsHere !== null) {
    crumbs.push({ label: 'Nastavení', to: '/settings' }, { label: settingsHere.section.label }, { label: settingsHere.item.label });
  } else if (pathname === '/settings' || pathname.startsWith('/settings/') || pathname.startsWith('/nastaveni/')) {
    crumbs.push({ label: 'Nastavení' });
  } else if (patientId !== null) {
    const section = PATIENT_SECTIONS.find((s) => sectionPath(patientId, s) === pathname);
    crumbs.push({ label: 'Pacienti', to: '/patients' }, { label: 'Karta pacienta', to: `/patients/${patientId}` });
    if (section && section.path !== '') crumbs.push({ label: section.label });
    if (pathname.endsWith('/edit')) crumbs.push({ label: 'Úprava karty' });
  } else if (pathname === '/patients/register') {
    /* No longer a child in the menu (R19: an action lives in the top bar), but still a place with a name. */
    crumbs.push({ label: 'Pacienti', to: '/patients' }, { label: 'Nový pacient' });
  } else if (clubPageIdOfRoute(pathname) !== null || clubIdOfRoute(pathname) !== null) {
    /* a club's page, and its calendar one step further: the middle crumb leads back to the page (the phone has no other way) */
    const calendarOf = clubIdOfRoute(pathname);
    crumbs.push({ label: 'Kluby a týmy', to: '/clubs' });
    if (calendarOf !== null) crumbs.push({ label: 'Klub', to: clubPagePath(calendarOf) }, { label: 'Kalendář' });
    else crumbs.push({ label: 'Klub' });
  } else if (pathname.startsWith('/kalendar/')) {
    crumbs.push({ label: 'Kalendář', to: '/planovani' }, { label: 'Termín' });
  } else {
    /* A child of one of the six first - its parent names the place. */
    let parent: MenuEntry | undefined;
    let child: MenuEntry | undefined;
    for (const entry of menu) {
      child = entry.children?.find((c) => c.path === pathname);
      if (child) { parent = entry; break; }
    }
    if (!parent) {
      parent = menu.find((i) => i.path === pathname)
        ?? menu.find((i) => pathname.startsWith(`${i.path}/`));
    }
    if (parent) crumbs.push({ label: parent.text, to: parent.path });
    if (child && child.text !== parent?.text) crumbs.push({ label: child.text });
  }
  return crumbs;
}

/** The browser tab says where you are: "Hráči · SportMedical". */
export function useDocumentTitle(crumbs: Crumb[]): void {
  const trail = crumbs.map((c) => c.label).join(' › ');
  useEffect(() => {
    const here = crumbs.length ? crumbs[crumbs.length - 1].label : 'SportMedical';
    document.title = `${here} · SportMedical`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail]);
}

/** The crumb line over the page (tablet and desktop). */
export function WhereAmI({ crumbs }: { crumbs: Crumb[] }) {
  /* On the planner routes there is no rail: this row also holds the Menu button that opens the navigation, and the stage
     brings its own controls, so the action bar is not drawn there. Everywhere else the row ends in the action bar (R19). */
  const planner = isPlannerRoute(useLocation().pathname);
  return (
    <Box
      aria-label="Kde jsem"
      sx={(t) => ({ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, minHeight: planner ? undefined : 44, flexShrink: 0, fontSize: 13, color: 'text.secondary', flexWrap: 'wrap', ...(t.palette.mode === 'dark' ? { fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' } : {}) })}
    >
      {planner && <PlannerMenuSlot />}
      {crumbs.length > 0 && (
        <>
          <Box component="span" sx={(t) => ({ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, ...(t.palette.mode === 'dark' ? { boxShadow: `0 0 10px ${accentLiteral(t, '#00EDDA')}` } : {}) })} />
          <Trail crumbs={crumbs} />
        </>
      )}
      {!planner && <ActionBar />}
    </Box>
  );
}

/** The crumbs themselves: earlier ones link back, the last is where you are. */
export function Trail({ crumbs, nowrap = false }: { crumbs: Crumb[]; nowrap?: boolean }) {
  return (
    <>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Box
            key={i}
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0, ...(nowrap && last ? { overflow: 'hidden' } : {}) }}
          >
            {i > 0 && <Box component="span" sx={{ color: 'text.disabled' }}>›</Box>}
            {c.to && !last ? (
              <Box component={Link} to={c.to} sx={{ color: 'text.secondary', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>{c.label}</Box>
            ) : (
              <Box
                component="span"
                aria-current={last ? 'page' : undefined}
                sx={{
                  color: last ? (t) => (t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.text.primary) : 'text.secondary',
                  fontWeight: last ? 700 : 600,
                  ...(nowrap ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
                }}
              >
                {c.label}
              </Box>
            )}
          </Box>
        );
      })}
    </>
  );
}
