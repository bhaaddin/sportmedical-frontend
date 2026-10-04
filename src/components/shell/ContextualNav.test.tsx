/*
 * D10: the sidebar reacts to where you are, the settings groups fold, and every
 * "Nová objednávka" opens the chooser. Rendered through the real Layout at the
 * three widths (390 / 834 / 1440), like Shell.test.tsx.
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

const { Layout } = await import('../../App');

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
const mainNav = () =>
  screen.getAllByRole('navigation').filter((n) => /^(Hlavní navigace|Sekce )/.test(n.getAttribute('aria-label') ?? ''))[0];

beforeEach(() => {
  localStorage.clear();
});

describe('contextual sidebar (1440)', () => {
  it('shows only the children of the entry you are in', () => {
    renderShell('/clubs/hraci', VIEWPORTS.desktop);
    const nav = mainNav();
    for (const name of ['Přehled klubů', 'Objednávky klubů', 'Rezervace', 'Hráči', 'Statistiky', 'Fakturace']) {
      expect(within(nav).getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    expect(within(nav).queryByRole('link', { name: 'Dnešní přehled' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Hráči' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Přehled klubů' })).not.toHaveAttribute('aria-current');
  });

  it('lights the club overview on a club page', () => {
    renderShell('/clubs/some-club-id', VIEWPORTS.desktop);
    expect(within(mainNav()).getByRole('link', { name: 'Přehled klubů' })).toHaveAttribute('aria-current', 'page');
  });

  it('Pacienti: overview, new patient, registration check', () => {
    renderShell('/patients', VIEWPORTS.desktop);
    const nav = mainNav();
    expect(within(nav).getByRole('link', { name: 'Přehled pacientů' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Nový pacient' })).toHaveAttribute('href', '/patients/register');
    expect(within(nav).getByRole('link', { name: 'Kontrola registrací' })).toHaveAttribute('href', '/intake-review');
    expect(within(nav).queryByRole('link', { name: 'Objednávky klubů' })).not.toBeInTheDocument();
  });

  it('Kalendář: the club-order shortcut opens the calendar with a marker and is never current', async () => {
    renderShell('/dnes', VIEWPORTS.desktop);
    expect(within(mainNav()).getByRole('link', { name: 'Dnešní přehled' })).toHaveAttribute('aria-current', 'page');
    const shortcut = within(mainNav()).getByRole('link', { name: 'Klubová objednávka' });
    expect(shortcut).not.toHaveAttribute('aria-current');
    await userEvent.click(shortcut);
    expect(path()).toBe('/planovani');
    expect(JSON.parse(screen.getByTestId('state').textContent ?? 'null')).toEqual({ openClubOrder: true });
    expect(within(mainNav()).getByRole('link', { name: 'Kalendář' })).toHaveAttribute('aria-current', 'page');
    expect(within(mainNav()).getByRole('link', { name: 'Klubová objednávka' })).not.toHaveAttribute('aria-current');
  });

  it('draws no children of other areas on a plain page', () => {
    renderShell('/billing', VIEWPORTS.desktop);
    expect(screen.queryByRole('link', { name: 'Hráči' })).not.toBeInTheDocument();
  });
});

describe('contextual navigation (834 / 390)', () => {
  it('tablet: rail button and overlay open the chooser; the overlay shows the active entry children', async () => {
    renderShell('/clubs', VIEWPORTS.tablet);
    await userEvent.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'zavřít výběr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(overlay).getByRole('link', { name: 'Objednávky klubů' })).toHaveAttribute('href', '/clubs/objednavky');
    expect(within(overlay).queryByRole('link', { name: 'Dnešní přehled' })).not.toBeInTheDocument();
    await userEvent.click(within(overlay).getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
  });

  it('phone: Kluby leads to /clubs and its children are in the Více sheet', async () => {
    renderShell('/clubs/hraci', VIEWPORTS.phone);
    const bar = screen.getByRole('navigation', { name: 'Hlavní navigace' });
    expect(within(bar).getByRole('link', { name: 'Kluby a týmy' })).toHaveAttribute('href', '/clubs');
    expect(within(bar).getByRole('link', { name: 'Kluby a týmy' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    for (const [name, href] of [['Objednávky klubů', '/clubs/objednavky'], ['Rezervace', '/clubs/rezervace'], ['Hráči', '/clubs/hraci']]) {
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
 * Choosing a section replaces the WHOLE navigation with that section's own
 * items - at every width - with a way back to all sections and the title.
 */
const SECTIONS: Array<{ path: string; title: string; items: Array<[string, string]>; foreign: string[] }> = [
  {
    path: '/planovani',
    title: 'Kalendář',
    items: [['Kalendář', '/planovani'], ['Dnešní přehled', '/dnes'], ['Přehled podle služeb', '/prehled-sluzeb'], ['Dostupnost', '/availability'], ['Klubová objednávka', '/planovani']],
    foreign: ['Nový pacient', 'Objednávky klubů', 'Pokladna'],
  },
  {
    path: '/patients',
    title: 'Pacienti',
    items: [['Přehled pacientů', '/patients'], ['Nový pacient', '/patients/register'], ['Kontrola registrací', '/intake-review']],
    foreign: ['Dnešní přehled', 'Objednávky klubů', 'Pokladna'],
  },
  {
    path: '/clubs',
    title: 'Kluby a týmy',
    items: [['Přehled klubů', '/clubs'], ['Objednávky klubů', '/clubs/objednavky'], ['Rezervace', '/clubs/rezervace'], ['Hráči', '/clubs/hraci'], ['Statistiky', '/clubs/statistiky'], ['Fakturace', '/clubs/fakturace']],
    foreign: ['Dnešní přehled', 'Nový pacient', 'Pokladna'],
  },
  {
    path: '/billing',
    title: 'Fakturace',
    items: [['Faktury', '/billing'], ['Pokladna', '/cashier'], ['Účetní export', '/accounting-export']],
    foreign: ['Dnešní přehled', 'Nový pacient', 'Objednávky klubů'],
  },
];

describe.each(SECTIONS)('section $title replaces the whole navigation', ({ path: start, title, items, foreign }) => {
  it('desktop (1440): title, way back, own items, nothing of the others', () => {
    renderShell(start, VIEWPORTS.desktop);
    expect(screen.getByTestId('section-title')).toHaveTextContent(title);
    expect(screen.getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    const nav = mainNav();
    for (const [name, href] of items) expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of foreign) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    for (const other of ['Nastavení', 'Pacienti', 'Kluby a týmy']) {
      if (other !== title) expect(screen.queryByRole('link', { name: other })).not.toBeInTheDocument();
    }
  });

  it('tablet (834): the rail and the overlay both hold only this section', async () => {
    renderShell(start, VIEWPORTS.tablet);
    const rail = mainNav();
    expect(within(rail).getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    for (const [name, href] of items) expect(within(rail).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of foreign) expect(within(rail).queryByRole('link', { name })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(overlay).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(overlay).getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    for (const [name, href] of items) expect(within(overlay).getByRole('link', { name })).toHaveAttribute('href', href);
    for (const name of foreign) expect(within(overlay).queryByRole('link', { name })).not.toBeInTheDocument();
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

describe('Přehled is the home: every section is one tap away, none is open', () => {
  it.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet]] as const)('%s', (_name, width) => {
    renderShell('/prehled', width);
    const nav = mainNav();
    for (const name of ['Kalendář', 'Pacienti', 'Kluby a týmy', 'Fakturace', 'Nastavení']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Všechny sekce' })).not.toBeInTheDocument();
  });

  it('desktop: every entry leads to its section and the sidebar changes', async () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    await userEvent.click(within(mainNav()).getByRole('link', { name: 'Kluby a týmy' }));
    expect(path()).toBe('/clubs');
    expect(screen.getByTestId('section-title')).toHaveTextContent('Kluby a týmy');
    await userEvent.click(screen.getByRole('link', { name: 'Všechny sekce' }));
    expect(path()).toBe('/prehled');
    expect(screen.queryByTestId('section-title')).not.toBeInTheDocument();
  });
});
