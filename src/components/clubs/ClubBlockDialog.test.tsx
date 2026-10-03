/*
 * The club-block dialog and its calculator, clicked through at the three widths.
 *
 * What only the screen can show: that the calculator asks while the operator
 * types and says the same sentence the board draws; that it warns (never
 * blocks) below the minimum and when the need does not fit; that a block is
 * created with exactly the body the contract names; that a club which does not
 * exist yet is created together with the block; and that an edit that would hit
 * registered athletes lists them and waits for a second, explicit confirmation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { Calculation, ClubBlockView } from '../../api/clubBlocks';

const calculate = vi.fn();
const create = vi.fn();
const update = vi.fn();
const fetchActivities = vi.fn();
const settingsGet = vi.fn();
const createClub = vi.fn();

vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { calculate, create, update, list: vi.fn(), get: vi.fn(), cancel: vi.fn() },
    fetchBlockableActivities: fetchActivities,
  };
});
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's-1' },
      { id: 'c-2', name: 'Spiroergometrie', color: '#2B5C9B', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's-2' },
      { id: 'c-off', name: 'Starý', color: '#000000', location: '', displayStepMinutes: 15, isActive: false, sortOrder: 2, clinicServiceId: null },
    ]),
  },
}));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { create: createClub, getAll: vi.fn(), update: vi.fn(), deactivate: vi.fn() }, clubSettingsApi: { get: settingsGet, put: vi.fn() } };
});

const { ClubBlockDialog } = await import('./ClubBlockDialog');
const { ClubBlockError } = await import('../../api/clubBlocks');

const club = (id: string, name: string) => ({ id, name, ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z' });
const clubs = [club('club-1', 'FK Slaný'), club('club-2', 'SK Kladno')];

const calc = (over: Partial<Calculation> = {}): Calculation => ({
  minutesPerPlayer: 60, parallelCapacity: 2, neededMinutes: 3600, dailyOpenMinutes: 600,
  suggestedDays: 7, suggestedFrom: '2026-10-26', suggestedTo: '2026-11-03', fitsHorizon: true, minimumPlayers: null,
  perDay: [{ date: '2026-10-26', openMinutes: 600 }, { date: '2026-10-27', openMinutes: 600 }], ...over,
});

const saved = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
  fromDate: '2026-10-26', toDate: '2026-11-03', dailyFrom: null, dailyTo: null, playerCount: 120, seats: 120, registered: 0,
  status: 'Active', registrationToken: 'tok', registrationUrl: 'https://app/klub/tok', note: null, createdAtUtc: null, athletes: null, ...over,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const open = (props: Partial<Parameters<typeof ClubBlockDialog>[0]> = {}) =>
  render(<Wrap><ClubBlockDialog clubs={clubs} onClose={vi.fn()} {...props} /></Wrap>);

const group = async (name: string) => within(await screen.findByRole('group', { name }));
const setDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillCalculatorInputs(user: ReturnType<typeof userEvent.setup>, players: string) {
  await user.type(screen.getByLabelText('Počet hráčů'), players);
  await user.click(await (await group('Kalendáře')).findByRole('checkbox', { name: /Prohlídky/ }));
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  calculate.mockReset().mockResolvedValue(calc());
  create.mockReset().mockResolvedValue(saved());
  update.mockReset().mockResolvedValue(saved());
  createClub.mockReset().mockResolvedValue(club('club-new', 'TJ Sokol Slaný'));
  settingsGet.mockReset().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: 30 });
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
    { id: 'a-2', name: 'Spiroergometrie', durationMinutes: 45, clinicServiceId: 's-2', colorHex: '#3B6EA8', parallelCapacity: 1 },
  ]);
});

describe('layouts', () => {
  it.each([
    ['phone', VIEWPORTS.phone, '1'],
    ['tablet', VIEWPORTS.tablet, '2'],
    ['desktop', VIEWPORTS.desktop, '2'],
  ])('draws the %s layout', async (device, width, columns) => {
    setViewport(width);
    open();
    const form = await screen.findByTestId('club-block-form');
    expect(form).toHaveAttribute('data-layout', device);
    expect(form).toHaveAttribute('data-columns', columns);
    /* The buttons are always in the dialog's own footer - at the bottom of a full-screen phone sheet. */
    expect(screen.getByRole('button', { name: 'Vytvořit blok' })).toBeInTheDocument();
    expect(screen.getByTestId('block-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('block-preview')).toBeInTheDocument();
  });

  it('takes the whole screen on a phone', async () => {
    setViewport(VIEWPORTS.phone);
    open();
    await screen.findByTestId('club-block-form');
    expect(screen.getByRole('dialog').className).toMatch(/paperFullScreen/);
  });
});

describe('the calculator', () => {
  it('asks while the operator types and writes the board\'s sentence', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByTestId('block-calculator')).toHaveTextContent('Zadejte počet hráčů');

    await fillCalculatorInputs(user, '120');
    const sentence = await screen.findByTestId('calculation-sentence');
    expect(sentence.textContent?.replace(/\s/g, ' ')).toBe('120 hráčů × 60 min ÷ 2 stanoviště = 3 600 min → 7 dní, 26. 10. – 3. 11.');

    /* Ticking the calendar offered its own činnost; the call carries the three lists. */
    expect((await group('Činnosti')).getByRole('checkbox', { name: /Základní prohlídka/ })).toBeChecked();
    expect((await group('Činnosti')).getByRole('checkbox', { name: /Spiroergometrie/ })).not.toBeChecked();
    await waitFor(() =>
      expect(calculate).toHaveBeenLastCalledWith({ playerCount: 120, activityIds: ['a-1'], calendarIds: ['c-1'], fromDate: undefined }),
    );

    const perDay = screen.getByRole('list', { name: 'Otevřeno po dnech' });
    expect(within(perDay).getAllByRole('listitem')).toHaveLength(2);
    expect(within(perDay).getByText('po 26. 10.')).toBeInTheDocument();
  });

  it('fills the days when "Použít návrh" is pressed', async () => {
    const user = userEvent.setup();
    open();
    await fillCalculatorInputs(user, '120');
    await user.click(await screen.findByRole('button', { name: 'Použít návrh' }));
    expect(screen.getByLabelText('Od')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Do')).toHaveValue('2026-11-03');
  });

  it('warns below the minimum from the club settings, and does not block', async () => {
    const user = userEvent.setup();
    open();
    await fillCalculatorInputs(user, '20');
    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent('Méně než doporučené minimum 30 hráčů');
    expect(screen.getByRole('button', { name: 'Použít návrh' })).toBeEnabled();
  });

  it('says "nevejde se" when the need does not fit the horizon', async () => {
    calculate.mockResolvedValue(calc({ fitsHorizon: false, suggestedDays: 90, suggestedTo: '2027-01-30' }));
    const user = userEvent.setup();
    open();
    await fillCalculatorInputs(user, '5000');
    const alert = await screen.findByText(/Nevejde se do období/);
    expect(alert).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says what failed and offers a retry', async () => {
    calculate.mockRejectedValueOnce(new ClubBlockError('Kalkulace selhala.', 500));
    const user = userEvent.setup();
    open();
    await fillCalculatorInputs(user, '120');
    expect(await screen.findByText(/Kalkulačku se nepodařilo načíst/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByTestId('calculation-sentence')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it("draws the block in the club's colour once the club is known", async () => {
    open({ prefill: { clubId: 'club-1' }, blocks: [saved({ colorHex: '#2E7D6B' })] });
    await screen.findByTestId('club-block-form');
    const chip = screen.getByTestId('block-preview-chip');
    expect(chip).toHaveAttribute('data-color', '#2E7D6B');
    expect(chip).toHaveTextContent('FK Slaný');
  });

  it('is honest that a new club has no colour yet', async () => {
    open({ prefill: { newClub: { name: 'TJ Sokol Slaný' } } });
    await screen.findByTestId('club-block-form');
    expect(screen.getByTestId('block-preview-chip')).toHaveAttribute('data-color', '');
    expect(screen.getByTestId('block-preview')).toHaveTextContent('Barvu klubu přidělí systém');
  });

  it('shows each calendar and činnost with its colour', async () => {
    open();
    const acts = await (await group('Činnosti')).findByRole('checkbox', { name: /Základní prohlídka/ });
    expect(acts.closest('label')?.querySelector('[data-swatch="#2E7D6B"]')).not.toBeNull();
    expect((await group('Kalendáře')).getByRole('checkbox', { name: /Prohlídky/ }).closest('label')?.querySelector('[data-swatch="#0D5C52"]')).not.toBeNull();
    expect((await group('Kalendáře')).queryByText('Starý')).not.toBeInTheDocument();
  });
});

describe('creating a block', () => {
  it('sends the contract body for a club picked from the list', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    open({ onSaved, onClose });

    await user.click(screen.getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
    await user.type(screen.getByLabelText('Počet hráčů'), '120');
    setDate('Od', '2026-10-26');
    setDate('Do', '2026-10-30');
    await user.click(await (await group('Kalendáře')).findByRole('checkbox', { name: /Prohlídky/ }));
    fireEvent.change(screen.getByLabelText('Denně od'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Denně do'), { target: { value: '12:00' } });
    await user.type(screen.getByLabelText('Poznámka'), 'Jarní příprava');
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      clubId: 'club-1', name: null, calendarIds: ['c-1'], activityIds: ['a-1'], fromDate: '2026-10-26', toDate: '2026-10-30',
      dailyFrom: '08:00', dailyTo: '12:00', playerCount: 120, note: 'Jarní příprava',
    });
    expect(createClub).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1' })));
    expect(onClose).toHaveBeenCalled();
  });

  it('refuses an incomplete form with a sentence under each field and sends nothing', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText('Vyberte klub nebo založte nový.')).toBeInTheDocument();
    expect(screen.getByText('Zadejte první den bloku.')).toBeInTheDocument();
    expect(screen.getByText('Vyberte aspoň jeden kalendář.')).toBeInTheDocument();
    expect(screen.getByText('Vyberte aspoň jednu činnost.')).toBeInTheDocument();
    expect(screen.getByText('Zadejte počet hráčů (celé číslo od 1).')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the server\'s refusal and keeps the form filled', async () => {
    create.mockRejectedValue(new ClubBlockError('V tom termínu už je jiný blok.', 409));
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], fromDate: '2026-10-26', toDate: '2026-10-27' } });
    await user.type(screen.getByLabelText('Počet hráčů'), '50');
    await user.click(await (await group('Činnosti')).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText('V tom termínu už je jiný blok.')).toBeInTheDocument();
    expect(screen.getByLabelText('Počet hráčů')).toHaveValue('50');
  });

  it('has no ceiling on the headcount', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], fromDate: '2026-10-26', toDate: '2026-12-31' } });
    await user.type(screen.getByLabelText('Počet hráčů'), '10000');
    await user.click(await (await group('Činnosti')).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ playerCount: 10000 })));
  });
});

describe('a club that does not exist yet', () => {
  it('opens with the new-club fields filled from the prefill, and creates the club with the block', async () => {
    const user = userEvent.setup();
    open({
      prefill: {
        newClub: { name: 'TJ Sokol Slaný', contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: 'trener@sokol.cz', headcount: 40 },
        calendarIds: ['c-1'], fromDate: '2026-10-26', toDate: '2026-10-28',
      },
    });

    expect(screen.getByLabelText('Název klubu')).toHaveValue('TJ Sokol Slaný');
    expect(screen.getByLabelText('Kontaktní osoba')).toHaveValue('Jan Trenér');
    expect(screen.getByLabelText('Telefon')).toHaveValue('+420 603 221 004');
    expect(screen.getByLabelText('E-mail')).toHaveValue('trener@sokol.cz');
    expect(screen.getByLabelText('Počet hráčů')).toHaveValue('40');
    expect(screen.getByLabelText('Od')).toHaveValue('2026-10-26');
    expect((await group('Kalendáře')).getByRole('checkbox', { name: /Prohlídky/ })).toBeChecked();

    /* The server needs an IČO to make a club - the dialog asks for it and checks the digit. */
    await user.click(await (await group('Činnosti')).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText(/IČO je povinné/)).toBeInTheDocument();
    expect(createClub).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('IČO'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText(/Tohle IČO neexistuje/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('IČO'));
    await user.type(screen.getByLabelText('IČO'), '00000019');
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));

    await waitFor(() => expect(createClub).toHaveBeenCalledTimes(1));
    expect(createClub).toHaveBeenCalledWith(expect.objectContaining({
      name: 'TJ Sokol Slaný', ico: '00000019', contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: 'trener@sokol.cz', paymentTermsDays: 14,
    }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ clubId: 'club-new', playerCount: 40, calendarIds: ['c-1'], activityIds: ['a-1'] })));
  });

  it('does not create the club twice when the block save has to be retried', async () => {
    create.mockRejectedValueOnce(new ClubBlockError('V tom termínu už je jiný blok.', 409)).mockResolvedValue(saved({ clubId: 'club-new' }));
    const user = userEvent.setup();
    open({ prefill: { newClub: { name: 'TJ Sokol Slaný', headcount: 40 }, calendarIds: ['c-1'], fromDate: '2026-10-26', toDate: '2026-10-28' } });
    await user.type(screen.getByLabelText('IČO'), '00000019');
    await user.click(await (await group('Činnosti')).findByRole('checkbox', { name: /Základní prohlídka/ }));
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText('V tom termínu už je jiný blok.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(createClub).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ clubId: 'club-new' }));
  });
});

describe('editing a block', () => {
  it('locks the club, the calendars and the činnosti and saves the days and the headcount', async () => {
    const user = userEvent.setup();
    open({ block: saved() });
    expect(await screen.findByRole('heading', { name: /Upravit blok/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Klub')).not.toBeInTheDocument();
    expect(await (await group('Kalendáře')).findByRole('checkbox', { name: /Prohlídky/ })).toBeDisabled();

    setDate('Do', '2026-10-30');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      'b-1', { fromDate: '2026-10-26', toDate: '2026-10-30', playerCount: 120, note: null, dailyFrom: null, dailyTo: null }, { cancelAthletes: false },
    ));
  });

  it('lists the athletes a 409 names and sends the confirmation only when asked twice', async () => {
    update
      .mockRejectedValueOnce(new ClubBlockError('Změna se dotkne sportovců.', 409, [
        { name: 'Jan Novák', activityName: 'Základní prohlídka', startUtc: '2026-11-03T09:00:00Z' },
        { name: 'Petr Malý', activityName: null, startUtc: null },
      ]))
      .mockResolvedValue(saved({ toDate: '2026-10-30' }));
    const user = userEvent.setup();
    open({ block: saved() });
    setDate('Do', '2026-10-30');
    await user.click(await screen.findByRole('button', { name: 'Uložit změny' }));

    const list = await screen.findByTestId('block-conflicts');
    expect(list).toHaveTextContent('Změna se dotkne sportovců.');
    expect(list).toHaveTextContent('Jan Novák · Základní prohlídka');
    expect(list).toHaveTextContent('Petr Malý');
    expect(update).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Potvrdit a zrušit rezervace' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][2]).toEqual({ cancelAthletes: true });
  });
});
