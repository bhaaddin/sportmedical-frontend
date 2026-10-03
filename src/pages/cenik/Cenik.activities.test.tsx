/*
 * Ceník: the činnosti under each price-list row and what the clinic decides per
 * činnost - the documents it asks for (default none), its colour (its own, or
 * the shade of its služba) and how many it serves at once - in the three
 * layouts, with validation and the whole činnost sent back untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { BookingApiError } from '../../api/apiError';

const m = vi.hoisted(() => ({
  getAll: vi.fn(), listActivities: vi.fn(), updateActivity: vi.fn(), listClinicServices: vi.fn(), getTemplates: vi.fn(), getPalette: vi.fn(),
}));

vi.mock('../../api/services', () => ({ servicesApi: { getAll: m.getAll, archive: vi.fn() } }));
vi.mock('../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: m.listActivities, update: m.updateActivity } };
});
vi.mock('../../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: m.listClinicServices } };
});
vi.mock('../../api/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/documents')>();
  return { ...actual, documentsApi: { ...actual.documentsApi, getTemplates: m.getTemplates } };
});
vi.mock('../../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { get: m.getPalette, put: vi.fn() } };
});

const { default: Cenik } = await import('../Cenik');

const ITEMS = [
  { id: 'p-1', code: 'ZP', name: 'Základní prohlídka', description: 'Krátký popis', durationMinutes: 30, priceCzk: 1200, isActive: true },
  { id: 'p-2', code: 'SP', name: 'Spiroergometrie', description: '', durationMinutes: 60, priceCzk: 2400, isActive: true },
];
const SERVICES = [{ id: 's-1', name: 'Prohlídky', description: '', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' }];
const activity = (over: Record<string, unknown>) => ({
  name: 'x', slug: 'x', durationMinutes: 30, color: '#111111', publicNote: 'Poznámka', isPubliclyBookable: true, requiresReportByEmail: true,
  requiresClubSharing: false, questionnaireRequirement: 'Required', sortOrder: 1, isActive: true, serviceItemId: 'p-1', clinicServiceId: 's-1',
  questionnaireDefinitionId: 'q-1', colorHex: null, effectiveColorHex: '#3E7D74', parallelCapacity: 1, requiredDocumentTemplateIds: [], ...over,
});
const ACTIVITIES = {
  activities: [
    activity({ id: 'a-1', name: 'Základní' }),
    activity({ id: 'a-2', name: 'Komplexní', sortOrder: 2, colorHex: '#AA5500', effectiveColorHex: '#AA5500', parallelCapacity: 3, requiredDocumentTemplateIds: ['t-1'] }),
    activity({ id: 'a-3', name: 'Spiro činnost', serviceItemId: 'p-2', effectiveColorHex: '#556677' }),
    activity({ id: 'a-4', name: 'Vypnutá činnost', isActive: false }),
  ],
  warnings: [],
};
const TEMPLATES = [
  { id: 't-1', name: 'Výpis ze zdravotní dokumentace', type: 'Vypis', version: 1, fileUrl: '', description: '', isActive: true },
  { id: 't-2', name: 'Informovaný souhlas klubu', type: 'InformovanySouhlas', version: 1, fileUrl: '', description: '', isActive: true },
  { id: 't-3', name: 'Vyřazená šablona', type: 'Podminky', version: 1, fileUrl: '', description: '', isActive: false },
];
const PALETTE = ['#0D5C52', '#2B3440', '#8A5A2F', '#27603A', '#9B3B1B', '#4A5564'];

const renderCenik = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Cenik />
    </QueryClientProvider>,
  );

const asOwner = () => localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  asOwner();
  m.getAll.mockReset().mockResolvedValue(ITEMS);
  m.listActivities.mockReset().mockResolvedValue(ACTIVITIES);
  m.updateActivity.mockReset().mockResolvedValue({ activity: ACTIVITIES.activities[0], warnings: [] });
  m.listClinicServices.mockReset().mockResolvedValue(SERVICES);
  m.getTemplates.mockReset().mockResolvedValue(TEMPLATES);
  m.getPalette.mockReset().mockResolvedValue({ palette: PALETTE });
});

afterEach(() => localStorage.clear());

describe.each(Object.entries(VIEWPORTS))('Ceník at %s (%i px)', (name, width) => {
  beforeEach(() => setViewport(width));

  it('draws the price list in this device\'s layout, with each činnost under its row', async () => {
    const { container } = renderCenik();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ceník' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Upravit činnost Základní' })).toBeInTheDocument();

    const layout = name === 'phone' ? 'cards' : name === 'tablet' ? 'table-3' : 'table';
    expect(container.querySelector(`[data-layout="${layout}"]`)).not.toBeNull();
    for (const other of ['cards', 'table-3', 'table'].filter((l) => l !== layout)) {
      expect(container.querySelector(`[data-layout="${other}"]`)).toBeNull();
    }

    // the činnosti stand under the row they are billed by, and only the active ones
    expect(screen.getByRole('button', { name: 'Upravit činnost Komplexní' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upravit činnost Spiro činnost' })).toBeInTheDocument();
    expect(screen.queryByText('Vypnutá činnost')).not.toBeInTheDocument();

    // the row carries the colour of its služba; each činnost its own or its shade
    expect(screen.getByRole('img', { name: 'Barva položky Základní prohlídka: #0D5C52' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Barva činnosti Základní: #3E7D74' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Barva činnosti Komplexní: #AA5500' })).toBeInTheDocument();
    expect(screen.getAllByText(/1\s200\sKč/).length).toBeGreaterThan(0);
  });

  it('keeps every action a 44 px target', async () => {
    renderCenik();
    for (const label of ['Upravit činnost Základní', 'Upravit položku Základní prohlídka', 'Vyřadit položku Základní prohlídka']) {
      const button = await screen.findByRole('button', { name: label });
      expect(parseFloat(getComputedStyle(button).minHeight || '0')).toBeGreaterThanOrEqual(44);
    }
    expect(parseFloat(getComputedStyle(screen.getByRole('button', { name: 'Nová položka' })).minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('opens the činnost dialog (full screen on a phone) with its three settings and a help sentence for each', async () => {
    const user = userEvent.setup();
    renderCenik();
    await user.click(await screen.findByRole('button', { name: 'Upravit činnost Komplexní' }));
    const dialog = await screen.findByRole('dialog', { name: 'Činnost: Komplexní' });
    expect(within(dialog).getByRole('group', { name: 'Požadované dokumenty' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Barva činnosti' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Souběžně obslouženo')).toHaveValue('3');
    expect(within(dialog).getByText(/Kolik lidí nebo stanovišť zvládne tuto činnost naráz/)).toBeInTheDocument();
    expect(within(dialog).getByText(/zákonné souhlasy .* se vyžadují vždy/)).toBeInTheDocument();
    expect(dialog.classList.contains('MuiDialog-paperFullScreen')).toBe(name === 'phone');
  });
});

describe('Ceník - činnosti', () => {
  it('shows what each činnost asks for: documents (none by default) and how many it serves at once', async () => {
    renderCenik();
    await screen.findByRole('button', { name: 'Upravit činnost Základní' });
    expect(screen.getAllByText('bez dokumentů').length).toBeGreaterThan(0);
    expect(screen.getByText(/1\sdokument$/)).toBeInTheDocument();
    expect(screen.getByText(/Souběžně\s3×/)).toBeInTheDocument();
  });

  it('is read-only for somebody who may not change the settings: the činnosti show, no way to edit them', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderCenik();
    expect(await screen.findByText('Základní')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit činnost/ })).not.toBeInTheDocument();
    expect(m.getTemplates).not.toHaveBeenCalled();
  });

  it('sends the chosen documents, colour and capacity - and the rest of the činnost exactly as it was', async () => {
    const user = userEvent.setup();
    renderCenik();
    await user.click(await screen.findByRole('button', { name: 'Upravit činnost Základní' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Uložit činnost' })).toBeDisabled();

    // only active templates are offered, none ticked by default
    const docs = within(dialog).getByRole('group', { name: 'Požadované dokumenty' });
    expect(within(docs).queryByText('Vyřazená šablona')).not.toBeInTheDocument();
    expect(within(docs).getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    await user.click(within(docs).getByRole('checkbox', { name: 'Výpis ze zdravotní dokumentace' }));
    await user.click(within(docs).getByRole('checkbox', { name: 'Informovaný souhlas klubu' }));

    await user.click(await within(dialog).findByRole('button', { name: 'Barva #8A5A2F' }));
    const capacity = within(dialog).getByLabelText('Souběžně obslouženo');
    await user.clear(capacity);
    await user.type(capacity, '2');

    await user.click(within(dialog).getByRole('button', { name: 'Uložit činnost' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledTimes(1));
    const [id, body] = m.updateActivity.mock.calls[0];
    expect(id).toBe('a-1');
    expect(body).toMatchObject({
      requiredDocumentTemplateIds: ['t-1', 't-2'], colorHex: '#8A5A2F', parallelCapacity: 2,
      // untouched: a PUT is the whole činnost
      name: 'Základní', durationMinutes: 30, publicNote: 'Poznámka', requiresReportByEmail: true, questionnaireRequirement: 'Required',
      serviceItemId: 'p-1', clinicServiceId: 's-1', questionnaireDefinitionId: 'q-1', isPubliclyBookable: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clears the own colour with "Použít odstín služby"', async () => {
    const user = userEvent.setup();
    renderCenik();
    await user.click(await screen.findByRole('button', { name: 'Upravit činnost Komplexní' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Vlastní barva')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Použít odstín služby' }));
    expect(within(dialog).getByText('Odstín služby')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit činnost' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledTimes(1));
    expect(m.updateActivity.mock.calls[0][1]).toMatchObject({ colorHex: null, parallelCapacity: 3, requiredDocumentTemplateIds: ['t-1'] });
  });

  it('refuses a capacity under 1 or a non-number before the request', async () => {
    const user = userEvent.setup();
    renderCenik();
    await user.click(await screen.findByRole('button', { name: 'Upravit činnost Základní' }));
    const dialog = await screen.findByRole('dialog');
    const capacity = within(dialog).getByLabelText('Souběžně obslouženo');
    await user.clear(capacity);
    await user.type(capacity, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit činnost' }));
    expect(await within(dialog).findByText('Souběžně obslouženo je celé číslo od 1.')).toBeInTheDocument();
    await user.clear(capacity);
    await user.type(capacity, 'dvě');
    expect(within(dialog).getByText('Souběžně obslouženo je celé číslo od 1.')).toBeInTheDocument();
    expect(m.updateActivity).not.toHaveBeenCalled();
  });

  it('shows the server\'s own sentence when the činnost is refused, and keeps the dialog open', async () => {
    const user = userEvent.setup();
    m.updateActivity.mockRejectedValue(new BookingApiError('validation', 400, 'Činnost s tímto názvem už existuje.'));
    renderCenik();
    await user.click(await screen.findByRole('button', { name: 'Upravit činnost Základní' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Barva #9B3B1B' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit činnost' }));
    expect(await within(dialog).findByText('Činnost s tímto názvem už existuje.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps showing the price list and says so when the činnosti cannot be loaded', async () => {
    const user = userEvent.setup();
    m.listActivities.mockRejectedValueOnce(new AxiosError('x'));
    renderCenik();
    expect(await screen.findByText('Činnosti se nepodařilo načíst, pod položkami zatím chybí.')).toBeInTheDocument();
    expect((await screen.findAllByText('Základní prohlídka')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('button', { name: 'Upravit činnost Základní' })).toBeInTheDocument();
  });

  it('says a položka has no činnost yet instead of showing an empty gap', async () => {
    m.listActivities.mockResolvedValue({ activities: [], warnings: [] });
    renderCenik();
    expect((await screen.findAllByText('Zatím žádná činnost se podle této položky neúčtuje.')).length).toBe(2);
  });
});
