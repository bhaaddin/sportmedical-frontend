/*
 * Etapa 5: the addenda and the group's one invoice in the club-orders API module - the tolerant reader, the new
 * parameters and the shapes of the invoice answers (201 / 200, the 409 that lists live addenda).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./client', () => ({ default: { get, post, put: vi.fn() }, client: { get, post, put: vi.fn() } }));

const { clubOrdersApi, toOrder, ClubOrderError } = await import('./clubOrders');

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('toOrder - the group fields', () => {
  it('reads an old answer without them as a lone order', () => {
    const o = toOrder({ id: 'o1', totalSeats: 9, registered: 2, priceQuote: { listTotalCzk: 100, discounts: [], totalCzk: 90 } });
    expect(o.parentOrderId).toBeNull();
    expect(o.groupId).toBe('o1');
    expect(o.addenda).toEqual([]);
    expect(o.invoiceId).toBeNull();
    expect(o.groupTotals).toEqual({ totalSeats: 9, registered: 2, listTotalCzk: 100, discountCzk: 0, totalCzk: 90 });
  });

  it('reads the addenda of a root and its group totals', () => {
    const o = toOrder({
      id: 'root', groupId: 'root', parentOrderId: null, invoiceId: 'inv-1',
      addenda: [{ id: 'a1', serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2660 }, { id: 'a2', status: 'weird' }],
      groupTotals: { totalSeats: 9, registered: 0, listTotalCzk: 7800, discountCzk: 780, totalCzk: 7020 },
    });
    expect(o.addenda).toHaveLength(2);
    expect(o.addenda[0]).toEqual({ id: 'a1', serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2660 });
    expect(o.addenda[1].status).toBe('Requested');
    expect(o.addenda[1].totalCzk).toBeNull();
    expect(o.groupTotals.discountCzk).toBe(780);
    expect(o.invoiceId).toBe('inv-1');
  });

  it('an addendum names its root and takes it as the group', () => {
    const o = toOrder({ id: 'a1', parentOrderId: 'root' });
    expect(o.parentOrderId).toBe('root');
    expect(o.groupId).toBe('root');
  });
});

describe('createStaff / cancel / list', () => {
  it('sends parentOrderId with the staff body', async () => {
    post.mockResolvedValue({ status: 201, data: { id: 'a1', parentOrderId: 'root' } });
    const created = await clubOrdersApi.createStaff({
      clubId: 'c', serviceId: 's', activitySeats: [{ activityId: 'x', seats: 30 }], paymentMethod: 'ClubInvoice',
      ranges: [], calendarIds: [], status: 'Confirmed', parentOrderId: 'root',
    });
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/staff', expect.objectContaining({ parentOrderId: 'root' }));
    expect(created.parentOrderId).toBe('root');
  });

  it('cancel sends cancelAddenda only when asked for', async () => {
    post.mockResolvedValue({ status: 200, data: { id: 'root' } });
    await clubOrdersApi.cancel('root', false);
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/root/cancel', null, { params: { cancelAthletes: false } });
    await clubOrdersApi.cancel('root', true, true);
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/root/cancel', null, { params: { cancelAthletes: true, cancelAddenda: true } });
  });

  it('turns the 409 addenda_live body into an error that carries the addenda', async () => {
    post.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'club_order.addenda_live', message: 'Objednávka má dodatky.', addenda: [{ id: 'a1', serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2660 }] },
      },
    });
    const error = await clubOrdersApi.cancel('root').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ClubOrderError);
    const e = error as InstanceType<typeof ClubOrderError>;
    expect(e.status).toBe(409);
    expect(e.code).toBe('club_order.addenda_live');
    expect(e.addenda.map((a) => a.serviceName)).toEqual(['Fyzioterapie']);
  });

  it('lists a group with ?groupId=', async () => {
    get.mockResolvedValue({ data: [] });
    await clubOrdersApi.list({ groupId: 'root' });
    expect(get).toHaveBeenCalledWith('/api/v1/club-orders', { params: { groupId: 'root' } });
  });
});

describe('the group invoice', () => {
  it('reads the draft', async () => {
    get.mockResolvedValue({
      data: {
        clubId: 'c', groupId: 'root', paymentMethod: 'ClubInvoice', headcount: 9,
        lines: [{ orderId: 'root', serviceName: 'Prohlídky', activityName: 'VO2max', quantity: 5, unitPriceCzk: 1000, totalCzk: 5000 }],
        discounts: [{ kind: 'Tier', label: 'Skupinová sleva', percent: 10, amountCzk: 780 }],
        listTotalCzk: 7800, totalCzk: 7020, note: 'Klubová objednávka', invoiceId: null,
      },
    });
    const draft = await clubOrdersApi.invoiceDraft('root');
    expect(get).toHaveBeenCalledWith('/api/v1/club-orders/root/invoice-draft');
    expect(draft.lines[0].activityName).toBe('VO2max');
    expect(draft.totalCzk).toBe(7020);
    expect(draft.discounts[0].amountCzk).toBe(780);
    expect(draft.invoiceId).toBeNull();
  });

  it('201 means created, 200 means the invoice already existed', async () => {
    post.mockResolvedValueOnce({ status: 201, data: { invoiceId: 'i1', invoiceNumber: 'INV-1', status: 'Issued', totalCzk: 7020, clubId: 'c', groupId: 'root', created: true } });
    const first = await clubOrdersApi.createInvoice('root');
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/root/invoice', null);
    expect(first.created).toBe(true);
    expect(first.invoiceNumber).toBe('INV-1');

    post.mockResolvedValueOnce({ status: 200, data: { invoiceId: 'i1', invoiceNumber: 'INV-1', status: 'Issued', totalCzk: 7020, clubId: 'c', groupId: 'root', created: false } });
    expect((await clubOrdersApi.createInvoice('a1')).created).toBe(false);
  });

  it('falls back on the HTTP status when the body has no created flag', async () => {
    post.mockResolvedValueOnce({ status: 200, data: { invoiceId: 'i1', invoiceNumber: 'INV-1' } });
    expect((await clubOrdersApi.createInvoice('root')).created).toBe(false);
  });

  it('keeps the server message of a 409 per-person and of a 422 not quotable', async () => {
    post.mockRejectedValueOnce({ response: { status: 409, data: { code: 'club_order.invoice_per_person', message: 'Skupina platí po osobách.' } } });
    const a = (await clubOrdersApi.createInvoice('root').catch((e: unknown) => e)) as InstanceType<typeof ClubOrderError>;
    expect([a.status, a.code, a.message]).toEqual([409, 'club_order.invoice_per_person', 'Skupina platí po osobách.']);
    post.mockRejectedValueOnce({ response: { status: 422, data: { code: 'club_order.invoice_not_quotable', message: 'Činnost Masáž nemá cenu.', errors: { lines: ['Masáž'] } } } });
    const b = (await clubOrdersApi.createInvoice('root').catch((e: unknown) => e)) as InstanceType<typeof ClubOrderError>;
    expect([b.status, b.message]).toEqual([422, 'Činnost Masáž nemá cenu.']);
    expect(b.fieldErrors.lines).toEqual(['Masáž']);
  });
});
