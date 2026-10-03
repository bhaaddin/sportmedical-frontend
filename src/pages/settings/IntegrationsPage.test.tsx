/*
 * Integrace: ADAM fields with a write-only password, "nepřipojeno" until the
 * data is stored, MEDISTAR "ukončeno" without fields - load, save and error
 * paths against a mocked API, at 390 / 834 / 1440.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import IntegrationsPage from './IntegrationsPage';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
const put = vi.fn();
vi.mock('../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
  client: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
}));

const EMPTY = { adam: { enabled: false, baseUrl: '', username: '', hasPassword: false }, medistar: { status: 'retired' } };
const STORED = { adam: { enabled: true, baseUrl: 'https://adam.example.cz', username: 'recepce', hasPassword: true }, medistar: { status: 'retired' } };

/** The integrations endpoint answers; the change-history panel under the page is not deployed (404). */
function serve(settings: unknown) {
  get.mockImplementation((url: string) => {
    if (url === '/api/v1/settings/integrations') return Promise.resolve({ data: settings });
    return Promise.reject({ response: { status: 404 } });
  });
}

const renderPage = () => render(<MemoryRouter initialEntries={['/nastaveni/integrace']}><IntegrationsPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
});

describe.each(Object.entries(VIEWPORTS))('Integrace at %s (%i px)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows ADAM as nepřipojeno with its fields, and MEDISTAR as ukončeno with none', async () => {
    serve(EMPTY);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Integrace' })).toBeInTheDocument();
    const adam = await screen.findByRole('region', { name: 'ADAM' });
    expect(adam).toHaveTextContent('Nepřipojeno');
    expect(screen.getByLabelText('Adresa serveru ADAM')).toBeInTheDocument();
    expect(screen.getByLabelText('Uživatelské jméno ADAM')).toBeInTheDocument();
    expect(screen.getByLabelText('Heslo ADAM')).toBeInTheDocument();

    const medistar = screen.getByRole('region', { name: 'MEDISTAR' });
    expect(medistar).toHaveTextContent('Ukončeno');
    expect(medistar.querySelectorAll('input')).toHaveLength(0);
  });
});

describe('Integrace', () => {
  it('says "uloženo" for a stored password and never shows it', async () => {
    serve(STORED);
    renderPage();

    const password = await screen.findByLabelText('Heslo ADAM');
    expect(password).toHaveValue('');
    expect(password).toHaveAttribute('placeholder', 'uloženo');
    expect(screen.getByRole('region', { name: 'ADAM' })).toHaveTextContent('uloženo');
    expect(screen.getByLabelText('Adresa serveru ADAM')).toHaveValue('https://adam.example.cz');
    expect(document.body.innerHTML).not.toContain('hasPassword');
  });

  it('keeps Uložit off until something changes, then sends only the password that was typed', async () => {
    const user = userEvent.setup();
    serve(STORED);
    put.mockResolvedValue({ data: { adam: { ...STORED.adam, username: 'lekar' }, medistar: { status: 'retired' } } });
    renderPage();

    await screen.findByLabelText('Heslo ADAM');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();

    const username = screen.getByLabelText('Uživatelské jméno ADAM');
    await user.clear(username);
    await user.type(username, 'lekar');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/api/v1/settings/integrations', {
      adam: { enabled: true, baseUrl: 'https://adam.example.cz', username: 'lekar' },
    });
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends a new password once and clears the field afterwards', async () => {
    const user = userEvent.setup();
    serve(EMPTY);
    put.mockResolvedValue({ data: STORED });
    renderPage();

    await screen.findByLabelText('Heslo ADAM');
    await user.click(screen.getByRole('switch', { name: 'Napojení na ADAM zapnuto' }));
    await user.type(screen.getByLabelText('Adresa serveru ADAM'), 'https://adam.example.cz');
    await user.type(screen.getByLabelText('Uživatelské jméno ADAM'), 'recepce');
    await user.type(screen.getByLabelText('Heslo ADAM'), 'tajne-heslo');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toEqual({
      adam: { enabled: true, baseUrl: 'https://adam.example.cz', username: 'recepce', password: 'tajne-heslo' },
    });
    await waitFor(() => expect(screen.getByLabelText('Heslo ADAM')).toHaveValue(''));
    expect(screen.getByLabelText('Heslo ADAM')).toHaveAttribute('placeholder', 'uloženo');
    expect(screen.getByRole('region', { name: 'ADAM' })).toHaveTextContent('Údaje uloženy');
  });

  it('refuses an address that is not a URL, before asking the server', async () => {
    const user = userEvent.setup();
    serve(EMPTY);
    renderPage();

    await screen.findByLabelText('Heslo ADAM');
    await user.click(screen.getByRole('switch', { name: 'Napojení na ADAM zapnuto' }));
    await user.type(screen.getByLabelText('Adresa serveru ADAM'), 'adam');
    await user.type(screen.getByLabelText('Uživatelské jméno ADAM'), 'r');
    expect(await screen.findByText('Zadejte celou adresu včetně https://')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(put).not.toHaveBeenCalled();
  });

  it('says what failed on a failed load, and Zkusit znovu loads again', async () => {
    const user = userEvent.setup();
    get.mockImplementation((url: string) =>
      url === '/api/v1/settings/integrations' ? Promise.reject(new Error('boom')) : Promise.reject({ response: { status: 404 } }));
    renderPage();

    expect(await screen.findByText('Nastavení integrací se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Adresa serveru ADAM')).not.toBeInTheDocument();

    serve(STORED);
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Adresa serveru ADAM')).toHaveValue('https://adam.example.cz');
  });

  it('shows the server\'s own words when the save is refused, and keeps the draft', async () => {
    const user = userEvent.setup();
    serve(STORED);
    put.mockRejectedValue({ response: { status: 400, data: { message: 'Adresa serveru není povolená.' } } });
    renderPage();

    const username = await screen.findByLabelText('Uživatelské jméno ADAM');
    await user.type(username, 'x');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Adresa serveru není povolená.')).toBeInTheDocument();
    expect(screen.getByLabelText('Uživatelské jméno ADAM')).toHaveValue('recepcex');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('Zahodit puts the stored values back', async () => {
    const user = userEvent.setup();
    serve(STORED);
    renderPage();

    const username = await screen.findByLabelText('Uživatelské jméno ADAM');
    await user.type(username, 'zzz');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByLabelText('Uživatelské jméno ADAM')).toHaveValue('recepce');
  });
});
