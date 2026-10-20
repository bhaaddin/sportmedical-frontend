/*
 * Souhlasy a GDPR and Údaje pacienta: what the form shows, what is saved and what is read back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { readConsent, saveConsent, readFields, saveFields, clientGet, clientPut } = vi.hoisted(() => {
  const readFields = vi.fn();
  const saveFields = vi.fn();
  return {
    readConsent: vi.fn(), saveConsent: vi.fn(), readFields, saveFields,
    /* usePatientFields() reads through its own module's function, so the HTTP client is what is mocked. */
    clientGet: vi.fn((url: string) => (url.includes('patient-fields') ? readFields().then((data: unknown) => ({ data })) : Promise.reject(new Error(url)))),
    clientPut: vi.fn((_url: string, body: { visible: string[] }) => saveFields(body.visible).then((data: unknown) => ({ data }))),
  };
});
vi.mock('../../api/client', () => ({ client: { get: clientGet, put: clientPut }, default: { get: clientGet, put: clientPut } }));
vi.mock('../../api/consentSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/consentSettings')>();
  return { ...actual, readConsentSettings: readConsent, saveConsentSettings: saveConsent };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

import ConsentSettingsPage from './ConsentSettingsPage';
import PatientFieldsPage from './PatientFieldsPage';

const refused = (data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status: 400, data } as never);
const wrap = (node: React.ReactNode, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const CONSENT = { communicationVisible: true, communicationTitle: 'Novinky a nabídky', communicationDetail: 'Souhlasím se zasíláním novinek.' };

describe('Souhlasy a GDPR', () => {
  beforeEach(() => {
    setViewport(VIEWPORTS.desktop);
    readConsent.mockReset().mockResolvedValue(CONSENT);
    saveConsent.mockReset().mockImplementation(async (s: typeof CONSENT) => s);
  });
  const render_ = () => wrap(<ConsentSettingsPage />, '/nastaveni/souhlasy');
  const save = () => screen.getByRole('button', { name: 'Uložit' });

  it('shows the stored switch and wording, and the same wording as the patient sees it', async () => {
    render_();
    expect(await screen.findByLabelText('Nadpis')).toHaveValue('Novinky a nabídky');
    expect(screen.getByLabelText('Text souhlasu')).toHaveValue('Souhlasím se zasíláním novinek.');
    expect(screen.getByRole('switch', { name: 'Zobrazit marketingový souhlas na formuláři' })).toBeChecked();
    const preview = screen.getByRole('region', { name: 'Tak to uvidí pacient' });
    expect(preview).toHaveTextContent('Novinky a nabídky');
    expect(preview).toHaveTextContent('Souhlasím se zasíláním novinek.');
  });

  it('follows the typing in the preview', async () => {
    const user = userEvent.setup();
    render_();
    const title = await screen.findByLabelText('Nadpis');
    await user.clear(title);
    await user.type(title, 'Nabídky');
    expect(screen.getByRole('region', { name: 'Tak to uvidí pacient' })).toHaveTextContent('Nabídky');
  });

  it('keeps Uložit off until something differs from the stored values, even after a change is undone', async () => {
    const user = userEvent.setup();
    render_();
    const title = await screen.findByLabelText('Nadpis');
    expect(save()).toBeDisabled();
    await user.type(title, '!');
    expect(save()).toBeEnabled();
    await user.type(title, '{Backspace}');
    expect(save()).toBeDisabled();
  });

  it('switching the consent off disables the wording fields and says nothing is shown, while the law\'s consents stay', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(await screen.findByRole('switch', { name: 'Zobrazit marketingový souhlas na formuláři' }));
    expect(screen.getByLabelText('Nadpis')).toBeDisabled();
    expect(screen.getByLabelText('Text souhlasu')).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Tak to uvidí pacient' })).toHaveTextContent('Zákonné souhlasy zůstávají vždy zapnuté.');
  });

  it('saves the switch and both texts exactly as shown', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(await screen.findByRole('switch', { name: 'Zobrazit marketingový souhlas na formuláři' }));
    await user.click(save());
    await waitFor(() => expect(saveConsent.mock.calls[0][0]).toEqual({ ...CONSENT, communicationVisible: false }));
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
  });

  it('shows what the server stored (it trims) after saving', async () => {
    const user = userEvent.setup();
    saveConsent.mockResolvedValue({ ...CONSENT, communicationTitle: 'Zkrácený' });
    render_();
    const title = await screen.findByLabelText('Nadpis');
    await user.type(title, '   ');
    await user.click(save());
    await waitFor(() => expect(title).toHaveValue('Zkrácený'));
  });

  it('puts the server\'s refusal under the field it names and keeps what was typed', async () => {
    const user = userEvent.setup();
    saveConsent.mockRejectedValue(refused({ message: 'x', errors: { communicationTitle: ['Nadpis souhlasu nesmí být prázdný, pokud se souhlas zobrazuje.'] } }));
    render_();
    const title = await screen.findByLabelText('Nadpis');
    fireEvent.change(title, { target: { value: ' ' } });
    await user.click(save());
    expect(await screen.findByText('Nadpis souhlasu nesmí být prázdný, pokud se souhlas zobrazuje.')).toBeInTheDocument();
    expect(title).toHaveValue(' ');
  });

  it('shows a refusal that names no field as an alert', async () => {
    const user = userEvent.setup();
    saveConsent.mockRejectedValue(refused({ message: 'Nastavení souhlasů mění správce ordinace.' }));
    render_();
    await user.type(await screen.findByLabelText('Nadpis'), 'x');
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Nastavení souhlasů mění správce ordinace.');
  });

  it('limits the fields to 120 and 1000 characters, the server\'s limits', async () => {
    render_();
    expect(await screen.findByLabelText('Nadpis')).toHaveAttribute('maxlength', '120');
    expect(screen.getByLabelText('Text souhlasu')).toHaveAttribute('maxlength', '1000');
  });

  it('says the load failed', async () => {
    readConsent.mockRejectedValue(new Error('down'));
    render_();
    expect(await screen.findByText('Nastavení souhlasů se nepodařilo načíst.')).toBeInTheDocument();
  });

  it('Zahodit puts the stored wording back', async () => {
    const user = userEvent.setup();
    render_();
    const title = await screen.findByLabelText('Nadpis');
    await user.type(title, 'abc');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(title).toHaveValue('Novinky a nabídky');
  });
});

const FIELDS = [
  { key: 'recordId', label: 'Číslo karty', group: 'personal', onCard: true, onList: true, sensitive: false },
  { key: 'phone', label: 'Telefon', group: 'personal', onCard: true, onList: false, sensitive: false },
  { key: 'birthNumber', label: 'Rodné číslo', group: 'personal', onCard: true, onList: false, sensitive: true },
  { key: 'notes', label: 'Poznámky', group: 'registration', onCard: true, onList: false, sensitive: false },
] as const;
const VISIBILITY = { fields: FIELDS, visible: ['recordId', 'phone', 'birthNumber', 'notes'] };

describe('Údaje pacienta', () => {
  beforeEach(() => {
    setViewport(VIEWPORTS.desktop);
    readFields.mockReset().mockResolvedValue(VISIBILITY);
    saveFields.mockReset().mockImplementation(async (visible: string[]) => ({ fields: FIELDS, visible }));
  });
  const render_ = () => wrap(<PatientFieldsPage />, '/nastaveni/udaje-pacienta');
  const save = () => screen.getByRole('button', { name: 'Uložit' });
  const order = () => screen.getAllByRole('button', { name: /Posunout .* výš/ }).map((b) => b.getAttribute('aria-label')?.replace(/^Posunout | výš$/g, ''));

  it('lists the fields in the stored order, numbered, with the chips that matter', async () => {
    render_();
    expect(await screen.findByText('Zobrazené (4)')).toBeInTheDocument();
    expect(order()).toEqual(['Číslo karty', 'Telefon', 'Rodné číslo', 'Poznámky']);
    expect(screen.getByText('i v seznamu pacientů')).toBeInTheDocument();
    expect(screen.getByText('jen s oprávněním k rodnému číslu')).toBeInTheDocument();
  });

  it('moving a field down changes the order and enables Uložit; the first cannot go up and the last cannot go down', async () => {
    const user = userEvent.setup();
    render_();
    await screen.findByText('Zobrazené (4)');
    expect(screen.getByRole('button', { name: 'Posunout Číslo karty výš' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Posunout Poznámky níž' })).toBeDisabled();
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Posunout Číslo karty níž' }));
    expect(order()).toEqual(['Telefon', 'Číslo karty', 'Rodné číslo', 'Poznámky']);
    expect(save()).toBeEnabled();
  });

  it('moving a field and moving it back leaves nothing to save', async () => {
    const user = userEvent.setup();
    render_();
    await screen.findByText('Zobrazené (4)');
    await user.click(screen.getByRole('button', { name: 'Posunout Telefon výš' }));
    await user.click(screen.getByRole('button', { name: 'Posunout Telefon níž' }));
    expect(save()).toBeDisabled();
  });

  it('hides a field into the "Skryté" list, and shows it again at the end', async () => {
    const user = userEvent.setup();
    render_();
    await screen.findByText('Zobrazené (4)');
    await user.click(screen.getByRole('button', { name: 'Skrýt Telefon' }));
    expect(screen.getByText('Zobrazené (3)')).toBeInTheDocument();
    expect(screen.getByText('Skryté (1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zobrazit' }));
    expect(screen.getByText('Zobrazené (4)')).toBeInTheDocument();
    expect(order()).toEqual(['Číslo karty', 'Rodné číslo', 'Poznámky', 'Telefon']);
  });

  it('saves the visible keys in the order on screen', async () => {
    const user = userEvent.setup();
    render_();
    await screen.findByText('Zobrazené (4)');
    await user.click(screen.getByRole('button', { name: 'Skrýt Poznámky' }));
    await user.click(screen.getByRole('button', { name: 'Posunout Telefon výš' }));
    await user.click(save());
    await waitFor(() => expect(saveFields).toHaveBeenCalledWith(['phone', 'recordId', 'birthNumber']));
    expect(await screen.findByText('Uloženo. Karta a seznam pacientů to ukazují všem.')).toBeInTheDocument();
  });

  it('can hide everything and says the card then shows only the name', async () => {
    const user = userEvent.setup();
    render_();
    await screen.findByText('Zobrazené (4)');
    for (const label of ['Číslo karty', 'Telefon', 'Rodné číslo', 'Poznámky']) {
      await user.click(screen.getByRole('button', { name: `Skrýt ${label}` }));
    }
    expect(screen.getByText('Nic — karta ukáže jen jméno pacienta.')).toBeInTheDocument();
    await user.click(save());
    await waitFor(() => expect(saveFields).toHaveBeenCalledWith([]));
  });

  it('"Zobrazit vše v původním pořadí" restores the catalogue order and lists nothing as hidden', async () => {
    const user = userEvent.setup();
    readFields.mockResolvedValue({ fields: FIELDS, visible: ['notes'] });
    render_();
    await screen.findByText('Zobrazené (1)');
    await user.click(screen.getByRole('button', { name: 'Zobrazit vše v původním pořadí' }));
    expect(order()).toEqual(['Číslo karty', 'Telefon', 'Rodné číslo', 'Poznámky']);
    expect(screen.queryByText(/Skryté/)).toBeNull();
  });

  it('never sends a key the server\'s catalogue no longer lists', async () => {
    const user = userEvent.setup();
    readFields.mockResolvedValue({ fields: FIELDS, visible: ['phone', 'removedLongAgo', 'notes'] });
    render_();
    await screen.findByText('Zobrazené (2)');
    await user.click(screen.getByRole('button', { name: 'Skrýt Poznámky' }));
    await user.click(save());
    await waitFor(() => expect(saveFields).toHaveBeenCalledTimes(1));
    expect(saveFields.mock.calls[0][0]).toEqual(['phone']);
  });

  it('shows the server\'s refusal and keeps the edit', async () => {
    const user = userEvent.setup();
    saveFields.mockRejectedValue(refused({ message: 'Tyto údaje systém nezná: x.' }));
    render_();
    await screen.findByText('Zobrazené (4)');
    await user.click(screen.getByRole('button', { name: 'Skrýt Telefon' }));
    await user.click(save());
    expect(await screen.findByText('Tyto údaje systém nezná: x.')).toBeInTheDocument();
    expect(screen.getByText('Zobrazené (3)')).toBeInTheDocument();
  });

  it('explains that the birth number is withheld from anybody without the right, whatever is chosen here', async () => {
    render_();
    expect(await screen.findByText(/Rodné číslo a číslo pojištěnce uvidí jen ten, kdo má oprávnění/)).toBeInTheDocument();
  });

  it('says the load failed', async () => {
    readFields.mockRejectedValue(new Error('down'));
    render_();
    expect(await screen.findByText('Nastavení údajů o pacientovi se nepodařilo načíst.')).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px)', async (_name, width) => {
    setViewport(width);
    render_();
    await screen.findByText('Zobrazené (4)');
    expect(screen.getByRole('button', { name: 'Skrýt Telefon' })).toBeInTheDocument();
    expect(save()).toBeInTheDocument();
  });
});
