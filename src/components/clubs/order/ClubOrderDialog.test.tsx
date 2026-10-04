/*
 * The club order dialog (edit an order / process a club's request) at the three widths.
 *
 * Etapa 7: there is NO automatic suggestion, NO term form and NO analysis bar in it any more. What only the screen
 * can show: the terms are listed and changed by "Upravit termíny v kalendáři" (which hands the current numbers to the
 * calendar's pick mode); edit mode saves seats / payment / note WITHOUT touching the windows; the refusal below
 * `registered` and the 409 that lists the athletes; process mode; the success screen with the athletes' link; and the
 * dialog scrolls cleanly (nothing sticky repeats over the content).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { ClubOrderView } from '../../../api/clubOrders';
import type { PickSession } from './pickSession';

const update = vi.fn();
const confirm = vi.fn();
const fetchActivities = vi.fn();

vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { update, confirm } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: fetchActivities };
});
vi.mock('../../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's-1' },
      { id: 'c-2', name: 'Spiro', color: '#2B5C9B', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's-2' },
    ]),
  },
}));

const { ClubOrderDialog } = await import('./ClubOrderDialog');
const { ClubOrderError } = await import('../../../api/clubOrders');

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
  parentOrderId: null, groupId: 'o-1', addenda: [], invoiceId: null,
  groupTotals: { totalSeats: 30, registered: 12, listTotalCzk: 15000, discountCzk: 1500, totalCzk: 13500 },
  blocks: [{
    id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
    fromDate: RANGE.fromDate, toDate: RANGE.toDate, dailyFrom: RANGE.dailyFrom, dailyTo: RANGE.dailyTo, playerCount: 30, seats: 30, registered: 12,
    status: 'Active', registrationToken: 'rt', registrationUrl: 'https://app/klub/rt', note: null, createdAtUtc: null, athletes: [],
  }],
  ...over,
});

const requested = (over: Partial<ClubOrderView> = {}): ClubOrderView =>
  order({
    status: 'Requested', blocks: [], requestedRanges: [{ fromDate: '2026-12-07', toDate: '2026-12-09', dailyFrom: '09:00', dailyTo: '12:00' }],
    note: 'Dvě třídy', contact: { name: 'Jana Nováková', phone: '777 111 222', email: 'jana@fk.cz' }, registered: 0,
    activitySeats: [{ activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 20, registered: 0, unitPriceCzk: 500 }],
    totalSeats: 20, ...over,
  });

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const open = (props: Partial<Parameters<typeof ClubOrderDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onEditTerms = vi.fn<(session: PickSession) => void>();
  render(<Wrap><ClubOrderDialog open onClose={onClose} onSaved={onSaved} onEditTerms={onEditTerms} {...props} /></Wrap>);
  return { onClose, onSaved, onEditTerms };
};

type User = ReturnType<typeof userEvent.setup>;
const setField = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00+02:00'));
  update.mockReset().mockResolvedValue(order());
  confirm.mockReset().mockResolvedValue(order());
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', clinicServiceId: 's-1', name: 'Základní prohlídka', durationMinutes: 30, parallelCapacity: 1, colorHex: '#0D5C52' },
    { id: 'a-2', clinicServiceId: 's-1', name: 'Komplexní prohlídka', durationMinutes: 60, parallelCapacity: 1, colorHex: '#8A3FFC' },
    { id: 'a-3', clinicServiceId: 's-2', name: 'Spiro', durationMinutes: 20, parallelCapacity: 1, colorHex: '#2B5C9B' },
  ]);
});
afterEach(() => vi.useRealTimers());

const click = async (user: User, name: RegExp | string) => user.click(await screen.findByRole('button', { name }));

describe.each(['phone', 'tablet', 'desktop'] as const)('ClubOrderDialog at %s width', (layout) => {
  beforeEach(() => setViewport(VIEWPORTS[layout]));

  it('has no automatic suggestion, no term form and no analysis bar', async () => {
    open({ order: order() });
    await screen.findByTestId('order-terms');
    expect(screen.queryByText(/Automatický návrh/)).toBeNull();
    expect(screen.queryByText(/Navrhnout termíny/)).toBeNull();
    expect(screen.queryByText(/Přidat termín/)).toBeNull();
    expect(screen.queryByLabelText(/Denně od/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Analýza kapacity/ })).toBeNull();
    expect(screen.queryByTestId('analysis-dock')).toBeNull();
    expect(screen.queryByText(/Uložit jako poptávku/)).toBeNull();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'club-order-title');
  });

  it('edit mode: lists the windows and saves seats, payment and note without sending any ranges', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onSaved, onClose } = open({ order: order() });
    expect(await screen.findByText('Upravit objednávku')).toBeInTheDocument();
    const terms = screen.getByTestId('order-terms');
    expect(within(terms).getByText(/1\. 12\. 2026, 09:40–10:40/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    setField('Poznámka', 'Posun');
    await click(user, 'Uložit změny');
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('o-1', { activitySeats: [{ activityId: 'a-1', seats: 31 }], paymentMethod: 'ClubInvoice', note: 'Posun' }, false);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('edit mode refuses a number below the registered players', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open({ order: order() });
    const field = await screen.findByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '10');
    expect(await screen.findByText(/nejméně 12/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeDisabled();
  });

  it('a 409 lists the athletes and the second press cancels them', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    update.mockRejectedValueOnce(new ClubOrderError('Změna zruší rezervace.', 409, undefined, [{ name: 'Petr Novák', activityName: 'Základní prohlídka' }]));
    open({ order: order() });
    await user.click(await screen.findByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    await click(user, 'Uložit změny');
    const affected = await screen.findByTestId('order-affected');
    expect(within(affected).getByText(/Petr Novák/)).toBeInTheDocument();
    await click(user, 'Potvrdit a zrušit rezervace');
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][2]).toBe(true);
  });

  it('"Upravit termíny v kalendáři" hands the CURRENT numbers and the order\'s windows to the calendar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onEditTerms } = open({ order: order() });
    await user.click(await screen.findByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    await click(user, 'Upravit termíny v kalendáři');
    expect(onEditTerms).toHaveBeenCalledTimes(1);
    const session = onEditTerms.mock.calls[0][0];
    expect(session).toMatchObject({
      clubId: 'club-1', serviceId: 's-1', paymentMethod: 'ClubInvoice',
      activities: [{ activityId: 'a-1', name: 'Základní prohlídka', seats: 31, minutesPerSeat: 30, parallelCapacity: 1 }],
      editOrder: { mode: 'edit', orderId: 'o-1', dirty: true, requested: [], firstDate: '2026-12-01' },
    });
    expect(session.editOrder?.blocks).toEqual([{ id: 'b-1', calendarId: 'c-1', range: RANGE }]);
    expect(update).not.toHaveBeenCalled();
  });

  it('process mode: shows the request, the calendar gets it as a hint and nothing is picked for the club', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onEditTerms } = open({ processOrder: requested() });
    expect(await screen.findByText('Zpracovat požadavek klubu')).toBeInTheDocument();
    expect(screen.getByTestId('request-contact')).toHaveTextContent('Jana Nováková');
    await click(user, 'Upravit termíny v kalendáři');
    const session = onEditTerms.mock.calls[0][0];
    expect(session.editOrder).toMatchObject({ mode: 'process', orderId: 'o-1', dirty: false, blocks: [], firstDate: '2026-12-07' });
    expect(session.editOrder?.requested).toEqual(['7. 12. 2026 – 9. 12. 2026, 09:00–12:00']);
  });

  it('process mode: "Potvrdit podle požadavku" confirms the requested ranges on the service calendars', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open({ processOrder: requested() });
    await click(user, 'Potvrdit podle požadavku');
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(update).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith('o-1', { calendarIds: ['c-1'], ranges: requested().requestedRanges });
    expect(await screen.findByTestId('order-success')).toBeInTheDocument();
  });

  it('process mode: a changed number is saved before the confirmation', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    open({ processOrder: requested() });
    await user.click(await screen.findByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    await click(user, 'Potvrdit podle požadavku');
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith('o-1', { activitySeats: [{ activityId: 'a-1', seats: 21 }], paymentMethod: 'ClubInvoice', note: 'Dvě třídy' });
  });

  it('a server refusal is shown in the dialog', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    confirm.mockRejectedValueOnce(new ClubOrderError('Termín je obsazený.', 409));
    open({ processOrder: requested() });
    await click(user, 'Potvrdit podle požadavku');
    expect(await screen.findByTestId('order-failure')).toHaveTextContent('Termín je obsazený.');
  });
});
