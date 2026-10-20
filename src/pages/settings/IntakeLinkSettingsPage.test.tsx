/*
 * Odkaz k dokončení registrace: the screen for the four settings the link service has always read and nobody could set.
 * The address, the lifetime and the e-mail wording - what is sent, what the server may still refuse, what is read back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/client', () => ({ client: { get, put }, default: { get, put } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import IntakeLinkSettingsPage, { daysHelper, isUsableSiteUrl, toPayload, validateIntakeLink } from './IntakeLinkSettingsPage';
import { normalizeIntakeLink } from '../../api/intakeLinkSettings';

const DEFAULTS = {
  completionDeadlineHours: 24,
  emailSubject: 'Dokončete prosím svou registraci',
  emailBody: 'Dobrý den, {jmeno} {prijmeni},\n\n{odkaz}\n\nOdkaz platí do {platnost}.',
  publicSiteBaseUrl: '',
};
const ANSWER = (settings = DEFAULTS) => ({
  settings,
  defaults: DEFAULTS,
  placeholders: [
    { token: '{jmeno}', meaning: 'Jméno pacienta' },
    { token: '{odkaz}', meaning: 'Osobní odkaz k dokončení registrace (povinný)' },
    { token: '{platnost}', meaning: 'Do kdy odkaz platí' },
  ],
  minimumHours: 1,
  maximumHours: 720,
});
const refused = (data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status: 400, data } as never);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/odkaz-registrace']}>
        <IntakeLinkSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const save = () => screen.getByRole('button', { name: 'Uložit' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'patients.register']));
  get.mockReset().mockImplementation((url: string) =>
    url === '/api/v1/settings/intake-link' ? Promise.resolve({ data: ANSWER() }) : Promise.reject({ response: { status: 404 } }));
  put.mockReset().mockImplementation(async (_url: string, body: typeof DEFAULTS) => ({ data: ANSWER(body) }));
});

describe('the contract', () => {
  it('reads an answer with nothing in it as empty settings and no placeholders', () => {
    expect(normalizeIntakeLink(undefined)).toEqual({
      settings: { completionDeadlineHours: 0, emailSubject: '', emailBody: '', publicSiteBaseUrl: '' },
      defaults: { completionDeadlineHours: 0, emailSubject: '', emailBody: '', publicSiteBaseUrl: '' },
      placeholders: [], minimumHours: 1, maximumHours: 720,
    });
  });

  it('drops a placeholder without a token and keeps the server\'s bounds', () => {
    const out = normalizeIntakeLink({ settings: DEFAULTS, placeholders: [{ token: '' }, { meaning: 'x' }, { token: '{odkaz}', meaning: 'Odkaz' }], minimumHours: 2, maximumHours: 100 });
    expect(out.placeholders).toEqual([{ token: '{odkaz}', meaning: 'Odkaz' }]);
    expect([out.minimumHours, out.maximumHours]).toEqual([2, 100]);
  });
});

describe('the validation rules', () => {
  const ok = { completionDeadlineHours: '24', emailSubject: 'Předmět', emailBody: 'Ahoj {odkaz}', publicSiteBaseUrl: '' };

  it.each([
    [{}, []],
    [{ completionDeadlineHours: '1' }, []],
    [{ completionDeadlineHours: '720' }, []],
    [{ completionDeadlineHours: '0' }, ['completionDeadlineHours']],
    [{ completionDeadlineHours: '721' }, ['completionDeadlineHours']],
    [{ completionDeadlineHours: '' }, ['completionDeadlineHours']],
    [{ completionDeadlineHours: '1.5' }, ['completionDeadlineHours']],
    [{ completionDeadlineHours: '1e1' }, ['completionDeadlineHours']],
    [{ emailSubject: '  ' }, ['emailSubject']],
    [{ emailSubject: 'a\nb' }, ['emailSubject']],
    [{ emailSubject: 'x'.repeat(201) }, ['emailSubject']],
    [{ emailSubject: 'x'.repeat(200) }, []],
    [{ emailBody: '' }, ['emailBody']],
    [{ emailBody: 'bez odkazu' }, ['emailBody']],
    [{ emailBody: '{ODKAZ}' }, ['emailBody']],
    [{ emailBody: `{odkaz}${'x'.repeat(4000)}` }, ['emailBody']],
    [{ publicSiteBaseUrl: 'https://www.sportmedical.cz' }, []],
    [{ publicSiteBaseUrl: 'http://localhost:3000' }, []],
    [{ publicSiteBaseUrl: 'www.sportmedical.cz' }, ['publicSiteBaseUrl']],
    [{ publicSiteBaseUrl: 'https://a.cz/?x=1' }, ['publicSiteBaseUrl']],
    [{ publicSiteBaseUrl: 'https://a.cz/#x' }, ['publicSiteBaseUrl']],
    [{ publicSiteBaseUrl: 'https://u:p@a.cz' }, ['publicSiteBaseUrl']],
    [{ publicSiteBaseUrl: 'ftp://a.cz' }, ['publicSiteBaseUrl']],
  ])('%j gives errors on %j', (patch, fields) => {
    expect(Object.keys(validateIntakeLink({ ...ok, ...patch }, 1, 720))).toEqual(fields);
  });

  it('uses the server\'s bounds, not its own', () => {
    expect(Object.keys(validateIntakeLink({ ...ok, completionDeadlineHours: '48' }, 1, 24))).toEqual(['completionDeadlineHours']);
  });

  it.each([['https://a.cz', true], ['', false], ['  ', false], ['mailto:a@b.cz', false], ['https://a.cz/cesta', true]])('site url %j usable = %s', (value, usable) => {
    expect(isUsableSiteUrl(value)).toBe(usable);
  });

  it('sends the address without a trailing slash and the text trimmed', () => {
    expect(toPayload({ completionDeadlineHours: ' 48 ', emailSubject: ' S ', emailBody: ' {odkaz} ', publicSiteBaseUrl: ' https://a.cz/// ' })).toEqual({
      completionDeadlineHours: 48, emailSubject: 'S', emailBody: '{odkaz}', publicSiteBaseUrl: 'https://a.cz',
    });
  });

  it.each([[1, 'méně než jeden den'], [23, 'méně než jeden den'], [24, '= 1 den'], [48, '= 2 dny'], [52, '= 2 dny a 4 h'], [120, '= 5 dní']])('%i hours reads %s', (hours, text) => {
    expect(daysHelper(hours).replace(/ /g, ' ')).toBe(text);
  });
});

describe('the screen', () => {
  it('shows the stored values and says that without an address no e-mail is queued', async () => {
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('24');
    expect(screen.getByLabelText('Předmět e-mailu')).toHaveValue('Dokončete prosím svou registraci');
    expect(screen.getByLabelText('Adresa webu pro pacienty')).toHaveValue('');
    expect(screen.getByRole('region', { name: 'Co se stane' })).toHaveTextContent('e-mail s odkazem se nezařadí');
  });

  it('keeps Uložit off until something changes', async () => {
    const user = userEvent.setup();
    renderPage();
    const hours = await screen.findByLabelText('Platnost odkazu');
    expect(save()).toBeDisabled();
    await user.clear(hours);
    await user.type(hours, '48');
    expect(save()).toBeEnabled();
    await user.clear(hours);
    await user.type(hours, '24');
    expect(save()).toBeDisabled();
  });

  it('saves the four settings and reads back what the server stored', async () => {
    const user = userEvent.setup();
    renderPage();
    const hours = await screen.findByLabelText('Platnost odkazu');
    await user.clear(hours);
    await user.type(hours, '72');
    await user.type(screen.getByLabelText('Adresa webu pro pacienty'), 'https://www.sportmedical.cz/');
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/settings/intake-link', { ...DEFAULTS, completionDeadlineHours: 72, publicSiteBaseUrl: 'https://www.sportmedical.cz' }));
    await waitFor(() => expect(screen.getByLabelText('Adresa webu pro pacienty')).toHaveValue('https://www.sportmedical.cz'));
    expect(save()).toBeDisabled();
  });

  it('will not send a text with no {odkaz}, and says why at the text', async () => {
    const user = userEvent.setup();
    renderPage();
    const body = await screen.findByLabelText('Text e-mailu');
    fireEvent.change(body, { target: { value: 'Ahoj, dokončete registraci.' } });
    expect(screen.getByText('Text musí obsahovat {odkaz}, jinak by pacient odkaz nedostal.')).toBeInTheDocument();
    await user.click(save());
    expect(put).not.toHaveBeenCalled();
  });

  it('will not send a hours field that is not a whole number within the server\'s bounds', async () => {
    const user = userEvent.setup();
    renderPage();
    const hours = await screen.findByLabelText('Platnost odkazu');
    await user.clear(hours);
    await user.type(hours, '721');
    expect(screen.getByText('Zadejte celý počet hodin od 1 do 720.')).toBeInTheDocument();
    await user.click(save());
    expect(put).not.toHaveBeenCalled();
  });

  it('refuses an address without https:// at the field', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Adresa webu pro pacienty'), 'www.sportmedical.cz');
    expect(screen.getByText(/Zadejte celou adresu začínající https:\/\//)).toBeInTheDocument();
    await user.click(save());
    expect(put).not.toHaveBeenCalled();
  });

  it('inserts a placeholder at the cursor', async () => {
    const user = userEvent.setup();
    renderPage();
    const body = (await screen.findByLabelText('Text e-mailu')) as HTMLTextAreaElement;
    body.setSelectionRange(0, 0);
    await user.click(screen.getByText('{platnost}'));
    expect(body.value.startsWith('{platnost}Dobrý den')).toBe(true);
  });

  it('"Vrátit výchozí znění e-mailu" puts the server\'s default wording back, and leaves the hours and the address', async () => {
    const user = userEvent.setup();
    get.mockImplementation(() => Promise.resolve({ data: ANSWER({ ...DEFAULTS, emailSubject: 'Vlastní', emailBody: 'Vlastní {odkaz}', completionDeadlineHours: 12 }) }));
    renderPage();
    await screen.findByLabelText('Předmět e-mailu');
    await user.click(screen.getByRole('button', { name: 'Vrátit výchozí znění e-mailu' }));
    expect(screen.getByLabelText('Předmět e-mailu')).toHaveValue(DEFAULTS.emailSubject);
    expect(screen.getByLabelText('Text e-mailu')).toHaveValue(DEFAULTS.emailBody);
    expect(screen.getByLabelText('Platnost odkazu')).toHaveValue('12');
    expect(save()).toBeEnabled();
  });

  it('puts the server\'s own refusal under the field it names, and keeps the typed text', async () => {
    const user = userEvent.setup();
    put.mockRejectedValue(refused({ code: 'settings.invalid', message: 'Nastavení nelze uložit: Adresa webu musí být úplná adresa.', errors: { publicSiteBaseUrl: ['Adresa webu musí být úplná adresa začínající https://.'] } }));
    renderPage();
    const site = await screen.findByLabelText('Adresa webu pro pacienty');
    await user.type(site, 'https://a.cz');
    await user.click(save());
    expect(await screen.findByText('Adresa webu musí být úplná adresa začínající https://.')).toBeInTheDocument();
    expect(site).toHaveValue('https://a.cz');
  });

  it('shows a refusal that names no field above the form', async () => {
    const user = userEvent.setup();
    put.mockRejectedValue(refused({ message: 'Nastavení odkazu mění správce ordinace.' }));
    renderPage();
    await user.type(await screen.findByLabelText('Adresa webu pro pacienty'), 'https://a.cz');
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Nastavení odkazu mění správce ordinace.');
  });

  it('a double click on Uložit is one request', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    put.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderPage();
    await user.type(await screen.findByLabelText('Adresa webu pro pacienty'), 'https://a.cz');
    await user.dblClick(save());
    expect(put).toHaveBeenCalledTimes(1);
    release({ data: ANSWER() });
  });

  it('Zahodit puts the stored values back', async () => {
    const user = userEvent.setup();
    renderPage();
    const site = await screen.findByLabelText('Adresa webu pro pacienty');
    await user.type(site, 'https://a.cz');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(site).toHaveValue('');
  });

  it('says the load failed (for instance without the right to register patients)', async () => {
    get.mockRejectedValue(refused({ message: 'x' }));
    renderPage();
    expect(await screen.findByText('Nastavení odkazu se nepodařilo načíst.')).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px) with the explanation beside or below the form', async (name, width) => {
    setViewport(width);
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Co se stane' })).toBeInTheDocument();
    expect(name.length).toBeGreaterThan(0);
  });
});
