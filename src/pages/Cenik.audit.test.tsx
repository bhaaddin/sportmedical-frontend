/*
 * Settings audit (20. 10. 2026) - Ceník (/nastaveni/cenik), the screen.
 * Server facts (dev API): GET /api/services returns the ACTIVE lines only;
 * DELETE archives (the line never comes back from the list); an omitted
 * listPriceCzk on PUT keeps the stored one, null clears it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../test/auditHarness';
import { setViewport, VIEWPORTS } from '../test/viewport';

const getAll = vi.fn();
const create = vi.fn();
const update = vi.fn();
const archive = vi.fn();

vi.mock('../api/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/services')>()),
  servicesApi: { getAll, create, update, archive },
}));
vi.mock('../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } };
});
vi.mock('../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../api/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/documents')>();
  return { ...actual, documentsApi: { ...actual.documentsApi, getTemplates: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../api/serviceColors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/serviceColors')>()),
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }), put: vi.fn() },
}));

const { default: Cenik } = await import('./Cenik');

const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1', code: 'KP', name: 'Komplexní prohlídka', description: 'Vše v jednom', durationMinutes: 30, priceCzk: 1500, listPriceCzk: null, isActive: true, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  getAll.mockReset().mockResolvedValue([item(), item({ id: 'i2', code: 'DG', name: 'Diagnostika', priceCzk: 2500, listPriceCzk: 3000 })]);
  create.mockReset().mockResolvedValue(item());
  update.mockReset().mockResolvedValue(item());
  archive.mockReset().mockResolvedValue(undefined);
});

afterEach(() => localStorage.clear());

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('reading the list · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows each line with its price in Czech money format and the crossed-out list price where there is one', async () => {
    renderScreen(<Cenik />, '/nastaveni/cenik');
    expect((await screen.findAllByText('Komplexní prohlídka')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\s500\sKč/).length).toBeGreaterThan(0);
    const crossed = screen.getAllByTestId('list-price');
    expect(crossed).toHaveLength(1);
    expect(crossed[0]).toHaveTextContent(/3\s000\sKč/);
  });
});

describe('who sees what', () => {
  it('hides every editing control from somebody without settings.clinic.manage', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await screen.findAllByText('Komplexní prohlídka');
    expect(screen.queryByRole('button', { name: /Nová položka/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit položku/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vyřadit položku/ })).not.toBeInTheDocument();
  });

  it('offers them to the owner', async () => {
    renderScreen(<Cenik />, '/nastaveni/cenik');
    expect(await screen.findByRole('button', { name: /Nová položka/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upravit položku Komplexní prohlídka' })).toBeInTheDocument();
  });
});

describe('searching', () => {
  it('finds by name or by code, ignoring case', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await screen.findAllByText('Komplexní prohlídka');
    const search = screen.getByRole('textbox', { name: 'Hledat v ceníku' });
    await user.type(search, 'dg');
    expect(screen.queryByText('Komplexní prohlídka')).not.toBeInTheDocument();
    expect(screen.getAllByText('Diagnostika').length).toBeGreaterThan(0);
    await user.clear(search);
    await user.type(search, 'KOMPLEX');
    expect(screen.queryByText('Diagnostika')).not.toBeInTheDocument();
  });

  it('says nothing matches, rather than that the list is empty', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await screen.findAllByText('Komplexní prohlídka');
    await user.type(screen.getByRole('textbox', { name: 'Hledat v ceníku' }), 'zzz');
    expect(await screen.findByText('V ceníku nic takového není')).toBeInTheDocument();
  });
});

describe('an empty and a failing list', () => {
  it('invites the owner to add the first line', async () => {
    getAll.mockResolvedValue([]);
    renderScreen(<Cenik />, '/nastaveni/cenik');
    expect(await screen.findByText('Ceník je prázdný')).toBeInTheDocument();
    expect(screen.getByText(/Přidejte první položku/)).toBeInTheDocument();
  });

  it('tells somebody who cannot edit who can', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    getAll.mockResolvedValue([]);
    renderScreen(<Cenik />, '/nastaveni/cenik');
    expect(await screen.findByText(/Ceník vyplní ten, kdo smí měnit nastavení ordinace/)).toBeInTheDocument();
  });

  it('says it could not read the list and reads again on request', async () => {
    getAll.mockRejectedValueOnce(new Error('down')).mockResolvedValue([item()]);
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    expect(await screen.findByText('Ceník se nepodařilo načíst.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect((await screen.findAllByText('Komplexní prohlídka')).length).toBeGreaterThan(0);
  });
});

describe('the dialog', () => {
  it('creating sends the typed line and reads the list again', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: /Nová položka/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Kód/), 'NOVA');
    await user.type(within(dialog).getByLabelText(/^Název/), 'Nová položka');
    await user.type(within(dialog).getByLabelText(/^Cena$/), '1.250');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOVA', name: 'Nová položka', priceCzk: 1250, listPriceCzk: null }));
    await waitFor(() => expect(getAll.mock.calls.length).toBeGreaterThan(1));
  });

  it('editing sends the line back with its id and an explicit null list price when it was emptied', async () => {
    getAll.mockResolvedValue([item({ listPriceCzk: 1800 })]);
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: 'Upravit položku Komplexní prohlídka' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/^Původní/));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('i1', expect.objectContaining({ code: 'KP', priceCzk: 1500, listPriceCzk: null, isActive: true }));
  });

  it('refuses three decimals before the round trip', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: 'Upravit položku Komplexní prohlídka' }));
    const dialog = await screen.findByRole('dialog');
    const price = within(dialog).getByLabelText(/^Cena$/);
    await user.clear(price);
    await user.type(price, '1234,567');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Cena může mít nejvýše dvě desetinná místa.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Vyřadit (a one-way door)', () => {
  it('asks first, says it cannot be undone, and only then archives', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: 'Vyřadit položku Komplexní prohlídka' }));
    expect(archive).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Zpátky už se do ceníku vrátit nedá/);
    await user.click(within(dialog).getByRole('button', { name: 'Vyřadit' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith('i1'));
  });

  it('Zrušit leaves the line alone', async () => {
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: 'Vyřadit položku Diagnostika' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit' }));
    expect(archive).not.toHaveBeenCalled();
  });

  it('says it did not work when the server refuses', async () => {
    archive.mockRejectedValue(new Error('no'));
    const user = userEvent.setup();
    renderScreen(<Cenik />, '/nastaveni/cenik');
    await user.click(await screen.findByRole('button', { name: 'Vyřadit položku Diagnostika' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vyřadit' }));
    expect(await screen.findByText('Vyřazení se nepodařilo.')).toBeInTheDocument();
  });
});
