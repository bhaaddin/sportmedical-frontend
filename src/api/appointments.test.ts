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
vi.mock('./client', () => ({
  default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

const { appointmentsApi } = await import('./appointments');

/* The endpoints parse their answer with zod, so give them a valid empty list. */
beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: [] });
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

  it('refuses to ask without an activityId, instead of sending a request that 404s misleadingly', async () => {
    await expect(
      appointmentsApi.getAvailability('cal-1', '', '2026-09-29', '2026-09-29'),
    ).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});
