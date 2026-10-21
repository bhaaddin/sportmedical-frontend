import { describe, expect, it } from 'vitest';
import type { TimeBlock } from '../../../api/bookingContracts';
import { weekHeadModel, type DayMark } from '../../model';
import type { InquiryRef } from '../../model/inquiries';
import type { BoardWindowModel, DayRowModel, MonthTileModel } from './boardModel';
import { clubLinesByDay, phoneEntries, phoneMonthRows, weekStripModel } from './phoneModel';

const row = (over: Partial<DayRowModel>): DayRowModel => ({
  key: 'booking:b1', kind: 'booking', id: 'b1', sortStart: 9 * 60, timeLabel: '09:00 – 09:30', name: 'Pacient b1', sub: 'Prohlídka', tail: 'Objednán', priceText: null, colour: '#00f1dc', categoryId: 'a1', slots: 1, ...over,
});
const win = (over: Partial<BoardWindowModel>): BoardWindowModel => ({
  key: 'window:c1:k1:2026-11-18', kind: 'club', col: 2, sub: 0, subs: 1, day: '2026-11-18', top: 0, height: 10, lane: 0, lanes: 1, left: '0', width: '1', label: 'FK Slaný',
  timeLabel: '08:00–16:00', start: 480, end: 960, colour: '#2E7D32', block: {} as TimeBlock, allBlocks: [], calendarId: 'c1', calendarName: 'Ordinace 1', clubDates: null, ...over,
});

describe('the phone day: bookings, terms, club windows and blocks in one list by start', () => {
  it('orders them by when they start and says what each is', () => {
    const entries = phoneEntries(
      [row({}), row({ key: 'session:s1', kind: 'session', id: 's1', sortStart: 14 * 60, timeLabel: '14:00 – 15:00', name: 'Kondiční diagnostika', sub: null, tail: '3/8' })],
      [
        win({}),
        win({ key: 'window:c1:m1:2026-11-18', kind: 'manual', label: 'Školení', start: 13 * 60, end: 14 * 60, timeLabel: '13:00–14:00' }),
        win({ key: 'window:c1:k9:2026-11-19', day: '2026-11-19' }), // another day
      ],
      '2026-11-18',
    );
    expect(entries.map((e) => [e.kind, e.timeLabel, e.title])).toEqual([
      ['club', '08:00–16:00', 'FK Slaný'],
      ['booking', '09:00 – 09:30', 'Pacient b1'],
      ['block', '13:00–14:00', 'Školení'],
      ['session', '14:00 – 15:00', 'Kondiční diagnostika'],
    ]);
    const [club, , block] = entries;
    expect(club!.colour).toBe('#2E7D32');
    expect(club!.window).not.toBeNull();
    expect(block).toMatchObject({ sub: 'Ordinace 1', colour: null });
  });

  it('an empty day has no entries', () => {
    expect(phoneEntries([], [], '2026-11-18')).toEqual([]);
  });
});

describe('the week strip', () => {
  const head = weekHeadModel('2026-11-16').days;
  const marks = { '2026-11-21': { date: '2026-11-21', closed: true, label: 'Sobota' } } as Record<string, DayMark>;
  const inquiries = new Map<string, InquiryRef[]>([['2026-11-18', [{ orderId: 'o1', clubName: 'Dukla', kind: 'requested', current: false }]]]);

  it('counts the rows and the club windows of each day, names the closed ones and the inquiries', () => {
    const strip = weekStripModel({
      days: head, selected: '2026-11-18', today: '2026-11-17', dayMarks: marks,
      rowCount: (d) => (d === '2026-11-18' ? 2 : 0),
      windows: [win({}), win({ key: 'window:c2:k1:2026-11-18', calendarId: 'c2' }), win({ key: 'window:m', kind: 'manual', label: 'Školení' })],
      inquiries,
    });
    expect(strip).toHaveLength(7);
    const wednesday = strip[2]!;
    expect(wednesday).toMatchObject({ date: '2026-11-18', weekName: 'St', dayNumber: 18, count: 4, selected: true, today: false, inquiries: 1 });
    expect(wednesday.clubs).toEqual([{ name: 'FK Slaný', colour: '#2E7D32' }]); // one dot per club
    expect(strip[1]).toMatchObject({ today: true, selected: false, count: 0, inquiries: 0 });
    expect(strip[5]).toMatchObject({ closed: true, flag: 'Sobota' });
  });
});

describe('the month list', () => {
  const tile = (date: string, over: Partial<MonthTileModel> = {}): MonthTileModel => ({
    date, dayNumber: Number(date.slice(8, 10)), otherMonth: false, count: 0, countLabel: null, flag: null, inquiries: [], blocked: false, clubs: [], activities: [], calendars: [], ...over,
  });

  it('is one row per day of the month, with the figures written out', () => {
    const rows = phoneMonthRows(
      [
        tile('2026-10-30', { otherMonth: true }),
        tile('2026-11-02', { count: 3, countLabel: '3 termíny' }),
        tile('2026-11-17', { flag: 'Státní svátek', blocked: true }),
        tile('2026-11-18', { inquiries: [{ orderId: 'o1', clubName: 'Dukla', kind: 'requested', current: false }] }),
      ],
      new Map([['2026-11-02', ['FK Slaný · 08:00–16:00']]]),
      '2026-11-17',
    );
    expect(rows.map((r) => [r.date, r.weekName, r.dayNumber])).toEqual([['2026-11-02', 'Po', 2], ['2026-11-17', 'Út', 17], ['2026-11-18', 'St', 18]]);
    expect(rows[0]).toMatchObject({ countLabel: '3 termíny', clubs: ['FK Slaný · 08:00–16:00'], today: false });
    expect(rows[1]).toMatchObject({ today: true, flag: 'Státní svátek', blocked: true });
    expect(rows[2]!.inquiry).toBe('Poptávka · Dukla');
  });
});

describe('club lines of a day', () => {
  const LUNCH = () => ({ start: 12 * 60, end: 12 * 60 + 30 });
  const piece = (id: string, startUtc: string, endUtc: string, clubBlockId = 'cb1'): TimeBlock => ({ id, startUtc, endUtc, reason: '', kind: 'club', clubBlockId, clubName: 'FK Slaný' });
  it('one line per club window, one across the lunch break, the same window of two calendars once, manual blocks never', () => {
    const blocks = new Map<string, TimeBlock[]>([
      ['c1', [piece('k1', '2026-11-18T07:00:00Z', '2026-11-18T11:00:00Z'), piece('k2', '2026-11-18T11:30:00Z', '2026-11-18T15:00:00Z'), { id: 'm1', startUtc: '2026-11-18T08:00:00Z', endUtc: '2026-11-18T09:00:00Z', reason: 'Školení', kind: 'manual' }]],
      ['c2', [piece('k3', '2026-11-18T07:00:00Z', '2026-11-18T15:00:00Z')]],
    ]);
    const lines = clubLinesByDay(['2026-11-18', '2026-11-19'], ['c1', 'c2'], blocks, LUNCH);
    expect(lines.get('2026-11-18')).toEqual(['FK Slaný · 08:00–16:00']);
    expect(lines.has('2026-11-19')).toBe(false);
  });

  it('leaves out the club windows the draft of an order being planned already draws', () => {
    const blocks = new Map<string, TimeBlock[]>([['c1', [piece('k1', '2026-11-18T07:00:00Z', '2026-11-18T11:00:00Z')]]]);
    expect(clubLinesByDay(['2026-11-18'], ['c1'], blocks, LUNCH, new Set(['cb1'])).size).toBe(0);
  });
});
