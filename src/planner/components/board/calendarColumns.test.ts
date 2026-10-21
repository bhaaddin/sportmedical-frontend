/*
 * Reviewer 2.4 - pure rules of the calendar columns: when a day splits, which column a calendar and a pointer belong to, how the
 * cards and windows are placed inside a column, and that the plain week is exactly what it was.
 */
import { describe, expect, it } from 'vitest';
import type { Calendar, DayAppointment, TimeBlock } from '../../../api/bookingContracts';
import { DEFAULT_WINDOW, makeContext, type DayMark } from '../../model';
import { boardGeometry, cardLeftWidth, cellAtFraction, columnAtFraction } from './boardGeometry';
import { buildBoardModel, type BoardCalendarInput } from './boardModel';
import { MAX_CALENDAR_COLUMNS, calendarColumns, calendarOfColumn, columnChips, columnOf } from './calendarColumns';

const cal = (id: string, name: string, sortOrder: number, color = '#2563EB'): Calendar =>
  ({ id, name, color, location: '', displayStepMinutes: 15, isActive: true, sortOrder, clinicServiceId: null, publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null }) as Calendar;

const lekarske = cal('c1', 'Lékařské prohlídky', 1, '#0EA5E9');
const diagnostika = cal('c2', 'Sportovní diagnostika', 2, '#7C3AED');
const inbody = cal('c3', 'InBody', 3, '#D97706');
const balicky = cal('c4', 'Balíčky', 4, '#16A34A');

describe('when a day splits', () => {
  it('one calendar: the week stays one column per day', () => {
    expect(calendarColumns([lekarske], true)).toBeNull();
    expect(calendarColumns([], true)).toBeNull();
  });

  it('two or three calendars split the day, in the calendars own order', () => {
    expect(calendarColumns([diagnostika, lekarske], true)?.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(calendarColumns([inbody, lekarske, diagnostika], true)?.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('more than three do not (a card would be a sliver); the calendar selector says so', () => {
    expect(MAX_CALENDAR_COLUMNS).toBe(3);
    expect(calendarColumns([lekarske, diagnostika, inbody, balicky], true)).toBeNull();
  });

  it('only where it is allowed: a club planning board is never split', () => {
    expect(calendarColumns([lekarske, diagnostika], false)).toBeNull();
  });

  it('the column of a calendar and the calendar of a column agree; an unknown id is column 0', () => {
    const columns = calendarColumns([lekarske, diagnostika], true);
    expect(columnOf(columns, 'c2')).toBe(1);
    expect(columnOf(columns, 'zzz')).toBe(0);
    expect(columnOf(null, 'c2')).toBe(0);
    expect(calendarOfColumn(columns, 1)?.id).toBe('c2');
    expect(calendarOfColumn(columns, 9)?.id).toBe('c2');
    expect(calendarOfColumn(columns, -1)?.id).toBe('c1');
    expect(calendarOfColumn(null, 0)).toBeNull();
  });

  it('the chips carry the calendars own names and colours (a missing colour falls back to a neutral one)', () => {
    expect(columnChips([lekarske, { ...diagnostika, color: 'nope' }])).toEqual([
      { id: 'c1', name: 'Lékařské prohlídky', colour: '#0EA5E9' },
      { id: 'c2', name: 'Sportovní diagnostika', colour: '#6e91a5' },
    ]);
  });
});

describe('the pointer and the cards inside a split day', () => {
  it('without a split the cell is the day: exactly the old column', () => {
    for (const f of [0, 0.1, 0.5, 0.99, 1, 1.5, -1]) expect(cellAtFraction(f).col).toBe(columnAtFraction(f));
    expect(cellAtFraction(0.3).sub).toBe(0);
  });

  it('two calendars: the first half of a day is the first calendar, the second half the second', () => {
    const day = 1 / 7;
    expect(cellAtFraction(day * 2 + day * 0.25, 2)).toEqual({ col: 2, sub: 0 });
    expect(cellAtFraction(day * 2 + day * 0.75, 2)).toEqual({ col: 2, sub: 1 });
    expect(cellAtFraction(0, 2)).toEqual({ col: 0, sub: 0 });
    expect(cellAtFraction(1, 2)).toEqual({ col: 6, sub: 1 });
    expect(cellAtFraction(day * 6 + day * 0.9, 3)).toEqual({ col: 6, sub: 2 });
  });

  it('a card of the plain week keeps the prototype strings; a card of a sub-column sits inside its column', () => {
    expect(cardLeftWidth(2, 0, 1)).toEqual({ left: 'calc(2 * 100% / 7 + 3px)', width: 'calc(100% / 7 - 6px)' });
    expect(cardLeftWidth(2, 0, 1, 0, 1)).toEqual(cardLeftWidth(2, 0, 1));
    const second = cardLeftWidth(2, 0, 1, 1, 2);
    expect(second.left).toContain('(2 * 2 + 1)');
    expect(second.width).toBe('calc((100% / 7 / 2) - 4px)');
    /* lanes divide the sub-column, not the day */
    expect(cardLeftWidth(2, 1, 3, 1, 2).width).toBe('calc((100% / 7 / 2) / 3 - 4px)');
  });
});

describe('the board model of a split week', () => {
  const DAY = '2026-12-09'; // a Wednesday of the week starting 2026-12-07
  const WEEK = '2026-12-07';
  const ctx = makeContext({ categories: [], sessions: [], today: '2026-12-09' });
  const g = boardGeometry(DEFAULT_WINDOW, 1);
  const marks: Record<string, DayMark> = {};
  const appt = (id: string, calendarId: string, startUtc: string, endUtc: string): DayAppointment =>
    ({ id, calendarId, patientId: '', patientName: `P ${id}`, activityId: 'a1', activityName: 'Prohlídka', startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null, clubDiscountPercent: null, paymentState: 'none', invoiceId: null }) as DayAppointment;
  const block = (id: string, kind: 'club' | 'manual', startUtc: string, endUtc: string): TimeBlock =>
    ({ id, startUtc, endUtc, reason: 'x', kind, clubId: kind === 'club' ? 'k1' : null, clubName: kind === 'club' ? 'FK Slaný' : null, clubBlockId: kind === 'club' ? 'kb1' : null, colorHex: '#2E7D6B' }) as unknown as TimeBlock;

  const input = (extra: Partial<BoardCalendarInput> = {}, appointments: DayAppointment[] = []): Parameters<typeof buildBoardModel>[0] => ({
    ctx, weekStart: WEEK, filter: 'all', geometry: g, dayMarks: marks, dayMarkColors: { holiday: '#E7CBA9', lunch: '#CBD1D8' }, nowMinute: 600,
    calendar: { calendars: [lekarske, diagnostika], appointments, blocksByCalendar: new Map(), catalogue: { activities: new Map(), services: new Map() }, mayBook: true, ...extra },
  });

  /* December is CET: 09:00 Prague = 08:00Z */
  const a1 = appt('a1', 'c1', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z');
  const a2 = appt('a2', 'c2', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z');

  it('without a split every card is in column 0 of 1 and keeps the file strings, two simultaneous cards share lanes', () => {
    const model = buildBoardModel(input({}, [a1, a2]));
    expect(model.columns).toEqual([]);
    expect(model.cards.map((c) => [c.sub, c.subs, c.lanes])).toEqual([[0, 1, 2], [0, 1, 2]]);
  });

  it('with a split a booking sits in its own calendar column; simultaneous bookings of two calendars do NOT share lanes', () => {
    const model = buildBoardModel(input({ split: ['c1', 'c2'] }, [a1, a2]));
    expect(model.columns.map((c) => c.id)).toEqual(['c1', 'c2']);
    const byId = new Map(model.cards.map((c) => [c.key, c]));
    expect(byId.get('booking:a1')).toMatchObject({ col: 2, sub: 0, subs: 2, lane: 0, lanes: 1 });
    expect(byId.get('booking:a2')).toMatchObject({ col: 2, sub: 1, subs: 2, lane: 0, lanes: 1 });
    expect(byId.get('booking:a1')!.left).not.toBe(byId.get('booking:a2')!.left);
  });

  it('two simultaneous bookings of ONE calendar still share lanes inside that column', () => {
    const twin = appt('a3', 'c2', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z');
    const model = buildBoardModel(input({ split: ['c1', 'c2'] }, [a1, a2, twin]));
    const second = model.cards.filter((c) => c.sub === 1);
    expect(second.map((c) => c.lanes)).toEqual([2, 2]);
    expect(model.cards.find((c) => c.key === 'booking:a1')!.lanes).toBe(1);
  });

  it('a club window in both calendars is one window on a plain week and one in each column on a split week', () => {
    const club = (id: string) => block(id, 'club', '2026-12-09T07:00:00Z', '2026-12-09T09:00:00Z');
    const blocksByCalendar = new Map([['c1', [club('b-1')]], ['c2', [club('b-2')]]]);
    const plain = buildBoardModel(input({ blocksByCalendar }));
    expect(plain.windows).toHaveLength(1);
    const split = buildBoardModel(input({ blocksByCalendar, split: ['c1', 'c2'] }));
    expect(split.windows.map((w) => [w.calendarId, w.sub, w.subs])).toEqual([['c1', 0, 2], ['c2', 1, 2]]);
  });

  it('a manual block follows its calendar column', () => {
    const blocksByCalendar = new Map([['c2', [block('m1', 'manual', '2026-12-09T08:00:00Z', '2026-12-09T09:00:00Z')]]]);
    const model = buildBoardModel(input({ blocksByCalendar, split: ['c1', 'c2'] }));
    expect(model.windows).toHaveLength(1);
    expect(model.windows[0]).toMatchObject({ kind: 'manual', calendarId: 'c2', sub: 1, subs: 2 });
  });

  it('a calendar that does not work on an open day is hatched in its own column only; a closed day is hatched whole already', () => {
    const open = (calendarId: string, day: string) => !(calendarId === 'c2' && day === DAY);
    const model = buildBoardModel(input({ split: ['c1', 'c2'], isOpen: open }));
    expect(model.calendarShades.map((c) => [c.calendarId, c.day, c.sub])).toEqual([['c2', DAY, 1]]);
    const closedDay = buildBoardModel({ ...input({ split: ['c1', 'c2'], isOpen: () => false }), dayMarks: { [DAY]: { date: DAY, closed: true, label: 'Svátek' } as DayMark } });
    expect(closedDay.calendarShades.some((c) => c.day === DAY)).toBe(false);
  });

  it('no calendar shades without a split', () => {
    expect(buildBoardModel(input({ isOpen: () => false })).calendarShades).toEqual([]);
  });
});
