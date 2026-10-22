/*
 * The Stage 2 api modules against the contract (stage2-contract.md), with the transport faked:
 * booking-slots (R4), the club hold setting and `release-unfilled` (R13), the lunch exceptions and `into-lunch` (R17).
 * Every module reads leniently and every route is optional: an older server must never white-screen the desk.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';

const { get, put, post, del } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock('./client', () => ({ default: { get, put, post, delete: del }, client: { get, put, post, delete: del } }));

const { toBookingSlots, hasSingleWorkerSetting, saveBookingSlots } = await import('./bookingSlots');
const { clubSettingsApi } = await import('./clubs');
const { clubOrdersApi } = await import('./clubOrders');
const { lunchExceptionsApi, lunchErrorText, isLunchRouteMissing, LUNCH_CODES } = await import('./lunchExceptions');
const { previewListSchema, timeBlockListSchema } = await import('./bookingContracts');
const { toBookingError } = await import('./apiError');

const axiosError = (status: number, data: unknown) =>
  new AxiosError('x', 'ERR', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse);

beforeEach(() => {
  for (const f of [get, put, post, del]) f.mockReset();
});

describe('R4: booking-slots', () => {
  it('reads the two new fields, folds duplicate exception ids and drops empties', () => {
    const r = toBookingSlots({ settings: { examinationPauseMinutes: 10, singleWorkerAtATime: true, workerExceptions: ['u1', 'u1', '', 'u2'] }, defaults: { examinationPauseMinutes: 0, singleWorkerAtATime: false, workerExceptions: [] } });
    expect(r.settings).toEqual({ examinationPauseMinutes: 10, singleWorkerAtATime: true, workerExceptions: ['u1', 'u2'] });
    expect(r.defaults.singleWorkerAtATime).toBe(false);
    expect(hasSingleWorkerSetting(r.settings)).toBe(true);
  });

  it('an older server (fields absent) reads as "no such setting": the card stays away', () => {
    const r = toBookingSlots({ settings: { examinationPauseMinutes: 10 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 });
    expect(r.settings).toEqual({ examinationPauseMinutes: 10 });
    expect(hasSingleWorkerSetting(r.settings)).toBe(false);
  });

  it('a save carries only what is named (a PUT that leaves a field out keeps it)', async () => {
    put.mockResolvedValue({ data: { settings: { examinationPauseMinutes: 10, singleWorkerAtATime: true, workerExceptions: [] }, defaults: {} } });
    await saveBookingSlots({ singleWorkerAtATime: true, workerExceptions: [] });
    expect(put).toHaveBeenCalledWith('/api/v1/settings/booking-slots', { singleWorkerAtATime: true, workerExceptions: [] });
  });
});

describe('R13: the club hold', () => {
  it('reads holdUntilDaysBefore when the server has it and says nothing when it has not', async () => {
    get.mockResolvedValueOnce({ data: { registrationLinkValidityDays: 14, holdUntilDaysBefore: 7 } });
    expect((await clubSettingsApi.get()).holdUntilDaysBefore).toBe(7);
    get.mockResolvedValueOnce({ data: { registrationLinkValidityDays: 14 } });
    expect((await clubSettingsApi.get()).holdUntilDaysBefore).toBeUndefined();
  });

  it('release-unfilled: POST with the flag (and the reason when given), the answer read leniently', async () => {
    post.mockResolvedValue({ data: { orderId: 'o1', windowsRemoved: 2, windowsShortened: 1, minutesReleased: 180, stretchesKept: 3, onlyExpired: true, blockCancelled: false } });
    const r = await clubOrdersApi.releaseUnfilled('o1', { onlyExpired: true, reason: ' klub odřekl ' });
    expect(post).toHaveBeenCalledWith('/api/v1/club-orders/o1/release-unfilled', { onlyExpired: true, reason: 'klub odřekl' });
    expect(r).toEqual({ orderId: 'o1', windowsRemoved: 2, windowsShortened: 1, minutesReleased: 180, stretchesKept: 3, onlyExpired: true, blockCancelled: false });
    post.mockResolvedValue({ data: {} });
    expect((await clubOrdersApi.releaseUnfilled('o1')).minutesReleased).toBe(0);
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-orders/o1/release-unfilled', { onlyExpired: false });
  });

  it('the time blocks and the day preview accept the new fields and an older server without them', () => {
    const [b] = timeBlockListSchema.parse([{ id: 'b', startUtc: '2026-12-10T07:00:00Z', endUtc: '2026-12-10T08:00:00Z', kind: 'club', clubOrderId: 'o', orderCode: 'KO-1', playersMissing: true, windowEmpty: false, holdUntilUtc: '2026-12-03T00:00:00Z', holdExpired: false, seats: 10, registered: 3, activityIds: ['a'] }]);
    expect(b).toMatchObject({ clubOrderId: 'o', orderCode: 'KO-1', playersMissing: true, holdExpired: false, seats: 10 });
    const [plain] = timeBlockListSchema.parse([{ id: 'b', startUtc: '2026-12-10T07:00:00Z', endUtc: '2026-12-10T08:00:00Z' }]);
    expect(plain!.orderCode).toBeUndefined();
    const [day] = previewListSchema.parse([{ date: '2026-12-10', isOpen: true, isChangedByOverride: false, lunchException: { kind: 'moved', originalStart: '12:00', originalEnd: '12:30' } }]);
    expect(day!.lunchException).toEqual({ kind: 'moved', originalStart: '12:00', originalEnd: '12:30' });
    expect(previewListSchema.parse([{ date: '2026-12-10', isOpen: true, isChangedByOverride: false }])[0]!.lunchException).toBeUndefined();
  });
});

describe('R17: lunch exceptions', () => {
  const ex = { calendarId: 'c1', date: '2026-10-23', kind: 'moved', originalStart: '12:00', originalEnd: '12:30', startTime: '13:00', endTime: '13:30', reason: null, createdByUserId: 'u', createdAtUtc: '2026-10-22T10:00:00Z' };

  it('lists, sets (idempotent PUT) and restores one day - never the weekly rule', async () => {
    get.mockResolvedValue({ data: [ex] });
    expect(await lunchExceptionsApi.list('c1', '2026-10-19', '2026-10-25')).toEqual([ex]);
    expect(get).toHaveBeenCalledWith('/api/calendars/c1/lunch-exceptions', { params: { from: '2026-10-19', to: '2026-10-25' } });
    put.mockResolvedValue({ data: ex });
    const set = await lunchExceptionsApi.set('c1', '2026-10-23', { kind: 'moved', startTime: '13:00' });
    expect(put).toHaveBeenCalledWith('/api/calendars/c1/lunch-exceptions/2026-10-23', { kind: 'moved', startTime: '13:00' });
    expect(set).toMatchObject({ kind: 'moved', startTime: '13:00', endTime: '13:30', originalStart: '12:00' });
    del.mockResolvedValue({ status: 204 });
    await lunchExceptionsApi.restore('c1', '2026-10-23');
    expect(del).toHaveBeenCalledWith('/api/calendars/c1/lunch-exceptions/2026-10-23');
  });

  it('books into the lunch slot: the booked-appointment body comes back (a bare appointment is accepted too)', async () => {
    const appointment = { id: 'a1', calendarId: 'c1', patientId: 'p', activityId: 'act', activityName: 'Prohlídka', startUtc: '2026-10-23T10:00:00Z', endUtc: '2026-10-23T10:30:00Z', status: 0, paperwork: null };
    post.mockResolvedValueOnce({ data: { appointment, warnings: [] } });
    const booked = await lunchExceptionsApi.bookIntoLunch('c1', { patientId: 'p', activityId: 'act', startUtc: '2026-10-23T10:00:00Z' });
    expect(post).toHaveBeenCalledWith('/api/calendars/c1/appointments/into-lunch', { patientId: 'p', activityId: 'act', startUtc: '2026-10-23T10:00:00Z' });
    expect(booked.appointment.id).toBe('a1');
    post.mockResolvedValueOnce({ data: appointment });
    expect((await lunchExceptionsApi.bookIntoLunch('c1', { name: 'Host', activityId: 'act', startUtc: '2026-10-23T10:00:00Z' })).appointment.id).toBe('a1');
  });

  it('a refusal is worded by its stable code; a server without the routes is recognised', async () => {
    const overlap = toBookingError(axiosError(409, { code: LUNCH_CODES.overlapsBooking, message: 'x' }));
    expect(lunchErrorText(overlap)).toBe('V tomto čase už je rezervace. Přesuňte nejdřív ji, nebo zvolte jiný čas oběda.');
    expect(lunchErrorText(toBookingError(axiosError(422, { code: LUNCH_CODES.outsideHours })))).toBe('Oběd musí zůstat v pracovní době dne.');
    expect(lunchErrorText(toBookingError(axiosError(403, {})))).toBe('K úpravě oběda nemáte oprávnění.');
    expect(lunchErrorText(new Error('boom'))).toBe('Oběd se nepodařilo upravit. Zkuste to prosím znovu.');
    get.mockRejectedValue(axiosError(404, 'Not Found'));
    await expect(lunchExceptionsApi.list('c1', '2026-10-19', '2026-10-25')).rejects.toSatisfy(isLunchRouteMissing);
    /* a 404 that carries a problem code is "no lunch that day", not "no route" */
    expect(isLunchRouteMissing(toBookingError(axiosError(404, { code: LUNCH_CODES.notFound })))).toBe(false);
    expect(isLunchRouteMissing(toBookingError(axiosError(405, '')))).toBe(true);
  });
});
