/*
 * The shell at the three widths the design board calls for: which navigation
 * exists (bottom bar, rail or sidebar), and what it does.
 *
 *   390   phone    bottom bar + top bar + "Více" sheet - no sidebar
 *   834   tablet   72px rail that opens as an overlay
 *   1440  desktop  258px sidebar with text
 *
 * The invariant under all of it: one navigation at a time. No two `nav`
 * landmarks carrying the main entries, and in settings the main entries are
 * not drawn at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { buildTheme } from '../../theme';
import { ThemePrefsContext } from '../../themePrefs';

vi.mock('../../auth/accountRefresh', () => ({ useAccountRefresh: () => undefined }));
/* The chooser is another module's job; here it only has to be asked to open. */
vi.mock('../booking/NewOrderChooser', () => {
  const NewOrderChooser = ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="order-chooser"><button type="button" onClick={onClose}>zavřít výběr</button></div> : null;
  return { NewOrderChooser, default: NewOrderChooser };
});
vi.mock('../NotificationCenter', () => ({
  default: () => <button type="button" aria-label="Oznámení">zvonek</button>,
}));

const { Layout } = await import('../../App');
const { SidebarPortal, useHasSidebarSlot } = await import('./SidebarSlot');
const { OPEN_SEARCH_EVENT } = await import('../UniversalSearch');

const EVERYTHING = [
  'patients.view', 'patients.register', 'patients.edit', 'billing.manage',
  'settings.clinic.manage', 'users.manage', 'questionnaires.manage', 'communication.manage',
];

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  const inSidebar = useHasSidebarSlot();
  return (
    <div>
      <output data-testid="path">{location.pathname}</output>
      <output data-testid="state">{JSON.stringify(location.state ?? null)}</output>
      <output data-testid="has-slot">{String(inSidebar)}</output>
      <button type="button" onClick={() => navigate('/svatky')}>jdi do nastavení</button>
      <SidebarPortal>
        <p>mini kalendář</p>
      </SidebarPortal>
    </div>
  );
}

function renderShell(path: string, width: number, permissions: string[] = EVERYTHING) {
  setViewport(width);
  localStorage.setItem('permissions', JSON.stringify(permissions));
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
/** The visible `nav` landmarks that carry the six main entries. */
const mainNavs = () =>
  screen.queryAllByRole('navigation').filter((n) => /^(Hlavní navigace|Sekce )/.test(n.getAttribute('aria-label') ?? '') && n.querySelector('a') !== null);

beforeEach(() => {
  localStorage.clear();
  document.title = '';
});

describe('desktop (1440): the full sidebar', () => {
  it('has the sidebar and nothing else: no rail, no bottom bar, one navigation', () => {
    renderShell('/planovani', VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="sidebar"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-shell="bottombar"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Více' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otevřít menu' })).not.toBeInTheDocument();
    expect(mainNavs()).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('is 258px wide and the content starts at 258px, as a pixel value', () => {
    renderShell('/planovani', VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="sidebar"]')).toHaveStyle({ width: '258px' });
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '258px' });
  });

  it('shows the brand, the big button and the five entries with text on the overview', () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    const nav = mainNavs()[0];
    for (const name of ['Kalendář', 'Pacienti', 'Kluby a týmy', 'Fakturace', 'Nastavení']) {
      const link = within(nav).getByRole('link', { name });
      expect(getComputedStyle(link).minHeight).toBe('44px');
    }
    /* The brand opens the staff overview. '/' is the public site now and is never a link of the staff shell. */
    expect(screen.getByRole('link', { name: 'SportMedical — přehled' })).toHaveAttribute('href', '/prehled');
    expect(screen.getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
  });

  it('has no Výsledky section anywhere in the navigation', () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    expect(screen.queryByRole('link', { name: 'Výsledky' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zranění' })).not.toBeInTheDocument();
  });

  it('inside a section the whole sidebar is that section: title, way back, its own items only', () => {
    renderShell('/planovani', VIEWPORTS.desktop);
    const nav = mainNavs()[0];
    expect(screen.getByTestId('section-title')).toHaveTextContent('Kalendář');
    expect(screen.getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    expect(within(nav).getByRole('link', { name: 'Kalendář' })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Dnešní přehled', 'Přehled podle služeb', 'Dostupnost']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    for (const name of ['Pacienti', 'Kluby a týmy', 'Fakturace', 'Nastavení', 'Nový pacient', 'Pokladna']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps the diagnostic form inside the Pacienti section', () => {
    renderShell('/diagnostics/new', VIEWPORTS.desktop);
    expect(screen.getByTestId('section-title')).toHaveTextContent('Pacienti');
  });

  it('shows a patient file\'s sections under Pacienti', () => {
    renderShell('/patients/p-1/terminy', VIEWPORTS.desktop);
    const nav = mainNavs()[0];
    expect(screen.getByTestId('section-title')).toHaveTextContent('Pacienti');
    for (const name of ['Přehled', 'Termíny', 'Faktury', 'Dokumenty', 'Historie']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Termíny' })).toHaveAttribute('href', '/patients/p-1/terminy');
    expect(within(nav).getByRole('link', { name: 'Termíny' })).toHaveAttribute('aria-current', 'page');
    /* The patient list's own screens stay above the file's sections, never lit on a file. */
    expect(within(nav).getByRole('link', { name: 'Přehled pacientů' })).not.toHaveAttribute('aria-current');
  });

  it('hides what this person may not open', () => {
    renderShell('/prehled', VIEWPORTS.desktop, []);
    const nav = mainNavs()[0];
    expect(within(nav).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Fakturace' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('has the account row: name, role, search and the bell', async () => {
    renderShell('/planovani', VIEWPORTS.desktop);
    expect(screen.getByRole('button', { name: 'Účet a vzhled' })).toHaveTextContent('Jana Nováková');
    expect(screen.getByRole('button', { name: 'Účet a vzhled' })).toHaveTextContent('Recepce');
    expect(screen.getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    const opened = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, opened);
    await userEvent.click(screen.getByRole('button', { name: 'Hledat' }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SEARCH_EVENT, opened);
  });

  it('Nová objednávka opens the chooser and does not navigate', async () => {
    renderShell('/patients', VIEWPORTS.desktop);
    expect(screen.queryByTestId('order-chooser')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    expect(path()).toBe('/patients');
    await userEvent.click(screen.getByRole('button', { name: 'zavřít výběr' }));
    expect(screen.queryByTestId('order-chooser')).not.toBeInTheDocument();
  });

  it('draws the page\'s slot content in the sidebar', () => {
    renderShell('/planovani', VIEWPORTS.desktop);
    expect(screen.getByTestId('has-slot')).toHaveTextContent('true');
    const slot = document.querySelector('[data-sidebar-slot]') as HTMLElement;
    expect(within(slot).getByText('mini kalendář')).toBeInTheDocument();
  });

  it('draws the crumb line and names the tab', () => {
    renderShell('/clubs/hraci', VIEWPORTS.desktop);
    const crumbs = screen.getByLabelText('Kde jsem');
    expect(crumbs).toHaveTextContent('Kluby a týmy');
    expect(crumbs).toHaveTextContent('Hráči');
    expect(document.title).toBe('Hráči · SportMedical');
  });
});

describe('settings replace the navigation', () => {
  it('desktop: the settings sidebar stands where the main one was, never beside it', async () => {
    renderShell('/patients', VIEWPORTS.desktop);
    expect(mainNavs()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'jdi do nastavení' }));
    expect(path()).toBe('/svatky');

    expect(mainNavs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Nová objednávka' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zpět do aplikace' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hledat v nastavení' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Nastavení — oddíly' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    /* The settings screens draw their own breadcrumb; the shell's line is not repeated. */
    expect(screen.queryByLabelText('Kde jsem')).not.toBeInTheDocument();
    expect(screen.getByTestId('has-slot')).toHaveTextContent('false');
    expect(document.title).toBe('Svátky a dovolené · SportMedical');

    await userEvent.click(screen.getByRole('link', { name: 'Zpět do aplikace' }));
    expect(path()).toBe('/patients');
    expect(mainNavs()).toHaveLength(1);
  });

  it('a /nastaveni/ address is settings too, even before the catalogue knows it', () => {
    renderShell('/nastaveni/neco-noveho', VIEWPORTS.desktop);
    expect(mainNavs()).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Zpět do aplikace' })).toHaveAttribute('href', '/prehled');
  });

  it('phone: the bottom bar stays and Více → Nastavení opens the hub', async () => {
    renderShell('/svatky', VIEWPORTS.phone);
    const bar = screen.getByRole('navigation', { name: 'Hlavní navigace' });
    expect(within(bar).getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Kde jsem')).toHaveTextContent('Nastavení');
    await userEvent.click(within(bar).getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    await userEvent.click(within(sheet).getByRole('link', { name: 'Nastavení' }));
    expect(path()).toBe('/settings');
  });

  it('tablet: the rail offers "Zpět", and its overlay holds the settings sidebar', async () => {
    renderShell('/svatky', VIEWPORTS.tablet);
    expect(mainNavs()).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Zpět do aplikace' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Nastavení — menu' });
    expect(within(overlay).getByRole('textbox', { name: 'Hledat v nastavení' })).toBeInTheDocument();
    expect(within(overlay).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
  });
});

describe('tablet (834): the rail', () => {
  it('has the rail only: icons with labels, no children, content offset by 72px', () => {
    renderShell('/prehled', VIEWPORTS.tablet);
    expect(document.querySelector('[data-shell="rail"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="sidebar"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-shell="bottombar"]')).not.toBeInTheDocument();
    expect(mainNavs()).toHaveLength(1);
    expect(document.querySelector('[data-shell="rail"]')).toHaveStyle({ width: '72px' });
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '72px' });
    const rail = mainNavs()[0];
    expect(within(rail).getByRole('link', { name: 'Kluby a týmy' })).toHaveTextContent('Kluby');
    expect(within(rail).queryByRole('link', { name: 'Dnešní přehled' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hledat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    expect(screen.getByTestId('has-slot')).toHaveTextContent('false');
    expect(screen.queryByText('mini kalendář')).not.toBeInTheDocument();
  });

  it('inside a section the rail holds "Všechny sekce" and that section own screens', () => {
    renderShell('/planovani', VIEWPORTS.tablet);
    const rail = mainNavs()[0];
    expect(within(rail).getByRole('link', { name: 'Všechny sekce' })).toHaveAttribute('href', '/prehled');
    for (const name of ['Kalendář', 'Dnešní přehled', 'Přehled podle služeb', 'Dostupnost']) {
      expect(within(rail).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(rail).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
    expect(within(rail).queryByRole('link', { name: 'Kluby a týmy' })).not.toBeInTheDocument();
  });

  it('opens the full sidebar as an overlay: still one navigation, children shown', async () => {
    renderShell('/planovani', VIEWPORTS.tablet);
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(overlay).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    expect(within(overlay).getByRole('link', { name: 'Dnešní přehled' })).toBeInTheDocument();
    expect(mainNavs()).toHaveLength(1);
    /* The overlay does not push the content. */
    expect(screen.getByRole('main', { hidden: true })).toHaveStyle({ marginLeft: '72px' });
  });

  it('closes on navigation', async () => {
    renderShell('/planovani', VIEWPORTS.tablet);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.click(within(overlay).getByRole('link', { name: 'Dnešní přehled' }));
    expect(path()).toBe('/dnes');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
  });

  it('closes on Esc and on a tap outside it', async () => {
    renderShell('/planovani', VIEWPORTS.tablet);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    await screen.findByRole('dialog', { name: 'Menu' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root') as Element);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
    expect(path()).toBe('/planovani');
  });

  it('shows the patient file\'s sections in the overlay', async () => {
    renderShell('/patients/p-1', VIEWPORTS.tablet);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít menu' }));
    const overlay = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(overlay).getByRole('link', { name: 'Termíny' })).toHaveAttribute('href', '/patients/p-1/terminy');
  });
});

describe('phone (390): the bottom bar', () => {
  it('has the bottom bar and the top bar only: no sidebar, no rail, no content offset', () => {
    renderShell('/planovani', VIEWPORTS.phone);
    expect(document.querySelector('[data-shell="bottombar"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="topbar"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="sidebar"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otevřít menu' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(mainNavs()).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '0px' });
  });

  it('has Kalendář · Pacienti · Kluby · Fakturace and Více, every target at least 56px', () => {
    renderShell('/planovani', VIEWPORTS.phone);
    const bar = screen.getByRole('navigation', { name: 'Hlavní navigace' });
    const items = [
      ...['Kalendář', 'Pacienti', 'Kluby a týmy', 'Fakturace'].map((n) => within(bar).getByRole('link', { name: n })),
      within(bar).getByRole('button', { name: 'Více' }),
    ];
    expect(items).toHaveLength(5);
    for (const item of items) expect(getComputedStyle(item).minHeight).toBe('56px');
    expect(within(bar).getByRole('link', { name: 'Kalendář' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).queryByRole('link', { name: 'Nastavení' })).not.toBeInTheDocument();
    expect(within(bar).queryByRole('link', { name: 'Výsledky' })).not.toBeInTheDocument();
  });

  it('keeps search, the bell and the new-appointment button in the top bar', async () => {
    renderShell('/planovani', VIEWPORTS.phone);
    const top = document.querySelector('[data-shell="topbar"]') as HTMLElement;
    expect(within(top).getByRole('button', { name: 'Hledat' })).toBeInTheDocument();
    expect(within(top).getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    await userEvent.click(within(top).getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    expect(path()).toBe('/planovani');
  });

  it('shows where I am in the top bar, once', () => {
    renderShell('/clubs/hraci', VIEWPORTS.phone);
    const where = screen.getAllByLabelText('Kde jsem');
    expect(where).toHaveLength(1);
    expect(where[0].closest('[data-shell="topbar"]')).not.toBeNull();
    expect(where[0]).toHaveTextContent('Kluby a týmy');
    expect(where[0]).toHaveTextContent('Hráči');
  });

  it('inside a section the Více sheet is that section: way back, title, its own screens only', async () => {
    renderShell('/planovani', VIEWPORTS.phone);
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    expect(within(sheet).getByRole('link', { name: /Všechny sekce/ })).toHaveAttribute('href', '/prehled');
    expect(within(sheet).getByRole('heading', { name: 'Kalendář' })).toBeInTheDocument();
    for (const name of ['Dnešní přehled', 'Přehled podle služeb', 'Dostupnost']) {
      expect(within(sheet).getByRole('link', { name })).toBeInTheDocument();
    }
    for (const name of ['Nový pacient', 'Pokladna', 'Hráči', 'Nastavení']) {
      expect(within(sheet).queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('opens the Více sheet and goes where a row says, closing the sheet', async () => {
    renderShell('/prehled', VIEWPORTS.phone);
    expect(screen.queryByRole('dialog', { name: 'Více' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    expect(within(sheet).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    for (const name of ['Přehled', 'Nastavení', 'Pokladna', 'Dnešní přehled', 'Nový pacient']) {
      expect(within(sheet).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(sheet).queryByRole('link', { name: 'Výsledky' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Odhlásit se' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Tmavý režim' })).toBeInTheDocument();
    /* The sheet is not a second navigation landmark. */
    expect(mainNavs()).toHaveLength(0);

    await userEvent.click(within(sheet).getByRole('link', { name: 'Dnešní přehled' }));
    expect(path()).toBe('/dnes');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Více' })).not.toBeInTheDocument());
    expect(mainNavs()).toHaveLength(1);
  });

  it('Více → Nová objednávka opens the chooser', async () => {
    renderShell('/patients', VIEWPORTS.phone);
    await userEvent.click(screen.getByRole('button', { name: 'Více' }));
    const sheet = await screen.findByRole('dialog', { name: 'Více' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    expect(path()).toBe('/patients');
  });

  it('shows a patient file\'s sections where the page itself has them, not as a sidebar', () => {
    renderShell('/patients/p-1/vysledky', VIEWPORTS.phone);
    expect(screen.queryByRole('link', { name: 'Termíny' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Hlavní navigace' })).getByRole('link', { name: 'Pacienti' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves room for the bars and hands the slot back to the page', () => {
    renderShell('/planovani', VIEWPORTS.phone);
    expect(screen.getByTestId('has-slot')).toHaveTextContent('false');
    expect(screen.queryByText('mini kalendář')).not.toBeInTheDocument();
  });
});
