/*
 * Rychlá registrace (/nastaveni/rychla-registrace): the deadline, the reminder
 * and the date-of-birth switch - in three layouts, with its validation, its
 * save payload, the sentences about what happens at expiry and a failed load.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import QuickRegistrationSettingsPage, { daysHelper, hoursText, validateQuickRegistration } from './QuickRegistrationSettingsPage';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../api/quickRegistrationSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/quickRegistrationSettings')>();
  return { ...actual, quickRegistrationSettingsApi: { get, put } };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const SAVED = { expiryHours: 24, reminderHoursBeforeExpiry: 4, requireDateOfBirthOnCompletion: false };

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/rychla-registrace']}>
        <QuickRegistrationSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue(SAVED);
  put.mockReset().mockImplementation(async (s) => s);
});

describe.each(Object.entries(VIEWPORTS))('Rychlá registrace at %s (%i px)', (name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the saved values, the switch and what happens at expiry; the save bar is pinned only on a phone', async () => {
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('24');
    expect(screen.getByLabelText('Připomínka před vypršením')).toHaveValue('4');
    expect(screen.getByRole('switch', { name: 'Při dokončení vyžadovat datum narození' })).not.toBeChecked();

    const explainer = screen.getByRole('region', { name: 'Co se stane' });
    expect(explainer).toHaveTextContent('rezervace zanikne, termín se uvolní a provizorní záznam pacienta se smaže');
    expect(explainer).toHaveTextContent('Zatím se nic neposílá automaticky');

    const saveButtons = screen.getAllByRole('button', { name: 'Uložit' });
    expect(saveButtons).toHaveLength(1);
    expect(getComputedStyle(saveButtons[0].parentElement as HTMLElement).position === 'sticky').toBe(name === 'phone');
    expect(parseFloat(getComputedStyle(saveButtons[0]).minHeight)).toBeGreaterThanOrEqual(44);
  });
});

describe('QuickRegistrationSettingsPage', () => {
  it('turns the hours into days under the field', async () => {
    const user = userEvent.setup();
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    expect(screen.getByText(/= 1\sden/)).toBeInTheDocument();
    await user.clear(expiry);
    await user.type(expiry, '52');
    expect(screen.getByText(/= 2\sdny a\s4\sh/)).toBeInTheDocument();
  });

  it('writes the explanation in the clinic\'s own numbers as they are typed', async () => {
    const user = userEvent.setup();
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    const explainer = screen.getByRole('region', { name: 'Co se stane' });
    expect(explainer).toHaveTextContent(/Pacient má na dokončení 24\shodin od objednání\./);
    expect(explainer).toHaveTextContent(/zařadí se 4\shodiny před vypršením/);
    await user.clear(expiry);
    await user.type(expiry, '72');
    await user.clear(screen.getByLabelText('Připomínka před vypršením'));
    await user.type(screen.getByLabelText('Připomínka před vypršením'), '0');
    expect(explainer).toHaveTextContent(/Pacient má na dokončení 72\shodin/);
    expect(explainer).toHaveTextContent(/Připomínka:\s*vypnutá\./);
  });

  it('keeps Uložit off until something changes and Zahodit restores the saved values', async () => {
    const user = userEvent.setup();
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.clear(expiry);
    await user.type(expiry, '48');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(expiry).toHaveValue('24');
    expect(put).not.toHaveBeenCalled();
  });

  it('refuses hours outside 1-720 and a reminder longer than the whole deadline, without a request', async () => {
    const user = userEvent.setup();
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    await user.clear(expiry);
    await user.type(expiry, '721');
    expect(await screen.findByText('Zadejte celý počet hodin od 1 do 720 (30 dní).')).toBeInTheDocument();

    await user.clear(expiry);
    await user.type(expiry, '3');
    expect(await screen.findByText(/nejvýš 3\shodiny před vypršením/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(put).not.toHaveBeenCalled();
  });

  it('saves the numbers and the switch', async () => {
    const user = userEvent.setup();
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    await user.clear(expiry);
    await user.type(expiry, '72');
    await user.click(screen.getByRole('switch', { name: 'Při dokončení vyžadovat datum narození' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ expiryHours: 72, reminderHoursBeforeExpiry: 4, requireDateOfBirthOnCompletion: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
    expect(screen.getByLabelText('Platnost odkazu')).toHaveValue('72');
  });

  it('shows the server\'s own sentence under the field it names', async () => {
    const user = userEvent.setup();
    put.mockRejectedValue(refused(400, { message: 'Nastavení se nepodařilo uložit.', errors: { expiryHours: ['Lhůta je kratší než poslední objednávka.'] } }));
    renderPage();
    const expiry = await screen.findByLabelText('Platnost odkazu');
    await user.clear(expiry);
    await user.type(expiry, '30');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Lhůta je kratší než poslední objednávka.')).toBeInTheDocument();
    expect(screen.getByText('Nastavení se nepodařilo uložit.')).toBeInTheDocument();
  });

  it('keeps the frame and offers Zkusit znovu when the load fails', async () => {
    const user = userEvent.setup();
    get.mockRejectedValueOnce(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Nastavení rychlé registrace se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Rychlá registrace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('24');
  });
});

describe('quick registration rules', () => {
  it('words days and hours in Czech', () => {
    expect(daysHelper(24)).toMatch(/^= 1\sden$/);
    expect(daysHelper(720)).toMatch(/^= 30\sdní$/);
    expect(daysHelper(12)).toBe('méně než jeden den');
    expect(hoursText(1)).toMatch(/1\shodina/);
    expect(hoursText(3)).toMatch(/3\shodiny/);
    expect(hoursText(5)).toMatch(/5\shodin/);
  });

  it('checks the draft', () => {
    const ok = { expiryHours: '24', reminderHoursBeforeExpiry: '4', requireDateOfBirthOnCompletion: false };
    expect(validateQuickRegistration(ok)).toEqual({});
    expect(validateQuickRegistration({ ...ok, expiryHours: '0' }).expiryHours).toBeDefined();
    expect(validateQuickRegistration({ ...ok, expiryHours: 'abc' }).expiryHours).toBeDefined();
    expect(validateQuickRegistration({ ...ok, reminderHoursBeforeExpiry: '25' }).reminderHoursBeforeExpiry).toBeDefined();
    expect(validateQuickRegistration({ ...ok, reminderHoursBeforeExpiry: '24' })).toEqual({});
  });
});
