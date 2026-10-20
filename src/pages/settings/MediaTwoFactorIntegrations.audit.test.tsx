/*
 * Úložiště médií, Zabezpečení and Integrace: the screens that hold secrets. What matters is what is
 * sent, what is NEVER shown again, and what the person is told before and after a refusal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { get, put, post, toastSuccess } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a) },
  client: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a) },
}));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: vi.fn() } }));

import MediaStorageSettingsPage from './MediaStorageSettingsPage';
import TwoFactorPage from './TwoFactorPage';
import IntegrationsPage from './IntegrationsPage';

const refused = (data: unknown, status = 400) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);
const wrap = (node: React.ReactNode, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

/** Everything except the screen's own endpoint answers like the missing change-history panel: 404. */
const serve = (url: string, body: unknown) =>
  get.mockImplementation((u: string) => (u === url ? Promise.resolve({ data: body }) : Promise.reject({ response: { status: 404 } })));

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  post.mockReset();
  toastSuccess.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
});

/* ───────────────────────── Úložiště médií ───────────────────────── */

const MEDIA_URL = '/api/v1/settings/media-storage';
const MEDIA_EMPTY = { provider: 'cloudinary', enabled: false, cloudName: '', apiKey: '', hasSecret: false, uploadPreset: '' };
const MEDIA_STORED = { provider: 'cloudinary', enabled: true, cloudName: 'klinika', apiKey: '123456', hasSecret: true, uploadPreset: 'web' };

describe('Úložiště médií', () => {
  const page = () => wrap(<MediaStorageSettingsPage />, '/nastaveni/uloziste-medii');
  const save = () => screen.getByRole('button', { name: 'Uložit' });

  it('shows the stored values; the secret is only "Uloženo ✓" and a Změnit button, never a value', async () => {
    serve(MEDIA_URL, MEDIA_STORED);
    page();
    expect(await screen.findByLabelText('Cloud name')).toHaveValue('klinika');
    expect(screen.getByLabelText('API key')).toHaveValue('123456');
    expect(screen.getByLabelText('Upload preset (nepovinné)')).toHaveValue('web');
    expect(screen.getByText('Uloženo ✓')).toBeInTheDocument();
    expect(screen.queryByLabelText('API secret')).toBeNull();
    expect(document.body.textContent).not.toMatch(/secret.{0,20}[A-Za-z0-9]{12,}/i);
  });

  it('is off and empty on a fresh install, with the secret field open and the status "Nenastaveno"', async () => {
    serve(MEDIA_URL, MEDIA_EMPTY);
    page();
    expect(await screen.findByLabelText('API secret')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Úložiště médií zapnuto' })).not.toBeChecked();
    expect(screen.getByText('Nenastaveno')).toBeInTheDocument();
    expect(screen.getByText(/je potřeba zapnout úložiště, vyplnit cloud name, uložit API secret/)).toBeInTheDocument();
  });

  it('keeps Uložit off until something changes', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_STORED);
    page();
    await user.type(await screen.findByLabelText('Upload preset (nepovinné)'), 'x');
    expect(save()).toBeEnabled();
  });

  it('refuses to switch it on without a cloud name, a key and a secret, and sends nothing', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_EMPTY);
    page();
    await user.click(await screen.findByRole('switch', { name: 'Úložiště médií zapnuto' }));
    await user.click(save());
    expect(await screen.findByText(/Vyplňte cloud name/)).toBeInTheDocument();
    expect(screen.getByText('Vyplňte API key.')).toBeInTheDocument();
    expect(screen.getByText(/Vyplňte API secret/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('may be saved switched off with nothing filled in', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_EMPTY);
    put.mockResolvedValue({ data: { ...MEDIA_EMPTY, cloudName: 'x' } });
    page();
    await user.type(await screen.findByLabelText('Cloud name'), 'x');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toMatchObject({ provider: 'cloudinary', enabled: false, cloudName: 'x' });
  });

  it('sends the secret only when one was typed, trimmed, and never keeps it in the form afterwards', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_STORED);
    put.mockResolvedValue({ data: MEDIA_STORED });
    page();
    await user.click(await screen.findByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('API secret'), '  novy-secret ');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect((put.mock.calls[0][1] as { apiSecret?: string }).apiSecret).toBe('novy-secret');
    expect(await screen.findByText('Uloženo ✓')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('novy-secret')).toBeNull();
  });

  it('a save that changes only the preset sends no secret at all', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_STORED);
    put.mockResolvedValue({ data: MEDIA_STORED });
    page();
    await user.type(await screen.findByLabelText('Upload preset (nepovinné)'), '2');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect('apiSecret' in (put.mock.calls[0][1] as object)).toBe(false);
  });

  it('"Ponechat uložený secret" closes the field and throws away what was typed', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_STORED);
    page();
    await user.click(await screen.findByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('API secret'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Ponechat uložený secret' }));
    expect(screen.queryByLabelText('API secret')).toBeNull();
    expect(save()).toBeDisabled();
  });

  it('puts the server\'s refusal under the field it names', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_EMPTY);
    put.mockRejectedValue(refused({ message: 'Pro zapnutí úložiště vyplňte API secret.', errors: { apiSecret: ['Pro zapnutí úložiště vyplňte API secret.'] } }));
    page();
    await user.type(await screen.findByLabelText('Cloud name'), 'c');
    await user.click(save());
    expect(await screen.findByText('Pro zapnutí úložiště vyplňte API secret.', { selector: 'p' })).toBeInTheDocument();
  });

  it('tells the person when it is saved', async () => {
    const user = userEvent.setup();
    serve(MEDIA_URL, MEDIA_STORED);
    put.mockResolvedValue({ data: MEDIA_STORED });
    page();
    await user.type(await screen.findByLabelText('Upload preset (nepovinné)'), 'x');
    await user.click(save());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Úložiště médií uloženo'));
  });

  it('says the load failed', async () => {
    get.mockRejectedValue(new Error('down'));
    page();
    expect(await screen.findByText('Nastavení úložiště médií se nepodařilo načíst.')).toBeInTheDocument();
  });

  it('is honest that nothing is uploaded by switching it on, and that the connection is not tested', async () => {
    serve(MEDIA_URL, MEDIA_STORED);
    page();
    expect(await screen.findByText(/Zapnutím úložiště se nic nenahrává/)).toBeInTheDocument();
    expect(screen.getByText(/Zda je Cloudinary přijme, se ukáže při prvním nahrání souboru/)).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px)', async (_name, width) => {
    setViewport(width);
    serve(MEDIA_URL, MEDIA_STORED);
    page();
    expect(await screen.findByLabelText('Cloud name')).toBeInTheDocument();
    expect(screen.getByText('Nastaveno')).toBeInTheDocument();
  });
});

/* ───────────────────────── Zabezpečení ───────────────────────── */

const TF_URL = '/api/v1/account/two-factor';

describe('Zabezpečení (dvoufázové ověření)', () => {
  const page = () => wrap(<TwoFactorPage />, '/nastaveni/zabezpeceni');

  it('says it is off and offers to switch it on', async () => {
    serve(TF_URL, { enabled: false, setupPending: false });
    page();
    expect(await screen.findByText('Účet je chráněný jen heslem.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapnout dvoufázové ověření' })).toBeEnabled();
  });

  it('shows the key to copy into the app, then needs six digits before it will confirm', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: false, setupPending: false });
    post.mockResolvedValue({ data: { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP' } });
    page();
    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    expect(await screen.findByDisplayValue('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Potvrdit a zapnout' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Šestimístný kód'), '12345');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Šestimístný kód'), '6');
    expect(confirm).toBeEnabled();
  });

  it('limits the confirmation code to six characters', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: false, setupPending: false });
    post.mockResolvedValue({ data: { secret: 'S', otpauthUri: 'otpauth://x' } });
    page();
    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    await user.type(await screen.findByLabelText('Šestimístný kód'), '12345678');
    expect(screen.getByLabelText('Šestimístný kód')).toHaveValue('123456');
  });

  it('confirms with the typed code (trimmed) and shows the recovery codes once, with a warning', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: false, setupPending: false });
    post.mockImplementation((url: string) =>
      Promise.resolve({ data: url.endsWith('/setup') ? { secret: 'S', otpauthUri: 'otpauth://x' } : { recoveryCodes: ['aaaa-1111', 'bbbb-2222'] } }));
    page();
    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    await user.type(await screen.findByLabelText('Šestimístný kód'), '123456');
    await user.click(screen.getByRole('button', { name: 'Potvrdit a zapnout' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/account/two-factor/confirm', { code: '123456' }));
    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument();
    expect(screen.getByText('bbbb-2222')).toBeInTheDocument();
    expect(screen.getByText(/Zobrazí se jen jednou/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mám uloženo' }));
    expect(screen.queryByText('aaaa-1111')).toBeNull();
  });

  it('shows the server\'s sentence for a wrong code and stays on the code step', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: false, setupPending: true });
    post.mockImplementation((url: string) =>
      url.endsWith('/setup')
        ? Promise.resolve({ data: { secret: 'S', otpauthUri: 'otpauth://x' } })
        : Promise.reject(refused({ message: 'Kód není správný.' })));
    page();
    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    await user.type(await screen.findByLabelText('Šestimístný kód'), '000000');
    await user.click(screen.getByRole('button', { name: 'Potvrdit a zapnout' }));
    expect(await screen.findByText('Kód není správný.')).toBeInTheDocument();
    expect(screen.getByLabelText('Šestimístný kód')).toBeInTheDocument();
  });

  it('Zrušit leaves the setup step without confirming anything', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: false, setupPending: false });
    post.mockResolvedValue({ data: { secret: 'S', otpauthUri: 'otpauth://x' } });
    page();
    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    await user.click(await screen.findByRole('button', { name: 'Zrušit' }));
    expect(await screen.findByText('Účet je chráněný jen heslem.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('when it is on, switching it off needs a code of at least six characters', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: true, setupPending: false });
    page();
    expect(await screen.findByText('Váš účet je chráněný dvoufázovým ověřením.')).toBeInTheDocument();
    const off = screen.getByRole('button', { name: 'Vypnout' });
    expect(off).toBeDisabled();
    await user.type(screen.getByLabelText('Kód z aplikace'), '12345');
    expect(off).toBeDisabled();
    await user.type(screen.getByLabelText('Kód z aplikace'), '6');
    expect(off).toBeEnabled();
  });

  it('switches it off with the code and shows the refusal when the code is wrong', async () => {
    const user = userEvent.setup();
    serve(TF_URL, { enabled: true, setupPending: false });
    post.mockRejectedValue(refused({ message: 'Kód není správný.' }));
    page();
    await user.type(await screen.findByLabelText('Kód z aplikace'), '123456');
    await user.click(screen.getByRole('button', { name: 'Vypnout' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/account/two-factor/disable', { code: '123456' }));
    expect(await screen.findByText('Kód není správný.')).toBeInTheDocument();
  });

  it('says the status could not be read and offers another try', async () => {
    get.mockRejectedValue(refused({}, 500));
    page();
    expect(await screen.findByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('explains how it is switched on, in four steps', async () => {
    serve(TF_URL, { enabled: false, setupPending: false });
    page();
    expect(await screen.findByText('Jak se zapíná')).toBeInTheDocument();
    expect(screen.getByText('Uložíte si záložní kódy pro den, kdy nebudete mít telefon.')).toBeInTheDocument();
  });
});

/* ───────────────────────── Integrace ───────────────────────── */

const INT_URL = '/api/v1/settings/integrations';
const INT_EMPTY = { adam: { enabled: false, baseUrl: '', username: '', hasPassword: false }, medistar: { status: 'retired' } };
const INT_STORED = { adam: { enabled: true, baseUrl: 'https://adam.example.cz', username: 'recepce', hasPassword: true }, medistar: { status: 'retired' } };

describe('Integrace (ADAM)', () => {
  const page = () => wrap(<IntegrationsPage />, '/nastaveni/integrace');
  const save = () => screen.getByRole('button', { name: 'Uložit' });

  it('will not switch it on without a password that is stored or typed, and says so before the round trip', async () => {
    const user = userEvent.setup();
    serve(INT_URL, INT_EMPTY);
    page();
    await user.click(await screen.findByRole('switch', { name: 'Napojení na ADAM zapnuto' }));
    await user.type(screen.getByLabelText('Adresa serveru ADAM'), 'https://adam.example.cz');
    await user.type(screen.getByLabelText('Uživatelské jméno ADAM'), 'recepce');
    await user.click(save());
    expect(await screen.findByText('Zapnuté napojení potřebuje heslo.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('switches it on once the password is typed, and sends it once', async () => {
    const user = userEvent.setup();
    serve(INT_URL, INT_EMPTY);
    put.mockResolvedValue({ data: INT_STORED });
    page();
    await user.click(await screen.findByRole('switch', { name: 'Napojení na ADAM zapnuto' }));
    await user.type(screen.getByLabelText('Adresa serveru ADAM'), 'https://adam.example.cz');
    await user.type(screen.getByLabelText('Uživatelské jméno ADAM'), 'recepce');
    await user.type(screen.getByLabelText('Heslo ADAM'), 'tajne');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalledWith(INT_URL, { adam: { enabled: true, baseUrl: 'https://adam.example.cz', username: 'recepce', password: 'tajne' } }));
    expect(await screen.findByLabelText('Heslo ADAM')).toHaveValue('');
  });

  it('with a stored password a switch-on needs none typed', async () => {
    const user = userEvent.setup();
    serve(INT_URL, { adam: { ...INT_STORED.adam, enabled: false }, medistar: { status: 'retired' } });
    put.mockResolvedValue({ data: INT_STORED });
    page();
    await user.click(await screen.findByRole('switch', { name: 'Napojení na ADAM zapnuto' }));
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect('password' in (put.mock.calls[0][1] as { adam: object }).adam).toBe(false);
  });

  it('refuses an address without the scheme when it is switched on', async () => {
    const user = userEvent.setup();
    serve(INT_URL, INT_STORED);
    page();
    const address = await screen.findByLabelText('Adresa serveru ADAM');
    await user.clear(address);
    await user.type(address, 'adam.example.cz');
    expect(screen.getByText('Zadejte celou adresu včetně https://')).toBeInTheDocument();
    await user.click(save());
    expect(put).not.toHaveBeenCalled();
  });

  it('trims the address and the user name it sends', async () => {
    const user = userEvent.setup();
    serve(INT_URL, INT_STORED);
    put.mockResolvedValue({ data: INT_STORED });
    page();
    const name = await screen.findByLabelText('Uživatelské jméno ADAM');
    await user.clear(name);
    await user.type(name, '  jana  ');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect((put.mock.calls[0][1] as { adam: { username: string } }).adam.username).toBe('jana');
  });

  it('is honest that nothing is verified or sent', async () => {
    serve(INT_URL, INT_STORED);
    page();
    expect(await screen.findByText(/Spojení se zatím neověřuje/)).toBeInTheDocument();
    expect(screen.getByText(/nic se z ordinace do ADAM neodesílá/)).toBeInTheDocument();
  });

  it('a double click on Uložit is one request', async () => {
    const user = userEvent.setup();
    serve(INT_URL, INT_STORED);
    let release: (value: unknown) => void = () => undefined;
    put.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    page();
    await user.type(await screen.findByLabelText('Uživatelské jméno ADAM'), 'x');
    await user.dblClick(save());
    expect(put).toHaveBeenCalledTimes(1);
    release({ data: INT_STORED });
  });
});
