/*
 * The club-block dialog is EDIT ONLY (Etapa 10): a club's reservation is created as a club order in the calendar,
 * never as a loose block, so there is no "Nový blok pro klub" any more. What only the screen can show, at the three
 * widths: that the dialog opens on the block with the club, the calendars and the činnosti locked; that the
 * calculator asks about it and says the same sentence the board draws; that it warns (never blocks) below the
 * minimum; that seats per činnost show the registered count and refuse to go below it; that the update carries
 * exactly the body the contract names; and that an edit that would hit registered athletes lists them and waits
 * for a second, explicit confirmation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { Calculation, CalculationInput, ClubBlockView } from '../../api/clubBlocks';
import { answerFor, legacyAnswer } from './dialog/calcFixtures';

const calculate = vi.fn();
const update = vi.fn();
const create = vi.fn();
const fetchActivities = vi.fn();

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
    ]),
  },
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's-1', name: 'Sportovní prohlídky', description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: '#2E7D6B' },
      { id: 's-2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: '#3B6EA8' },
    ]),
  },
}));

const { ClubBlockDialog } = await import('./ClubBlockDialog');
const { ClubBlockError } = await import('../../api/clubBlocks');

const saved = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1', 'a-3'],
  fromDate: '2026-10-26', toDate: '2026-10-28', dailyFrom: null, dailyTo: null, playerCount: 40, seats: 40, registered: 15,
  status: 'Active', registrationToken: 'tok', registrationUrl: 'https://app/klub/tok', note: null, createdAtUtc: null, athletes: [],
  activitySeats: [
    { activityId: 'a-1', activityName: 'Základní prohlídka', seats: 30, registered: 12 },
    { activityId: 'a-3', activityName: 'Komplexní prohlídka', seats: 10, registered: 3 },
  ],
  ...over,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const open = (props: Partial<Parameters<typeof ClubBlockDialog>[0]> = {}) =>
  render(<Wrap><ClubBlockDialog block={saved()} onClose={vi.fn()} {...props} /></Wrap>);

const group = async (name: string) => within(await screen.findByRole('group', { name }));
const setDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const norm = (el: HTMLElement) => el.textContent?.replace(/\s/g, ' ') ?? '';
const seatsField = (activity: string) => screen.getByLabelText(`Počet hráčů, ${activity}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00+02:00'));
  setViewport(VIEWPORTS.desktop);
  calculate.mockReset().mockImplementation(async (input: CalculationInput) => answerFor(input));
  update.mockReset().mockResolvedValue(saved());
  create.mockReset();
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
    { id: 'a-3', name: 'Komplexní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#3B6EA8', parallelCapacity: 1 },
  ]);
});

afterEach(() => vi.useRealTimers());

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
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeInTheDocument();
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

describe('a block can no longer be created here', () => {
  it('has no new-block title, no club picker, no create button and no extra-term button', async () => {
    open();
    expect(await screen.findByRole('heading', { name: /Upravit blok/ })).toBeInTheDocument();
    expect(screen.queryByText('Nový blok pro klub')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Klub')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vytvořit blok/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat další termín/ })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('editing a block', () => {
  it('locks the club, the calendars and the činnosti and saves the days and the headcount', async () => {
    const user = userEvent.setup();
    open();
    expect(await (await group('Kalendáře')).findByRole('checkbox', { name: /Prohlídky/ })).toBeDisabled();
    expect(screen.getAllByText('FK Slaný').length).toBeGreaterThan(0);

    setDate('Do', '2026-10-30');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      'b-1',
      { fromDate: '2026-10-26', toDate: '2026-10-30', activitySeats: [{ activityId: 'a-1', seats: 30 }, { activityId: 'a-3', seats: 10 }], note: null, dailyFrom: null, dailyTo: null },
      { cancelAthletes: false },
    ));
  });

  it('shows the seats per činnost with the registered count, and refuses to go below it', async () => {
    const user = userEvent.setup();
    open();
    expect(await screen.findAllByTestId('seats-row')).toHaveLength(2);
    expect(screen.getAllByTestId('seats-registered').map((el) => norm(el))).toEqual(['12 / 30 obsazeno', '3 / 10 obsazeno']);
    expect(screen.getByTestId('seats-total')).toHaveTextContent('Celkem: 40 míst');

    fireEvent.change(seatsField('Základní prohlídka'), { target: { value: '10' } });
    expect(screen.getAllByTestId('seats-registered').map((el) => norm(el))[0]).toBe('12 / 10 obsazeno — nejméně 12');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(seatsField('Základní prohlídka'), { target: { value: '12' } });
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toMatchObject({ activitySeats: [{ activityId: 'a-1', seats: 12 }, { activityId: 'a-3', seats: 10 }] });
  });

  it('keeps the single headcount of a block the server holds without seats per činnost', async () => {
    update.mockResolvedValue(saved({ activitySeats: [] }));
    const user = userEvent.setup();
    open({ block: saved({ activitySeats: [], playerCount: 40, activityIds: ['a-1'] }) });
    expect(await screen.findByLabelText('Počet hráčů')).toHaveValue('40');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toMatchObject({ playerCount: 40 });
    expect(update.mock.calls[0][1]).not.toHaveProperty('activitySeats');
  });

  it('lists the athletes a 409 names and sends the confirmation only when asked twice', async () => {
    update
      .mockRejectedValueOnce(new ClubBlockError('Změna se dotkne sportovců.', 409, [
        { id: 'a1', name: 'Jan Novák', activityName: 'Základní prohlídka', startUtc: '2026-11-03T09:00:00Z', endUtc: '2026-11-03T09:40:00Z', status: 'Booked', phone: '' },
        { id: 'a2', name: 'Petr Malý', activityName: '', startUtc: '', endUtc: '', status: 'Booked', phone: '' },
      ]))
      .mockResolvedValue(saved({ toDate: '2026-10-30' }));
    const user = userEvent.setup();
    open();
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

  it('shows the server\'s refusal and keeps the form filled', async () => {
    update.mockRejectedValue(new ClubBlockError('V tom termínu už je jiný blok.', 400));
    const user = userEvent.setup();
    open();
    setDate('Do', '2026-10-30');
    await user.click(await screen.findByRole('button', { name: 'Uložit změny' }));
    expect(await screen.findByText('V tom termínu už je jiný blok.')).toBeInTheDocument();
    expect(screen.getByLabelText('Do')).toHaveValue('2026-10-30');
  });
});

describe('the calculator', () => {
  it('asks about the block and draws the analysis of the club as one whole', async () => {
    open();
    const line = (await screen.findAllByTestId('analysis-activity'))[0];
    expect(norm(line)).toContain('Základní prohlídka · 30 hráčů × 60 min ÷ 2 stanoviště');
    expect(await screen.findByTestId('analysis-total')).toBeInTheDocument();
    await waitFor(() =>
      expect(calculate).toHaveBeenLastCalledWith(expect.objectContaining({
        activitySeats: [{ activityId: 'a-1', seats: 30 }, { activityId: 'a-3', seats: 10 }], calendarIds: ['c-1'],
      })),
    );
  });

  it('fills the days when "Použít návrh" is pressed', async () => {
    open({ block: saved({ fromDate: '2026-11-10', toDate: '2026-11-10' }) });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Použít návrh' }));
    expect(screen.getByLabelText('Od')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Do')).toHaveValue('2026-11-03');
  });

  it('warns below the minimum only when the answer says so, and does not block', async () => {
    calculate.mockImplementation(async (i: CalculationInput) => answerFor(i, { minimumPlayers: 25, belowMinimum: true } as Partial<Calculation>));
    open();
    expect(await screen.findByRole('status')).toHaveTextContent('Méně než minimum 25 hráčů');
    expect(screen.getByRole('button', { name: 'Použít návrh' })).toBeEnabled();
  });

  it('shows no warning when no minimum is set', async () => {
    calculate.mockImplementation(async (i: CalculationInput) => answerFor(i, { minimumPlayers: null, belowMinimum: false } as Partial<Calculation>));
    open();
    await screen.findByRole('button', { name: 'Použít návrh' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says "nevejde se" when the need does not fit the horizon', async () => {
    calculate.mockImplementation(async (i: CalculationInput) => answerFor(i, { fitsHorizon: false, suggestedDays: 90, suggestedTo: '2027-01-30' } as Partial<Calculation>));
    open();
    expect(await screen.findByText(/Nevejde se do období/)).toBeInTheDocument();
  });

  it('says what failed and offers a retry', async () => {
    calculate.mockRejectedValueOnce(new ClubBlockError('Kalkulace selhala.', 500));
    open();
    expect(await screen.findByText(/Kalkulačku se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByTestId('analysis-total')).toBeInTheDocument();
  });

  it('falls back to the old calculator when the server answers without an analysis', async () => {
    calculate.mockResolvedValue(legacyAnswer());
    open({ block: saved({ activitySeats: [], playerCount: 120, activityIds: ['a-1'] }) });
    const sentence = await screen.findByTestId('calculation-sentence');
    expect(norm(sentence)).toContain('120 hráčů × 60 min ÷ 2 stanoviště = 3 600 min');
  });
});

describe('the preview', () => {
  it("draws the block in the club's colour", async () => {
    open();
    await screen.findByTestId('club-block-form');
    const chip = screen.getByTestId('block-preview-chip');
    expect(chip).toHaveAttribute('data-color', '#2E7D6B');
    expect(chip).toHaveTextContent('FK Slaný');
  });

  it('shows each calendar with its colour', async () => {
    open();
    const box = (await group('Kalendáře')).getByRole('checkbox', { name: /Prohlídky/ });
    expect(box.closest('label')?.querySelector('[data-swatch="#0D5C52"]')).not.toBeNull();
  });
});
