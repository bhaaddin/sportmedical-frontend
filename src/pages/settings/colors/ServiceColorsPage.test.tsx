/*
 * Barvy služeb (/nastaveni/barvy-sluzeb): the palette editor, the colour of each
 * služba and the shades of its činnosti - in the three layouts, with validation,
 * with what is saved at once and what waits for Uložit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import ServiceColorsPage from '../ServiceColorsPage';
import { hasPaletteErrors, normalizeHex, toRows, validatePalette } from './colorLogic';

const m = vi.hoisted(() => ({
  getPalette: vi.fn(), putPalette: vi.fn(), listServices: vi.fn(), updateService: vi.fn(), listActivities: vi.fn(), updateActivity: vi.fn(),
}));

vi.mock('../../../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { get: m.getPalette, put: m.putPalette } };
});
vi.mock('../../../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: m.listServices, update: m.updateService } };
});
vi.mock('../../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: m.listActivities, update: m.updateActivity } };
});
vi.mock('../../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const PALETTE = ['#0D5C52', '#2B3440', '#8A5A2F', '#27603A', '#9B3B1B', '#4A5564'];
const SERVICES = [
  { id: 's-1', name: 'Prohlídky', description: 'Popis', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' },
  { id: 's-2', name: 'Diagnostika', description: '', sortOrder: 2, isActive: true, activities: 1, calendars: 1, colorHex: '#2B3440' },
];
const activity = (over: Record<string, unknown>) => ({
  name: 'x', slug: 'x', durationMinutes: 30, color: '#111111', publicNote: '', isPubliclyBookable: true, requiresReportByEmail: false,
  requiresClubSharing: false, questionnaireRequirement: 'NotAsked', sortOrder: 1, isActive: true, serviceItemId: 'p-1', clinicServiceId: 's-1',
  questionnaireDefinitionId: null, colorHex: null, effectiveColorHex: '#3E7D74', parallelCapacity: 2, requiredDocumentTemplateIds: ['t-1'], ...over,
});
const ACTIVITIES = {
  activities: [
    activity({ id: 'a-1', name: 'Základní', sortOrder: 1 }),
    activity({ id: 'a-2', name: 'Komplexní', sortOrder: 2, colorHex: '#AA5500', effectiveColorHex: '#AA5500' }),
    activity({ id: 'a-3', name: 'Spiro', sortOrder: 1, clinicServiceId: 's-2', effectiveColorHex: '#556677' }),
  ],
  warnings: [],
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/barvy-sluzeb']}>
        <ServiceColorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  m.getPalette.mockReset().mockResolvedValue({ palette: PALETTE });
  m.putPalette.mockReset().mockImplementation(async (s) => s);
  m.listServices.mockReset().mockResolvedValue(SERVICES);
  m.updateService.mockReset().mockResolvedValue(SERVICES[0]);
  m.listActivities.mockReset().mockResolvedValue(ACTIVITIES);
  m.updateActivity.mockReset().mockResolvedValue({ activity: ACTIVITIES.activities[0], warnings: [] });
});

describe.each(Object.entries(VIEWPORTS))('Barvy služeb at %s (%i px)', (name, width) => {
  beforeEach(() => setViewport(width));

  it('draws the palette, the služby and the legend preview in this device\'s layout', async () => {
    const { container } = renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: 'Paleta' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Barvy palety' }).children).toHaveLength(6);
    expect(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Náhled legendy' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Uložit' })).toHaveLength(1);

    const layout = name === 'phone' ? 'cards' : name === 'tablet' ? 'table-3' : 'table';
    expect(container.querySelector(`[data-layout="${layout}"]`)).not.toBeNull();
    for (const other of ['cards', 'table-3', 'table'].filter((l) => l !== layout)) {
      expect(container.querySelector(`[data-layout="${other}"]`)).toBeNull();
    }

    const legend = screen.getByRole('list', { name: 'Legenda služeb' });
    expect(within(legend).getByText('Prohlídky')).toBeInTheDocument();
    expect(within(legend).getByText('Spiro')).toBeInTheDocument();
  });
});

describe('ServiceColorsPage', () => {
  it('shows the činnosti in their shades and marks the one with a colour of its own', async () => {
    renderPage();
    const own = await screen.findByRole('button', { name: 'Změnit barvu činnosti Komplexní' });
    expect(within(own).getByText('vlastní')).toBeInTheDocument();
    expect(within(await screen.findByRole('button', { name: 'Změnit barvu činnosti Základní' })).queryByText('vlastní')).not.toBeInTheDocument();
    const dot = (await screen.findByRole('button', { name: 'Změnit barvu činnosti Základní' })).querySelector('span[aria-hidden]') as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: '#3E7D74' });
  });

  it('says that a new služba is coloured automatically', async () => {
    renderPage();
    expect(await screen.findByText(/nová služba dostane barvu automaticky/i)).toBeInTheDocument();
  });

  it('keeps Uložit off until the palette changes; a text that is no colour is refused before the request', async () => {
    const user = userEvent.setup();
    renderPage();
    const first = await screen.findByLabelText('Barva 1 jako text');
    expect(first).toHaveValue('#0D5C52');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.clear(first);
    await user.type(first, '#12');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Zadejte barvu jako #RRGGBB, např. #0D5C52.')).toBeInTheDocument();
    expect(m.putPalette).not.toHaveBeenCalled();
  });

  it('does not let the palette drop under six colours, and saves a seventh in capitals', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Barva 1 jako text');
    expect(screen.getByRole('button', { name: 'Odebrat barvu 1' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Přidat barvu' }));
    expect(screen.getByRole('button', { name: 'Odebrat barvu 1' })).toBeEnabled();
    await user.type(screen.getByLabelText('Barva 7 jako text'), '1a2b3c');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.putPalette).toHaveBeenCalledWith({ palette: [...PALETTE, '#1A2B3C'] }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
  });

  it('refuses a colour that is already in the palette', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Barva 1 jako text');
    await user.click(screen.getByRole('button', { name: 'Přidat barvu' }));
    await user.type(screen.getByLabelText('Barva 7 jako text'), '#0d5c52');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Tuto barvu paleta už má.')).toBeInTheDocument();
    expect(m.putPalette).not.toHaveBeenCalled();
  });

  it('shows the server\'s sentence when the palette is refused', async () => {
    const user = userEvent.setup();
    m.putPalette.mockRejectedValue(refused(400, { message: 'Paleta se nedá uložit.', errors: { palette: ['Barva #12 je neplatná.'] } }));
    renderPage();
    await screen.findByLabelText('Barva 1 jako text');
    await user.click(screen.getByRole('button', { name: 'Přidat barvu' }));
    await user.type(screen.getByLabelText('Barva 7 jako text'), '#ABCDEF');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Paleta se nedá uložit\./)).toHaveTextContent('Barva #12 je neplatná.');
  });

  it('saves a služba at once when a palette colour is picked for it', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' }));
    await user.click(await screen.findByRole('button', { name: 'Barva #8A5A2F' }));
    await waitFor(() => expect(m.updateService).toHaveBeenCalledWith('s-1', { name: 'Prohlídky', description: 'Popis', sortOrder: 1, colorHex: '#8A5A2F' }));
  });

  it('gives a činnost its own colour without losing anything else about it', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu činnosti Základní' }));
    expect(screen.queryByRole('button', { name: 'Použít odstín služby' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Barva #9B3B1B' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledTimes(1));
    const [id, body] = m.updateActivity.mock.calls[0];
    expect(id).toBe('a-1');
    expect(body).toMatchObject({
      name: 'Základní', durationMinutes: 30, serviceItemId: 'p-1', clinicServiceId: 's-1', colorHex: '#9B3B1B',
      parallelCapacity: 2, requiredDocumentTemplateIds: ['t-1'], questionnaireRequirement: 'NotAsked',
    });
  });

  it('takes the own colour back with "Použít odstín služby"', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu činnosti Komplexní' }));
    await user.click(screen.getByRole('button', { name: 'Použít odstín služby' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledTimes(1));
    expect(m.updateActivity.mock.calls[0][0]).toBe('a-2');
    expect(m.updateActivity.mock.calls[0][1]).toMatchObject({ colorHex: null, parallelCapacity: 2 });
  });

  it('keeps the frame and offers Zkusit znovu when the palette does not load', async () => {
    const user = userEvent.setup();
    m.getPalette.mockRejectedValueOnce(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Paletu barev se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Barvy služeb' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Barva 1 jako text')).toHaveValue('#0D5C52');
  });

  it('says what failed and retries when the služby do not load, while the palette stays editable', async () => {
    const user = userEvent.setup();
    m.listServices.mockRejectedValueOnce(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Služby a činnosti se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByLabelText('Barva 1 jako text')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' })).toBeInTheDocument();
  });
});

describe('colorLogic', () => {
  it('reads colours in either case with or without the hash', () => {
    expect(normalizeHex('0d5c52')).toBe('#0D5C52');
    expect(normalizeHex(' #abcdef ')).toBe('#ABCDEF');
    expect(normalizeHex('#12')).toBe('#12');
  });

  it('wants six colours, each valid and different', () => {
    expect(hasPaletteErrors(validatePalette(toRows(PALETTE)))).toBe(false);
    expect(validatePalette(toRows(PALETTE.slice(0, 5))).general).toMatch(/aspoň 6 barev/);
    const dup = validatePalette(toRows([...PALETTE, '#0d5c52']));
    expect(Object.values(dup.rows)).toEqual(['Tuto barvu paleta už má.']);
    expect(Object.values(validatePalette(toRows([...PALETTE, 'red'])).rows)).toEqual(['Zadejte barvu jako #RRGGBB, např. #0D5C52.']);
  });
});
