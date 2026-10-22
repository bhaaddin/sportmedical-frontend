import { describe, expect, it } from 'vitest';
import type { Calendar, DayAppointment, TimeBlock } from '../../../api/bookingContracts';
import { yOfMinute, type BoardGeometry } from './boardGeometry';
import { workerClashes, type RosterWorker } from './workerClash';

const cal = (id: string, name: string): Calendar => ({
  id, name, color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0, clinicServiceId: null,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const A = cal('cA', 'Ordinace 1');
const B = cal('cB', 'Diagnostika');
const appt = (id: string, calendarId: string, startUtc: string, endUtc: string, extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, calendarId, patientId: 'p', patientName: 'Tajné Jméno', activityId: 'a1', activityName: 'Spiroergometrie', startUtc, endUtc, status: 0,
  isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null, clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...extra,
});
/* December is CET: 09:00 Prague = 08:00Z */
const wed = appt('w1', 'cA', '2026-12-09T08:00:00Z', '2026-12-09T08:45:00Z');
const g = { startMinutes: 420, endMinutes: 1140, pxPerMinute: 1, height: 720 } as unknown as BoardGeometry;
const anna: RosterWorker = { id: 'u1', name: 'Anna Černá' };
const days = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'];

const run = (over: Partial<Parameters<typeof workerClashes>[0]> = {}) =>
  workerClashes({
    days, split: ['cA', 'cB'], calendars: [A, B], appointments: [wed], blocksByCalendar: new Map(), exceptions: new Set(),
    workerOf: () => anna, geometry: g, ...over,
  });

describe('R4: the shared worker is drawn busy in the other column', () => {
  it('a booking of the worker in one služba locks the same time in the other column, with the reason and no patient', () => {
    const [c] = run();
    expect(c).toMatchObject({ calendarId: 'cB', day: '2026-12-09', col: 2, sub: 1, subs: 2, worker: 'Anna Černá' });
    expect(c!.reason).toBe('Anna Černá: Spiroergometrie 09:00–09:45 (Ordinace 1)');
    expect(c!.reason).not.toContain('Tajné');
    expect(c!.top).toBe(yOfMinute(g, 540));
    expect(c!.height).toBe(45);
  });

  it('draws nothing when the rule is not in force: one column, or no split', () => {
    expect(run({ split: null })).toEqual([]);
    expect(run({ split: ['cA'] })).toEqual([]);
  });

  it('a different worker in the other column is no clash; nobody rostered means the calendar is the resource', () => {
    expect(run({ workerOf: (id) => (id === 'cA' ? anna : { id: 'u2', name: 'Petr' }) })).toEqual([]);
    expect(run({ workerOf: () => null })).toEqual([]);
    expect(run({ workerOf: (id) => (id === 'cA' ? anna : null) })).toEqual([]);
  });

  it('a worker on the exception list holds two things at once: nothing is drawn', () => {
    expect(run({ exceptions: new Set(['u1']) })).toEqual([]);
  });

  it('a cancelled booking blocks nothing', () => {
    expect(run({ appointments: [appt('w2', 'cA', '2026-12-09T08:00:00Z', '2026-12-09T08:45:00Z', { status: 4 })] })).toEqual([]);
  });

  it('a club window of the worker counts too (named by the club, never a player)', () => {
    const club = { id: 'k1', startUtc: '2026-12-10T08:00:00Z', endUtc: '2026-12-10T10:00:00Z', reason: '', kind: 'club', clubName: 'FK Slaný', clubBlockId: 'kb1' } as unknown as TimeBlock;
    const [c] = run({ appointments: [], blocksByCalendar: new Map([['cB', [club]]]) });
    expect(c).toMatchObject({ calendarId: 'cA', day: '2026-12-10', sub: 0 });
    expect(c!.reason).toBe('Anna Černá: blokace klubu FK Slaný 09:00–11:00 (Diagnostika)');
  });

  it('only days the worker is rostered in both columns clash', () => {
    expect(run({ workerOf: (id, day) => (id === 'cB' && day === '2026-12-09' ? null : anna) })).toEqual([]);
  });

  it('extra calendars of one služba ride in its column and do not clash with it', () => {
    const A2 = cal('cA2', 'Jen spiro');
    const out = run({ calendars: [A, A2, B], alias: new Map([['cA2', 'cA']]), appointments: [appt('w3', 'cA2', '2026-12-09T08:00:00Z', '2026-12-09T08:45:00Z')] });
    expect(out.map((c) => c.calendarId)).toEqual(['cB']);
  });
});
