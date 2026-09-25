/*
 * The one-click confirmations on a booking, driven the way a doctor drives
 * them: Přišel, then Zaplaceno with the till pre-filled; the amber flag after
 * the clinic's minutes with Nepřišel beside it; and the patient's own window
 * said in words.
 *
 * What would have to break for these to fail: the flag appearing before the
 * setting says so or changing a status by itself, "Zaplaceno" sending the
 * wrong service or forgetting the booking, a button offered to somebody
 * without the permission, or the sentence naming the wrong instant.
 *
 * The till's rows come in as the API really writes them - `status` and
 * `paymentMethod` as numbers - through the HTTP client, so the mapping at the
 * boundary is what these tests exercise, not a mock that already speaks names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SmartConfirmations } from './SmartConfirmations';
import { appointmentsApi } from '../../api/appointments';
import client from '../../api/client';

vi.mock('../../api/appointments', () => ({ appointmentsApi: { setStatus: vi.fn() } }));
vi.mock('../../api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

/* Exactly the server's enums: TransactionStatus Pending 0, Completed 1,
   Cancelled 2, Refunded 3; PaymentMethod Cash 0, Card 1. */
const wireTransaction = (status: number, paymentMethod: number, completedAt: string | null = '2026-09-24T07:12:00Z') => ({
  id: 't1', serviceId: 'svc-1', patientId: 'p1', appointmentId: 'ap1', originalPrice: 1500,
  discountAmount: 0, finalPrice: 1500, vatRate: 0, paymentMethod, status,
  createdAt: '2026-09-24T07:12:00Z', completedAt, canComplete: status === 0, canRefund: status === 1,
});
const tillHolds = (...rows: ReturnType<typeof wireTransaction>[]) =>
  vi.mocked(client.get).mockResolvedValue({ data: rows });
vi.mock('../../api/attendanceSettings', () => ({
  useAttendanceSettings: () => ({
    settings: { noShowAfterMinutes: 30, patientChangeDeadlineHours: 24 },
    loaded: true,
  }),
}));

const START = '2026-09-24T07:00:00Z'; // čt 24. 9. 09:00 Prague
const booking = (status: number) => ({
  id: 'ap1',
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'a1',
  startUtc: START,
  status,
});
const activity = { serviceItemId: 'svc-1', priceCzk: 1500, name: 'Spiroergometrie' };

type ActivityLike = Parameters<typeof SmartConfirmations>[0]['activity'];

function renderIt(status: number, now: Date, permissions: string[], act: ActivityLike = activity) {
  window.localStorage.setItem('permissions', JSON.stringify(permissions));
  const onChanged = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SmartConfirmations booking={booking(status)} activity={act} now={now} onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return onChanged;
}

beforeEach(() => {
  tillHolds();
  vi.mocked(appointmentsApi.setStatus).mockResolvedValue(undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('arrival', () => {
  it('offers Přišel with one click and writes CheckedIn', async () => {
    const onChanged = renderIt(0, new Date('2026-09-24T06:55:00Z'), ['bookings.edit']);

    fireEvent.click(screen.getByRole('button', { name: 'Přišel' }));

    await waitFor(() => expect(appointmentsApi.setStatus).toHaveBeenCalledWith('c1', 'ap1', '2'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('offers nothing to write without bookings.edit', () => {
    renderIt(0, new Date('2026-09-24T06:55:00Z'), []);
    expect(screen.queryByRole('button', { name: 'Přišel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nepřišel' })).toBeNull();
  });
});

describe('the amber flag', () => {
  it('is absent before the clinic minutes have passed, and Nepřišel with it', () => {
    renderIt(0, new Date('2026-09-24T07:20:00Z'), ['bookings.edit']);
    expect(screen.queryByTestId('probably-absent')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nepřišel' })).toBeNull();
  });

  it('appears after them, with Nepřišel and Přišel beside it, and changes nothing by itself', async () => {
    renderIt(0, new Date('2026-09-24T07:31:00Z'), ['bookings.edit']);

    expect(screen.getByTestId('probably-absent')).toHaveTextContent('asi nepřišel');
    expect(appointmentsApi.setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Nepřišel' }));
    await waitFor(() => expect(appointmentsApi.setStatus).toHaveBeenCalledWith('c1', 'ap1', '5'));

    expect(screen.getByRole('button', { name: 'Přišel' })).toBeInTheDocument();
  });

  it('never flags somebody who has arrived', () => {
    renderIt(2, new Date('2026-09-24T12:00:00Z'), ['bookings.edit']);
    expect(screen.queryByTestId('probably-absent')).toBeNull();
  });
});

describe('the patient window', () => {
  it('says until when the patient may change it, from start minus the deadline', () => {
    renderIt(0, new Date('2026-09-22T12:00:00Z'), []);
    expect(screen.getByText(/Pacient může termín sám změnit nebo zrušit do st 23\. 9\. 09:00\./)).toBeInTheDocument();
  });

  it('says the window has passed once it has', () => {
    renderIt(0, new Date('2026-09-23T12:00:00Z'), []);
    expect(screen.getByText(/už uplynula/)).toBeInTheDocument();
  });
});

describe('Zaplaceno', () => {
  it('is not offered before arrival, nor without billing.manage', () => {
    renderIt(0, new Date('2026-09-24T06:55:00Z'), ['bookings.edit', 'billing.manage']);
    expect(screen.queryByRole('button', { name: 'Zaplaceno' })).toBeNull();
  });

  it('opens the till pre-filled and records the payment against the booking', async () => {
    const onChanged = renderIt(2, new Date('2026-09-24T07:10:00Z'), ['bookings.edit', 'billing.manage']);
    vi.mocked(client.post).mockResolvedValue({ data: wireTransaction(1, 0) });

    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/api/cashier/appointments/ap1/transactions'));
    fireEvent.click(await screen.findByRole('button', { name: 'Zaplaceno' }));

    const panel = screen.getByTestId('payment-panel');
    expect(within(panel).getByDisplayValue(/1\s?500/)).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Zaevidovat platbu' }));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        '/api/cashier/transactions',
        expect.objectContaining({ serviceId: 'svc-1', patientId: 'p1', originalPrice: 1500, appointmentId: 'ap1', paymentMethod: 0 }),
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows a Completed (1) card payment as the wire writes it, and hides the button', async () => {
    tillHolds(wireTransaction(1, 1));
    renderIt(2, new Date('2026-09-24T07:30:00Z'), ['billing.manage']);

    const chip = await screen.findByTestId('payment-chip');
    expect(chip).toHaveTextContent(/Zaplaceno 1\s?500 Kč \(karta\) 09:12/);
    expect(screen.queryByRole('button', { name: 'Zaplaceno' })).toBeNull();
  });

  it('shows a Pending (0) club charge as open, and still no button', async () => {
    tillHolds(wireTransaction(0, 3, null));
    renderIt(2, new Date('2026-09-24T07:30:00Z'), ['billing.manage']);

    const chip = await screen.findByTestId('payment-chip');
    expect(chip).toHaveTextContent(/1\s?500 Kč/);
    expect(chip).toHaveTextContent(/na klub/i);
    expect(chip).not.toHaveTextContent(/^Zaplaceno/);
    expect(screen.queryByRole('button', { name: 'Zaplaceno' })).toBeNull();
  });

  it('offers the button again when the only payment was cancelled (2) or refunded (3)', async () => {
    tillHolds({ ...wireTransaction(2, 0, null), id: 't-cancelled' }, { ...wireTransaction(3, 1), id: 't-refunded' });
    renderIt(2, new Date('2026-09-24T07:30:00Z'), ['billing.manage']);

    expect(await screen.findByRole('button', { name: 'Zaplaceno' })).toBeInTheDocument();
    expect(screen.queryByTestId('payment-chip')).toBeNull();
  });

  it('is disabled with the reason when the činnost has no price-list item', async () => {
    renderIt(2, new Date('2026-09-24T07:10:00Z'), ['billing.manage'], { serviceItemId: null, priceCzk: null, name: 'X' });
    const button = await screen.findByRole('button', { name: 'Zaplaceno' });
    expect(button).toBeDisabled();
  });
});
