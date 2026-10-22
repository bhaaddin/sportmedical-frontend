/*
 * The planner routes have no icon rail: the stage is the whole screen, the shell keeps one "Menu" button in
 * the where-am-I row that opens the full list of pages as a slide-over (the same icons as the rail). Every other route
 * keeps the icon rail and the top action bar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { buildTheme } from '../../theme';
import { ThemePrefsContext } from '../../themePrefs';
import { isPlannerRoute } from './plannerRoutes';

vi.mock('../../auth/accountRefresh', () => ({ useAccountRefresh: () => undefined }));
vi.mock('../booking/NewOrderChooser', () => {
  const NewOrderChooser = ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="order-chooser"><button type="button" onClick={onClose}>zavřít výběr</button></div> : null;
  return { NewOrderChooser, default: NewOrderChooser };
});
vi.mock('../NotificationCenter', () => ({
  default: () => <button type="button" aria-label="Oznámení">zvonek</button>,
}));

const { Layout } = await import('../../StaffApp');
const { SidebarPortal } = await import('./SidebarSlot');

const EVERYTHING = [
  'patients.view', 'patients.register', 'patients.edit', 'billing.manage',
  'settings.clinic.manage', 'users.manage', 'questionnaires.manage', 'communication.manage',
];

function Probe() {
  const location = useLocation();
  return (
    <div>
      <output data-testid="path">{location.pathname}</output>
      <SidebarPortal><p>obsah postranního panelu</p></SidebarPortal>
    </div>
  );
}

function renderShell(path: string, width: number) {
  setViewport(width);
  localStorage.setItem('permissions', JSON.stringify(EVERYTHING));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nováková', role: 'Recepce' }));
  return render(
    <ThemePrefsContext.Provider value={{ accent: '#0D5C52', mode: 'dark', setAccent: () => undefined, setMode: () => undefined }}>
      <ThemeProvider theme={buildTheme('#0D5C52', 'dark')}>
        <MemoryRouter initialEntries={[path]}>
          <Layout><Probe /></Layout>
        </MemoryRouter>
      </ThemeProvider>
    </ThemePrefsContext.Provider>,
  );
}

const menuButton = () => screen.getByRole('button', { name: 'Menu' });

beforeEach(() => {
  localStorage.clear();
});

describe('isPlannerRoute', () => {
  it('knows the calendar and the lab pages, nothing that merely starts alike', () => {
    for (const p of ['/planovani', '/planner-lab', '/planner-lab/page', '/planovani/x']) expect(isPlannerRoute(p)).toBe(true);
    for (const p of ['/planovanizz', '/dnes', '/clubs', '/prehled', '/planner-labs']) expect(isPlannerRoute(p)).toBe(false);
  });

  it("knows a club's own screen /clubs/<id>, and not the clubs list or its other pages", () => {
    for (const p of ['/clubs/942e2676-d730-4a13-8016-17f95abd26e2', '/clubs/club-1', '/clubs/club-1/']) expect(isPlannerRoute(p)).toBe(true);
    for (const p of ['/clubs', '/clubs/', '/clubs/objednavky', '/clubs/rezervace', '/clubs/hraci', '/clubs/statistiky', '/clubs/fakturace', '/clubs/club-1/x', '/clubsx/1']) expect(isPlannerRoute(p)).toBe(false);
  });
});

describe.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet]] as const)("a club's own screen at %s", (_name, width) => {
  it('/clubs/<id>: no sidebar, no rail, the Menu button and "Zpět na kluby" in the where-am-I row', async () => {
    renderShell('/clubs/club-1', width);
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '0px' });
    const row = screen.getByLabelText('Kde jsem');
    expect(within(row).getByRole('button', { name: 'Menu' })).toBe(menuButton());
    await userEvent.click(within(row).getByRole('button', { name: 'Zpět na kluby' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/clubs');
    expect(screen.getByTestId('path').textContent).toBe('/clubs');
    /* ...and the list is an ordinary page again, with the navigation */
    expect(document.querySelector('[data-shell="rail"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zpět na kluby' })).not.toBeInTheDocument();
  });

  it('the Menu button opens the navigation as a drawer on a club screen too', async () => {
    renderShell('/clubs/club-1', width);
    await userEvent.click(menuButton());
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('link', { name: 'Všechny sekce' })).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Přehled klubů' })).toHaveAttribute('href', '/clubs');
  });

  it.each(['/clubs/objednavky', '/clubs/hraci', '/clubs/fakturace'])('%s keeps the normal shell', (route) => {
    renderShell(route, width);
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zpět na kluby' })).not.toBeInTheDocument();
  });
});

describe.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet]] as const)('planner routes at %s', (_name, width) => {
  it.each(['/planovani', '/planner-lab', '/planner-lab/page'])('%s: no rail, the page starts at the left edge', (route) => {
    renderShell(route, width);
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Hlavní navigace|Sekce/ })).not.toBeInTheDocument();
    expect(screen.queryByText('obsah postranního panelu')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '0px' });
  });

  it('has the Menu button in the where-am-I row', () => {
    renderShell('/planovani', width);
    const row = screen.getByLabelText('Kde jsem');
    expect(within(row).getByRole('button', { name: 'Menu' })).toBe(menuButton());
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('has no action bar on the stage (it brings its own controls)', () => {
    renderShell('/planovani', width);
    expect(document.querySelector('[data-shell="actions"]')).not.toBeInTheDocument();
  });

  it('opens the full list of pages as a drawer: the entries with icons, the section screens and the account widget - and no action entries', async () => {
    renderShell('/planovani', width);
    await userEvent.click(menuButton());
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    /* The page behind a modal is aria-hidden, so the button is asked for with `hidden`. */
    expect(screen.getByRole('button', { name: 'Menu', hidden: true })).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    expect(within(drawer).getByRole('heading', { name: 'Kalendář' })).toBeInTheDocument();
    for (const [name, href] of [
      ['Kalendář', '/planovani'], ['Dnešní přehled', '/dnes'], ['Přehled podle služeb', '/prehled-sluzeb'],
      ['Dostupnost', '/availability'],
    ]) {
      expect(within(drawer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    /* R19: an action lives only in the top action bar and on the page that owns it. */
    for (const action of ['Nová objednávka', 'Nový pacient', 'Rychlá registrace', 'Klubová objednávka']) {
      expect(within(drawer).queryByRole('button', { name: action })).not.toBeInTheDocument();
      expect(within(drawer).queryByRole('link', { name: action })).not.toBeInTheDocument();
    }
    expect(within(drawer).getByRole('button', { name: 'Účet a vzhled' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Hledat' })).toBeInTheDocument();
  });

  it('Esc closes the drawer and puts the focus back on the Menu button', async () => {
    renderShell('/planovani', width);
    await userEvent.click(menuButton());
    await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
    expect(menuButton()).toHaveFocus();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('the scrim closes it, and so does following a link', async () => {
    renderShell('/planovani', width);
    await userEvent.click(menuButton());
    await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.click(document.querySelector('.MuiBackdrop-root') as Element);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());

    await userEvent.click(menuButton());
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.click(within(drawer).getByRole('link', { name: 'Dnešní přehled' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/dnes');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
    /* ...and on the next route the normal navigation is back. */
    expect(document.querySelector('[data-shell="rail"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });
});

describe('everywhere else the icon rail and the action bar are there', () => {
  it.each(['/dnes', '/clubs', '/prehled'])('desktop %s: the icon rail and the action bar, no Menu button', (route) => {
    renderShell(route, VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="rail"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="actions"]')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('tablet /clubs: the same icon rail', () => {
    renderShell('/clubs', VIEWPORTS.tablet);
    expect(document.querySelector('[data-shell="rail"]')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
  });

  it('phone /planovani keeps the bottom navigation and gets no Menu button', () => {
    renderShell('/planovani', VIEWPORTS.phone);
    expect(document.querySelector('[data-shell="bottombar"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
