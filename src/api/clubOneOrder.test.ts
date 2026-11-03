import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('./client', () => ({ default: { get, post, put } }));

const { combinedSchema, getCombined, getOneOrderSettings, putOneOrderSettings, splitOrder, oneOrderClubIds, isMissing } = await import('./clubOneOrder');
const { subsetQuery } = await import('./clubOrders');

const notFound = () => Object.assign(new Error('nf'), { response: { status: 404 } });

const raw = {
  rootId: 'r1', reference: 'KO-AAAA1111', clubId: 'c1', clubName: 'Sparta', closedAtUtc: null, oneOrderMode: true,
  splitFrom: null, splitInto: [{ orderId: 'x', reference: 'KO-BBBB2222' }],
  days: [
    { orderId: 'r1', reference: 'KO-AAAA1111', serviceId: 's', serviceName: 'Prohlídka', ranges: [{ fromDate: '2026-11-05', toDate: '2026-11-05', dailyFrom: '08:00', dailyTo: '10:00' }], seats: 20, registered: 12, status: 2, origin: 1, createdAtUtc: '2026-11-01T10:00:00Z', createdByName: 'Recepce', note: null, invoiceId: null, invoiceNumber: null },
    { orderId: 'd2', reference: 'KO-CCCC3333', serviceName: 'Prohlídka', ranges: [], seats: 20, registered: 0, status: 'Cancelled', origin: 'Staff' },
  ],
  totals: { orders: 2, seats: 40, registered: 12, invoicedOrders: 0 },
  clubTotal: { parts: 2, seats: 60, registered: 12 },
};

beforeEach(() => { get.mockReset(); post.mockReset(); put.mockReset(); });

describe('combined schema', () => {
  it('reads numbers and words for status and origin, and fills what is missing', () => {
    const c = combinedSchema.parse(raw);
    expect(c.days[0]!.status).toBe('Confirmed');
    expect(c.days[1]!.status).toBe('Cancelled');
    expect(c.days[0]!.origin).toBe('1');
    expect(c.days[1]!.note).toBe('');
    expect(c.days[1]!.invoiceId).toBeNull();
    expect(c.splitFrom).toBeNull();
    expect(c.clubTotal.parts).toBe(2);
  });
  it('survives an almost empty answer', () => {
    const c = combinedSchema.parse({ rootId: 'r' });
    expect(c.days).toEqual([]);
    expect(c.totals.orders).toBe(0);
    expect(c.splitInto).toEqual([]);
  });
});

describe('soft failure', () => {
  it('404 on the settings and the combined view gives null (feature hidden)', async () => {
    get.mockRejectedValue(notFound());
    expect(await getOneOrderSettings()).toBeNull();
    expect(await getCombined('r1')).toBeNull();
    expect(await oneOrderClubIds()).toEqual([]);
  });
  it('another failure is not hidden', async () => {
    get.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    await expect(getCombined('r1')).rejects.toThrow('boom');
    expect(await oneOrderClubIds()).toEqual([]);
  });
  it('knows a mapped not-found too', () => {
    expect(isMissing({ kind: 'notFound' })).toBe(true);
    expect(isMissing({ response: { status: 403 } })).toBe(false);
  });
});

describe('calls', () => {
  it('reads and saves the settings', async () => {
    get.mockResolvedValue({ data: { clubIds: ['a', 'b'] } });
    expect(await getOneOrderSettings()).toEqual({ clubIds: ['a', 'b'] });
    put.mockResolvedValue({ data: { clubIds: ['a'] } });
    expect(await putOneOrderSettings(['a'])).toEqual({ clubIds: ['a'] });
    expect(put).toHaveBeenCalledWith('/api/v1/club-orders/one-order-settings', { clubIds: ['a'] });
  });
  it('split returns the new root when named, null when not', async () => {
    post.mockResolvedValueOnce({ data: { rootId: 'n1' } });
    expect(await splitOrder('r1', ['d2'])).toBe('n1');
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/r1/split', { orderIds: ['d2'] });
    post.mockResolvedValueOnce({ data: 'ok' });
    expect(await splitOrder('r1', ['d2'])).toBeNull();
  });
  it('the invoice subset is a repeated query parameter and an optional month', () => {
    expect(subsetQuery()).toBe('');
    expect(subsetQuery({})).toBe('');
    expect(subsetQuery({ orderIds: ['a', 'b'], month: '2026-11' })).toBe('?orderIds=a&orderIds=b&month=2026-11');
  });
});
