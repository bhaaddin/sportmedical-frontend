/*
 * Nastavení klubů (/nastaveni/kluby): the two numbers the clinic decides about
 * club blocks. What the screen has to get right: that "Uložit" is live only on a
 * change, that a refusal shows the server's own sentence under its field, that a
 * failed load says so and retries, and that it holds together at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import ClubSettingsPage, { validateClubSettings } from './ClubSettingsPage';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get, put } };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/kluby']}>
        <ClubSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const NEW_DEFAULTS = { releaseUnusedDaysBefore: null, allowMultiServiceOrders: false };
const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null, ...NEW_DEFAULTS });
  put.mockReset().mockImplementation(async (settings) => settings);
});

describe('ClubSettingsPage', () => {
  it('shows the saved values - an empty minimum when none is set - with Uložit and Zahodit off until something changes', async () => {
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('14');
    const minimum = screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    expect(minimum).toHaveValue('');
    expect(minimum).not.toHaveAttribute('placeholder');
    expect(screen.getByText(/Prázdné pole = bez minima/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nastavení klubů' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();
  });

  it('saves what was typed, as numbers, and goes quiet again', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '21');
    await user.clear(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)'));
    await user.type(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)'), '25');

    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 21, minimumPlayers: 25, ...NEW_DEFAULTS }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
    expect(screen.getByLabelText('Platnost odkazu')).toHaveValue('21');
  });

  it('sends null when the minimum is left empty, and null again after clearing a saved one', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 20, minimumPlayers: null, ...NEW_DEFAULTS }));
  });

  it('clears a saved minimum to "no minimum"', async () => {
    get.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: 18, ...NEW_DEFAULTS });
    const user = userEvent.setup();
    renderPage();
    const minimum = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    expect(minimum).toHaveValue('18');
    await user.clear(minimum);
    expect(screen.queryByText(/Zadejte celý počet sportovců/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 14, minimumPlayers: null, ...NEW_DEFAULTS }));
  });

  it('keeps the palette the server sent, so saving here cannot wipe it', async () => {
    get.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null, ...NEW_DEFAULTS, blockPalette: ['#112233'] });
    const user = userEvent.setup();
    renderPage();
    const minimum = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    await user.type(minimum, '12');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith({ registrationLinkValidityDays: 14, minimumPlayers: 12, ...NEW_DEFAULTS, blockPalette: ['#112233'] }));
  });

  it('shows the server sentence under the minimum field', async () => {
    put.mockRejectedValue(refused(400, { message: 'Neplatné.', errors: { minimumPlayers: ['Minimum nesmí být větší než kapacita.'] } }));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)'), '500');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Minimum nesmí být větší než kapacita.')).toBeInTheDocument();
  });

  it('puts the saved values back with Zahodit, without a request', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '99');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(days).toHaveValue('14');
    expect(put).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('refuses a value the server would refuse, before the round trip', async () => {
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '0');
    expect(await screen.findByText('Odkaz musí platit aspoň jeden den.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(put).not.toHaveBeenCalled();

    await user.clear(days);
    await user.type(days, 'abc');
    expect(await screen.findByText('Zadejte celý počet dní.')).toBeInTheDocument();
  });

  it('shows the server\'s sentence under the field it refused, and the message above', async () => {
    put.mockRejectedValue(refused(400, { message: 'Nastavení klubů je neplatné.', errors: { registrationLinkValidityDays: ['Odkaz smí platit nejvýše 365 dní.'] } }));
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    await user.clear(days);
    await user.type(days, '500');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Nastavení klubů je neplatné.')).toBeInTheDocument();
    expect(screen.getByText('Odkaz smí platit nejvýše 365 dní.')).toBeInTheDocument();
    /* Nothing is lost: the typed value stays and Uložit is still live. */
    expect(days).toHaveValue('500');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('says what failed when the settings cannot be read, and reads them again on request', async () => {
    get.mockRejectedValueOnce(new Error('503'));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Nastavení klubů se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nastavení klubů' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByLabelText('Platnost odkazu')).toHaveValue('14');
  });

  it('keeps a saved failure from emptying the form', async () => {
    put.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderPage();
    const players = await screen.findByLabelText('Minimální počet sportovců pro blok (nepovinné)');
    await user.clear(players);
    await user.type(players, '40');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Nastavení se nepodařilo uložit/)).toBeInTheDocument();
    expect(players).toHaveValue('40');
  });
});

describe('ClubSettingsPage in three layouts', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('draws the form and the save buttons on %s', async (_device, width) => {
    setViewport(width);
    renderPage();
    expect(await screen.findByLabelText('Platnost odkazu')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimální počet sportovců pro blok (nepovinné)')).toBeInTheDocument();
    /* On a phone the frame pins the pair to the bottom; either way each button exists once. */
    expect(screen.getAllByRole('button', { name: 'Uložit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Zahodit' })).toHaveLength(1);
  });
});

describe('validateClubSettings', () => {
  const draftOf = (d: { registrationLinkValidityDays: string; minimumPlayers: string; releaseUnusedDaysBefore?: string }) =>
    validateClubSettings({ releaseUnusedDaysBefore: '', allowMultiServiceOrders: false, ...d });

  it('wants whole numbers and at least a day; the minimum may be empty, otherwise a whole number from 1', () => {
    expect(draftOf({ registrationLinkValidityDays: '14', minimumPlayers: '' })).toEqual({});
    expect(draftOf({ registrationLinkValidityDays: '14', minimumPlayers: '8' })).toEqual({});
    expect(draftOf({ registrationLinkValidityDays: '', minimumPlayers: '0' })).toEqual({
      registrationLinkValidityDays: 'Zadejte celý počet dní.',
      minimumPlayers: 'Zadejte celý počet sportovců od 1, nebo pole nechte prázdné.',
    });
    expect(draftOf({ registrationLinkValidityDays: '14', minimumPlayers: 'abc' }).minimumPlayers).toMatch(/celý počet sportovců/);
    expect(draftOf({ registrationLinkValidityDays: '5000', minimumPlayers: '' }).registrationLinkValidityDays).toMatch(/překlep/);
  });

  it('lets the release days be empty (never) or 0 and up', () => {
    const base = { registrationLinkValidityDays: '14', minimumPlayers: '' };
    expect(draftOf({ ...base, releaseUnusedDaysBefore: '' })).toEqual({});
    expect(draftOf({ ...base, releaseUnusedDaysBefore: '0' })).toEqual({});
    expect(draftOf({ ...base, releaseUnusedDaysBefore: '7' })).toEqual({});
    expect(draftOf({ ...base, releaseUnusedDaysBefore: '-1' }).releaseUnusedDaysBefore).toMatch(/celý počet dní/);
    expect(draftOf({ ...base, releaseUnusedDaysBefore: '2,5' }).releaseUnusedDaysBefore).toMatch(/celý počet dní/);
  });
});

describe('ClubSettingsPage club-order fields (C-O)', () => {
  const RELEASE = 'Otevřít nevyužitou kapacitu veřejnosti X dní před termínem';

  it('shows empty = never and the switch off by default, with the help sentences', async () => {
    renderPage();
    expect(await screen.findByLabelText(RELEASE)).toHaveValue('');
    expect(screen.getByRole('switch', { name: 'Povolit v jedné objednávce více služeb' })).not.toBeChecked();
    expect(screen.getByText(/Prázdné pole = nikdy/)).toBeInTheDocument();
    expect(screen.getByText(/Už zapsaní sportovci se nikdy nemění/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('saves the release days and the switch', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(RELEASE), '3');
    await user.click(screen.getByRole('switch', { name: 'Povolit v jedné objednávce více služeb' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith({
        registrationLinkValidityDays: 14,
        minimumPlayers: null,
        releaseUnusedDaysBefore: 3,
        allowMultiServiceOrders: true,
      }),
    );
  });

  it('accepts 0 and sends null again after clearing a saved value', async () => {
    get.mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: 5, allowMultiServiceOrders: true });
    const user = userEvent.setup();
    renderPage();
    const release = await screen.findByLabelText(RELEASE);
    expect(release).toHaveValue('5');
    expect(screen.getByRole('switch', { name: 'Povolit v jedné objednávce více služeb' })).toBeChecked();
    await user.clear(release);
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenLastCalledWith(expect.objectContaining({ releaseUnusedDaysBefore: null, allowMultiServiceOrders: true })));
    await user.type(release, '0');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenLastCalledWith(expect.objectContaining({ releaseUnusedDaysBefore: 0 })));
  });

  it('refuses a negative number before the round trip', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(RELEASE), '-2');
    expect(await screen.findByText('Zadejte celý počet dní (0 a víc), nebo pole nechte prázdné.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the server sentence under the release field', async () => {
    put.mockRejectedValue(refused(400, { message: 'Neplatné.', errors: { releaseUnusedDaysBefore: ['Nejvýše 60 dní.'] } }));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(RELEASE), '90');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Nejvýše 60 dní.')).toBeInTheDocument();
  });

  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('draws both new fields on %s', async (_d, width) => {
    setViewport(width);
    renderPage();
    expect(await screen.findByLabelText(RELEASE)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Povolit v jedné objednávce více služeb' })).toBeInTheDocument();
  });
});
