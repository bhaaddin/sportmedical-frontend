/*
 * Settings audit (20. 10. 2026) - Nastavení klubů (/nastaveni/kluby).
 *
 * Server facts (dev API, PUT /api/v1/settings/clubs, body = the GET body with one field changed):
 *   registrationLinkValidityDays: 1..1095 (0, 1096 and 3650 -> 400 "Platnost odkazu musí být 1 až 1095 dní.")
 *   minimumPlayers: null or >= 1 (0 -> 400); releaseUnusedDaysBefore: null or >= 0 (-1 -> 400, 100000 ok)
 *   payerTextClubInvoice / payerTextPerPerson: up to 500 characters; "" clears (reads back null), null KEEPS, text is trimmed
 *   GET also sends defaultPayerText… (the sentences used while the clinic's own are empty) and blockPalette.
 * The screen had no editor for the two payer sentences at all although the public club page prints them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invalidSettings, renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/clubs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/clubs')>()),
  clubSettingsApi: { get, put },
}));
vi.mock('../../components/settings/changesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/settings/changesApi')>()),
  fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const { default: ClubSettingsPage, changedPayerTexts, validateClubSettings } = await import('./ClubSettingsPage');

const SERVER = {
  registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: null, allowMultiServiceOrders: false,
  blockPalette: ['#2563EB', '#D97706'], payerTextClubInvoice: null, payerTextPerPerson: null,
  defaultPayerTextClubInvoice: 'Vyšetření hradí klub fakturou. Rodiče ani hráči na místě nic neplatí.',
  defaultPayerTextPerPerson: 'Každý hráč (rodič) hradí své vyšetření sám, na místě v den vyšetření.',
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockImplementation(async () => structuredClone(SERVER));
  put.mockReset().mockImplementation(async (settings) => settings);
});

describe('validateClubSettings against the limits the server has', () => {
  const base = { registrationLinkValidityDays: '14', minimumPlayers: '', releaseUnusedDaysBefore: '', allowMultiServiceOrders: false, payerTextClubInvoice: '', payerTextPerPerson: '' };
  const check = (over: Record<string, string | boolean>) => validateClubSettings({ ...base, ...over });

  it.each([['1', true], ['14', true], ['1095', true], ['0', false], ['1096', false], ['3650', false], ['', false], ['abc', false], ['1,5', false], ['-3', false]])(
    'link validity %j is %s',
    (days, ok) => {
      expect(check({ registrationLinkValidityDays: days }).registrationLinkValidityDays === undefined).toBe(ok);
    },
  );

  it('says the real limit, not "a typo"', () => {
    expect(check({ registrationLinkValidityDays: '1096' }).registrationLinkValidityDays).toBe('Odkaz může platit nejvýše 1095 dní (tři roky).');
    expect(check({ registrationLinkValidityDays: '0' }).registrationLinkValidityDays).toBe('Odkaz musí platit aspoň jeden den.');
  });

  it.each([['', true], ['1', true], ['50', true], ['0', false], ['-1', false], ['2,5', false]])('minimum players %j is %s', (value, ok) => {
    expect(check({ minimumPlayers: value }).minimumPlayers === undefined).toBe(ok);
  });

  it.each([['', true], ['0', true], ['5', true], ['3650', true], ['-1', false], ['1,5', false], ['3651', false]])('release days %j is %s', (value, ok) => {
    expect(check({ releaseUnusedDaysBefore: value }).releaseUnusedDaysBefore === undefined).toBe(ok);
  });

  it('a payer sentence of 500 characters passes, 501 does not', () => {
    expect(check({ payerTextClubInvoice: 'a'.repeat(500) })).toEqual({});
    expect(check({ payerTextClubInvoice: 'a'.repeat(501) }).payerTextClubInvoice).toBe('Věta smí mít nejvýše 500 znaků.');
    expect(check({ payerTextPerPerson: 'a'.repeat(501) }).payerTextPerPerson).toBe('Věta smí mít nejvýše 500 znaků.');
  });

  it('spaces around a sentence do not count toward the limit', () => {
    expect(check({ payerTextPerPerson: `  ${'a'.repeat(500)}  ` })).toEqual({});
  });
});

describe('changedPayerTexts (null KEEPS on the server, "" clears)', () => {
  const draft = (over: Record<string, string> = {}) => ({
    registrationLinkValidityDays: '14', minimumPlayers: '', releaseUnusedDaysBefore: '', allowMultiServiceOrders: false, payerTextClubInvoice: '', payerTextPerPerson: '', ...over,
  });

  it('sends nothing for a sentence nobody touched', () => {
    expect(changedPayerTexts(SERVER, draft())).toEqual({});
    expect(changedPayerTexts({ ...SERVER, payerTextPerPerson: 'Platí každý.' }, draft({ payerTextPerPerson: 'Platí každý.' }))).toEqual({});
  });

  it('sends the trimmed text of a changed one', () => {
    expect(changedPayerTexts(SERVER, draft({ payerTextClubInvoice: '  Platí klub.  ' }))).toEqual({ payerTextClubInvoice: 'Platí klub.' });
  });

  it('sends "" - not null - to clear a stored sentence', () => {
    expect(changedPayerTexts({ ...SERVER, payerTextClubInvoice: 'Starý text.' }, draft())).toEqual({ payerTextClubInvoice: '' });
  });

  it('a sentence of spaces over a stored empty one is not a change', () => {
    expect(changedPayerTexts(SERVER, draft({ payerTextClubInvoice: '    ' }))).toEqual({});
  });
});

describe('Poslední změny', () => {
  it('asks the history under "clubs", which is what the server files these settings in', async () => {
    const { fetchSettingChanges } = await import('../../components/settings/changesApi');
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await screen.findByLabelText('Platnost odkazu');
    await waitFor(() => expect(fetchSettingChanges).toHaveBeenCalledWith('clubs', 5));
  });
});

describe('the screen', () => {
  it('shows the stored values and the server’s default sentences as the placeholders', async () => {
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('14');
    expect(screen.getByLabelText('Když platí klub fakturou')).toHaveValue('');
    expect(screen.getByLabelText('Když platí klub fakturou')).toHaveAttribute('placeholder', SERVER.defaultPayerTextClubInvoice);
    expect(screen.getByLabelText('Když platí každý rodič sám')).toHaveAttribute('placeholder', SERVER.defaultPayerTextPerPerson);
  });

  it('shows a stored sentence in the field', async () => {
    get.mockImplementation(async () => ({ ...structuredClone(SERVER), payerTextPerPerson: 'Platí se hotově.' }));
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    expect(await screen.findByLabelText('Když platí každý rodič sám')).toHaveValue('Platí se hotově.');
  });

  it('saves a new sentence together with the other settings, and keeps the palette and the defaults travelling', async () => {
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await user.type(await screen.findByLabelText('Když platí klub fakturou'), '  Platí klub fakturou do 14 dnů.  ');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith(expect.objectContaining({
      registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: null, allowMultiServiceOrders: false,
      blockPalette: ['#2563EB', '#D97706'], payerTextClubInvoice: 'Platí klub fakturou do 14 dnů.',
    }));
  });

  it('leaves the other sentence out of the change when only one was typed (null keeps the stored text)', async () => {
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await user.type(await screen.findByLabelText('Když platí klub fakturou'), 'Platí klub.');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0].payerTextPerPerson).toBeNull();
  });

  it('clearing a stored sentence sends "" so the default shows again', async () => {
    get.mockImplementation(async () => ({ ...structuredClone(SERVER), payerTextPerPerson: 'Platí se hotově.' }));
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await user.clear(await screen.findByLabelText('Když platí každý rodič sám'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0].payerTextPerPerson).toBe('');
  });

  it('stops the typing at 500 characters', async () => {
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    expect(await screen.findByLabelText('Když platí klub fakturou')).toHaveAttribute('maxlength', '500');
  });

  it('refuses 1096 days of link validity before the round trip, with the server’s limit', async () => {
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '1096');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Odkaz může platit nejvýše 1095 dní (tři roky).')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the server sentence under the sentence field it refused', async () => {
    put.mockRejectedValue(invalidSettings({ payerTextPerPerson: ['Věta smí mít nejvýše 500 znaků.'] }));
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await user.type(await screen.findByLabelText('Když platí každý rodič sám'), 'x');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Věta smí mít nejvýše 500 znaků.')).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    put.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    await user.type(await screen.findByLabelText('Když platí klub fakturou'), 'x');
    await user.dblClick(screen.getByRole('button', { name: /Uložit|Ukládám/ }));
    expect(put).toHaveBeenCalledTimes(1);
    finish(SERVER);
  });

  it('Zahodit puts the stored sentences back', async () => {
    const user = userEvent.setup();
    renderScreen(<ClubSettingsPage />, '/nastaveni/kluby');
    const field = await screen.findByLabelText('Když platí klub fakturou');
    await user.type(field, 'Něco.');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(field).toHaveValue('');
    expect(put).not.toHaveBeenCalled();
  });
});
