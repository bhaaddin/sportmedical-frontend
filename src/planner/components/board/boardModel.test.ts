import { describe, expect, it } from 'vitest';
import type { Calendar, DayAppointment, TimeBlock } from '../../../api/bookingContracts';
import { EMPTY_CATALOGUE, type Catalogue } from '../../../components/booking/calendar/model';
import { formatCzk } from '../../../components/booking/grid/appointmentPrice';
import { DEFAULT_WINDOW, makeContext, type DayMark, type PlannerCategory, type PlannerSession } from '../../model';
import { demoCategories, demoDemands, demoSessions } from '../../data/demoFixtures';
import { boardGeometry } from './boardGeometry';
import {
  buildBoardModel,
  dayListModel,
  isCalendarBacked,
  linesThatFit,
  monthTilesModel,
  toneVars,
  withAlpha,
  type BoardCalendarInput,
} from './boardModel';

const WEEK = '2026-11-16';
const g = boardGeometry(DEFAULT_WINDOW, 1);
const NOW_MINUTE = 10 * 60;

const marks = (over: Record<string, Partial<DayMark>> = {}): Record<string, DayMark> => {
  const out: Record<string, DayMark> = {};
  for (let i = 0; i < 7; i++) {
    const date = `2026-11-${String(16 + i).padStart(2, '0')}`;
    out[date] =
      i >= 5
        ? { date, closed: false, label: null, hours: null, lunch: null }
        : { date, closed: false, label: null, hours: { from: '08:00', to: '16:00' }, lunch: { from: '12:00', to: '12:30' } };
    Object.assign(out[date]!, over[date] ?? {});
  }
  return out;
};

const categories: PlannerCategory[] = [
  { id: 'a1', name: 'Prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, priceCzk: 1600 },
  { id: 'a2', name: 'Fyzio', iconKey: 'physio', color: '#ffb124', slotMinutes: 30, priceCzk: null },
];
const ctxOf = (sessions: PlannerSession[] = [], today = '2026-11-18') =>
  makeContext({ categories, sessions, today, demands: [] });

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};

const appt = (id: string, startUtc: string, endUtc: string, extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, calendarId: 'c1', patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...extra,
});

const block = (id: string, startUtc: string, endUtc: string, extra: Partial<TimeBlock> = {}): TimeBlock => ({
  id, startUtc, endUtc, reason: '', kind: 'manual', ...extra,
});

const calInput = (over: Partial<BoardCalendarInput> = {}): BoardCalendarInput => ({
  calendars: [calendar],
  appointments: [],
  blocksByCalendar: new Map(),
  catalogue: EMPTY_CATALOGUE as Catalogue,
  mayBook: true,
  ...over,
});

const build = (over: Partial<Parameters<typeof buildBoardModel>[0]> = {}) =>
  buildBoardModel({
    ctx: ctxOf(),
    weekStart: WEEK,
    filter: 'all',
    geometry: g,
    dayMarks: marks(),
    dayMarkColors: { holiday: '#E7CBA9', lunch: '#CBD1D8' },
    calendar: null,
    nowMinute: NOW_MINUTE,
    ...over,
  });

describe('session cards', () => {
  const sessions: PlannerSession[] = [
    { id: 's1', date: '2026-11-17', start: '09:00', end: '11:00', categoryId: 'a1', capacity: 8, booked: 3, origin: 'public' },
    { id: 's2', date: '2026-11-18', start: '09:00', end: '09:30', categoryId: 'a2', capacity: 1, booked: 0, origin: 'public' },
    { id: 's3', date: '2026-12-30', start: '09:00', end: '10:00', categoryId: 'a1', capacity: 1, booked: 0, origin: 'public' },
  ];

  it('draws the week\'s sessions with the činnost colour, "N slotů" and the times', () => {
    const m = build({ ctx: ctxOf(sessions) });
    expect(m.cards.map((c) => c.key)).toEqual(['session:s1', 'session:s2']);
    const first = m.cards[0]!;
    expect(first).toMatchObject({ kind: 'session', col: 1, tone: '#00f1dc', timeLabel: '09:00 – 11:00', capacityLabel: '8 slotů', iconKey: 'heart' });
    expect(m.cards[1]).toMatchObject({ capacityLabel: '1 slot', compact: true });
  });

  it('puts the price on a card only when it is tall enough, and says "bez ceny" when the list has none', () => {
    const m = build({ ctx: ctxOf(sessions) });
    const tall = m.cards[0] as Extract<(typeof m.cards)[number], { kind: 'session' }>;
    expect(tall.priceText).toBe(formatCzk(1600));
    expect(tall.showPrice).toBe(true);
    expect(tall.priceOwnLine).toBe(true);
    const short = m.cards[1] as typeof tall;
    expect(short.priceText).toBe('bez ceny');
    expect(short.showPrice).toBe(false); // 25 px: no price on the card, the hover has it
    expect(linesThatFit(75.8)).toBe(4);
    expect(linesThatFit(25)).toBe(1);
  });

  it('filters by činnost like the toolbar select', () => {
    const m = build({ ctx: ctxOf(sessions), filter: 'a2' });
    expect(m.cards.map((c) => c.key)).toEqual(['session:s2']);
  });

  it('draws the file\'s demo week exactly as renderWeekEvents does', () => {
    const ctx = makeContext({ categories: demoCategories, demands: demoDemands, sessions: demoSessions, today: '2026-11-10' });
    const m = build({ ctx });
    expect(m.cards.length).toBe(demoSessions.filter((s) => s.date >= WEEK && s.date <= '2026-11-22').length);
    for (const c of m.cards) {
      expect(c.lanes).toBe(1); // no lane sharing where the file has none
      expect(c.left).toMatch(/^calc\(\d \* 100% \/ 7 \+ 3px\)$/);
    }
  });

  it('stops drawing the sessions the real calendar draws itself, and only those', () => {
    const backed: PlannerSession = { id: 'appt:x', date: '2026-11-17', start: '10:00', end: '10:30', categoryId: 'a1', capacity: 1, booked: 1, origin: 'public', appointmentIds: ['b1'] };
    const foreign: PlannerSession = { id: 'club:y', date: '2026-11-17', start: '13:00', end: '15:00', categoryId: 'a1', capacity: 4, booked: 0, origin: 'public', foreign: true };
    const own: PlannerSession = { id: 'own', date: '2026-11-17', start: '16:00', end: '17:00', categoryId: 'a1', capacity: 2, booked: 0, origin: 'club' };
    expect([backed, foreign, own].map(isCalendarBacked)).toEqual([true, true, false]);
    const ctx = makeContext({ categories, sessions: [backed, foreign, own], today: '2026-11-18', demands: [{ categoryId: 'a1', requested: 5, baselinePlanned: 0 }] });
    expect(build({ ctx }).cards.map((c) => c.key)).toEqual(['session:appt:x', 'session:club:y', 'session:own']);
    expect(build({ ctx, calendar: calInput() }).cards.map((c) => c.key)).toEqual(['session:own']);
  });
});

describe('bookings of the real calendar', () => {
  it('draws one card per booking in the day column with patient, times and price', () => {
    const a = appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z'); // 09:00-09:30 Prague
    const m = build({ calendar: calInput({ appointments: [a] }) });
    expect(m.cards).toHaveLength(1);
    expect(m.cards[0]).toMatchObject({ kind: 'booking', col: 1, name: 'Pacient b1', timeLabel: '09:00 – 09:30', draggable: true });
  });

  it('prices a booking agreed price first, then list price, then the činnost\'s catalogue price', () => {
    const agreed = appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z', { agreedPriceCzk: 1200, listPriceCzk: 1600 });
    const listed = appt('b2', '2026-11-18T08:00:00Z', '2026-11-18T09:00:00Z', { listPriceCzk: 1600 });
    const catalogueOnly = appt('b3', '2026-11-19T08:00:00Z', '2026-11-19T09:00:00Z');
    const none = appt('b4', '2026-11-20T08:00:00Z', '2026-11-20T09:00:00Z', { activityId: 'a2' });
    const m = build({ calendar: calInput({ appointments: [agreed, listed, catalogueOnly, none] }) });
    const price = (id: string) => {
      const c = m.cards.find((x) => x.key === `booking:${id}`)!;
      return [c.priceText, c.priceAdjusted];
    };
    expect(price('b1')).toEqual([formatCzk(1200), true]);
    expect(price('b2')).toEqual([formatCzk(1600), false]);
    expect(price('b3')).toEqual([formatCzk(1600), false]);
    expect(price('b4')).toEqual(['bez ceny', false]);
  });

  it('shares the column in lanes when bookings run at the same time, up to three then a "+N" chip', () => {
    const list = ['p1', 'p2', 'p3', 'p4'].map((id) => appt(id, '2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z'));
    const two = build({ calendar: calInput({ appointments: list.slice(0, 2) }) });
    expect(two.cards.map((c) => [c.lane, c.lanes])).toEqual([[0, 2], [1, 2]]);
    expect(two.cards[1]!.width).toBe('calc((100% / 7) / 2 - 6px)');
    const four = build({ calendar: calInput({ appointments: list }) });
    expect(four.cards).toHaveLength(2);
    expect(four.overflow).toHaveLength(1);
    expect(four.overflow[0]!.keys).toHaveLength(2);
    expect(four.folded).toHaveLength(2);
  });

  it('keeps a cancelled booking as a card but not draggable', () => {
    const a = appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z', { status: 4 });
    const m = build({ calendar: calInput({ appointments: [a] }) });
    expect(m.cards[0]).toMatchObject({ cancelled: true, draggable: false });
  });

  it('filters bookings by činnost with the toolbar select', () => {
    const list = [appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z'), appt('b2', '2026-11-18T08:00:00Z', '2026-11-18T09:00:00Z', { activityId: 'a2' })];
    expect(build({ calendar: calInput({ appointments: list }), filter: 'a2' }).cards.map((c) => c.key)).toEqual(['booking:b2']);
  });

  it('cannot drag without bookings.create', () => {
    const a = appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z');
    expect(build({ calendar: calInput({ appointments: [a], mayBook: false }) }).cards[0]).toMatchObject({ draggable: false });
  });
});

describe('club windows and manual blocks', () => {
  const clubPiece = (id: string, startUtc: string, endUtc: string) =>
    block(id, startUtc, endUtc, { kind: 'club', clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný', colorHex: '#2E7D32' });

  it('draws a club\'s day as ONE block across the lunch break', () => {
    // 08:00-12:00 and 12:30-16:00 Prague, lunch 12:00-12:30 on the Tuesday
    const blocks = [clubPiece('k1', '2026-11-17T07:00:00Z', '2026-11-17T11:00:00Z'), clubPiece('k2', '2026-11-17T11:30:00Z', '2026-11-17T15:00:00Z')];
    const m = build({ calendar: calInput({ blocksByCalendar: new Map([['c1', blocks]]) }) });
    expect(m.windows).toHaveLength(1);
    expect(m.windows[0]).toMatchObject({ kind: 'club', col: 1, label: 'FK Slaný', timeLabel: '08:00–16:00', colour: '#2E7D32' });
    expect(m.windows[0]!.height).toBeCloseTo(8 * g.pxPerHour, 6);
  });

  it('keeps two windows apart when the free time between them is real', () => {
    const blocks = [clubPiece('k1', '2026-11-17T08:00:00Z', '2026-11-17T10:00:00Z'), clubPiece('k2', '2026-11-17T13:00:00Z', '2026-11-17T15:00:00Z')];
    expect(build({ calendar: calInput({ blocksByCalendar: new Map([['c1', blocks]]) }) }).windows).toHaveLength(2);
  });

  it('draws a manual block with its reason, and skips the window of the club being planned', () => {
    const blocks = [block('m1', '2026-11-18T08:00:00Z', '2026-11-18T09:00:00Z', { reason: 'Školení' }), clubPiece('k1', '2026-11-19T08:00:00Z', '2026-11-19T10:00:00Z')];
    const input = calInput({ blocksByCalendar: new Map([['c1', blocks]]) });
    const m = build({ calendar: input });
    expect(m.windows.map((w) => [w.kind, w.label])).toEqual([['manual', 'Školení'], ['club', 'FK Slaný']]);
    const planning = build({ calendar: { ...input, excludeClubId: 'club1' } });
    expect(planning.windows.map((w) => w.kind)).toEqual(['manual']);
  });

  it('draws a window shared by two calendars once', () => {
    const other: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2' };
    const piece = clubPiece('k1', '2026-11-17T08:00:00Z', '2026-11-17T10:00:00Z');
    const m = build({
      calendar: calInput({ calendars: [calendar, other], blocksByCalendar: new Map([['c1', [piece]], ['c2', [piece]]]) }),
    });
    expect(m.windows).toHaveLength(1);
  });
});

describe('day marks', () => {
  it('shades outside the working hours, names the lunch band and closes a holiday', () => {
    const m = build({ dayMarks: marks({ '2026-11-18': { closed: true, label: 'Státní svátek', hours: null, lunch: null } }) });
    const tue = m.shades.find((s) => s.day === '2026-11-17')!;
    expect(tue.before!.top).toBe(0);
    expect(tue.before!.height).toBeCloseTo(g.pxPerHour, 6); // 07:00-08:00
    expect(tue.after!.height).toBeCloseTo(3 * g.pxPerHour, 6); // 16:00-19:00
    expect(tue.lunch).toMatchObject({ from: '12:00', to: '12:30' });
    expect(tue.lunch!.height).toBeCloseTo(0.5 * g.pxPerHour, 6);
    const wed = m.shades.find((s) => s.day === '2026-11-18')!;
    expect(wed).toMatchObject({ closed: true, closedLabel: 'Státní svátek', lunch: null, before: null, after: null });
  });

  it('shades a day without hours quietly and says nothing about it', () => {
    const sat = build().shades.find((s) => s.day === '2026-11-21')!;
    expect(sat).toMatchObject({ noHours: true, closed: false, closedLabel: null });
  });

  it('writes "Zavřeno" on a closed day that gave no name', () => {
    const m = build({ dayMarks: marks({ '2026-11-19': { closed: true, label: null } }) });
    expect(m.shades.find((s) => s.day === '2026-11-19')!.closedLabel).toBe('Zavřeno');
  });

  it('draws the now-line only on today, on a working day, inside its hours', () => {
    const at = (minute: number, today = '2026-11-17', over = {}) => build({ ctx: ctxOf([], today), nowMinute: minute, dayMarks: marks(over) }).nowLine;
    const line = at(10 * 60);
    expect(line).toMatchObject({ col: 1, minute: 600, label: '10:00' });
    expect(line!.top).toBeCloseTo((600 - 420) * g.pxPerMinute, 6);
    expect(line!.edge.height).toBeCloseTo(8 * g.pxPerHour, 6);
    expect(at(7 * 60 + 30)).toBeNull(); // before opening
    expect(at(16 * 60)).toBeNull(); // at closing
    expect(at(10 * 60, '2026-11-21')).toBeNull(); // Saturday: no hours
    expect(at(10 * 60, '2026-11-17', { '2026-11-17': { closed: true } })).toBeNull();
    expect(at(10 * 60, '2026-12-30')).toBeNull(); // not in this week
  });
});

describe('the day list and the month tiles', () => {
  const sessions: PlannerSession[] = [
    { id: 's1', date: '2026-11-17', start: '14:00', end: '15:00', categoryId: 'a1', capacity: 8, booked: 3, origin: 'public' },
    { id: 's2', date: '2026-11-18', start: '09:00', end: '10:00', categoryId: 'a1', capacity: 1, booked: 0, origin: 'public' },
  ];
  const a = appt('b1', '2026-11-17T08:00:00Z', '2026-11-17T08:30:00Z');

  it('lists the day\'s sessions and bookings chronologically with their price', () => {
    const list = dayListModel(ctxOf(sessions), '2026-11-17', 'all', [a], () => 'Objednán', true);
    expect(list.rows.map((r) => [r.kind, r.timeLabel, r.name, r.priceText])).toEqual([
      ['booking', '09:00 – 09:30', 'Pacient b1', formatCzk(1600)],
      ['session', '14:00 – 15:00', 'Prohlídka', formatCzk(1600)],
    ]);
    expect(list.rows[0]!.tail).toBe('Objednán');
    expect(list.rows[1]!.tail).toBe('3/8');
  });

  it('says there is nothing on an empty day', () => {
    const list = dayListModel(ctxOf([]), '2026-11-17', 'all', [], () => '', false);
    expect(list.rows).toEqual([]);
    expect(list.empty).toBe('Na vybraný den zatím nejsou vytvořené termíny.');
  });

  it('counts terms and bookings per tile and names a closed day', () => {
    const tiles = monthTilesModel(ctxOf(sessions), '2026-11-01', 'all', [a], marks({ '2026-11-19': { closed: true, label: 'Zavřeno' } }), false);
    const tile = (d: string) => tiles.tiles.find((t) => t.date === d)!;
    expect(tile('2026-11-17')).toMatchObject({ count: 2, countLabel: '2 termíny' });
    expect(tile('2026-11-18')).toMatchObject({ count: 1, countLabel: '1 termín' });
    expect(tile('2026-11-19')).toMatchObject({ flag: 'Zavřeno', countLabel: null });
    expect(tile('2026-10-26').otherMonth).toBe(true);
  });
});

describe('colours', () => {
  it('derives the card\'s dark fill and glow from the činnost colour', () => {
    const vars = toneVars('#00f1dc');
    expect(vars['--ev-border']).toBe('#00f1dc');
    expect(vars['--ev-bg']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--ev-glow']).toBe(withAlpha('#00f1dc', 0.46));
    expect(withAlpha('#E7CBA9', 0.5)).toBe('rgba(231, 203, 169, 0.5)');
    expect(withAlpha('not-a-colour', 0.5)).toBe('not-a-colour');
  });
});
