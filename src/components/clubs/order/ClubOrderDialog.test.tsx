/*
 * The club order dialog (the calendar's "chytrá zkratka") at the three widths.
 *
 * What only the screen can show: choosing the service clears the činnosti and offers only its own; counts add up
 * to one club total; the automatic proposal REPLACES the rows and every row stays editable; a confirmed
 * reservation needs a payment method and a request does not; the exact bodies of createStaff / update / confirm;
 * edit mode's +10 / -10, the refusal below `registered` and the 409 that lists the athletes; process mode; and the
 * success screen with the athletes' link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { CalculationInput } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { answerFor } from '../dialog/calcFixtures';

const createStaff = vi.fn();
const update = vi.fn();
const confirm = vi.fn();
const proposal = vi.fn();
const calculate = vi.fn();
const fetchActivities = vi.fn();
const getAllClubs = vi.fn();
const createClub = vi.fn();

vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { createStaff, update, confirm, proposal } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { calculate }, fetchBlockableActivities: fetchActivities };
});
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { getAll: getAllClubs, create: createClub } };
});
vi.mock('../../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's-1' },
      { id: 'c-2', name: 'Spiro', color: '#2B5C9B', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's-2' },
    ]),
  },
}));
vi.mock('../../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's-1', name: 'Sportovní prohlídka', description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' },
      { id: 's-2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: '#2B5C9B' },
    ]),
  },
}));

const { ClubOrderDialog } = await import('./ClubOrderDialog');
const { ClubOrderError } = await import('../../../api/clubOrders');

const club = (id: string, name: string) => ({ id, name, ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z' });

const RANGE = { fromDate: '2026-12-01', toDate: '2026-12-01', dailyFrom: '09:40', dailyTo: '10:40' };

const order = (over: Partial<ClubOrderView> = {}): ClubOrderView => ({
  id: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#2E7D6B', serviceId: 's-1', serviceName: 'Sportovní prohlídka',
  status: 'Confirmed', paymentMethod: 'ClubInvoice',
  activitySeats: [{ activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 30, registered: 12, unitPriceCzk: 500 }],
  totalSeats: 30, registered: 12,
  priceQuote: { listTotalCzk: 15000, discounts: [{ kind: 'club', label: 'Sleva klubu', percent: 10, amountCzk: 1500 }], totalCzk: 13500 },
  requestedRanges: [], note: '', contact: null,
  formToken: 'ft', formUrl: 'https://app/klub-objednavka/ft', registrationToken: 'rt', registrationUrl: 'https://app/klub/rt',
  releaseDaysBefore: null, effectiveReleaseDaysBefore: null, createdBy: 'Staff', createdAtUtc: '2026-10-04T08:00:00Z',
  submittedAtUtc: null, confirmedAtUtc: null, history: [],
  blocks: [{
    id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
    fromDate: RANGE.fromDate, toDate: RANGE.toDate, dailyFrom: RANGE.dailyFrom, dailyTo: RANGE.dailyTo, playerCount: 30, seats: 30, registered: 12,
    status: 'Active', registrationToken: 'rt', registrationUrl: 'https://app/klub/rt', note: null, createdAtUtc: null, athletes: [],
  }],
  ...over,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const open = (props: Partial<Parameters<typeof ClubOrderDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<Wrap><ClubOrderDialog open onClose={onClose} onSaved={onSaved} {...props} /></Wrap>);
  return { onClose, onSaved };
};

type User = ReturnType<typeof userEvent.setup>;
const setField = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function pickClub(user: User) {
  await user.click(await screen.findByLabelText('Klub'));
  await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
}
async function pickService(user: User, name: string) {
  await user.click(await screen.findByRole('radio', { name }));
}
async function tick(user: User, name: RegExp | string) {
  await user.click(await screen.findByRole('checkbox', { name }));
}
const fillRow = (n = 1, from = '2026-12-01', to = '2026-12-01', dFrom = '09:40', dTo = '10:40') => {
  setField(`Od, termín ${n}`, from);
  setField(`Do, termín ${n}`, to);
  setField(`Denně od, termín ${n}`, dFrom);
  setField(`Denně do, termín ${n}`, dTo);
};
async function fillNew(user: User) {
  await pickClub(user);
  await pickService(user, 'Sportovní prohlídka');
  await tick(user, /Základní prohlídka/);
  await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');
  await user.click(screen.getByRole('radio', { name: 'Platí klub (jedna faktura)' }));
  fillRow();
}
/** On tablet and phone the analysis sits in a collapsible dock above the footer. */
async function showAnalysis(user: User) {
  const dock = screen.queryByRole('button', { name: /Analýza kapacity/ });
  if (dock !== null && dock.getAttribute('aria-expanded') === 'false') await user.click(dock);
}

beforeEach(() => {
  /* 'Today' is pinned so the fixtures in December 2026 are never in the past. */
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00+02:00'));
  createStaff.mockReset().mockResolvedValue(order());
  update.mockReset().mockResolvedValue(order());
  confirm.mockReset().mockResolvedValue(order());
  proposal.mockReset().mockResolvedValue({ ranges: [], analysis: null });
  calculate.mockReset().mockImplementation(async (input: CalculationInput) => answerFor(input));
  getAllClubs.mockReset().mockResolvedValue([club('club-1', 'FK Slaný'), club('club-2', 'SK Kladno')]);
  createClub.mockReset().mockResolvedValue(club('club-new', 'TJ Sokol'));
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 30, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
    { id: 'a-2', name: 'Diagnostika EKG', durationMinutes: 20, clinicServiceId: 's-1', colorHex: '#5B8E7D', parallelCapacity: 1 },
    { id: 'a-3', name: 'Spiroergometrie', durationMinutes: 45, clinicServiceId: 's-2', colorHex: '#3B6EA8', parallelCapacity: 1 },
  ]);
});
afterEach(() => vi.useRealTimers());

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('club order dialog · %s', (device, width) => {
  beforeEach(() => setViewport(width));

  it('lays itself out for the device: analysis beside the form on desktop, a dock above the footer otherwise', async () => {
    open();
    const form = await screen.findByTestId('club-order-form');
    expect(form).toHaveAttribute('data-layout', device);
    if (device === 'desktop') {
      expect(screen.getByTestId('order-analysis')).toBeInTheDocument();
      expect(screen.queryByTestId('analysis-dock')).not.toBeInTheDocument();
    } else {
      expect(screen.getByTestId('analysis-dock')).toBeInTheDocument();
      expect(screen.queryByTestId('order-analysis')).not.toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('button', { name: /Analýza kapacity/ }));
      expect(screen.getByTestId('order-analysis')).toBeInTheDocument();
    }
  });

  it('changing the service clears the činnosti and offers only the new service\'s own', async () => {
    const user = userEvent.setup();
    open();
    await pickService(user, 'Sportovní prohlídka');
    expect(screen.getByRole('checkbox', { name: /Diagnostika EKG/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Spiroergometrie/ })).not.toBeInTheDocument();
    await tick(user, /Základní prohlídka/);
    await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');

    await pickService(user, 'Diagnostika');
    expect(screen.queryByRole('checkbox', { name: /Základní prohlídka/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Spiroergometrie/ })).not.toBeChecked();
    expect(screen.queryByLabelText('Počet hráčů, Základní prohlídka')).not.toBeInTheDocument();
    /* Only that service's calendar is offered. */
    const calendars = within(screen.getByRole('group', { name: 'Kalendáře' }));
    expect(calendars.getByRole('checkbox', { name: /Spiro/ })).toBeChecked();
    expect(calendars.queryByRole('checkbox', { name: /Prohlídky/ })).not.toBeInTheDocument();

    await pickService(user, 'Sportovní prohlídka');
    expect(screen.getByRole('checkbox', { name: /Základní prohlídka/ })).not.toBeChecked();
  });

  it('adds the counts up to "Celkem N míst" and one club total', async () => {
    const user = userEvent.setup();
    open();
    await pickService(user, 'Sportovní prohlídka');
    await tick(user, /Základní prohlídka/);
    await tick(user, /Diagnostika EKG/);
    await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');
    await user.type(screen.getByLabelText('Počet hráčů, Diagnostika EKG'), '10');
    expect(screen.getByTestId('order-total-seats')).toHaveTextContent('Celkem 40 míst');
    expect(screen.getAllByText(/Klub celkem: 40 míst/).length).toBeGreaterThan(0);
  });

  it('the proposal REPLACES the rows with the server\'s suggestion and every row stays editable', async () => {
    const user = userEvent.setup();
    proposal.mockResolvedValue({
      ranges: [
        { fromDate: '2026-12-01', toDate: '2026-12-01', dailyFrom: '09:40', dailyTo: '10:40' },
        { fromDate: '2026-12-02', toDate: '2026-12-02', dailyFrom: '09:40', dailyTo: '10:40' },
      ],
      analysis: null,
    });
    open();
    await pickService(user, 'Sportovní prohlídka');
    await tick(user, /Základní prohlídka/);
    await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');
    expect(screen.getByRole('button', { name: 'Navrhnout termíny' })).toBeDisabled();
    setField('Od, termín 1', '2026-12-01');
    setField('Denně od, termín 1', '09:40');
    await user.click(screen.getByRole('button', { name: 'Út' }));
    await user.click(screen.getByRole('button', { name: 'Více týdnů' }));
    await user.click(screen.getByRole('button', { name: 'Navrhnout termíny' }));

    await waitFor(() => expect(screen.getAllByTestId('order-term-row')).toHaveLength(2));
    expect(proposal).toHaveBeenCalledWith({
      serviceId: 's-1',
      activitySeats: [{ activityId: 'a-1', seats: 30 }],
      calendarIds: ['c-1'],
      startDate: '2026-12-01',
      startTime: '09:40',
      daysOfWeek: [2],
      weeks: 2,
    });
    /* Edit: shorten the second row, add a row, repeat one on the next week, delete the first. */
    setField('Denně do, termín 2', '10:10');
    expect(screen.getByLabelText('Denně do, termín 2')).toHaveValue('10:10');
    expect(screen.getAllByTestId('row-window')[1]).toHaveTextContent('Počítá se od 09:40 do 10:10');
    await user.click(screen.getByRole('button', { name: 'Zopakovat termín 2 na další týden' }));
    expect(screen.getAllByTestId('order-term-row')).toHaveLength(3);
    expect(screen.getByLabelText('Od, termín 3')).toHaveValue('2026-12-09');
    await user.click(screen.getByRole('button', { name: '+ Přidat termín' }));
    expect(screen.getAllByTestId('order-term-row')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Odebrat termín 1' }));
    expect(screen.getAllByTestId('order-term-row')).toHaveLength(3);
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-12-02');
  });

  it('a past term offers "Posunout na dnešek"', async () => {
    const user = userEvent.setup();
    open();
    fillRow(1, '2026-09-01', '2026-09-02');
    expect(await screen.findByText('Termín začíná v minulosti')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Posunout na dnešek' }));
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-10-04');
    expect(screen.getByLabelText('Do, termín 1')).toHaveValue('2026-10-04');
  });

  it('a confirmed reservation needs a payment method; a request does not - and both send the contract body', async () => {
    const user = userEvent.setup();
    open();
    await pickClub(user);
    await pickService(user, 'Sportovní prohlídka');
    await tick(user, /Základní prohlídka/);
    await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');
    fillRow();

    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));
    expect(createStaff).not.toHaveBeenCalled();
    expect(await screen.findAllByText('Vyberte způsob platby.')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Uložit jako poptávku' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff).toHaveBeenLastCalledWith({
      clubId: 'club-1',
      serviceId: 's-1',
      activitySeats: [{ activityId: 'a-1', seats: 30 }],
      paymentMethod: null,
      ranges: [RANGE],
      calendarIds: ['c-1'],
      status: 'Requested',
    });
  });

  it('creates the confirmed reservation with the contract body and shows the summary, price and the athletes\' link', async () => {
    const user = userEvent.setup();
    createStaff.mockResolvedValue(order({ status: 'Confirmed' }));
    const { onSaved } = open();
    await fillNew(user);
    await user.type(screen.getByLabelText('Poznámka'), 'Přijdou v teplácích');
    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));

    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createStaff).toHaveBeenLastCalledWith({
      clubId: 'club-1',
      serviceId: 's-1',
      activitySeats: [{ activityId: 'a-1', seats: 30 }],
      paymentMethod: 'ClubInvoice',
      ranges: [RANGE],
      calendarIds: ['c-1'],
      status: 'Confirmed',
      note: 'Přijdou v teplácích',
    });
    const done = await screen.findByTestId('order-success');
    expect(within(done).getByText('Rezervace je v kalendáři')).toBeInTheDocument();
    expect(within(done).getByText('Základní prohlídka × 30')).toBeInTheDocument();
    expect(within(done).getByText('1. 12. 2026, 09:40–10:40')).toBeInTheDocument();
    expect(within(done).getByText('Platba: Platí klub (jedna faktura)')).toBeInTheDocument();
    expect(within(done).getByText('Sleva klubu (10 %): −1 500 Kč')).toBeInTheDocument();
    expect(within(done).getByTestId('quote-total')).toHaveTextContent('Celkem: 13 500 Kč');
    expect(within(done).getByTestId('registration-url')).toHaveAttribute('data-url', 'https://app/klub/rt');
    expect(within(done).queryByTestId('form-url')).not.toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: /Zkopírovat: Odkaz pro sportovce/ }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('https://app/klub/rt'));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'o-1' }));
  });

  it('a request shows the form link too', async () => {
    const user = userEvent.setup();
    createStaff.mockResolvedValue(order({ status: 'Requested', blocks: [], requestedRanges: [RANGE] }));
    open();
    await fillNew(user);
    await user.click(screen.getByRole('button', { name: 'Uložit jako poptávku' }));
    const done = await screen.findByTestId('order-success');
    expect(within(done).getByTestId('form-url')).toHaveAttribute('data-url', 'https://app/klub-objednavka/ft');
  });

  it('marks the row a 409 names, and keeps the rest editable', async () => {
    const user = userEvent.setup();
    createStaff.mockRejectedValue(new ClubOrderError('Termín 2. 12. 2026 je obsazený.', 409, 'club.conflict'));
    open();
    await fillNew(user);
    await user.click(screen.getByRole('button', { name: '+ Přidat termín' }));
    fillRow(2, '2026-12-02', '2026-12-02');
    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));
    const rows = await screen.findAllByTestId('order-term-row');
    await waitFor(() => expect(within(rows[1]).getByTestId('row-failure')).toHaveTextContent('Termín 2. 12. 2026 je obsazený.'));
    expect(within(rows[0]).queryByTestId('row-failure')).not.toBeInTheDocument();
    expect(rows[1]).toHaveAttribute('data-failed', 'true');
    setField('Denně do, termín 2', '10:20');
    expect(within(screen.getAllByTestId('order-term-row')[1]).queryByTestId('row-failure')).not.toBeInTheDocument();
  });

  it('puts a field error from the server at its field', async () => {
    const user = userEvent.setup();
    createStaff.mockRejectedValue(new ClubOrderError('Neplatná objednávka.', 400, undefined, [], { paymentMethod: ['Způsob platby není povolen.'] }));
    open();
    await fillNew(user);
    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));
    expect(await within(screen.getByTestId('order-payment')).findByText('Způsob platby není povolen.')).toBeInTheDocument();
  });

  it('the calendar hand-off prefills the ranges and picks the service of the marked calendar', async () => {
    open({
      initial: {
        calendarIds: ['c-2'],
        ranges: [
          { fromDate: '2026-12-01', toDate: '2026-12-01', dailyFrom: '08:00', dailyTo: '09:00' },
          { fromDate: '2026-12-03', toDate: '2026-12-04' },
        ],
      },
    });
    expect(await screen.findByRole('radio', { name: 'Diagnostika' })).toBeChecked();
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-12-01');
    expect(screen.getByLabelText('Denně od, termín 1')).toHaveValue('08:00');
    expect(screen.getByLabelText('Od, termín 2')).toHaveValue('2026-12-03');
    expect(screen.getByLabelText('Do, termín 2')).toHaveValue('2026-12-04');
    expect(screen.getAllByTestId('row-window')[1]).toHaveTextContent('Počítá se celá otevírací doba');
  });

  it('shows the live analysis - needed against available - and never blocks the save', async () => {
    const user = userEvent.setup();
    open();
    await fillNew(user);
    await showAnalysis(user);
    const fits = await screen.findByTestId('analysis-fits');
    /* 30 players x 60 min / 2 in parallel = 900 min needed in a 60 min window. */
    expect(fits).toHaveTextContent('Nevejde se');
    expect(screen.getByTestId('analysis-minutes')).toHaveTextContent(/Potřeba 900.min · k dispozici 60.min/);
    expect(screen.getByTestId('order-analysis')).toHaveAttribute('data-fits', 'false');
    expect(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' })).toBeEnabled();
  });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('editing an order · %s', (_device, width) => {
  beforeEach(() => setViewport(width));

  it('is prefilled from the order and steps the players by ten', async () => {
    const user = userEvent.setup();
    open({ order: order() });
    const input = await screen.findByLabelText('Počet hráčů, Základní prohlídka');
    expect(input).toHaveValue('30');
    expect(screen.getByTestId('seats-registered')).toHaveTextContent('12 / 30 obsazeno');
    expect(screen.getByTestId('unit-price')).toHaveTextContent('500');
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-12-01');
    expect(screen.getByLabelText('Denně od, termín 1')).toHaveValue('09:40');
    expect(screen.getByRole('radio', { name: 'Platí klub (jedna faktura)' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Přidat 10 hráčů, Základní prohlídka' }));
    expect(input).toHaveValue('40');
    expect(screen.getByTestId('order-total-seats')).toHaveTextContent('Celkem 40 míst');
    await user.click(screen.getByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    expect(input).toHaveValue('20');
  });

  it('refuses a number below the registered players, inline', async () => {
    const user = userEvent.setup();
    open({ order: order() });
    const input = await screen.findByLabelText('Počet hráčů, Základní prohlídka');
    await user.click(screen.getByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    /* 30 -> 20 -> 10 -> 1 (a step never goes below one player). */
    expect(input).toHaveValue('1');
    expect(screen.getByTestId('seats-registered')).toHaveTextContent('12 / 1 obsazeno — nejméně 12');
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeDisabled();
    setField('Počet hráčů, Základní prohlídka', '12');
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the service locked and adds another činnost to the same order', async () => {
    const user = userEvent.setup();
    open({ order: order() });
    expect(await screen.findByRole('radio', { name: 'Sportovní prohlídka' })).toBeDisabled();
    await tick(user, /Diagnostika EKG/);
    await user.type(screen.getByLabelText('Počet hráčů, Diagnostika EKG'), '10');
    expect(screen.getByTestId('order-total-seats')).toHaveTextContent('Celkem 40 míst');
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenLastCalledWith(
      'o-1',
      {
        activitySeats: [{ activityId: 'a-1', seats: 30 }, { activityId: 'a-2', seats: 10 }],
        paymentMethod: 'ClubInvoice',
        ranges: [RANGE],
        calendarIds: ['c-1'],
        note: '',
      },
      false,
    );
  });

  it('lists the athletes a 409 would hit and retries with cancelAffectedAthletes after the confirmation', async () => {
    const user = userEvent.setup();
    update.mockRejectedValueOnce(new ClubOrderError('Změna se dotkne přihlášených sportovců.', 409, 'order.affected', [{ name: 'Jan Novák', activityName: 'Základní prohlídka' }]));
    const { onClose, onSaved } = open({ order: order() });
    await user.click(await screen.findByRole('button', { name: 'Ubrat 10 hráčů, Základní prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Uložit změny' }));

    const warn = await screen.findByTestId('order-affected');
    expect(within(warn).getByText('Jan Novák — Základní prohlídka')).toBeInTheDocument();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][2]).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Potvrdit a zrušit rezervace' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][1]).toMatchObject({ activitySeats: [{ activityId: 'a-1', seats: 20 }] });
    expect(update.mock.calls[1][2]).toBe(true);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows the current price quote the server computed', async () => {
    const user = userEvent.setup();
    open({ order: order() });
    await screen.findByLabelText('Počet hráčů, Základní prohlídka');
    await showAnalysis(user);
    expect(await screen.findByTestId('quote-total')).toHaveTextContent('Celkem: 13 500 Kč');
  });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('processing a club request · %s', (_device, width) => {
  beforeEach(() => setViewport(width));

  const requested = (over: Partial<ClubOrderView> = {}) =>
    order({
      status: 'Requested', paymentMethod: 'PerPerson', blocks: [], priceQuote: null, note: 'Chceme ráno',
      contact: { name: 'Jana Nováková', phone: '777 111 222', email: 'jana@klub.cz' },
      requestedRanges: [{ fromDate: '2026-12-01', toDate: '2026-12-02', dailyFrom: '09:40', dailyTo: '10:40' }],
      ...over,
    });

  it('shows the request read-only on top and confirms with the final calendars and ranges', async () => {
    const user = userEvent.setup();
    confirm.mockResolvedValue(order());
    open({ processOrder: requested() });
    const card = await screen.findByTestId('order-request');
    expect(within(card).getByTestId('request-contact')).toHaveTextContent('Jana Nováková · 777 111 222 · jana@klub.cz');
    expect(within(card).getByText('Poznámka klubu: Chceme ráno')).toBeInTheDocument();
    expect(screen.getByLabelText('Do, termín 1')).toHaveValue('2026-12-02');
    expect(screen.getByRole('radio', { name: 'Platí rodiče / hráči sami' })).toBeChecked();

    /* The worker may change anything: shorten the window by ten minutes. */
    setField('Denně do, termín 1', '10:30');
    await user.click(screen.getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenLastCalledWith('o-1', {
      calendarIds: ['c-1'],
      ranges: [{ fromDate: '2026-12-01', toDate: '2026-12-02', dailyFrom: '09:40', dailyTo: '10:30' }],
    });
    expect(update).not.toHaveBeenCalled();
    expect(await screen.findByTestId('order-success')).toBeInTheDocument();
  });

  it('saves a changed payment method and headcount before it confirms', async () => {
    const user = userEvent.setup();
    open({ processOrder: requested() });
    await user.click(await screen.findByRole('radio', { name: 'Platí klub (jedna faktura)' }));
    await user.click(screen.getByRole('button', { name: 'Přidat 10 hráčů, Základní prohlídka' }));
    await user.click(screen.getByRole('button', { name: 'Potvrdit objednávku' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('o-1', { activitySeats: [{ activityId: 'a-1', seats: 40 }], paymentMethod: 'ClubInvoice', note: 'Chceme ráno' });
  });

  it('will not confirm without a window in the future', async () => {
    const user = userEvent.setup();
    open({ processOrder: requested({ requestedRanges: [{ fromDate: '2026-09-01', toDate: '2026-09-02' }] }) });
    await screen.findByTestId('order-request');
    expect(screen.getByRole('button', { name: 'Potvrdit objednávku' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Posunout na dnešek' }));
    expect(screen.getByRole('button', { name: 'Potvrdit objednávku' })).toBeEnabled();
  });
});

describe('a new club', () => {
  it('is created together with the order', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    createStaff.mockResolvedValue(order({ clubId: 'club-new', clubName: 'TJ Sokol' }));
    open();
    await user.click(await screen.findByRole('button', { name: /založit nový/ }));
    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));
    expect(await screen.findByText('Název klubu je povinný.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Název klubu'), 'TJ Sokol');
    await user.type(screen.getByLabelText('IČO'), '00000019');
    await pickService(user, 'Sportovní prohlídka');
    await tick(user, /Základní prohlídka/);
    await user.type(screen.getByLabelText('Počet hráčů, Základní prohlídka'), '30');
    await user.click(screen.getByRole('radio', { name: 'Platí klub (jedna faktura)' }));
    fillRow();
    await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci v kalendáři' }));
    await waitFor(() => expect(createStaff).toHaveBeenCalledTimes(1));
    expect(createClub).toHaveBeenCalledTimes(1);
    expect(createStaff.mock.calls[0][0]).toMatchObject({ clubId: 'club-new', status: 'Confirmed' });
  });
});
