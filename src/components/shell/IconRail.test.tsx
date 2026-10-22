/*
 * The slim icon navigation (R19), rendered on its own: every icon has a name and a tooltip, the page you are on is lit and
 * is not a link, an area you are inside of is lit but still leads to its start, an entry the person may not open is not
 * drawn, the whole thing is reachable by keyboard, and every target is 44px.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { buildTheme } from '../../theme';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { MenuEntry, ShellNav } from './shellTypes';

vi.mock('../NotificationCenter', () => ({ default: () => <button type="button" aria-label="Oznámení">zvonek</button> }));
vi.mock('../booking/NewOrderChooser', () => ({ NewOrderChooser: () => null, default: () => null }));

const { IconRail, RailIcon } = await import('./IconRail');

const icon = (label: string) => <svg data-icon={label} aria-hidden />;
const ENTRIES: MenuEntry[] = [
  { text: 'Přehled', icon: icon('home'), path: '/prehled' },
  { text: 'Kalendář', icon: icon('cal'), path: '/planovani' },
  { text: 'Pacienti', icon: icon('pat'), path: '/patients', requires: 'patients.view', children: [{ text: 'Přehled pacientů', icon: null, path: '/patients' }] },
  { text: 'Kluby a týmy', icon: icon('club'), path: '/clubs', children: [{ text: 'Hráči', icon: null, path: '/clubs/hraci' }] },
  { text: 'Fakturace', icon: icon('bill'), path: '/billing', requires: 'billing.manage' },
  { text: 'Nastavení', icon: icon('set'), path: '/settings' },
];

function navFor(pathname: string, menu: MenuEntry[] = ENTRIES, settingsMode = false): ShellNav {
  return {
    pathname,
    menu,
    patientId: null,
    canSeeInvoices: true,
    settingsMode,
    settingsQuery: '',
    onSettingsQueryChange: () => undefined,
    backToAppPath: '/prehled',
    user: { firstName: 'Jana', lastName: 'Nováková', role: 'Recepce' },
    onNewAppointment: () => undefined,
    onOpenAccountMenu: () => undefined,
  };
}

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderRail(nav: ShellNav, width = VIEWPORTS.desktop) {
  setViewport(width);
  return render(
    <ThemeProvider theme={buildTheme('#0D5C52', 'dark')}>
      <MemoryRouter initialEntries={[nav.pathname]}>
        <IconRail nav={nav} />
        <Where />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const rail = () => screen.getByRole('navigation', { name: 'Hlavní navigace' });

describe('the icons', () => {
  it('draws the logo and the five entries (icons only), each with an accessible name and a 44px target', () => {
    renderRail(navFor('/dnes'));
    for (const name of ['SportMedical — přehled', 'Kalendář', 'Pacienti', 'Kluby', 'Fakturace', 'Nastavení']) {
      const link = within(rail()).getByRole('link', { name });
      expect(getComputedStyle(link).height).toBe('44px');
      expect(getComputedStyle(link).width).toBe('44px');
      /* Icons only - the logo mark is the one thing with letters. */
      if (name !== 'SportMedical — přehled') expect(link.textContent).toBe('');
    }
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toHaveAttribute('href', '/planovani');
    expect(within(rail()).getByRole('link', { name: 'Kluby' })).toHaveAttribute('href', '/clubs');
    /* The foot: all pages, the bell, the account. */
    for (const name of ['Všechny stránky', 'Oznámení', 'Účet a vzhled']) expect(within(rail()).getByRole('button', { name })).toBeInTheDocument();
  });

  it('does not draw an entry the person may not open (the menu given is already filtered by permission)', () => {
    renderRail(navFor('/dnes', ENTRIES.filter((e) => e.path !== '/patients' && e.path !== '/billing')));
    expect(within(rail()).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
    expect(within(rail()).queryByRole('link', { name: 'Fakturace' })).not.toBeInTheDocument();
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('has no text labels and no children: it is a rail of icons', () => {
    renderRail(navFor('/clubs/hraci'));
    expect(within(rail()).queryByRole('link', { name: 'Hráči' })).not.toBeInTheDocument();
    expect(within(rail()).queryByText('Kluby a týmy')).not.toBeInTheDocument();
  });
});

describe('the current page', () => {
  it('is lit and is NOT a link: a disabled link that says where you are', () => {
    renderRail(navFor('/patients'));
    const here = within(rail()).getByRole('link', { name: 'Pacienti (tady jste)' });
    expect(here).toHaveAttribute('aria-current', 'page');
    expect(here).toHaveAttribute('aria-disabled', 'true');
    expect(here).not.toHaveAttribute('href');
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).not.toHaveAttribute('aria-current');
  });

  it('does nothing when it is activated', async () => {
    renderRail(navFor('/patients'));
    await userEvent.click(within(rail()).getByRole('link', { name: 'Pacienti (tady jste)' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/patients');
  });

  it('an area you are inside of stays a link to its start, lit but not "current"', async () => {
    renderRail(navFor('/clubs/hraci'));
    const club = within(rail()).getByRole('link', { name: 'Kluby' });
    expect(club).toHaveAttribute('href', '/clubs');
    expect(club).not.toHaveAttribute('aria-current');
    await userEvent.click(club);
    expect(screen.getByTestId('path')).toHaveTextContent('/clubs');
  });

  it('the logo is the overview: a link elsewhere, the current page on Přehled itself', () => {
    const first = renderRail(navFor('/dnes'));
    expect(within(rail()).getByRole('link', { name: 'SportMedical — přehled' })).toHaveAttribute('href', '/prehled');
    first.unmount();
    renderRail(navFor('/prehled'));
    expect(within(rail()).getByRole('link', { name: 'SportMedical — přehled (tady jste)' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('settings: Nastavení is lit, the rest of the rail still leads away', () => {
    renderRail(navFor('/svatky', ENTRIES, true));
    expect(within(rail()).getByRole('link', { name: 'Nastavení' })).toHaveAttribute('href', '/settings');
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toHaveAttribute('href', '/planovani');
  });
});

describe('keyboard and tooltips', () => {
  it('Tab walks the icons in order, Enter follows one', async () => {
    renderRail(navFor('/dnes'));
    const user = userEvent.setup();
    await user.tab();
    expect(within(rail()).getByRole('link', { name: 'SportMedical — přehled' })).toHaveFocus();
    await user.tab();
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toHaveFocus();
    await user.tab();
    expect(within(rail()).getByRole('link', { name: 'Pacienti' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('path')).toHaveTextContent('/patients');
  });

  it('shows the name as a tooltip on hover', async () => {
    renderRail(navFor('/dnes'));
    const user = userEvent.setup();
    await user.hover(within(rail()).getByRole('link', { name: 'Kluby' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Kluby');
    await user.unhover(within(rail()).getByRole('link', { name: 'Kluby' }));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  /* jsdom has no :focus-visible, so MUI never opens a tooltip on focus here; scripts/stage4/shell-check.mjs asserts the
     focus tooltip in a real browser. What is pinned here: every icon is reachable by Tab and carries its name. */
  it('every icon is reachable by Tab and carries its name', async () => {
    renderRail(navFor('/dnes'));
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(within(rail()).getByRole('link', { name: 'Kalendář' })).toHaveFocus();
  });

  it('the current page is focusable too (its tooltip is reachable)', async () => {
    renderRail(navFor('/patients'));
    const user = userEvent.setup();
    const here = within(rail()).getByRole('link', { name: 'Pacienti (tady jste)' });
    for (let i = 0; i < 4 && document.activeElement !== here; i++) await user.tab();
    expect(here).toHaveFocus();
  });

  it('RailIcon alone: a name is always there', () => {
    render(
      <ThemeProvider theme={buildTheme('#0D5C52', 'light')}>
        <MemoryRouter>
          <RailIcon to="/x" label="Ukázka" icon={icon('x')} here={false} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole('link', { name: 'Ukázka' })).toHaveAttribute('href', '/x');
  });
});

describe('the planner routes', () => {
  it('draw no rail (the stage is the whole screen; its Menu button is tested in PlannerMenu.test.tsx)', async () => {
    renderRail(navFor('/planovani'));
    expect(screen.queryByRole('navigation', { name: 'Hlavní navigace' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
  });
});
