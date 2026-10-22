/*
 * The shell at the three widths the design board calls for (Stage 4, R19: the labelled sidebar is gone): which navigation
 * exists (bottom bar or the slim icon rail), what the top action bar offers, and what each does.
 *
 *   390   phone    bottom bar + top bar + "Více" sheet
 *   834   tablet   56px icon rail + the action bar; "Všechny stránky" opens the drawer
 *   1440  desktop  the same icon rail and action bar (the content takes the width the sidebar used to hold)
 *
 * The invariant under all of it: one navigation at a time. No two `nav` landmarks carrying the main entries.
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

const { Layout } = await import('../../StaffApp');
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

describe.each([['desktop (1440)', VIEWPORTS.desktop], ['tablet (834)', VIEWPORTS.tablet]] as const)('%s: the slim icon rail', (_name, width) => {
  it('has the rail only: no sidebar, no bottom bar, one navigation, 56px, the content starts at 56px as a pixel value', () => {
    renderShell('/dnes', width);
    const rail = document.querySelector('[data-shell="rail"]') as HTMLElement;
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveStyle({ width: '56px' });
    expect(document.querySelector('[data-shell="sidebar"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-shell="bottombar"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Více' })).not.toBeInTheDocument();
    expect(mainNavs()).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
  });

  it('has NO labelled sidebar: no text entries, no "Nová objednávka" / "Nový pacient" / "Rychlá registrace" among the navigation links', () => {
    renderShell('/prehled', width);
    const nav = mainNavs()[0];
    expect(within(nav).queryByText('Kluby a týmy')).not.toBeInTheDocument();
    expect(nav.textContent?.replace(/\s/g, '') ?? '').not.toMatch(/Kalendář|Pacienti|Fakturace|Nastavení/);
    for (const action of ['Nová objednávka', 'Nový pacient', 'Rychlá registrace']) {
      expect(within(nav).queryByRole('link', { name: action })).not.toBeInTheDocument();
      expect(within(nav).queryByRole('button', { name: action })).not.toBeInTheDocument();
    }
  });

  it('has the five icons and the logo, every target 44px, the brand leading to the overview', () => {
    renderShell('/prehled', width);
    const nav = mainNavs()[0];
    for (const name of ['Kalendář', 'Pacienti', 'Kluby', 'Fakturace', 'Nastavení']) {
      const link = within(nav).getByRole('link', { name });
      expect(getComputedStyle(link).width).toBe('44px');
      expect(getComputedStyle(link).height).toBe('44px');
    }
  });

  it('the logo is the way home - and not a link on the overview itself', () => {
    const { unmount } = renderShell('/dnes', width);
    /* The brand opens the staff overview. '/' is the public site now and is never a link of the staff shell. */
    expect(within(mainNavs()[0]).getByRole('link', { name: 'SportMedical — přehled' })).toHaveAttribute('href', '/prehled');
    unmount();
    renderShell('/prehled', width);
    const here = within(mainNavs()[0]).getByRole('link', { name: 'SportMedical — přehled (tady jste)' });
    expect(here).toHaveAttribute('aria-current', 'page');
    expect(here).toHaveAttribute('aria-disabled', 'true');
    expect(here).not.toHaveAttribute('href');
  });

  it('has no Výsledky section anywhere in the navigation', async () => {
    renderShell('/prehled', width);
    expect(screen.queryByRole('link', { name: 'Výsledky' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    expect(screen.queryByRole('link', { name: 'Zranění' })).not.toBeInTheDocument();
  });

  it('keeps the diagnostic form inside the Pacienti area', async () => {
    renderShell('/diagnostics/new', width);
    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    expect(within(await screen.findByRole('dialog', { name: 'Menu' })).getByTestId('section-title')).toHaveTextContent('Pacienti');
  });

  it("shows a patient file's sections under Pacienti in the drawer", async () => {
    renderShell('/patients/p-1/terminy', width);
    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByTestId('section-title')).toHaveTextContent('Pacienti');
    for (const name of ['Přehled', 'Termíny', 'Faktury', 'Dokumenty', 'Historie']) {
      expect(within(drawer).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(drawer).getByRole('link', { name: 'Termíny' })).toHaveAttribute('href', '/patients/p-1/terminy');
    expect(within(drawer).getByRole('link', { name: 'Termíny' })).toHaveAttribute('aria-current', 'page');
    /* The patient list's own screens stay above the file's sections, never lit on a file. */
    expect(within(drawer).getByRole('link', { name: 'Přehled pacientů' })).not.toHaveAttribute('aria-current');
  });

  it('hides what this person may not open', () => {
    renderShell('/prehled', width, []);
    const nav = mainNavs()[0];
    expect(within(nav).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Fakturace' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Kalendář' })).toBeInTheDocument();
  });

  it('has the account and the bell at the foot of the rail, the search in the action bar', async () => {
    renderShell('/dnes', width);
    const nav = mainNavs()[0];
    expect(within(nav).getByRole('button', { name: 'Účet a vzhled' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: /^Hledat/ })).not.toBeInTheDocument();
    const opened = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, opened);
    const actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    await userEvent.click(within(actions).getByRole('button', { name: /^Hledat/ }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SEARCH_EVENT, opened);
  });

  it('Nová objednávka (top action bar) opens the chooser and does not navigate', async () => {
    renderShell('/patients', width);
    expect(screen.queryByTestId('order-chooser')).not.toBeInTheDocument();
    const actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    await userEvent.click(within(actions).getByRole('button', { name: 'Nová objednávka' }));
    expect(screen.getByTestId('order-chooser')).toBeInTheDocument();
    expect(path()).toBe('/patients');
    await userEvent.click(screen.getByRole('button', { name: 'zavřít výběr' }));
    expect(screen.queryByTestId('order-chooser')).not.toBeInTheDocument();
  });

  it('draws no sidebar slot: a page draws its own content (there is no sidebar to portal into)', () => {
    renderShell('/dnes', width);
    expect(screen.getByTestId('has-slot')).toHaveTextContent('false');
    expect(document.querySelector('[data-sidebar-slot]')).not.toBeInTheDocument();
    expect(screen.queryByText('mini kalendář')).not.toBeInTheDocument();
  });

  it('draws the crumb line and names the tab', () => {
    renderShell('/clubs/hraci', width);
    const crumbs = screen.getByLabelText('Kde jsem');
    expect(crumbs).toHaveTextContent('Kluby a týmy');
    expect(crumbs).toHaveTextContent('Hráči');
    expect(document.title).toBe('Hráči · SportMedical');
  });

  it('names the registration page: Pacienti › Nový pacient', () => {
    renderShell('/patients/register', width);
    expect(screen.getByLabelText('Kde jsem')).toHaveTextContent('Nový pacient');
    expect(document.title).toBe('Nový pacient · SportMedical');
  });
});

describe('the top action bar', () => {
  it('desktop: Hledat, Nový pacient, Rychlá registrace and Nová objednávka, 44px each, in the where-am-I row', () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    const actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    expect(screen.getByLabelText('Kde jsem')).toContainElement(actions);
    expect(within(actions).getByRole('button', { name: 'Hledat' })).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    expect(within(actions).getByRole('link', { name: 'Nový pacient' })).toHaveAttribute('href', '/patients/register');
    expect(within(actions).getByRole('link', { name: 'Rychlá registrace' })).toHaveAttribute('href', '/patients/register?mode=quick');
    expect(within(actions).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    for (const item of [...within(actions).getAllByRole('button'), ...within(actions).getAllByRole('link')]) {
      expect(getComputedStyle(item).minHeight).toBe('44px');
    }
  });

  it('tablet: the first three are icon buttons with an accessible name', () => {
    renderShell('/prehled', VIEWPORTS.tablet);
    const actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    expect(within(actions).getByRole('button', { name: /^Hledat/ })).toBeInTheDocument();
    expect(within(actions).getByRole('link', { name: 'Nový pacient' })).toBeInTheDocument();
    expect(within(actions).getByRole('link', { name: 'Rychlá registrace' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    expect(within(actions).queryByText('Nový pacient')).not.toBeInTheDocument();
  });

  it('does not offer Nový pacient where the screen owns it (Pacienti, the registration page)', () => {
    const { unmount } = renderShell('/patients', VIEWPORTS.desktop);
    let actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    expect(within(actions).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
    expect(within(actions).getByRole('link', { name: 'Rychlá registrace' })).toBeInTheDocument();
    unmount();
    renderShell('/patients/register', VIEWPORTS.desktop);
    actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    expect(within(actions).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
  });

  it('hides the registrations from someone who may not register patients', () => {
    renderShell('/prehled', VIEWPORTS.desktop, ['patients.view']);
    const actions = document.querySelector('[data-shell="actions"]') as HTMLElement;
    expect(within(actions).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('link', { name: 'Rychlá registrace' })).not.toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
  });

  it('is not drawn on a phone (its top bar has them) nor in settings', () => {
    const { unmount } = renderShell('/prehled', VIEWPORTS.phone);
    expect(document.querySelector('[data-shell="actions"]')).not.toBeInTheDocument();
    unmount();
    renderShell('/svatky', VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="actions"]')).not.toBeInTheDocument();
  });
});

describe('settings: the rail stays, the settings list stands beside it', () => {
  it('desktop: Nastavení is lit in the rail, the settings groups stand beside it, never a second main navigation', async () => {
    renderShell('/patients', VIEWPORTS.desktop);
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
    await userEvent.click(screen.getByRole('button', { name: 'jdi do nastavení' }));
    expect(path()).toBe('/svatky');

    expect(mainNavs()).toHaveLength(1);
    const rail = mainNavs()[0];
    expect(within(rail).getByRole('link', { name: 'Nastavení' })).not.toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Nová objednávka' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zpět do aplikace' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hledat v nastavení' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Nastavení — oddíly' })).toBeInTheDocument();
    expect(document.querySelector('[data-shell="settings-side"]')).toBeInTheDocument();
    /* The rail and the settings groups: 56 + 258. */
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '314px' });
    /* The settings screens draw their own breadcrumb; the shell's line is not repeated. */
    expect(screen.queryByLabelText('Kde jsem')).not.toBeInTheDocument();
    expect(screen.getByTestId('has-slot')).toHaveTextContent('false');
    expect(document.title).toBe('Svátky a dovolené · SportMedical');

    await userEvent.click(screen.getByRole('link', { name: 'Zpět do aplikace' }));
    expect(path()).toBe('/patients');
    expect(document.querySelector('[data-shell="settings-side"]')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
  });

  it('a /nastaveni/ address is settings too, even before the catalogue knows it', () => {
    renderShell('/nastaveni/neco-noveho', VIEWPORTS.desktop);
    expect(document.querySelector('[data-shell="settings-side"]')).toBeInTheDocument();
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

  it('tablet: the rail stays (no settings panel beside it) and its drawer holds the settings list', async () => {
    renderShell('/svatky', VIEWPORTS.tablet);
    expect(document.querySelector('[data-shell="settings-side"]')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ marginLeft: '56px' });
    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    const overlay = await screen.findByRole('dialog', { name: 'Nastavení — menu' });
    expect(within(overlay).getByRole('link', { name: 'Zpět do aplikace' })).toBeInTheDocument();
    expect(within(overlay).getByRole('textbox', { name: 'Hledat v nastavení' })).toBeInTheDocument();
    expect(within(overlay).queryByRole('link', { name: 'Pacienti' })).not.toBeInTheDocument();
  });
});

describe('the drawer behind "Všechny stránky"', () => {
  it('opens on a click, closes on navigation, on Esc and on a tap outside', async () => {
    renderShell('/clubs', VIEWPORTS.tablet);
    const button = screen.getByRole('button', { name: 'Všechny stránky' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    let drawer = await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.click(within(drawer).getByRole('link', { name: 'Hráči' }));
    expect(path()).toBe('/clubs/hraci');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    await screen.findByRole('dialog', { name: 'Menu' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    drawer = await screen.findByRole('dialog', { name: 'Menu' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root') as Element);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
  });

  it('carries the same icons as the rail on its entries', async () => {
    renderShell('/prehled', VIEWPORTS.desktop);
    await userEvent.click(screen.getByRole('button', { name: 'Všechny stránky' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    for (const name of ['Kalendář', 'Pacienti', 'Kluby a týmy', 'Fakturace', 'Nastavení']) {
      expect(within(drawer).getByRole('link', { name }).querySelector('svg')).not.toBeNull();
    }
  });
});

describe('phone (390): the bottom bar', () => {
  it('has the bottom bar and the top bar only: no rail, no content offset', () => {
    renderShell('/planovani', VIEWPORTS.phone);
    expect(document.querySelector('[data-shell="bottombar"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="topbar"]')).toBeInTheDocument();
    expect(document.querySelector('[data-shell="rail"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Všechny stránky' })).not.toBeInTheDocument();
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
    for (const name of ['Přehled', 'Nastavení', 'Pokladna', 'Dnešní přehled']) {
      expect(within(sheet).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(sheet).queryByRole('link', { name: 'Výsledky' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'Nový pacient' })).not.toBeInTheDocument();
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
