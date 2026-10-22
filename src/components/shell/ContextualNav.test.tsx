/*
 * D10, as of Stage 4 (R19): the icon rail has no children, so "where you are" shows in the Menu drawer ("Všechny stránky"
 * on desktop and tablet, "Více" on a phone): inside an area the drawer is that area's own screens. The settings groups
 * still fold, and "Nová objednávka" lives in the top action bar. Rendered through the real Layout at the three widths
 * (390 / 834 / 1440), like Shell.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { buildTheme } from '../../theme';
import { ThemePrefsContext } from '../../themePrefs';

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

const EVERYTHING = [
  'patients.view', 'patients.register', 'patients.edit', 'billing.manage',
  'settings.clinic.manage', 'users.manage', 'questionnaires.manage', 'communication.manage',
];

function Probe() {
  const location = useLocation();
  return (
    <div>
      <output data-testid="path">{location.pathname}</output>
      <output data-testid="state">{JSON.stringify(location.state ?? null)}</output>
    </div>
  );
}

function renderShell(path: string, width: number) {
  setViewport(width);
  localStorage.setItem('permissions', JSON.stringify(EVERYTHING));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nováková', role: 'Recepce' }));
  return render(
    <ThemePrefsContext.Provider value={{ accent: '#0D5C52', mode: 'light', setAccent: () => undefined, setMode: () => undefined }}>
      <ThemeProvider theme={buildTheme('#0D5C52', 'light')}>
        <MemoryRouter initialEntries={[path]}>
          <Layout><Probe /></Layout>
        </MemoryRouter>
      </ThemeProvider>
    </ThemePrefsContext.Provider>,
  );
}

const path = () => screen.getByTestId('path').textContent;
/** The drawer behind "Všechny stránky" (desktop and tablet). */
async function openDrawer() {
  await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
  return screen.findByRole('dialog', { name: 'Menu' });
}

beforeEach(() => {
  localStorage.clear();
});

describe('contextual drawer (1440)', () => {
  it('shows only the children of the entry you are in', async () => {
    renderShell('/clubs/hraci', VIEWPORTS.desktop);
    const drawer = await openDrawer();
    for (const name of ['Přehled klubů', 'Objednávky klubů', 'Hráči', 'Statistiky', 'Fakturace']) {
      expect(within(drawer).getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    expect(within(drawer).queryByRole('link', { name: 'Dnešní přehled' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Hráči' })).toHaveAttribute('aria-current', 'page');
    expect(within(drawer).getByRole('link', { name: 'Přehled klubů' })).not.toHaveAttribute('aria-current');
  });

  it('a club calendar is a planner route: no rail - the Menu drawer lights the clubs overview', async () => {
    renderShell('/clubs/some-club-id/kalendar', VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('link', { name: 'Přehled klubů' })).toHaveAttribute('aria-current', 'page');
  });

  it('Pacienti: the overview and the registration check - no entry that starts a registration', async () => {
    renderShell('/patients', VIEWPORTS.desktop);
    const drawer = await openDrawer();
    expect(within(drawer).getByRole('link', { name: 'Přehled pacientů' })).toHaveAttribute('aria-current', 'page');
    expect(within(drawer).getByRole('link', { name: 'Kontrola registrací' })).toHaveAttribute('href', '/intake-review');
    for (const action of ['Nový pacient', 'Rychlá registrace']) expect(within(drawer).queryByRole('link', { name: action })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('link', { name: 'Objednávky klubů' })).not.toBeInTheDocument();
  });

  it('Kalendář: its screens are in the drawer, the club order is not (the calendar owns it)', async () => {
    renderShell('/dnes', VIEWPORTS.desktop);
    const drawer = await openDrawer();
    expect(within(drawer).getByRole('link', { name: 'Dnešní přehled' })).toHaveAttribute('aria-current', 'page');
    expect(within(drawer).queryByRole('link', { name: 'Klubová objednávka' })).not.toBeInTheDocument();
  });

  it('draws no children of other areas on a plain page', async () => {
    renderShell('/billing', VIEWPORTS.desktop);
    expect(screen.queryByRole('link', { name: 'Hráči' })).not.toBeInTheDocument();
    const drawer = await openDrawer();
    expect(within(drawer).queryByRole('link', { name: 'Hráči' })).not.toBeInTheDocument();
  });
});

describe('contextual navigation (834 / 390)', () => {
  it('tablet: the action bar opens the chooser; the drawer shows the active entry children', async () => {
    renderShell('/clubs', VIEWPORTS.tablet);
    await userEvent.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'zavřít výběr' }));
    const overlay = await openDrawer();
    expect(within(overlay).getByRole('link', { name: 'Objednávky klubů' })).toHaveAttribute('href', '/clubs/objednavky');
    expect(within(overlay).queryByRole('link', { name: 'Dnešní přehled' })).not.toBeInTheDocument();
    expect(within(overlay).queryByRole('button', { name: 'Nová objednávka' })).not.toBeInTheDocument();
  });

  it('phone: Kluby leads to /clubs and its children are in the Více sheet', async () => {
    renderShell('/clubs/hraci', VIEWPORTS.phone);
    const bar = screen.getByRole('navigation', { name: 'Hlavní navigace' });
    expect(within(bar).getByRole('link', { name: 'Kluby a týmy' })).toHaveAttribute('href', '/clubs');
    expect(within(bar).getByRole('link', { name: 'Kluby a týmy' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    for (const [name, href] of [['Objednávky klubů', '/clubs/objednavky'], ['Hráči', '/clubs/hraci']]) {
      expect(within(sheet).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('phone: the top bar plus opens the chooser', async () => {
    renderShell('/planovani', VIEWPORTS.phone);
    const top = document.querySelector('[data-shell="topbar"]') as HTMLElement;
    await userEvent.click(within(top).getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
  });
});

describe('settings sidebar groups', () => {
  const settingsNav = () => screen.getByRole('navigation', { name: 'Nastavení — oddíly' });

  it('are collapsed except the group of the current page, toggle on click, one at a time', async () => {
    renderShell('/working-hours', VIEWPORTS.desktop);
    const nav = settingsNav();
    const provoz = within(nav).getByRole('button', { name: 'Provoz' });
    const system = within(nav).getByRole('button', { name: 'Systém' });
    expect(provoz).toHaveAttribute('aria-expanded', 'true');
    expect(system).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).getByRole('link', { name: 'Otevírací doba' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(system);
    expect(system).toHaveAttribute('aria-expanded', 'true');
    expect(provoz).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();

    await userEvent.click(system);
    expect(system).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes with Enter and Space', async () => {
    renderShell('/settings', VIEWPORTS.desktop);
    const provoz = within(settingsNav()).getByRole('button', { name: 'Provoz' });
    expect(provoz).toHaveAttribute('aria-expanded', 'false');
    provoz.focus();
    await userEvent.keyboard('{Enter}');
    expect(provoz).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(provoz).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows matching groups expanded while a search is typed', async () => {
    renderShell('/settings', VIEWPORTS.desktop);
    const nav = settingsNav();
    expect(within(nav).queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();
    await userEvent.type(within(nav).getByLabelText('Hledat v nastavení'), 'oběd');
    expect(within(nav).getByRole('link', { name: 'Otevírací doba' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Provoz' })).toHaveAttribute('aria-expanded', 'true');
  });
});

/*
 * Inside an area the drawer is that area's own items - at every width - with a way back to all sections and the title.
 * (The icon rail itself never has children.)
 */
const SECTIONS: Array<{ path: string; title: string; items: Array<[string, string]>; foreign: string[] }> = [
  {
    path: '/dnes',
    title: 'Kalendář',
    items: [['Kalendář', '/planovani'], ['Dnešní přehled', '/dnes'], ['Přehled podle služeb', '/prehled-sluzeb'], ['Dostupnost', '/availability']],
    foreign: ['Nový pacient', 'Klubová objednávka', 'Objednávky klubů', 'Pokladna'],
  },
  {
    path: '/patients',
    title: 'Pacienti',
    items: [['Přehled pacientů', '/patients'], ['Kontrola registrací', '/intake-review']],
    foreign: ['Nový pacient', 'Rychlá registrace', 'Dnešní přehled', 'Objednávky klubů', 'Pokladna'],
  },
  {
    path: '/clubs',
    title: 'Kluby a týmy',
    items: [['Přehled klubů', '/clubs'], ['Objednávky klubů', '/clubs/objednavky'], ['Hráči', '/clubs/hraci'], ['Statistiky', '/clubs/statistiky'], ['Fakturace', '/clubs/fakturace']],
    foreign: ['Dnešní přehled', 'Nový pacient', 'Pokladna'],
  },
  {
    path: '/billing',
    title: 'Fakturace',
    items: [['Faktury', '/billing'], ['Pokladna', '/cashier'], ['Účetní export', '/accounting-export']],
    foreign: ['Dnešní přehled', 'Nový pacient', 'Objednávky klubů'],
  },
];

describe.each(SECTIONS)('area $title: the drawer is only this area', ({ path: start, title, items, foreign }) => {
  it.each([['desktop (1440)', VIEWPORTS.desktop], ['tablet (834)', VIEWPORTS.tablet]] as const)('%s: title, way back, own items, nothing of the others', async (_n, width) => {
    renderShell(start, width);
    /* The rail itself has no children: only icons. */
    const rail = document.querySelector('[data-shell="rail"]') as HTMLElement;
    const iconNames = ['Kalendář', 'Pacienti', 'Kluby', 'Fakturace', 'Nastavení'];
    for (const [name] of items) if (!iconNames.includes(name)) expect(within(rail).queryByRole('link', { name })).not.toBeInTheDocument();
    const drawer = await openDrawer();
    expect(within(drawer).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    for (const [name, href] of items) expect(within(drawer).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of foreign) expect(within(drawer).queryByRole('link', { name })).not.toBeInTheDocument();
    for (const other of ['Nastavení', 'Pacienti', 'Kluby a týmy']) {
      if (other !== title) expect(within(drawer).queryByRole('link', { name: other })).not.toBeInTheDocument();
    }
  });

  it('phone (390): the Více sheet holds the way back, the title and only this section', async () => {
    renderShell(start, VIEWPORTS.phone);
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    expect(within(sheet).getByRole('link', { name: /Všechny sekce/ })).toHaveAttribute('href', '/prehled');
    expect(within(sheet).getByRole('heading', { name: title })).toBeInTheDocument();
    for (const [name, href] of items) expect(within(sheet).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of foreign) expect(within(sheet).queryByRole('link', { name })).not.toBeInTheDocument();
  });
});

describe('Přehled is the home: the icons lead to every area, none is open', () => {
  it.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet]] as const)('%s', async (_name, width) => {
    renderShell('/prehled', width);
    const rail = screen.getByRole('navigation', { name: 'Hlavní navigace' });
    for (const name of ['Kalendář', 'Pacienti', 'Kluby', 'Fakturace', 'Nastavení']) {
      expect(within(rail).getByRole('link', { name })).toBeInTheDocument();
    }
    /* Přehled is the logo, and on Přehled it is not a link. */
    expect(within(rail).queryByRole('link', { name: 'SportMedical — přehled' })).not.toBeInTheDocument();
    const drawer = await openDrawer();
    expect(within(drawer).queryByRole('link', { name: 'Všechny sekce' })).not.toBeInTheDocument();
  });

  it('desktop: an icon leads to its area, and "Všechny sekce" in the drawer leads home', async () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Hlavní navigace' })).getByRole('link', { name: 'Kluby' }));
    expect(path()).toBe('/clubs');
    const drawer = await openDrawer();
    expect(within(drawer).getByTestId('section-title')).toHaveTextContent('Kluby a týmy');
    await userEvent.click(within(drawer).getByRole('link', { name: 'Všechny sekce' }));
    expect(path()).toBe('/prehled');
  });
});
