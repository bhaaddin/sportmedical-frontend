/*
 * Settings audit (20. 10. 2026) - Služby (/nastaveni/sluzby), the dialog.
 *
 * Server facts (dev API, /api/clinic-services):
 *   name over 100, description over 500, sortOrder -1, an empty name -> 422 (scheduling.text.too_long / sort_order_negative / calendar.name_required)
 *   a duplicate name -> 409 { code: "service.duplicate" }
 *   a PUT without colorHex KEEPS the colour; a colour sent in lower case comes back upper case
 *   a new service without a colour gets the next one of the palette.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { refused, renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listServices = vi.fn();
const createService = vi.fn();
const updateService = vi.fn();
const removeService = vi.fn();
const activateService = vi.fn();

vi.mock('../../api/clinicServices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/clinicServices')>()),
  clinicServicesApi: { list: listServices, create: createService, update: updateService, remove: removeService, activate: activateService, deactivate: vi.fn(), removePermanently: vi.fn() },
}));
vi.mock('../../api/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/activities')>()),
  activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }), update: vi.fn(), create: vi.fn(), remove: vi.fn(), restore: vi.fn(), removePermanently: vi.fn() },
}));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]), update: vi.fn() } }));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const service = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Sportovní lékařské prohlídky', description: 'Prohlídky pro sportovce', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52', ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  listServices.mockReset().mockResolvedValue([service(), service({ id: 's2', name: 'Diagnostika', sortOrder: 2, colorHex: '#2563EB' }), service({ id: 's3', name: 'Stará služba', sortOrder: 3, isActive: false })]);
  createService.mockReset().mockResolvedValue(service({ id: 'new' }));
  updateService.mockReset().mockResolvedValue(service());
  removeService.mockReset().mockResolvedValue(undefined);
  activateService.mockReset().mockResolvedValue(undefined);
});

const open = async (name: RegExp | string = 'Upravit službu Sportovní lékařské prohlídky') => {
  const user = userEvent.setup();
  renderScreen(<ClinicServicesPage />, '/nastaveni/sluzby');
  await user.click(await screen.findByRole('button', { name }));
  return { user, dialog: await screen.findByRole('dialog') };
};

describe('the list', () => {
  it('shows the active services in order and the archived ones apart', async () => {
    renderScreen(<ClinicServicesPage />, '/nastaveni/sluzby');
    await screen.findByText('Sportovní lékařské prohlídky');
    expect(screen.getByText('Diagnostika')).toBeInTheDocument();
    expect(screen.getByText(/Archivované \(1\)/)).toBeInTheDocument();
  });

  it('a click on a service opens it at its own address', async () => {
    const user = userEvent.setup();
    renderScreen(<Routes><Route path="/nastaveni/sluzby/:serviceId?" element={<ClinicServicesPage />} /></Routes>, '/nastaveni/sluzby');
    await user.click(await screen.findByRole('button', { name: 'Otevřít službu Diagnostika' }));
    expect(await screen.findByRole('tablist', { name: 'Části služby' })).toBeInTheDocument();
  });

  it('archiving asks first and then calls the archive route, not a delete', async () => {
    const user = userEvent.setup();
    renderScreen(<ClinicServicesPage />, '/nastaveni/sluzby');
    await user.click(await screen.findByRole('button', { name: 'Archivovat službu Diagnostika' }));
    expect(removeService).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Existující termíny, objednávky a historie zůstanou/);
    await user.click(within(dialog).getByRole('button', { name: 'Archivovat' }));
    await waitFor(() => expect(removeService).toHaveBeenCalledWith('s2'));
  });

  it('restoring an archived service calls activate', async () => {
    const user = userEvent.setup();
    renderScreen(<ClinicServicesPage />, '/nastaveni/sluzby');
    await screen.findByText('Sportovní lékařské prohlídky');
    await user.click(screen.getByText(/Archivované \(1\)/));
    await user.click(await screen.findByRole('button', { name: 'Obnovit službu Stará služba' }));
    await waitFor(() => expect(activateService).toHaveBeenCalledWith('s3'));
  });
});

describe('editing a service', () => {
  it('loads the stored name, description and order', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveValue('Sportovní lékařské prohlídky');
    expect(within(dialog).getByLabelText('Popis')).toHaveValue('Prohlídky pro sportovce');
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(1);
  });

  it('sends name, description and order - and no colour, which the server then keeps', async () => {
    const { user, dialog } = await open();
    const name = within(dialog).getByLabelText(/^Název/);
    await user.clear(name);
    await user.type(name, '  Prohlídky  ');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    expect(updateService).toHaveBeenCalledWith('s1', { name: 'Prohlídky', description: 'Prohlídky pro sportovce', sortOrder: 1 });
  });

  it('stops the typing at the 100 and 500 characters the server keeps', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveAttribute('maxlength', '100');
    expect(within(dialog).getByLabelText('Popis')).toHaveAttribute('maxlength', '500');
  });

  it('keeps Uložit off for a name of spaces and for a negative order', async () => {
    const { user, dialog } = await open();
    const name = within(dialog).getByLabelText(/^Název/);
    await user.clear(name);
    await user.type(name, '   ');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.type(name, 'x');
    fireEvent.change(within(dialog).getByLabelText('Pořadí'), { target: { value: '-3' } });
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(within(dialog).getByText('Pořadí musí být celé číslo od 0.')).toBeInTheDocument();
  });

  it('pins the duplicate-name refusal to the name box', async () => {
    const { toNamedError } = await vi.importActual<typeof import('../../api/duplicateName')>('../../api/duplicateName');
    updateService.mockRejectedValue(toNamedError(refused(409, { code: 'service.duplicate', message: 'Služba s tímto názvem už existuje.' })));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Služba s tímto názvem už existuje.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    updateService.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, dialog } = await open();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(updateService).toHaveBeenCalledTimes(1);
    finish(service());
  });
});

describe('a new service', () => {
  it('opens empty, after the active ones in order, and sends what was typed (the server picks its colour)', async () => {
    const { user, dialog } = await open('Nová služba');
    expect(within(dialog).getByLabelText(/^Název/)).toHaveValue('');
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(2);
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Název/), 'Fyzioterapie');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createService).toHaveBeenCalled());
    expect(createService).toHaveBeenCalledWith({ name: 'Fyzioterapie', description: '', sortOrder: 2 });
    expect(updateService).not.toHaveBeenCalled();
  });
});

describe('who may do what', () => {
  it('somebody without settings.clinic.manage cannot delete a duplicate (the route is guarded and the button says why)', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    listServices.mockResolvedValue([service(), service({ id: 'dup', name: 'sportovní lékařské prohlídky' })]);
    renderScreen(<ClinicServicesPage />, '/nastaveni/sluzby');
    await screen.findAllByText(/Sportovní lékařské prohlídky/i);
    const buttons = screen.getAllByRole('button', { name: /Smazat službu/ });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toBeDisabled();
  });
});
