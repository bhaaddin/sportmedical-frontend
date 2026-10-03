/*
 * Club-block dialog, Etapa 3: the club as one whole.
 *
 * What only the screen can show, at the three widths: that ticking a calendar
 * shows only its service's činnosti; that every chosen činnost gets its own
 * seats with a total underneath; that the seats are filled from the window the
 * operator dragged (09:40 counts from 09:40), alone or shared between several
 * činnosti; what the analysis says when the club fits, is short, or does not
 * fit the booking horizon; the payload with `activitySeats`; and that editing
 * shows how many seats are registered and refuses to go below that.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { CalculationInput, ClubBlockView } from '../../api/clubBlocks';
import { answerFor } from './dialog/calcFixtures';

const calculate = vi.fn();
const create = vi.fn();
const update = vi.fn();
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
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { create: vi.fn(), getAll: vi.fn(), update: vi.fn(), deactivate: vi.fn() }, clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() } };
});

const { ClubBlockDialog } = await import('./ClubBlockDialog');

const club = (id: string, name: string) => ({ id, name, ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z' });
const clubs = [club('club-1', 'FK Slaný')];

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
  render(<Wrap><ClubBlockDialog clubs={clubs} onClose={vi.fn()} {...props} /></Wrap>);

const group = async (name: string) => within(await screen.findByRole('group', { name }));
const norm = (el: HTMLElement) => el.textContent?.replace(/\s/g, ' ') ?? '';
const tick = async (user: ReturnType<typeof userEvent.setup>, list: 'Kalendáře' | 'Činnosti', name: RegExp) =>
  user.click(await (await group(list)).findByRole('checkbox', { name }));
const seatsField = (name: string) => screen.getByLabelText(`Počet hráčů, ${name}`);

/** 09:40-10:40 on one day, as the calendar hands it over when a slot is dragged. */
const SLOT = { clubId: 'club-1', calendarIds: ['c-1', 'c-2'], ranges: [{ fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '09:40', dailyTo: '10:40' }] };
/** The same window on five days: 300 minutes. */
const WEEK = { clubId: 'club-1', calendarIds: ['c-1', 'c-2'], ranges: [{ fromDate: '2026-10-26', toDate: '2026-10-30', dailyFrom: '09:40', dailyTo: '10:40' }] };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00+02:00'));
  setViewport(VIEWPORTS.desktop);
  calculate.mockReset().mockImplementation(async (input: CalculationInput) => answerFor(input));
  create.mockReset().mockResolvedValue(saved());
  update.mockReset().mockResolvedValue(saved());
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
    { id: 'a-3', name: 'Komplexní prohlídka', durationMinutes: 30, clinicServiceId: 's-1', colorHex: '#1F6F5C', parallelCapacity: 1 },
    { id: 'a-2', name: 'Spiroergometrie', durationMinutes: 45, clinicServiceId: 's-2', colorHex: '#3B6EA8', parallelCapacity: 1 },
  ]);
});
afterEach(() => vi.useRealTimers());

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('at %s width', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows only the činnosti of the ticked service, grouped under its name, and none ticked', async () => {
    const user = userEvent.setup();
    open();
    expect(await screen.findByTestId('activities-hint')).toHaveTextContent('Nejdřív zaškrtněte kalendář');

    await tick(user, 'Kalendáře', /Prohlídky/);
    const acts = await group('Činnosti');
    expect(await acts.findByText('Sportovní prohlídky')).toBeInTheDocument();
    expect(acts.getByRole('checkbox', { name: /Základní prohlídka/ })).not.toBeChecked();
    expect(acts.getByRole('checkbox', { name: /Komplexní prohlídka/ })).not.toBeChecked();
    expect(acts.queryByRole('checkbox', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('activity-group').querySelector('[data-swatch="#2E7D6B"]')).not.toBeNull();

    /* A second service adds its own group; unticking the first drops its činnosti and their seats. */
    await tick(user, 'Kalendáře', /Spiroergometrie/);
    expect(await acts.findByRole('checkbox', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(acts.getAllByText(/Diagnostika/)).toHaveLength(1);
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await user.type(seatsField('Základní prohlídka'), '10');
    await tick(user, 'Kalendáře', /Prohlídky/);
    expect(acts.queryByRole('checkbox', { name: /Základní prohlídka/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Počet hráčů, Základní prohlídka')).not.toBeInTheDocument();
  });

  it('has a seats row for every chosen činnost and adds the club up as one whole', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'] } });
    expect(screen.getByTestId('seats-table')).toHaveTextContent('Vyberte činnosti');

    await tick(user, 'Činnosti', /Základní prohlídka/);
    await tick(user, 'Činnosti', /Komplexní prohlídka/);
    expect(screen.getAllByTestId('seats-row')).toHaveLength(2);
    await user.type(seatsField('Základní prohlídka'), '10');
    await user.type(seatsField('Komplexní prohlídka'), '60');
    expect(screen.getByTestId('seats-total')).toHaveTextContent('Celkem: 70 míst');
  });

  it('counts from the selected time: the window text and "vejde se max." come from the dragged slot', async () => {
    const user = userEvent.setup();
    open({ prefill: SLOT });
    expect(screen.getByTestId('row-window')).toHaveTextContent('Počítá se od 09:40 do 10:40');
    expect(screen.getByLabelText('Denně od')).toHaveValue('09:40');
    expect(screen.getByLabelText('Denně do')).toHaveValue('10:40');

    await tick(user, 'Činnosti', /Základní prohlídka/);
    /* 60 minutes of window, two stations, 60 minutes a seat = 2 seats alone. */
    expect(await screen.findByTestId('seats-max')).toHaveTextContent('vejde se max. 2');
    const input = calculate.mock.calls.at(-1)?.[0] as CalculationInput;
    expect(input.ranges).toEqual([{ fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '09:40', dailyTo: '10:40' }]);
  });

  it('fills the seats of ONE činnost from the window', async () => {
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    const button = screen.getByRole('button', { name: 'Spočítat počet hráčů z vybraného času' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    /* 300 minutes x 2 stations / 60 minutes = 10. */
    expect(seatsField('Základní prohlídka')).toHaveValue('10');
    expect(screen.getByTestId('seats-total')).toHaveTextContent('Celkem: 10 míst');
  });

  it('shares the window equally between several činnosti when no seats are typed', async () => {
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await tick(user, 'Činnosti', /Spiroergometrie/);
    const button = screen.getByRole('button', { name: 'Spočítat počet hráčů z vybraného času' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    /* 150 minutes each: 150 x 2 / 60 = 5 and 150 x 1 / 45 = 3. */
    expect(seatsField('Základní prohlídka')).toHaveValue('5');
    expect(seatsField('Spiroergometrie')).toHaveValue('3');
    expect(screen.getByTestId('seats-fill-message')).toHaveTextContent('Rozděleno rovným dílem mezi 2 činnosti — upravte podle klubu');
  });

  it('shares the window in the proportion of the seats already typed', async () => {
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await tick(user, 'Činnosti', /Spiroergometrie/);
    await user.type(seatsField('Základní prohlídka'), '3');
    await user.type(seatsField('Spiroergometrie'), '1');
    const button = screen.getByRole('button', { name: 'Spočítat počet hráčů z vybraného času' });
    await waitFor(() => expect(button).toBeEnabled());
    await waitFor(() => expect(calculate).toHaveBeenLastCalledWith(expect.objectContaining({ activitySeats: [{ activityId: 'a-1', seats: 3 }, { activityId: 'a-2', seats: 1 }] })));
    await waitFor(() => expect(screen.getByTestId('analysis-total')).toBeInTheDocument());
    await user.click(button);
    /* 3 : 1 of 300 minutes = 225 and 75: 225 x 2 / 60 = 7 and 75 / 45 = 1. */
    expect(seatsField('Základní prohlídka')).toHaveValue('7');
    expect(seatsField('Spiroergometrie')).toHaveValue('1');
    expect(screen.getByTestId('seats-fill-message')).toHaveTextContent('v poměru zadaných míst');
  });

  it('says the club fits (green), with the room that is left and the per-range minutes', async () => {
    calculate.mockImplementation(async (input: CalculationInput) => answerFor(input, {}, { capacityNote: 'Diagnostika má jedno stanoviště.' }));
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await user.type(seatsField('Základní prohlídka'), '4');
    const total = await screen.findByTestId('analysis-total');
    expect(total).toHaveAttribute('data-state', 'fits');
    expect(norm(total)).toContain('Klub celkem: 4 místa, potřebuje 120 min, k dispozici ve vybraných termínech 300 min — zbývá 180 min');
    expect(norm(screen.getByTestId('analysis-range'))).toContain('09:40–10:40');
    expect(screen.getByTestId('capacity-note')).toHaveTextContent('Diagnostika má jedno stanoviště.');
  });

  it('says how many minutes are missing (red) and still lets the block be saved', async () => {
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await user.type(seatsField('Základní prohlídka'), '30');
    const total = await screen.findByTestId('analysis-total');
    await waitFor(() => expect(total).toHaveAttribute('data-state', 'short'));
    expect(norm(total)).toContain('potřebuje 900 min, k dispozici ve vybraných termínech 300 min — chybí 600 min');
    expect(screen.getByRole('button', { name: 'Vytvořit blok' })).toBeEnabled();
  });

  it('warns when the need does not fit the booking horizon, without blocking', async () => {
    calculate.mockImplementation(async (input: CalculationInput) => answerFor(input, { fitsHorizon: false }));
    const user = userEvent.setup();
    open({ prefill: WEEK });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await user.type(seatsField('Základní prohlídka'), '5000');
    expect(await screen.findByTestId('horizon-warning')).toHaveTextContent('Nevejde se do období, které lze rezervovat');
    expect(screen.getByRole('button', { name: 'Vytvořit blok' })).toBeEnabled();
  });
});

describe('creating', () => {
  it('sends activitySeats for every chosen činnost, in the order they were chosen, and no playerCount', async () => {
    const user = userEvent.setup();
    open({ prefill: { ...SLOT, calendarIds: ['c-1', 'c-2'] } });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await tick(user, 'Činnosti', /Spiroergometrie/);
    await user.type(seatsField('Základní prohlídka'), '10');
    await user.type(seatsField('Spiroergometrie'), '60');
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toEqual({
      clubId: 'club-1', name: null, calendarIds: ['c-1', 'c-2'], fromDate: '2026-10-26', toDate: '2026-10-26',
      dailyFrom: '09:40', dailyTo: '10:40',
      activitySeats: [{ activityId: 'a-1', seats: 10 }, { activityId: 'a-2', seats: 60 }], note: null,
    });
  });

  it('refuses a chosen činnost without seats, with one sentence, and sends nothing', async () => {
    const user = userEvent.setup();
    open({ prefill: SLOT });
    await tick(user, 'Činnosti', /Základní prohlídka/);
    await tick(user, 'Činnosti', /Spiroergometrie/);
    await user.type(seatsField('Základní prohlídka'), '10');
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    expect(await screen.findByText('Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('editing', () => {
  it('shows the seats per činnost with the registered count, and refuses to go below it', async () => {
    const user = userEvent.setup();
    open({ block: saved() });
    const rows = await screen.findAllByTestId('seats-row');
    expect(rows).toHaveLength(2);
    const registered = screen.getAllByTestId('seats-registered').map((el) => norm(el));
    expect(registered[0]).toBe('12 / 30 obsazeno');
    expect(registered[1]).toBe('3 / 10 obsazeno');
    expect(screen.getByTestId('seats-total')).toHaveTextContent('Celkem: 40 míst');

    fireEvent.change(seatsField('Základní prohlídka'), { target: { value: '10' } });
    expect(screen.getAllByTestId('seats-registered').map((el) => norm(el))[0]).toBe('12 / 10 obsazeno — nejméně 12');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(seatsField('Základní prohlídka'), { target: { value: '12' } });
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toEqual({
      fromDate: '2026-10-26', toDate: '2026-10-28', activitySeats: [{ activityId: 'a-1', seats: 12 }, { activityId: 'a-3', seats: 10 }],
      note: null, dailyFrom: null, dailyTo: null,
    });
  });

  it('keeps the single headcount of a block the server holds without seats per činnost', async () => {
    update.mockResolvedValue(saved({ activitySeats: [] }));
    const user = userEvent.setup();
    open({ block: saved({ activitySeats: [], playerCount: 40, activityIds: ['a-1'] }) });
    const field = await screen.findByLabelText('Počet hráčů');
    expect(field).toHaveValue('40');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toMatchObject({ playerCount: 40 });
    expect(update.mock.calls[0][1]).not.toHaveProperty('activitySeats');
  });
});
