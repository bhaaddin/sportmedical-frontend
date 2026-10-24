import { describe, expect, it } from 'vitest';
import { busyIntervals, withPastTime } from '../../components/booking/calendar/pickLogic';
import { firstGapQuestion, leadGap, nextGapQuestion, tailGap, withHHMM } from './gaps';

const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const span = (a: string, b: string) => ({ start: m(a), end: m(b) });
const ROW = { isOpen: true, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00' };
/* December is CET: 09:00 Prague = 08:00Z */
const appt = (day: string, from: string, to: string) => ({ startUtc: `${day}T${String(Number(from.slice(0, 2)) - 1).padStart(2, '0')}${from.slice(2)}:00Z`, endUtc: `${day}T${String(Number(to.slice(0, 2)) - 1).padStart(2, '0')}${to.slice(2)}:00Z`, status: 0 });
const DAY = '2026-12-09';
const busyOf = (appointments: ReturnType<typeof appt>[], blocks: { startUtc: string; endUtc: string }[] = [], row = ROW) =>
  busyIntervals({ dayKey: DAY, row, appointments, blocks, picks: [] });

describe('leadGap (R23)', () => {
  const first = [appt(DAY, '09:00', '10:30')];
  const busy = busyOf(first);

  it('the owner\'s case: a click at 10:40 after a term ending 10:30 asks, and the moved place starts at 10:30', () => {
    const q = leadGap(busy, span('10:40', '11:10'), 30)!;
    expect(q.kind).toBe('lead');
    expect(q.gap).toBe(10);
    expect(q.moved).toEqual(span('10:30', '11:00'));
    expect(q.asClicked).toEqual(span('10:40', '11:10'));
    expect(withHHMM(q.moved.start)).toBe('10:30');
  });
  it('no hole (gap 0) asks nothing', () => expect(leadGap(busy, span('10:30', '11:00'), 30)).toBeNull());
  it('gap 5 and gap 25 ask; the length is kept', () => {
    expect(leadGap(busy, span('10:35', '11:20'), 30)).toMatchObject({ gap: 5, moved: span('10:30', '11:15') });
    expect(leadGap(busy, span('10:55', '11:25'), 30)).toMatchObject({ gap: 25, moved: span('10:30', '11:00') });
  });
  it('a gap equal to the slot (or longer) is a real pause: nothing to ask', () => {
    expect(leadGap(busy, span('11:00', '11:30'), 30)).toBeNull();
    expect(leadGap(busy, span('11:10', '11:40'), 30)).toBeNull();
  });
  it('nothing before the click (no previous booking, no opening time known) asks nothing', () => {
    expect(leadGap([], span('10:40', '11:10'), 30)).toBeNull();
    expect(leadGap(busyOf([], [], { ...ROW, startTime: '10:00:00' }), span('10:00', '10:30'), 30)).toBeNull();
  });
  it('the opening time is "the previous": a click 10 minutes after the doors open asks', () => {
    expect(leadGap(busyOf([]), span('08:10', '08:40'), 30)).toMatchObject({ gap: 10, moved: span('08:00', '08:30') });
  });
  it('the previous is the lunch: the moved place starts right after it', () => {
    const q = leadGap(busyOf([]), span('12:40', '13:10'), 30)!;
    expect(q.gap).toBe(10);
    expect(q.moved).toEqual(span('12:30', '13:00'));
  });
  it('the previous is a club block (a hold): same rule', () => {
    const blocks = [{ startUtc: `${DAY}T10:00:00Z`, endUtc: `${DAY}T10:15:00Z` }]; /* 11:00-11:15 Prague */
    const q = leadGap(busyOf([], blocks), span('11:25', '11:55'), 30)!;
    expect(q.moved).toEqual(span('11:15', '11:45'));
  });
  it('the moved place must itself be free: not into the next booking, not over the lunch', () => {
    /* 10:30 + 60 min would run into the booking at 11:15 */
    const tight = busyOf([appt(DAY, '09:00', '10:30'), appt(DAY, '11:15', '12:00')]);
    expect(leadGap(tight, span('10:40', '11:40'), 30)).toBeNull();
    /* a lunch that does not move: starts 12:00 - a 60 min booking from 11:20 (after a 11:10 end) would run into it */
    const nearLunch = busyOf([appt(DAY, '10:00', '11:10')]);
    expect(leadGap(nearLunch, span('11:20', '12:20'), 30)).toBeNull();
  });
  it('time already gone today counts as busy: the moved place starts at "now", never in the past', () => {
    const busy = withPastTime(busyOf([appt(DAY, '09:00', '10:30')]), m('10:35'));
    expect(leadGap(busy, span('10:40', '11:10'), 30)).toMatchObject({ gap: 5, moved: span('10:35', '11:05') });
    /* and a click right at "now" leaves no hole */
    expect(leadGap(busy, span('10:35', '11:05'), 30)).toBeNull();
  });
  it('across midnight: a term that ran past midnight leaves its clipped end as the previous', () => {
    /* yesterday 23:50 -> today 00:20 (Prague): the part on this day is 00:00-00:20 */
    const busy = busyIntervals({
      dayKey: DAY,
      row: { isOpen: true, startTime: '00:00:00', endTime: '23:59:00', breakStart: null, breakEnd: null },
      appointments: [{ startUtc: '2026-12-08T22:50:00Z', endUtc: '2026-12-08T23:20:00Z', status: 0 }],
      blocks: [],
      picks: [],
    });
    expect(leadGap(busy, span('00:30', '01:00'), 30)).toMatchObject({ gap: 10, moved: span('00:20', '00:50') });
  });
});

describe('tailGap (R23)', () => {
  const busy = busyOf([appt(DAY, '11:00', '12:00')]);
  it('a booking that ends 10 minutes before the next one can be moved to its end', () => {
    const q = tailGap(busy, span('09:30', '10:50'), 30)!;
    expect(q.kind).toBe('tail');
    expect(q.gap).toBe(10);
    expect(q.moved).toEqual(span('09:40', '11:00'));
  });
  it('no hole, a real pause, or nothing after asks nothing', () => {
    expect(tailGap(busy, span('09:30', '11:00'), 30)).toBeNull();
    expect(tailGap(busy, span('09:00', '10:30'), 30)).toBeNull();
    expect(tailGap(busyOf([], [], { ...ROW, endTime: '23:59:00' }), span('09:00', '09:30'), 30)).toBeNull();
  });
  it('the closing time counts as "the next": a booking 10 minutes short of closing can be moved to it', () => {
    expect(tailGap(busyOf([]), span('15:20', '15:50'), 30)).toMatchObject({ gap: 10, moved: span('15:30', '16:00') });
  });
});

describe('the sequence of questions', () => {
  it('lead first, then the tail of the place that was chosen', () => {
    const busy = busyOf([appt(DAY, '09:00', '10:30'), appt(DAY, '11:50', '13:00')]);
    const range = span('10:40', '11:20');
    const first = firstGapQuestion(busy, range, 30, 30)!;
    expect(first.kind).toBe('lead');
    /* took the neighbour's side: 10:30-11:10, the next term starts 11:50 -> 40 min, a real pause */
    expect(nextGapQuestion(busy, 'lead', first.moved, 30)).toBeNull();
    /* kept the click: 10:40-11:20 leaves 30 -> not a hole either; a longer hole question needs a smaller gap */
    expect(nextGapQuestion(busy, 'lead', first.asClicked, 30)).toBeNull();
    const busy2 = busyOf([appt(DAY, '09:00', '10:30'), appt(DAY, '11:30', '13:00')]);
    const second = nextGapQuestion(busy2, 'lead', span('10:40', '11:20'), 30)!;
    expect(second).toMatchObject({ kind: 'tail', gap: 10, moved: span('10:50', '11:30') });
  });
  it('the tail alone, when there is no lead hole', () => {
    const busy = busyOf([appt(DAY, '11:00', '12:00')]);
    expect(firstGapQuestion(busy, span('10:00', '10:50'), 30, 30)?.kind).toBe('tail');
  });
  it('an answer to a tail question ends the questions', () => {
    expect(nextGapQuestion([], 'tail', span('09:00', '09:30'), 30)).toBeNull();
  });
});
