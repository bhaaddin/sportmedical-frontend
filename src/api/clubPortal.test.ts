/*
 * Etapa 11: the club portal reader (public), and the staff calls that feed it - cancel with a club message, the
 * notice, rotate-links, `visibleToClub` on the history, `clubMessage` on update.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('./client', () => ({ default: { get, post, put }, client: { get, post, put } }));
vi.mock('../web/http', async () => {
  const actual = await vi.importActual<typeof import('../web/http')>('../web/http');
  return { ...actual, webHttp: { get, post } };
});

const { getClubPortal, toPortal, ClubOrderLinkError } = await import('./publicClubOrder');
const { clubOrdersApi, toOrder } = await import('./clubOrders');

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe('the club portal reader', () => {
  it('reads the contract', () => {
    const p = toPortal({
      reference: 'KO-1', clubName: 'FK Slaný', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'PerPerson',
      activities: [{ activityId: 'a1', name: 'Základní', durationMinutes: 30, seats: 10, registered: 4 }],
      windows: [{ date: '2026-10-26', startLocal: '08:00:00', endLocal: '12:00', activityIds: ['a1'], calendarName: 'Ambulance' }],
      athletes: [{ name: 'Petr', activityName: 'Základní', date: '2026-10-26', startLocal: '08:30', endLocal: '09:00', status: 'Cancelled' }],
      notices: [{ atUtc: '2026-10-20T10:00:00Z', text: 'Posun' }],
      registrationUrl: '/klub/tok', clinic: { phone: '606 1', email: 'a@b.cz' },
    });
    expect(p.status).toBe('Confirmed');
    expect(p.paymentMethod).toBe('PerPerson');
    expect(p.windows[0]).toEqual({ date: '2026-10-26', startLocal: '08:00', endLocal: '12:00', activityIds: ['a1'], calendarName: 'Ambulance' });
    expect(p.athletes[0].status).toBe('Cancelled');
    expect(p.notices).toEqual([{ atUtc: '2026-10-20T10:00:00Z', text: 'Posun' }]);
    expect(p.registrationUrl).toBe('/klub/tok');
    expect(p.clinic).toEqual({ phone: '606 1', email: 'a@b.cz' });
  });

  it('reads missing and malformed fields as empty, an unknown status as Requested', () => {
    const p = toPortal({ status: 'weird', windows: [{ date: 'nope' }, 7], athletes: 'x', notices: [{ atUtc: '', text: '  ' }], registrationUrl: '  ' });
    expect(p.status).toBe('Requested');
    expect(p.windows).toEqual([]);
    expect(p.athletes).toEqual([]);
    expect(p.notices).toEqual([]);
    expect(p.activities).toEqual([]);
    expect(p.registrationUrl).toBeNull();
    expect(p.paymentMethod).toBeNull();
    expect(p.clinic).toEqual({ phone: '', email: '' });
    expect(toPortal(null).clubName).toBe('');
  });

  /* Etapa 12, "Ceny doplnit všude": the prices the portal shows, read tolerantly. */
  it('reads the price per činnost (`priceCzk`, or `unitPriceCzk`), the order and group quotes', () => {
    const p = toPortal({
      activities: [
        { activityId: 'a1', name: 'Základní', priceCzk: 1200 },
        { activityId: 'a2', name: 'Komplexní', unitPriceCzk: 2500 },
        { activityId: 'a3', name: 'Konzultace' },
      ],
      priceQuote: { listTotalCzk: 12000, discounts: [{ label: 'Skupinová sleva', amountCzk: 1200 }, { label: '', amountCzk: 0 }], totalCzk: 10800 },
      groupPriceQuote: { totalCzk: 27000 },
    });
    expect(p.activities.map((a) => a.priceCzk)).toEqual([1200, 2500, null]);
    expect(p.priceQuote).toEqual({ listTotalCzk: 12000, discounts: [{ label: 'Skupinová sleva', amountCzk: 1200 }], totalCzk: 10800 });
    expect(p.groupPriceQuote).toEqual({ listTotalCzk: 27000, discounts: [], totalCzk: 27000 });
  });

  it('reads no price quote as null and no invoicing as None (an older server never breaks the page)', () => {
    const p = toPortal({ priceQuote: null, groupPriceQuote: { totalCzk: 'x' } });
    expect(p.priceQuote).toBeNull();
    expect(p.groupPriceQuote).toBeNull();
    expect(p.billing).toEqual({ state: 'None', invoiceNumber: null });
    expect(toPortal({}).billing).toEqual({ state: 'None', invoiceNumber: null });
  });

  it('reads the invoicing state from whichever field the server uses', () => {
    expect(toPortal({ billing: { state: 'ToInvoice' } }).billing).toEqual({ state: 'ToInvoice', invoiceNumber: null });
    expect(toPortal({ invoiceState: 'Pending' }).billing.state).toBe('ToInvoice');
    expect(toPortal({ billing: { state: 'Invoiced', invoiceNumber: 'FV-1' } }).billing).toEqual({ state: 'Invoiced', invoiceNumber: 'FV-1' });
    expect(toPortal({ invoice: { number: 'FV-2' } }).billing).toEqual({ state: 'Invoiced', invoiceNumber: 'FV-2' });
    expect(toPortal({ invoiceNumber: 'FV-3' }).billing).toEqual({ state: 'Invoiced', invoiceNumber: 'FV-3' });
    expect(toPortal({ invoiceNumber: '  ' }).billing.state).toBe('None');
  });

  it('calls the portal of the token (encoded) and unwraps an envelope', async () => {
    get.mockResolvedValue({ data: { success: true, data: { reference: 'KO-2', status: 'Completed' } } });
    const p = await getClubPortal('a/b c');
    expect(get).toHaveBeenCalledWith('/api/public/club-portal/a%2Fb%20c', expect.anything());
    expect(p.reference).toBe('KO-2');
    expect(p.status).toBe('Completed');
  });

  it('turns a 404 into a not-found link error and rethrows anything else', async () => {
    const notFound = Object.assign(new Error('nf'), { isAxiosError: true, response: { status: 404 } });
    get.mockRejectedValueOnce(notFound);
    await expect(getClubPortal('x')).rejects.toBeInstanceOf(ClubOrderLinkError);
    const boom = new Error('boom');
    get.mockRejectedValueOnce(boom);
    await expect(getClubPortal('x')).rejects.toBe(boom);
  });
});

describe('the staff calls of the club message', () => {
  const orderBody = { id: 'o1', status: 'Cancelled', history: [{ atUtc: '2026-10-01T10:00:00Z', user: 'Eva', text: 'Zrušeno', visibleToClub: true }, { atUtc: '', user: '', text: 'Interní' }] };

  it('reads visibleToClub on the history (absent = false)', () => {
    const o = toOrder(orderBody);
    expect(o.history.map((h) => h.visibleToClub)).toEqual([true, false]);
  });

  it('cancel sends no body without a message and the trimmed message in clubMessage with one', async () => {
    post.mockResolvedValue({ data: orderBody });
    await clubOrdersApi.cancel('o1', true, false);
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/o1/cancel', null, { params: { cancelAthletes: true } });
    await clubOrdersApi.cancel('o1', false, true, '   ');
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/o1/cancel', null, { params: { cancelAthletes: false, cancelAddenda: true } });
    await clubOrdersApi.cancel('o1', false, false, '  Termíny rušíme.  ');
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/o1/cancel', { clubMessage: 'Termíny rušíme.' }, { params: { cancelAthletes: false } });
  });

  it('notice posts the text and returns the order', async () => {
    post.mockResolvedValue({ data: orderBody });
    const o = await clubOrdersApi.notice('o1', '  Posun na 9:00 ');
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/o1/notice', { text: 'Posun na 9:00' });
    expect(o.id).toBe('o1');
  });

  it('rotateLinks posts without a body and reads the new links', async () => {
    post.mockResolvedValue({ data: { ...orderBody, formUrl: '/klub-objednavka/new', registrationUrl: '/klub/new' } });
    const o = await clubOrdersApi.rotateLinks('o1');
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/o1/rotate-links', null);
    expect(o.formUrl).toBe('/klub-objednavka/new');
    expect(o.registrationUrl).toBe('/klub/new');
  });

  it('update carries clubMessage in the body', async () => {
    put.mockResolvedValue({ data: orderBody });
    await clubOrdersApi.update('o1', { activitySeats: [], clubMessage: 'Změna' });
    expect(put).toHaveBeenCalledWith('/api/v1/club-orders/o1', { activitySeats: [], clubMessage: 'Změna' }, { params: undefined });
  });
});
