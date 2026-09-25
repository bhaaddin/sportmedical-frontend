/*
 * The till's rows arrive with `status` and `paymentMethod` as numbers - the
 * API registers no string-enum converter - and every screen works with the
 * status name. This is the one place the number becomes the name.
 *
 * What would have to break for these to fail: a row whose status is the
 * number 1 reaching a screen as 1 instead of 'Completed', the four numbers
 * mapped to the wrong names, or the mapping skipped on one of the calls that
 * return a transaction.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import client from '../api/client';
import { cashierApi, transactionStatusName } from './cashierApi';

vi.mock('../api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const wire = (status: number | string, id = 't1') => ({
  id, serviceId: 's', patientId: 'p', appointmentId: null, originalPrice: 100, discountAmount: 0,
  finalPrice: 100, vatRate: 21, paymentMethod: 1, status, createdAt: '2026-09-24T07:00:00Z', completedAt: null,
});

beforeEach(() => vi.clearAllMocks());

describe('transactionStatusName', () => {
  it('names the four numbers exactly as Domain/Billing/TransactionStatus.cs does', () => {
    expect(transactionStatusName(0)).toBe('Pending');
    expect(transactionStatusName(1)).toBe('Completed');
    expect(transactionStatusName(2)).toBe('Cancelled');
    expect(transactionStatusName(3)).toBe('Refunded');
  });

  it('accepts the name too, should the server ever write strings', () => {
    expect(transactionStatusName('Completed')).toBe('Completed');
    expect(transactionStatusName('pending')).toBe('Pending');
    expect(transactionStatusName('2')).toBe('Cancelled');
  });

  it('knows nothing else, so an unknown value is never taken for an open payment', () => {
    for (const value of [4, -1, 'Paid', '', null, undefined, {}]) expect(transactionStatusName(value)).toBeNull();
  });
});

describe('cashierApi maps the status on every call that returns a transaction', () => {
  it('getTransactions', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [wire(1, 'a'), wire(0, 'b'), wire(3, 'c')] });
    const rows = await cashierApi.getTransactions('2026-09-24');
    expect(rows.map((r) => r.status)).toEqual(['Completed', 'Pending', 'Refunded']);
    expect(rows[0].paymentMethod).toBe(1);
  });

  it('getByAppointment, through the success envelope the client unwraps', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { data: [wire(2)] } });
    const rows = await cashierApi.getByAppointment('ap1');
    expect(rows[0].status).toBe('Cancelled');
  });

  it('createTransaction and complete', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: wire(0) }).mockResolvedValueOnce({ data: wire(1) });
    const created = await cashierApi.createTransaction({ serviceId: 's', patientId: 'p', originalPrice: 100, paymentMethod: 3 });
    expect(created.status).toBe('Pending');
    const completed = await cashierApi.complete('t1');
    expect(completed.status).toBe('Completed');
  });

  it('keeps a value it does not know visible, not actionable', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [wire(7)] });
    const [row] = await cashierApi.getTransactions('2026-09-24');
    expect(row.status).toBe('7');
  });
});
