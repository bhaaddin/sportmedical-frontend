/*
 * Reviewer 2.2: a day is summarised per činnost - "Komplexní prohlídka ×10 -> 10 slotů" - never one row per booking. Pure model tests:
 * the counts, the parallel-capacity rule (a booking counts people, not the free parallel seats), the lunch break (a window's
 * slots are laid through the open pieces, so they are never subtracted twice), 30 people in one row, the order of the rows.
 */
import { describe, expect, it } from 'vitest';
import {
  addPlannedInterval, countMark, groupByActivity, groupTitle, makeContext, slotsOfSession, slotsText, spanText, summariseDay,
  type DayMark, type PlannerCategory, type PlannerSession, type SessionAppointment,
} from './index';

const DAY = '2026-12-07';
const komplex: PlannerCategory = { id: 'k', name: 'Komplexní prohlídka', iconKey: 'heart', color: '#e9c46a', slotMinutes: 60, parallelCapacity: 1 };
const zaklad: PlannerCategory = { id: 'z', name: 'Základní prohlídka', iconKey: 'heart', color: '#e76f51', slotMinutes: 40, parallelCapacity: 1 };
const spiro: PlannerCategory = { id: 's', name: 'Spiroergometrie', iconKey: 'heart', color: '#2a9d8f', slotMinutes: 90, parallelCapacity: 2 };
const categories = [zaklad, komplex, spiro];

const person = (id: string, name: string | null): SessionAppointment => ({ id, calendarId: 'c1', patientName: name, status: 0, heads: 1, priceCzk: null });
/** A booking term as the mapper builds it: one per činnost and start, `booked` heads, `capacity` = parallel seats of the group. */
const booking = (id: string, categoryId: string, start: string, end: string, opts: { capacity?: number; names?: (string | null)[] } = {}): PlannerSession => {
  const names = opts.names ?? ['Jana Nováková'];
  return {
    id, date: DAY, start, end, categoryId, booked: names.length, capacity: opts.capacity ?? names.length, origin: 'public', showInList: true,
    appointmentIds: names.map((_, i) => `${id}-${i}`), appointments: names.map((n, i) => person(`${id}-${i}`, n)),
  };
};
const window_ = (id: string, categoryId: string, start: string, end: string, capacity: number, origin: 'club' | 'public' = 'club', booked = 0): PlannerSession => ({
  id, date: DAY, start, end, categoryId, capacity, booked, origin, showInList: true,
});
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

describe('one row per činnost', () => {
  it('ten bookings of one činnost are ONE row: x10, 10 slotů', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => booking(`b${i}`, 'k', hhmm(480 + i * 60), hhmm(540 + i * 60)));
    const rows = groupByActivity({ categories }, sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoryId: 'k', name: 'Komplexní prohlídka', count: 10, terms: 10, people: 10, slots: 10, tone: '#e9c46a' });
    expect(countMark(rows[0]!)).toBe('×10');
    expect(groupTitle(rows[0]!)).toBe('Komplexní prohlídka ×10');
    expect(slotsText(rows[0]!.slots)).toBe('10 slotů');
    expect(spanText(rows[0]!)).toBe('08:00–18:00');
  });

  it('two činnosti are two rows, in the catalogue order, each with its own count', () => {
    const sessions = [
      booking('k1', 'k', '09:00', '10:00'), booking('k2', 'k', '10:00', '11:00'),
      booking('z1', 'z', '08:00', '08:40'), booking('z2', 'z', '08:45', '09:25'),
    ];
    const rows = groupByActivity({ categories }, sessions);
    expect(rows.map((r) => [r.name, r.count, r.slots])).toEqual([['Základní prohlídka', 2, 2], ['Komplexní prohlídka', 2, 2]]);
    expect(slotsText(2)).toBe('2 sloty');
    expect(slotsText(1)).toBe('1 slot');
  });

  it('30 people for one komplexní prohlídka: still one row, 30 slotů, the people behind it', () => {
    const sessions = Array.from({ length: 30 }, (_, i) => booking(`p${i}`, 'k', hhmm(420 + i * 20), hhmm(480 + i * 20), { names: [`Pacient ${i + 1}`] }));
    const day = summariseDay({ categories }, sessions, DAY);
    expect(day.groups).toHaveLength(1);
    expect(day.groups[0]).toMatchObject({ count: 30, slots: 30, people: 30, terms: 30 });
    expect(day.groups[0]!.entries.flatMap((e) => e.names)).toHaveLength(30);
    expect(day).toMatchObject({ count: 30, slots: 30 });
  });

  it('a lone booking is a plain row without a multiplier', () => {
    const rows = groupByActivity({ categories }, [booking('z1', 'z', '08:00', '08:40')]);
    expect(countMark(rows[0]!)).toBe('');
    expect(groupTitle(rows[0]!)).toBe('Základní prohlídka');
  });

  it('a group booking counts its people (heads), not 1', () => {
    const rows = groupByActivity({ categories }, [booking('g', 'k', '09:00', '10:00', { names: ['A', 'B', 'C'] })]);
    expect(rows[0]).toMatchObject({ count: 3, people: 3, slots: 3, terms: 1 });
  });
});

describe('parallel capacity', () => {
  it('one patient on a činnost with two parallel places is ONE slot, not the two seats the term offers', () => {
    const term = booking('s1', 's', '09:00', '10:30', { capacity: 2, names: ['Jana'] });
    expect(term.capacity).toBe(2);
    expect(slotsOfSession(term)).toBe(1);
    const rows = groupByActivity({ categories }, [term]);
    expect(rows[0]).toMatchObject({ slots: 1, people: 1, count: 1 });
  });

  it('two patients at the same time on two parallel places are two slots in one entry', () => {
    const rows = groupByActivity({ categories }, [booking('s1', 's', '09:00', '10:30', { capacity: 2, names: ['A', 'B'] })]);
    expect(rows[0]).toMatchObject({ slots: 2, people: 2, count: 2, terms: 1 });
  });
});

describe('windows and the lunch break', () => {
  it('a club window counts its capacity once and its booked athletes as people of the entry', () => {
    const rows = groupByActivity({ categories }, [window_('w1', 'z', '08:00', '12:00', 6, 'club', 2)]);
    expect(rows[0]).toMatchObject({ slots: 6, count: 1, terms: 1, people: 0 });
    expect(rows[0]!.entries[0]).toMatchObject({ kind: 'club', people: 2, slots: 6 });
  });

  it('a block dropped across the lunch break is counted by the slots really laid (the break is not subtracted twice)', () => {
    const mark: DayMark = { date: DAY, closed: false, hours: { from: '08:00', to: '17:00' }, lunch: { from: '12:00', to: '12:30' } };
    const cat: PlannerCategory = { ...zaklad, slotMinutes: 30 };
    const ctx = makeContext({ categories: [cat], demands: [{ categoryId: 'z', requested: 40, baselinePlanned: 0 }], sessions: [], today: '2026-10-21', dayMarks: { [DAY]: mark } });
    const added = addPlannedInterval(ctx, { date: DAY, categoryId: 'z', start: '11:00', quantity: 4 });
    expect(added.ok).toBe(true);
    /* 11:00-12:00 = 2 slots before the break, 12:30-13:30 = 2 after it: two terms, 4 slots, none of them inside the break */
    expect(added.sessions.map((s) => [s.start, s.end, s.capacity])).toEqual([['11:00', '12:00', 2], ['12:30', '13:30', 2]]);
    const rows = groupByActivity({ categories: [cat] }, added.sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slots: 4, terms: 2, count: 2, minutes: 120, start: '11:00', end: '13:30' });
  });

  it('bookings and a window of one činnost add up in one row', () => {
    const rows = groupByActivity({ categories }, [booking('b1', 'k', '09:00', '10:00'), booking('b2', 'k', '10:00', '11:00'), window_('w', 'k', '13:00', '16:00', 3)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slots: 5, count: 3, terms: 3, people: 2 });
  });
});

describe('rows and entries', () => {
  it('per-day grouping keeps the days apart and in date order', () => {
    const other = { ...booking('b3', 'k', '09:00', '10:00'), date: '2026-12-08' };
    const rows = groupByActivity({ categories }, [other, booking('b1', 'k', '09:00', '10:00'), booking('b2', 'k', '10:00', '11:00')], { perDay: true });
    expect(rows.map((r) => [r.date, r.count])).toEqual([[DAY, 2], ['2026-12-08', 1]]);
  });

  it('an unknown činnost still gets a row (neutral), after the known ones; a window with no činnost has none', () => {
    const rows = groupByActivity({ categories }, [booking('x', 'zzz', '09:00', '10:00'), booking('z1', 'z', '08:00', '08:40'), window_('n', '', '08:00', '09:00', 4)]);
    expect(rows.map((r) => r.categoryId)).toEqual(['z', 'zzz']);
  });

  it('entries are in time order and carry the source', () => {
    const rows = groupByActivity({ categories }, [window_('w2', 'z', '13:00', '15:00', 3, 'public'), booking('b1', 'z', '08:00', '08:40'), window_('w1', 'z', '09:00', '12:00', 4, 'club')]);
    expect(rows[0]!.entries.map((e) => [e.start, e.kind])).toEqual([['08:00', 'booking'], ['09:00', 'club'], ['13:00', 'term']]);
  });

  it('a day with no terms has no rows and zero totals', () => {
    expect(summariseDay({ categories }, [], DAY)).toEqual({ date: DAY, groups: [], count: 0, slots: 0, minutes: 0 });
  });
});

describe('the mini calendar flyout of a day (dayTooltipModel.groups)', () => {
  it('one group per činnost: 12 bookings are one row with the people behind it; the prototype list (events) is untouched', async () => {
    const { dayTooltipModel } = await import('./index');
    const sessions = [
      ...Array.from({ length: 12 }, (_, i) => booking(`k${i}`, 'k', hhmm(480 + i * 40), hhmm(540 + i * 40), { names: [`Pacient ${i + 1}`] })),
      booking('z1', 'z', '08:00', '08:40'),
    ];
    const ctx = makeContext({ categories, sessions, today: '2026-10-21' });
    const m = dayTooltipModel(ctx, DAY, false)!;
    expect(m.groups.map((g) => [g.name, g.countMark, g.slotsLabel])).toEqual([['Základní prohlídka', '', '1 slot'], ['Komplexní prohlídka', '×12', '12 slotů']]);
    const k = m.groups.find((g) => g.categoryId === 'k')!;
    expect(k.entries).toHaveLength(12);
    expect(k.entries[0]).toMatchObject({ kind: 'booking', source: 'Objednávka', names: ['Pacient 1'] });
    expect(k.timeLabel).toBe('08:00–16:20');
    /* the per-term list the prototype draws is still there */
    expect(m.events).toHaveLength(13);
  });
});
