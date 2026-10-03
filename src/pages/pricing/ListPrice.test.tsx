/*
 * The optional crossed-out list price on the staff price list: shown beside the
 * price in all three layouts, validated in front (must exceed the price; empty =
 * none), sent as a number or as an explicit null, and a server refusal shows at
 * the field.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { validateService, toRequest, draftFrom } from './serviceForm';

const m = vi.hoisted(() => ({ getAll: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('../../api/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/services')>();
  return { ...actual, servicesApi: { getAll: m.getAll, update: m.update, create: m.create, archive: vi.fn() } };
});
vi.mock('../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } };
});
vi.mock('../../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../../api/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/documents')>();
  return { ...actual, documentsApi: { ...actual.documentsApi, getTemplates: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }), put: vi.fn() } };
});

const { default: Cenik } = await import('../Cenik');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p-1', code: 'ZP', name: 'Balíček', description: '', durationMinutes: 30, priceCzk: 1200, listPriceCzk: 1500, isActive: true, ...over,
});

const renderCenik = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Cenik /></QueryClientProvider>,
);

beforeEach(() => {
  m.getAll.mockReset().mockResolvedValue([row()]);
  m.update.mockReset().mockResolvedValue(row());
  m.create.mockReset().mockResolvedValue(row());
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
});
afterEach(() => localStorage.clear());

const LABEL = /Původní \(přeškrtnutá\) cena/;

describe.each(Object.entries(VIEWPORTS))('list price at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the crossed-out price next to the price when set, and nothing when not', async () => {
    m.getAll.mockResolvedValue([row(), row({ id: 'p-2', code: 'X', name: 'Bez původní', listPriceCzk: null })]);
    renderCenik();
    await screen.findAllByText('Balíček');
    const crossed = screen.getAllByTestId('list-price');
    expect(crossed).toHaveLength(1);
    expect(crossed[0].textContent).toMatch(/^1\s500\sKč$/);
    expect(crossed[0].tagName).toBe('S');
  });

  it('refuses a list price that is not above the price, and sends nothing', async () => {
    renderCenik();
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit položku Balíček' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Nechte prázdné, pokud nemá být/)).toBeInTheDocument();
    const field = within(dialog).getByLabelText(LABEL);
    await userEvent.clear(field);
    await userEvent.type(field, '1200');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Původní cena musí být vyšší než cena.')).toBeInTheDocument();
    expect(m.update).not.toHaveBeenCalled();
  });

  it('sends the number when set and an explicit null when cleared', async () => {
    renderCenik();
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit položku Balíček' }));
    let dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByLabelText(LABEL);
    expect(field).toHaveValue('1500');
    await userEvent.clear(field);
    await userEvent.type(field, '1 800');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(1));
    expect(m.update.mock.calls[0][1]).toMatchObject({ priceCzk: 1200, listPriceCzk: 1800 });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit položku Balíček' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText(LABEL));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(2));
    expect(m.update.mock.calls[1][1].listPriceCzk).toBeNull();
  });

  it('puts a server refusal at the field', async () => {
    m.update.mockRejectedValue({ response: { status: 400, data: { message: 'Neplatné.', errors: { listPriceCzk: ['Původní cena musí být vyšší než cena (server).'] } } } });
    renderCenik();
    await userEvent.click(await screen.findByRole('button', { name: 'Upravit položku Balíček' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Původní cena musí být vyšší než cena (server).')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(LABEL)).toBeInvalid();
  });
});

describe('the rules without the screen', () => {
  const draft = (list: string) => ({ ...draftFrom(null), code: 'A', name: 'B', priceCzk: '100', listPriceCzk: list });
  it('treats empty as none and anything not above the price as an error', () => {
    expect(validateService(draft(''), [], null).listPriceCzk).toBeUndefined();
    expect(validateService(draft('100'), [], null).listPriceCzk).toBeDefined();
    expect(validateService(draft('abc'), [], null).listPriceCzk).toBeDefined();
    expect(validateService(draft('100,5'), [], null).listPriceCzk).toBeUndefined();
    expect(toRequest(draft('')).listPriceCzk).toBeNull();
    expect(toRequest(draft('150')).listPriceCzk).toBe(150);
  });
});
