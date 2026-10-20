/*
 * Settings audit (20. 10. 2026) - Údaje ordinace (/admin), the public details.
 *
 * Server facts (dev API, PUT /api/settings/bulk with the pub.* keys, read back by GET /api/settings AND GET /api/public/clinic):
 *   all seven keys round-trip (name, e-mail, phone, address, openingHours, siteUrl, bookingEnabled "true"/"false")
 *   public clinic then answers { name, email, phone, address, bookingEnabled, openingHours }
 *   openingHours over 200 characters -> 400 "Otevírací doba může mít nejvýše 200 znaků."
 *   "not-an-email", "javascript:alert(1)" for siteUrl and "maybe" for bookingEnabled were ALL ACCEPTED: the server checks nothing else
 *   an empty siteName is stored as "" (the public pages then print nothing).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../test/auditHarness';
import { setViewport, VIEWPORTS } from '../test/viewport';

const { readSettings, saveSettings } = vi.hoisted(() => ({ readSettings: vi.fn(), saveSettings: vi.fn() }));

vi.mock('../api/clinicSettings', () => ({
  readSettings,
  saveSettings,
  PUBLIC_CLINIC_KEYS: {
    name: 'pub.siteName', email: 'pub.contactEmail', phone: 'pub.contactPhone', address: 'pub.contactAddress',
    bookingEnabled: 'pub.bookingEnabled', openingHours: 'pub.openingHours', siteUrl: 'pub.siteUrl',
  },
  OPENING_HOURS_MAX_LENGTH: 200,
}));
vi.mock('../components/CompanySettingsCard', () => ({ default: () => null }));
vi.mock('../components/settings/changesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/settings/changesApi')>()),
  fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const { default: Admin } = await import('./Admin');
const { normalizeBase } = await import('../components/clubs/orders/absoluteLink');

const STORED = {
  'pub.siteName': 'SportMedical Diagnostics', 'pub.contactEmail': 'recepce@sportmedical-diagnostics.cz', 'pub.contactPhone': '+420 606 785 271',
  'pub.contactAddress': 'Jihlavská 1558/21, 140 00 Praha 4', 'pub.openingHours': 'Po–Pá 8:00–18:00 · So 8:00–18:00 · Ne zavřeno',
};
const save = () => screen.getByRole('button', { name: /Uložit kontakty a rezervace/ });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  readSettings.mockReset().mockResolvedValue({ ...STORED });
  saveSettings.mockReset().mockResolvedValue(undefined);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('reading what is stored · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('fills every field, and the preview shows what a patient will see', async () => {
    renderScreen(<Admin />, '/admin');
    expect(await screen.findByDisplayValue('SportMedical Diagnostics')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('recepce@sportmedical-diagnostics.cz');
    expect(screen.getByLabelText('Telefon')).toHaveValue('+420 606 785 271');
    expect(screen.getByLabelText('Adresa')).toHaveValue('Jihlavská 1558/21, 140 00 Praha 4');
    expect(screen.getByLabelText('Otevírací doba (text pro web)')).toHaveValue('Po–Pá 8:00–18:00 · So 8:00–18:00 · Ne zavřeno');
    expect(screen.getByText('Online rezervace zapnuté')).toBeInTheDocument();
  });
});

describe('the booking switch', () => {
  it.each([
    ['absent', undefined, true],
    ['"true"', 'true', true],
    ['"false"', 'false', false],
    ['an empty row left by an earlier save', '', true],
    ['an unknown word', 'maybe', true],
  ])('%s reads as %s', async (_label, stored, on) => {
    readSettings.mockResolvedValue({ ...STORED, ...(stored === undefined ? {} : { 'pub.bookingEnabled': stored }) });
    renderScreen(<Admin />, '/admin');
    await screen.findByDisplayValue('SportMedical Diagnostics');
    expect(screen.getByRole('switch')).toHaveProperty('checked', on);
  });

  it('is saved as the text "false" / "true"', async () => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await user.click(await screen.findByRole('switch'));
    await user.click(save());
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveSettings.mock.calls[0][0]['pub.bookingEnabled']).toBe('false');
  });
});

describe('saving', () => {
  it('sends all seven keys in one request, trimmed, with the web address reduced to its origin', async () => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    const name = await screen.findByLabelText('Název webu');
    await user.clear(name);
    await user.type(name, '  Nová ordinace  ');
    await user.type(screen.getByLabelText('Veřejná adresa webu'), 'www.priklad.cz/rezervace/');
    await user.click(save());
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    expect(saveSettings).toHaveBeenCalledWith({
      'pub.siteName': 'Nová ordinace', 'pub.contactEmail': STORED['pub.contactEmail'], 'pub.contactPhone': STORED['pub.contactPhone'], 'pub.contactAddress': STORED['pub.contactAddress'],
      'pub.openingHours': STORED['pub.openingHours'], 'pub.siteUrl': 'https://www.priklad.cz', 'pub.bookingEnabled': 'true',
    });
  });

  it('sends an emptied field as "", which is how the owner removes a number from the web', async () => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await user.clear(await screen.findByLabelText('Telefon'));
    await user.click(save());
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveSettings.mock.calls[0][0]['pub.contactPhone']).toBe('');
  });

  it('says "Nastavení uloženo!" only after the request went through', async () => {
    let finish: () => void = () => undefined;
    saveSettings.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await screen.findByDisplayValue('SportMedical Diagnostics');
    await user.click(save());
    expect(screen.queryByText('Nastavení uloženo!')).not.toBeInTheDocument();
    finish();
    expect(await screen.findByText('Nastavení uloženo!')).toBeInTheDocument();
  });

  it('says it did NOT save when the request failed, never "uloženo"', async () => {
    saveSettings.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await screen.findByDisplayValue('SportMedical Diagnostics');
    await user.click(save());
    expect(await screen.findByText('Nastavení se nepodařilo uložit. Zkuste to prosím znovu.')).toBeInTheDocument();
    expect(screen.queryByText('Nastavení uloženo!')).not.toBeInTheDocument();
  });

  it('keeps Uložit off while saving, so a double click is one request', async () => {
    let finish: () => void = () => undefined;
    saveSettings.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await screen.findByDisplayValue('SportMedical Diagnostics');
    await user.dblClick(save());
    expect(saveSettings).toHaveBeenCalledTimes(1);
    finish();
  });
});

describe('what the server would store without a word', () => {
  it.each(['not-an-email', 'a@b', '@x.cz', 'a b@x.cz', 'a@x'])('refuses the e-mail "%s" at the field and does not send it', async (typed) => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, typed);
    expect(screen.getByText('Zadejte e-mail ve tvaru recepce@priklad.cz.')).toBeInTheDocument();
    await user.click(save());
    expect(saveSettings).not.toHaveBeenCalled();
    expect(await screen.findByText(/E-mail pro pacienty není platný/)).toBeInTheDocument();
  });

  it.each(['recepce@priklad.cz', ' jan.novak+test@sub.priklad.co.uk '])('accepts the e-mail "%s"', async (typed) => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, typed);
    await user.click(save());
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveSettings.mock.calls[0][0]['pub.contactEmail']).toBe(typed.trim());
  });

  it('an empty e-mail is allowed (the public page then prints no address)', async () => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await user.clear(await screen.findByLabelText('Email'));
    await user.click(save());
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
  });

  it.each(['javascript:alert(1)', 'ftp://x', 'http://'])('does not send the web address "%s"', async (typed) => {
    const user = userEvent.setup();
    renderScreen(<Admin />, '/admin');
    await user.type(await screen.findByLabelText('Veřejná adresa webu'), typed);
    await user.click(save());
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('stops the opening hours at 200 characters and counts them', async () => {
    renderScreen(<Admin />, '/admin');
    const hours = await screen.findByLabelText('Otevírací doba (text pro web)');
    expect(hours).toHaveAttribute('maxlength', '200');
    expect(screen.getByText(/\/200/)).toBeInTheDocument();
  });
});

describe('Poslední změny', () => {
  it('asks the history under "pub", where the server files the public details', async () => {
    const { fetchSettingChanges } = await import('../components/settings/changesApi');
    renderScreen(<Admin />, '/admin');
    await screen.findByDisplayValue('SportMedical Diagnostics');
    await waitFor(() => expect(fetchSettingChanges).toHaveBeenCalledWith('pub', 5));
  });
});

describe('a stored value that cannot be read', () => {
  it('keeps Uložit off and explains, so the blanks are never written over the stored details', async () => {
    readSettings.mockRejectedValue(new Error('down'));
    renderScreen(<Admin />, '/admin');
    expect(await screen.findByText(/Uložené kontakty se nepodařilo načíst/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});

describe('normalizeBase', () => {
  it.each([
    ['https://www.priklad.cz', 'https://www.priklad.cz'],
    ['www.priklad.cz', 'https://www.priklad.cz'],
    ['http://priklad.cz/cesta?x=1', 'http://priklad.cz'],
    ['  priklad.cz/  ', 'https://priklad.cz'],
    ['', ''],
    ['javascript:alert(1)', ''],
    ['http://', ''],
  ])('%j -> %j', (typed, expected) => {
    expect(normalizeBase(typed)).toBe(expected);
  });
});
