import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import {
  columnStep,
  ghostLabel,
  glideFrom,
  moveRefusal,
  movedNoticeText,
  rememberNotify,
  rememberedNotify,
  samePlace,
  settle,
  snapMove,
} from './moveDrag';

/*
 * The arithmetic of dragging a card: where it snaps, when a slot refuses it,
 * and the motion rules (none under prefers-reduced-motion).
 */

const DAY = '2026-10-26';
const PX = 52 / 60;

const appt = (id: string, startUtc: string, endUtc: string, status = 0): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId: 'a1',
  activityName: 'Prohlídka',
  startUtc,
  endUtc,
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  partnerName: null,
  clubDiscountPercent: null,
  paymentState: 'none',
  invoiceId: null,
});

const row: PreviewDay = {
  date: DAY,
  isOpen: true,
  closedBecause: null,
  startTime: '08:00:00',
  endTime: '16:00:00',
  breakStart: '12:00:00',
  breakEnd: '12:30:00',
  workerUserId: 'u1',
  workerDisplayName: 'Anna',
  isChangedByOverride: false,
  offeredActivityIds: ['a1'],
};

const card = appt('m1', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z'); // 08:00–08:30 Prague

const base = {
  appointment: card,
  dayKey: DAY,
  sameColumn: true,
  open: true,
  row,
  blocks: [] as TimeBlock[],
  others: [card],
  capacity: 1,
};

describe('snapMove', () => {
  const grid = { grabMinutes: 10, length: 30, pxPerMinute: PX, topMinute: 7 * 60, bottomMinute: 19 * 60 };
  const pointerAt = (minute: number) => (minute - 7 * 60) * PX;

  it.each([
    [30, 10 * 60 + 20, 10 * 60 + 30],
    [15, 10 * 60 + 20, 10 * 60 + 15],
    [10, 10 * 60 + 20, 10 * 60 + 20],
  ])('at a %i-minute step a pointer at %i (held 10 min down the card) lands the start on %i', (step, pointerMinute, start) => {
    expect(snapMove({ ...grid, step, pointerOffsetPx: pointerAt(pointerMinute + 10) })).toEqual({ start, end: start + 30 });
  });

  it('keeps the whole card on the grid', () => {
    expect(snapMove({ ...grid, step: 30, pointerOffsetPx: -500 })).toEqual({ start: 7 * 60, end: 7 * 60 + 30 });
    expect(snapMove({ ...grid, step: 30, pointerOffsetPx: 10_000 })).toEqual({ start: 19 * 60 - 30, end: 19 * 60 });
  });
});

describe('columnStep', () => {
  it('is the calendar step, or the finer grid when the grid is zoomed below it', () => {
    expect(columnStep({ displayStepMinutes: 30 }, 30)).toBe(30);
    expect(columnStep({ displayStepMinutes: 30 }, 15)).toBe(15);
    expect(columnStep({ displayStepMinutes: 15 }, 30)).toBe(15);
    expect(columnStep({ displayStepMinutes: 0 }, 0)).toBe(30);
  });
});

describe('moveRefusal', () => {
  it('a free slot inside the hours takes the card', () => {
    expect(moveRefusal({ ...base, range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBeNull();
  });

  it('another calendar or činnost does not', () => {
    expect(moveRefusal({ ...base, sameColumn: false, range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBe('calendar');
  });

  it('a shut column does not', () => {
    expect(moveRefusal({ ...base, open: false, range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBe('closed');
  });

  it('outside the working hours and across the lunch band it is refused', () => {
    expect(moveRefusal({ ...base, range: { start: 7 * 60 + 30, end: 8 * 60 } })).toBe('hours');
    expect(moveRefusal({ ...base, range: { start: 15 * 60 + 45, end: 16 * 60 + 15 } })).toBe('hours');
    expect(moveRefusal({ ...base, range: { start: 11 * 60 + 45, end: 12 * 60 + 15 } })).toBe('hours');
  });

  it('a block or another live booking makes it busy; a cancelled one and the card itself do not count', () => {
    const block: TimeBlock = {
      id: 'b1',
      calendarId: 'c1',
      startUtc: '2026-10-26T09:00:00Z',
      endUtc: '2026-10-26T10:00:00Z',
      reason: 'Školení',
      kind: 'manual',
      clubBlockId: null,
      clubId: null,
      clubName: null,
      colorHex: null,
    } as TimeBlock;
    expect(moveRefusal({ ...base, blocks: [block], range: { start: 10 * 60 + 30, end: 11 * 60 } })).toBe('busy');
    const other = appt('m2', '2026-10-26T09:00:00Z', '2026-10-26T09:30:00Z');
    expect(moveRefusal({ ...base, others: [card, other], range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBe('busy');
    expect(moveRefusal({ ...base, others: [card, { ...other, status: 4 }], range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBeNull();
    expect(moveRefusal({ ...base, others: [card], range: { start: 8 * 60, end: 8 * 60 + 30 } })).toBeNull();
    /* Two stations: one other booking still leaves room. */
    expect(moveRefusal({ ...base, capacity: 2, others: [card, other], range: { start: 10 * 60, end: 10 * 60 + 30 } })).toBeNull();
  });

  it('without a preview row nothing is known about the hours, so the slot is taken on trust', () => {
    expect(moveRefusal({ ...base, row: undefined, range: { start: 6 * 60, end: 6 * 60 + 30 } })).toBeNull();
  });
});

describe('labels', () => {
  it('spells the ghost 10:30–11:00 and knows when nothing moved', () => {
    expect(ghostLabel({ start: 10 * 60 + 30, end: 11 * 60 })).toBe('10:30–11:00');
    expect(samePlace(card, DAY, { start: 8 * 60, end: 8 * 60 + 30 }, 'c1', 'c1')).toBe(true);
    expect(samePlace(card, DAY, { start: 8 * 60 + 30, end: 9 * 60 }, 'c1', 'c1')).toBe(false);
    expect(samePlace(card, '2026-10-27', { start: 8 * 60, end: 8 * 60 + 30 }, 'c1', 'c1')).toBe(false);
    expect(movedNoticeText(true)).toBe('Termín přesunut · pacientovi odesíláme oznámení');
    expect(movedNoticeText(false)).toBe('Termín přesunut · bez oznámení');
  });
});

describe('the notify checkbox is remembered for the session', () => {
  afterEach(() => window.sessionStorage.clear());

  it('defaults to on, keeps what the desk last chose', () => {
    expect(rememberedNotify()).toBe(true);
    rememberNotify(false);
    expect(rememberedNotify()).toBe(false);
    rememberNotify(true);
    expect(rememberedNotify()).toBe(true);
  });
});

describe('motion', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  const element = (left: number, top: number) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left, top, right: left + 100, bottom: top + 40, width: 100, height: 40, x: left, y: top, toJSON: () => ({}) });
    const animate = vi.fn();
    (el as unknown as { animate: typeof animate }).animate = animate;
    return { el, animate };
  };
  const rect = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 40, width: 100, height: 40, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  it('glides the card from where it was to where it is, by transform', () => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const { el, animate } = element(10, 300);
    glideFrom(el, rect(10, 100));
    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, options] = animate.mock.calls[0];
    expect(frames[0].transform).toBe('translate(0px, -200px)');
    expect(frames[1].transform).toBe('translate(0, 0)');
    expect(options.duration).toBe(280);
    settle(el);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('does not move at all when it is already there', () => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const { el, animate } = element(10, 100);
    glideFrom(el, rect(10, 100));
    expect(animate).not.toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion: the card just snaps', () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') })) as unknown as typeof window.matchMedia;
    const { el, animate } = element(10, 300);
    glideFrom(el, rect(10, 100));
    settle(el);
    expect(animate).not.toHaveBeenCalled();
  });
});
