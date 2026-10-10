/*
 * Firma a faktury (/nastaveni/firma-a-faktury): the invoice header's data - in
 * three layouts, with the checks that matter (IČO, PSČ, IBAN checksum), the
 * header preview with its QR note, the save payload and the failed load.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import CompanyInvoiceSettingsPage, { ibanFromBankAccount, isValidBankAccount, isValidIban, validateCompany } from './CompanyInvoiceSettingsPage';

const { get, put, lookup } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), lookup: vi.fn() }));

vi.mock('../../api/companySettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/companySettings')>();
  return { ...actual, companySettingsApi: { get, put } };
});
vi.mock('../../api/ares', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/ares')>();
  return { ...actual, aresApi: { lookup } };
});
const { AresError } = await import('../../api/ares');
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const SAVED = {
  legalName: 'SportMedical Diagnostics s.r.o.', ico: '23351632', dic: '', address: 'Krátká 283', city: 'Tursko', postalCode: '252 65',
  bankAccount: '', iban: '', dataBox: '', phone: '+420 606 785 271', email: 'recepce@example.cz', invoiceDueDays: 14,
};
/* The textbook example account and its IBAN. */
const ACCOUNT = '19-2000145399/0800';
const IBAN = 'CZ65 0800 0000 1920 0014 5399';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/firma-a-faktury']}>
        <CompanyInvoiceSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);
const replace = async (user: ReturnType<typeof userEvent.setup>, label: string, text: string) => {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (text !== '') await user.type(field, text);
};

/* What the registry says about the clinic's own IČO - another name and seat, so the overwrite is visible. */
const ARES_SUBJECT = {
  ico: SAVED.ico, name: 'SportMedical Diagnostics, s. r. o.', dic: 'CZ23351632', legalForm: 's.r.o.', street: 'Krátká 283/1', city: 'Tursko',
  postalCode: '252 65', countryCode: 'CZ', established: '2023-01-01', dissolved: null, isActive: true, fetchedAtUtc: '2026-10-10T08:00:00Z', management: [],
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue(SAVED);
  put.mockReset().mockImplementation(async (s) => s);
  lookup.mockReset().mockResolvedValue(ARES_SUBJECT);
});

describe.each(Object.entries(VIEWPORTS))('Firma a faktury at %s (%i px)', (name, width) => {
  beforeEach(() => setViewport(width));

  it('shows every field, the header preview and the QR note; the save bar is pinned only on a phone', async () => {
    renderPage();
    expect(await screen.findByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics s.r.o.');
    for (const label of ['IČO', 'DIČ', 'Ulice a číslo', 'Obec', 'PSČ', 'Telefon', 'E-mail', 'Datová schránka', 'Bankovní účet', 'IBAN', 'Splatnost faktur']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    const preview = screen.getByRole('region', { name: 'Náhled hlavičky faktury' });
    expect(preview).toHaveTextContent('SportMedical Diagnostics s.r.o.');
    expect(preview).toHaveTextContent('252 65 Tursko');
    expect(preview).toHaveTextContent('IČO 23351632');
    expect(preview).toHaveTextContent('QR platba se na PDF faktury objeví jen tehdy, když je vyplněný bankovní účet.');

    const save = screen.getAllByRole('button', { name: 'Uložit' });
    expect(save).toHaveLength(1);
    expect(getComputedStyle(save[0].parentElement as HTMLElement).position === 'sticky').toBe(name === 'phone');
  });
});

describe('CompanyInvoiceSettingsPage', () => {
  it('says the QR payment is off until a bank account is set, and on afterwards', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Bankovní účet');
    const preview = screen.getByRole('region', { name: 'Náhled hlavičky faktury' });
    expect(preview).toHaveTextContent('QR platba se nezobrazí');
    await user.type(screen.getByLabelText('Bankovní účet'), ACCOUNT);
    expect(preview).toHaveTextContent('QR platba na faktuře');
    expect(preview).toHaveTextContent(`Účet ${ACCOUNT}`);
  });

  it('works the IBAN out of the account number', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Bankovní účet');
    expect(screen.getByRole('button', { name: 'Spočítat IBAN z čísla účtu' })).toBeDisabled();
    await user.type(screen.getByLabelText('Bankovní účet'), ACCOUNT);
    await user.click(screen.getByRole('button', { name: 'Spočítat IBAN z čísla účtu' }));
    expect(screen.getByLabelText('IBAN')).toHaveValue(IBAN);
  });

  it('refuses a short IČO, a bad PSČ, a wrong IBAN checksum, a bad e-mail and a zero due time, without a request', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    await replace(user, 'IČO', '1234567');
    await replace(user, 'PSČ', '123');
    await replace(user, 'IBAN', 'CZ65 0800 0000 1920 0014 5398');
    await replace(user, 'E-mail', 'bez-zavináče');
    await replace(user, 'Splatnost faktur', '0');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('IČO má osm číslic.')).toBeInTheDocument();
    expect(screen.getByText('PSČ má pět číslic, např. 252 65.')).toBeInTheDocument();
    expect(screen.getByText('IBAN nemá správný kontrolní součet. Zkontrolujte ho.')).toBeInTheDocument();
    expect(screen.getByText('E-mail nemá správný tvar.')).toBeInTheDocument();
    expect(screen.getByText('Splatnost je celý počet dní od 1 do 365.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('saves the data cleaned: IČO without spaces, PSČ spaced, IBAN in capitals without spaces', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    await replace(user, 'PSČ', '14000');
    await replace(user, 'Bankovní účet', ACCOUNT);
    await replace(user, 'IBAN', IBAN.toLowerCase());
    await replace(user, 'DIČ', 'cz 23351632');
    await replace(user, 'Splatnost faktur', '21');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith({
      ...SAVED, postalCode: '140 00', bankAccount: ACCOUNT, iban: 'CZ6508000000192000145399', dic: 'CZ23351632', invoiceDueDays: 21,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
  });

  it('keeps Uložit off until something changes and Zahodit restores', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Obec');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await replace(user, 'Obec', 'Praha');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByLabelText('Obec')).toHaveValue('Tursko');
  });

  it('puts the server\'s sentence under the field it names', async () => {
    const user = userEvent.setup();
    put.mockRejectedValue(refused(400, { message: 'Údaje se nepodařilo uložit.', errors: { ico: ['IČO není v registru.'] } }));
    renderPage();
    await screen.findByLabelText('Obec');
    await replace(user, 'Obec', 'Praha');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('IČO není v registru.')).toBeInTheDocument();
    expect(screen.getByText('Údaje se nepodařilo uložit.')).toBeInTheDocument();
  });

  it('keeps the frame and offers Zkusit znovu when the load fails', async () => {
    const user = userEvent.setup();
    get.mockRejectedValueOnce(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Údaje o firmě se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Firma a faktury' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics s.r.o.');
  });

  it('shows empty fields as empty - nothing is invented for what the server could not find', async () => {
    get.mockResolvedValue({ ...SAVED, dic: '', dataBox: '', bankAccount: '', iban: '' });
    renderPage();
    expect(await screen.findByLabelText('Datová schránka')).toHaveValue('');
    expect(screen.getByLabelText('DIČ')).toHaveValue('');
    expect(screen.getByLabelText('IBAN')).toHaveValue('');
  });
});

describe.each(Object.entries(VIEWPORTS))('Firma a faktury + ARES at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('fills name, DIČ and the seat from ARES at the button, says what it overwrote and gives it back on Vrátit', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    const button = screen.getByRole('button', { name: 'Načíst z ARES' });
    expect(button).toBeEnabled();
    expect(getComputedStyle(button).minHeight).toBe('44px');

    await user.click(button);
    await waitFor(() => expect(lookup).toHaveBeenCalledWith(SAVED.ico));
    await waitFor(() => expect(screen.getByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics, s. r. o.'));
    expect(screen.getByLabelText('DIČ')).toHaveValue('CZ23351632');
    expect(screen.getByLabelText('Ulice a číslo')).toHaveValue('Krátká 283/1');
    expect(screen.getByLabelText('Obec')).toHaveValue('Tursko');
    expect(screen.getByLabelText('PSČ')).toHaveValue('252 65');
    expect(screen.getByRole('status')).toHaveTextContent('Načteno z ARES 10. 10. 2026 · SportMedical Diagnostics, s. r. o.');
    /* Phone, e-mail, bank and due days are not the registry's. */
    expect(screen.getByLabelText('Telefon')).toHaveValue(SAVED.phone);
    expect(screen.getByLabelText('Splatnost faktur')).toHaveValue('14');

    /* Name and street changed; DIČ was empty, Obec and PSČ were the same: two captions. */
    expect(screen.getAllByText('Přepsáno z ARES')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();

    const nameCell = screen.getByLabelText('Obchodní název').closest('div.MuiBox-root') as HTMLElement;
    await user.click(within(nameCell).getByRole('button', { name: 'Vrátit' }));
    expect(screen.getByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics s.r.o.');
    expect(screen.getAllByText('Přepsáno z ARES')).toHaveLength(1);
  });
});

describe('Firma a faktury + ARES', () => {
  it('asks once when a new valid IČO loses focus, not for the saved one', async () => {
    const user = userEvent.setup();
    renderPage();
    const ico = await screen.findByLabelText('IČO');
    await user.click(ico);
    await user.click(screen.getByLabelText('DIČ'));
    await new Promise((r) => setTimeout(r, 400));
    expect(lookup).not.toHaveBeenCalled();

    await replace(user, 'IČO', '25596641');
    await user.click(screen.getByLabelText('DIČ'));
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
    expect(lookup).toHaveBeenCalledWith('25596641');
  });

  it('shows the server\'s sentence on a refusal and changes nothing', async () => {
    lookup.mockRejectedValue(new AresError('ares.not_found', 'Subjekt s tímto IČO v ARES není.', 404));
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    await user.click(screen.getByRole('button', { name: 'Načíst z ARES' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Subjekt s tímto IČO v ARES není.');
    expect(screen.getByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics s.r.o.');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('warns about a dissolved subject', async () => {
    lookup.mockResolvedValue({ ...ARES_SUBJECT, isActive: false, dissolved: '2025-01-01' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    await user.click(screen.getByRole('button', { name: 'Načíst z ARES' }));
    expect(await screen.findByText('Subjekt je zaniklý')).toBeInTheDocument();
  });

  it('Zahodit after a fill restores the saved data and clears the captions', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('IČO');
    await user.click(screen.getByRole('button', { name: 'Načíst z ARES' }));
    await waitFor(() => expect(screen.getAllByText('Přepsáno z ARES')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByLabelText('Obchodní název')).toHaveValue('SportMedical Diagnostics s.r.o.');
    expect(screen.queryByText('Přepsáno z ARES')).not.toBeInTheDocument();
  });
});

describe('company checks', () => {
  it('knows a real IBAN from a mistyped one', () => {
    expect(isValidIban(IBAN)).toBe(true);
    expect(isValidIban(IBAN.replace(/\s/g, '').toLowerCase())).toBe(true);
    expect(isValidIban('CZ65 0800 0000 1920 0014 5398')).toBe(false);
    expect(isValidIban('nesmysl')).toBe(false);
  });

  it('derives the Czech IBAN, with and without a prefix', () => {
    expect(ibanFromBankAccount(ACCOUNT)).toBe('CZ6508000000192000145399');
    expect(isValidIban(ibanFromBankAccount('123456789/0800') as string)).toBe(true);
    expect(ibanFromBankAccount('nesmysl')).toBeNull();
    expect(isValidBankAccount(ACCOUNT)).toBe(true);
    expect(isValidBankAccount('123/12')).toBe(false);
  });

  it('accepts the clinic\'s own data as it stands', () => {
    expect(validateCompany({ ...SAVED, invoiceDueDays: '14' })).toEqual({});
  });
});
