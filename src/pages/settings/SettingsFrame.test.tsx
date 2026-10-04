/*
 * The frame of a settings item: breadcrumb, title, one sentence, Zahodit ·
 * Uložit, the related card and "Poslední změny" - at 390, 834 and 1440.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsNav, SettingsScreen } from './SettingsFrame';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

const OWNER = ['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage'];

beforeEach(() => {
  get.mockReset();
  get.mockRejectedValue({ response: { status: 404 } });
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(OWNER));
});

const renderFrame = (props: Partial<React.ComponentProps<typeof SettingsScreen>> = {}, path = '/working-hours') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsScreen title="Otevírací doba" subtitle="Kdy se v ordinaci pracuje." {...props}>
        <div>obsah stránky</div>
      </SettingsScreen>
    </MemoryRouter>,
  );

describe.each(Object.entries(VIEWPORTS))('the frame at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('has the breadcrumb Nastavení / Skupina / Položka, the title and the sentence', () => {
    renderFrame();

    const crumbs = screen.getByRole('navigation', { name: 'Kde jste' });
    expect(crumbs).toHaveTextContent('Nastavení/Provoz/Otevírací doba');
    expect(screen.getByRole('link', { name: 'Nastavení' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Provoz' })).toHaveAttribute('href', '/settings/provoz');
    expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('Otevírací doba');
    expect(screen.getByRole('heading', { level: 1, name: 'Otevírací doba' })).toBeInTheDocument();
    expect(screen.getByText('Kdy se v ordinaci pracuje.')).toBeInTheDocument();
    expect(screen.getByText('obsah stránky')).toBeInTheDocument();
  });

  it('lists the other settings of the group as "Související nastavení", never the page itself', () => {
    renderFrame();

    const related = screen.getByRole('region', { name: 'Související nastavení' });
    expect(related).toHaveTextContent('Pauzy a přestávky');
    expect(related).toHaveTextContent('Svátky a dovolené');
    expect(related).not.toHaveTextContent('Otevírací doba');
  });

  it('offers Uložit only while there is a change, and Zahodit undoes it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = renderFrame({ save: { dirty: false, onSave, onDiscard } });
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();

    rerender(
      <MemoryRouter initialEntries={['/working-hours']}>
        <SettingsScreen title="Otevírací doba" save={{ dirty: true, onSave, onDiscard }}>x</SettingsScreen>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('shows "Poslední změny" for the page\'s scope, and none of it on a 404', async () => {
    renderFrame();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/settings/changes', { params: { scope: 'pracovni-doba', take: 5 } }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Poslední změny' })).not.toBeInTheDocument());

    get.mockResolvedValue({ data: { items: [{ at: '2026-10-03T10:00:00Z', user: 'Jana', scope: 'pracovni-doba', label: 'Úterý do', before: '17:00', after: '18:00' }], total: 1 } });
    renderFrame();
    expect(await screen.findByText(/Úterý do: 17:00 → 18:00/)).toBeInTheDocument();
  });
});

describe('the frame, in particular', () => {
  it('pins Uložit to the bottom on a phone and keeps it in the header elsewhere', () => {
    setViewport(VIEWPORTS.phone);
    const { container, unmount } = renderFrame({ save: { dirty: true, onSave: () => {}, onDiscard: () => {} } });
    const bar = screen.getByRole('button', { name: 'Uložit' }).parentElement as HTMLElement;
    expect(bar).toHaveStyle({ position: 'sticky' });
    expect(container.querySelector('h1')?.parentElement?.parentElement).not.toContainElement(screen.getByRole('button', { name: 'Uložit' }));
    unmount();

    setViewport(VIEWPORTS.desktop);
    const second = renderFrame({ save: { dirty: true, onSave: () => {}, onDiscard: () => {} } });
    const header = second.container.querySelector('h1')?.parentElement?.parentElement as HTMLElement;
    expect(header).toContainElement(screen.getByRole('button', { name: 'Uložit' }));
  });

  it('puts a preview in a right-hand card and takes the column away when asked', () => {
    setViewport(VIEWPORTS.desktop);
    const { unmount } = renderFrame({ aside: <p>přepočet objednávky</p>, asideTitle: 'Náhled' });
    expect(screen.getByRole('region', { name: 'Náhled' })).toHaveTextContent('přepočet objednávky');
    unmount();

    renderFrame({ aside: false, related: false });
    expect(screen.queryByRole('region', { name: 'Náhled' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Související nastavení' })).not.toBeInTheDocument();
  });

  it('hides a related item the person has no permission for - never a dead link', () => {
    localStorage.setItem('permissions', JSON.stringify(['communication.manage']));
    renderFrame({}, '/nastaveni/sablony-emailu');
    const related = screen.queryByRole('region', { name: 'Související nastavení' });
    /* Pripominky and the rest of Komunikace need settings.clinic.manage; Hodnocení needs nothing. */
    expect(related).toHaveTextContent('Hodnocení pacientů');
    expect(related).not.toHaveTextContent('Připomínky');
  });

  it('works outside a router: header and content, no breadcrumb, no panel', () => {
    render(<SettingsScreen title="Sám" subtitle="bez routeru">obsah</SettingsScreen>);
    expect(screen.getByRole('heading', { level: 1, name: 'Sám' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Kde jste' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the old call (title, subtitle, actions, width) working', () => {
    renderFrame({ actions: <button>Nová položka</button>, width: 720 });
    expect(screen.getByRole('button', { name: 'Nová položka' })).toBeInTheDocument();
  });
});

describe('SettingsNav', () => {
  const renderNav = (path: string, props: React.ComponentProps<typeof SettingsNav> = {}) =>
    render(<MemoryRouter initialEntries={[path]}><SettingsNav {...props} /></MemoryRouter>);

  it('makes each group heading a disclosure button: the current group open, the others closed', async () => {
    renderNav('/working-hours');
    expect(screen.getByRole('button', { name: 'Provoz' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Systém' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Systém' }));
    expect(screen.getByRole('button', { name: 'Systém' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the compact (phone) nav as links to the group pages', () => {
    render(<MemoryRouter initialEntries={['/settings']}><SettingsNav compact /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Systém' })).toHaveAttribute('href', '/settings/system');
  });

  it('marks the item you are on', () => {
    renderNav('/working-hours');
    expect(screen.getByRole('link', { name: 'Otevírací doba' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Svátky a dovolené' })).not.toHaveAttribute('aria-current');
  });

  it('keeps its props: a shared query narrows it, plain and compact still draw', async () => {
    const onQueryChange = vi.fn();
    const { rerender } = renderNav('/settings', { query: 'sleva', onQueryChange, plain: true });
    expect(screen.getByRole('link', { name: 'Slevy a cenové hladiny' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();

    rerender(<MemoryRouter initialEntries={['/settings']}><SettingsNav compact /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Otevírací doba' })).toBeInTheDocument();

    await userEvent.setup().type(screen.getByLabelText('Hledat v nastavení'), 'x');
    expect(screen.getByLabelText('Hledat v nastavení')).toHaveValue('x');
  });
});
