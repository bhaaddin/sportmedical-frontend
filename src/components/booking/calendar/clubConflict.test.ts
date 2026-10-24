import { describe, expect, it, vi } from 'vitest';
import type { DayAppointment } from '../../../api/bookingContracts';
import { clubWindowsOf, collidingBookings, isTimeTakenRefusal, proposeSlot, revertMoves, runMoves, searchSpan, type MovePlanItem } from './clubConflict';

/* December is CET: 09:00 Prague = 08:00Z */
const appt = (id: string, from: string, to: string, extra: Partial<DayAppointment> = {}): DayAppointment =>
  ({ id, calendarId: 'c1', patientId: 'p', activityId: 'a1', activityName: 'Prohlídka', startUtc: `2026-12-02T${from}:00Z`, endUtc: `2026-12-02T${to}:00Z`, status: 0, patientName: 'Pacient', ...extra }) as DayAppointment;

const range = { fromDate: '2026-12-02', toDate: '2026-12-02', dailyFrom: '10:00', dailyTo: '12:00' }; /* 09:00-11:00Z */

describe('clubWindowsOf / collidingBookings (R24)', () => {
  it('a range is one window per day over its daily hours; no hours = the whole day', () => {
    const w = clubWindowsOf([range]);
    expect(w).toHaveLength(1);
    expect(new Date(w[0]!.startUtc).toISOString()).toBe('2026-12-02T09:00:00.000Z');
    expect(new Date(w[0]!.endUtc).toISOString()).toBe('2026-12-02T11:00:00.000Z');
    expect(clubWindowsOf([{ fromDate: '2026-12-02', toDate: '2026-12-03', dailyFrom: null, dailyTo: null }])).toHaveLength(2);
  });
  it('lists the bookings that overlap the window - touching ones and cancelled ones are not in the way', () => {
    const w = clubWindowsOf([range]);
    const list = [
      appt('in', '09:30', '10:00'),
      appt('edge-before', '08:30', '09:00'),
      appt('edge-after', '11:00', '11:30'),
      appt('across', '08:45', '09:15'),
      appt('cancelled', '09:30', '10:00', { status: 4 }),
      appt('other-cal', '09:30', '10:00', { calendarId: 'c9' }),
    ];
    expect(collidingBookings(w, ['c1'], list).map((a) => a.id)).toEqual(['across', 'in']);
  });
});

describe('proposeSlot (R24)', () => {
  const windows = clubWindowsOf([range]);
  const slot = (from: string) => ({ startUtc: `2026-12-02T${from}:00Z` });
  const booking = appt('b', '09:30', '10:00'); /* 30 min */
  it('the nearest free start, outside the club window', () => {
    const got = proposeSlot({ booking, windows, taken: [], slots: [slot('09:30'), slot('10:00'), slot('11:00'), slot('08:00'), slot('08:30')] });
    expect(got).toBe('2026-12-02T08:30:00Z'); /* 08:30-09:00 ends where the club starts (60 min away); 08:00 and 11:00 are 90 min away; 10:00 is inside */
  });
  it('never inside the window, never the booking\'s own place, never the end overlapping the window', () => {
    expect(proposeSlot({ booking, windows, taken: [], slots: [slot('09:30'), slot('08:45'), slot('10:15')] })).toBeNull();
  });
  it('two bookings do not get the same slot, and a stayer is not landed on', () => {
    const slots = [slot('08:00'), slot('08:30'), slot('11:00')];
    const first = proposeSlot({ booking, windows, taken: [], slots })!;
    const second = proposeSlot({ booking: appt('b2', '09:45', '10:15'), windows, taken: [{ calendarId: 'c1', startUtc: Date.parse(first), endUtc: Date.parse(first) + 30 * 60_000 }], slots })!;
    expect(second).not.toBe(first);
    const staying = [appt('s', '08:30', '09:00')];
    expect(proposeSlot({ booking, windows, taken: [], slots: [slot('08:30'), slot('11:00')], staying })).toBe('2026-12-02T11:00:00Z');
  });
  it('no slot at all = null (the step must say so and block)', () => {
    expect(proposeSlot({ booking, windows, taken: [], slots: [] })).toBeNull();
  });
  it('searches two weeks each way but never before today', () => {
    expect(searchSpan('2026-12-02T08:00:00Z', '2026-12-01')).toEqual({ from: '2026-12-01', to: '2026-12-16' });
    expect(searchSpan('2026-12-20T08:00:00Z', '2026-12-01')).toEqual({ from: '2026-12-06', to: '2027-01-03' });
  });
});

describe('runMoves / revertMoves (R24)', () => {
  const plan: MovePlanItem[] = ['a', 'b', 'c'].map((id, i) => ({ appointmentId: id, calendarId: 'c1', fromStartUtc: `from${i}`, toStartUtc: `to${i}`, notify: i === 0 }));
  it('moves all of them in order', async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const run = await runMoves(plan, move, String);
    expect(run.failed).toBeNull();
    expect(run.moved.map((m) => m.appointmentId)).toEqual(['a', 'b', 'c']);
    expect(move).toHaveBeenCalledTimes(3);
  });
  it('stops at the first failure and says exactly what moved; nothing after it is tried', async () => {
    const move = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Čas je obsazený'));
    const run = await runMoves(plan, move, (e) => (e as Error).message);
    expect(run.moved.map((m) => m.appointmentId)).toEqual(['a']);
    expect(run.failed).toMatchObject({ item: { appointmentId: 'b' }, message: 'Čas je obsazený' });
    expect(move).toHaveBeenCalledTimes(2);
  });
  it('reverts the moved ones, last first, and reports the ones that would not go back', async () => {
    const order: string[] = [];
    const back = vi.fn(async (i: MovePlanItem) => {
      order.push(i.appointmentId);
      if (i.appointmentId === 'a') throw new Error('x');
    });
    const stuck = await revertMoves(plan.slice(0, 2), back);
    expect(order).toEqual(['b', 'a']);
    expect(stuck.map((s) => s.appointmentId)).toEqual(['a']);
  });
});

describe('isTimeTakenRefusal', () => {
  it('a 409 or a "taken" code is the time-taken kind; a validation error is not', () => {
    expect(isTimeTakenRefusal({ status: 409 })).toBe(true);
    expect(isTimeTakenRefusal({ code: 'scheduling.booking.time_taken' })).toBe(true);
    expect(isTimeTakenRefusal({ status: 400, message: 'Čas je obsazený' })).toBe(true);
    expect(isTimeTakenRefusal({ status: 400, message: 'Vyberte objednávku.' })).toBe(false);
  });
});
