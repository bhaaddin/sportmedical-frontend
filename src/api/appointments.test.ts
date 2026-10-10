/*
 * The wire names of the range query, and the guards that stop a half-filled
 * request from being sent at all.
 *
 * `from`/`to` is the pair the contract names. Sending `fromDate`/`toDate`
 * instead does not fail loudly - the server answers 200 with an empty list,
 * which the grid draws as a day with nothing in it. Both lanes were caught by
 * that once, which is why the names are asserted rather than assumed.
 *
 * What would have to break for these to fail: renaming the params, dropping
 * `requireDate`/`requireId`, or joining `calendarIds` with something other
 * than a comma.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock('./client', () => ({
  default: { get, post, put, delete: vi.fn(), patch: vi.fn() },
}));

const { appointmentsApi } = await import('./appointments');

/* The endpoints parse their answer with zod, so give them a valid empty list. */
beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: [] });
  post.mockReset();
  put.mockReset().mockResolvedValue({ data: null });
});

const paramsOf = (call: number = 0) => get.mock.calls[call][1].params;

describe('range', () => {
  it('sends from and to - not fromDate/toDate', async () => {
    await appointmentsApi.range('2026-09-29', '2026-09-30');

    expect(get).toHaveBeenCalledWith('/api/day', expect.anything());
    const params = paramsOf();
    expect(params).toMatchObject({ from: '2026-09-29', to: '2026-09-30' });
    expect(params).not.toHaveProperty('fromDate');
    expect(params).not.toHaveProperty('toDate');
  });

  it('joins calendarIds with a comma, and omits them entirely when none are given', async () => {
    await appointmentsApi.range('2026-09-29', '2026-09-30', ['a', 'b']);
    expect(paramsOf().calendarIds).toBe('a,b');

    get.mockClear();
    await appointmentsApi.range('2026-09-29', '2026-09-30');
    expect(paramsOf().calendarIds).toBeUndefined();
  });

  /*
   * The guard's own message does not survive: `toBookingError` turns any
   * non-Axios throw into BookingApiError('server') on purpose, so a schema
   * mismatch cannot leak its detail to a patient-facing screen. So the thing
   * to assert is the part that is actually promised - the half-filled request
   * never leaves - not the wording, which the code deliberately hides.
   */
  it('refuses to ask at all when a date is missing', async () => {
    await expect(appointmentsApi.range('', '2026-09-30')).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('availability', () => {
  it('names activityId, from and to', async () => {
    await appointmentsApi.getAvailability('cal-1', 'act-1', '2026-09-29', '2026-09-29');
    expect(paramsOf()).toMatchObject({
      activityId: 'act-1',
      from: '2026-09-29',
      to: '2026-09-29',
    });
  });

  it('asks for the desk starts only when told to (never for the public list)', async () => {
    await appointmentsApi.getAvailability('cal-1', 'act-1', '2026-09-29', '2026-09-29');
    expect(paramsOf()).not.toHaveProperty('staffStarts');
    await appointmentsApi.getAvailability('cal-1', 'act-1', '2026-09-29', '2026-09-29', { staffStarts: true });
    expect(paramsOf(1)).toMatchObject({ forPublic: false, staffStarts: true });
  });

  it('refuses to ask without an activityId, instead of sending a request that 404s misleadingly', async () => {
    await expect(
      appointmentsApi.getAvailability('cal-1', '', '2026-09-29', '2026-09-29'),
    ).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});

/* Etapa 12: the agreed price travels as `agreedPriceCzk`, and has its own sub-resource on an existing appointment. */
describe('agreed price', () => {
  const booked = {
    appointment: {
      id: 'ap-1', calendarId: 'cal-1', patientId: 'p-1', activityId: 'act-1', activityName: 'Prohlídka',
      startUtc: '2026-09-29T07:00:00Z', endUtc: '2026-09-29T07:30:00Z', status: 0, paperwork: null,
      agreedPriceCzk: 1200, listPriceCzk: 1600,
    },
    warnings: [],
  };

  it('sends agreedPriceCzk on create as typed - a number, or null for the list price', async () => {
    post.mockResolvedValue({ data: booked });
    await appointmentsApi.create({
      patientId: 'p-1', calendarId: 'cal-1', activityId: 'act-1', startUtc: '2026-09-29T07:00:00Z', source: 0,
      agreedPriceCzk: 1200,
    });
    expect(post.mock.calls[0][1]).toMatchObject({ agreedPriceCzk: 1200 });
    await appointmentsApi.create({
      patientId: 'p-1', calendarId: 'cal-1', activityId: 'act-1', startUtc: '2026-09-29T07:00:00Z', source: 0,
      agreedPriceCzk: null,
    });
    expect(post.mock.calls[1][1]).toMatchObject({ agreedPriceCzk: null });
  });

  it('reads agreedPriceCzk and listPriceCzk off the booked appointment, and tolerates a server without them', async () => {
    post.mockResolvedValue({ data: booked });
    const result = await appointmentsApi.create({
      patientId: 'p-1', calendarId: 'cal-1', activityId: 'act-1', startUtc: '2026-09-29T07:00:00Z', source: 0,
    });
    expect(result.appointment.agreedPriceCzk).toBe(1200);
    expect(result.appointment.listPriceCzk).toBe(1600);

    const { agreedPriceCzk: _a, listPriceCzk: _l, ...older } = booked.appointment;
    post.mockResolvedValue({ data: { appointment: older, warnings: [] } });
    const old = await appointmentsApi.create({
      patientId: 'p-1', calendarId: 'cal-1', activityId: 'act-1', startUtc: '2026-09-29T07:00:00Z', source: 0,
    });
    expect(old.appointment.agreedPriceCzk).toBeUndefined();
  });

  it('puts the price on its own sub-resource, null to restore the list price', async () => {
    await appointmentsApi.setPrice('cal-1', 'ap-1', 1200);
    expect(put).toHaveBeenCalledWith('/api/calendars/cal-1/appointments/ap-1/price', { agreedPriceCzk: 1200 });
    await appointmentsApi.setPrice('cal-1', 'ap-1', null);
    expect(put).toHaveBeenLastCalledWith('/api/calendars/cal-1/appointments/ap-1/price', { agreedPriceCzk: null });
  });
});
