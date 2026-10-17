import { describe, expect, it } from 'vitest';
import { weekEventsModel, weekHeadModel, makeContext, DEFAULT_WINDOW, TIMELINE_HEIGHT, type PlannerSession } from '../../model';
import { demoCategories, demoDemands, demoSessions } from '../../data/demoFixtures';
import {
  boardGeometry,
  boardScaleFor,
  boxOfSpan,
  cardBox,
  cardLeftWidth,
  columnAtFraction,
  hourLabels,
  minuteAtY,
  selectionRange,
  stepLineHeight,
  yOfMinute,
} from './boardGeometry';

const ctx = makeContext({ categories: demoCategories, demands: demoDemands, sessions: demoSessions, today: '2026-11-10' });

describe('the board at the file\'s own zoom', () => {
  const g = boardGeometry(DEFAULT_WINDOW, 1);

  it('is 455 px for 07:00-19:00 and 37.92 px an hour, like the prototype', () => {
    expect(g.height).toBeCloseTo(TIMELINE_HEIGHT, 6);
    expect(g.pxPerHour).toBeCloseTo(TIMELINE_HEIGHT / 12, 6);
    expect(g.scale).toBe(1);
  });

  it('places every card exactly where weekEventsModel does', () => {
    const cards = weekEventsModel(ctx, '2026-11-16', 'all');
    expect(cards.length).toBeGreaterThan(5);
    const byId = new Map<string, PlannerSession>(demoSessions.map((s) => [s.id, s]));
    for (const card of cards) {
      const s = byId.get(card.id)!;
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      const box = cardBox(g, sh! * 60 + sm!, eh! * 60 + em!);
      expect(box.top).toBeCloseTo(card.top, 6);
      expect(box.height).toBeCloseTo(card.height, 6);
      expect(box.compact).toBe(card.compact);
    }
  });

  it('puts the hour labels where renderWeekHead does', () => {
    const labels = hourLabels(g);
    const head = weekHeadModel('2026-11-16');
    expect(labels.map((l) => l.label)).toEqual(head.hours.map((h) => h.label));
    labels.forEach((l, i) => expect(l.top).toBeCloseTo(head.hours[i]!.top, 6));
  });

  it('writes the prototype\'s exact left / width for one lane and shares the column for more', () => {
    expect(cardLeftWidth(3, 0, 1)).toEqual({ left: 'calc(3 * 100% / 7 + 3px)', width: 'calc(100% / 7 - 6px)' });
    expect(cardLeftWidth(3, 1, 2)).toEqual({ left: 'calc(3 * 100% / 7 + 1 * (100% / 7) / 2 + 3px)', width: 'calc((100% / 7) / 2 - 6px)' });
  });

  it('converts between minutes and pixels both ways', () => {
    expect(yOfMinute(g, 420)).toBe(0);
    expect(yOfMinute(g, 1140)).toBeCloseTo(455, 6);
    expect(minuteAtY(g, yOfMinute(g, 10 * 60 + 15))).toBeCloseTo(10 * 60 + 15, 6);
    expect(boxOfSpan(g, 0, 8 * 60).top).toBe(0);
    expect(boxOfSpan(g, 18 * 60, 24 * 60).height).toBeCloseTo((19 - 18) * g.pxPerHour, 6);
  });
});

describe('the resolution ("Rozlišení") levels', () => {
  it('keeps Hodina and 30 min at the file\'s size and grows the finer levels like the old grid', () => {
    expect(boardScaleFor(0.6)).toBe(1);
    expect(boardScaleFor(1)).toBe(1);
    expect(boardScaleFor(1.5)).toBeCloseTo(65 / 52, 6);
    expect(boardScaleFor(2)).toBeCloseTo(78 / 52, 6);
    expect(boardGeometry(DEFAULT_WINDOW, 2).height).toBeCloseTo(TIMELINE_HEIGHT * (78 / 52), 6);
  });

  it('draws finer step lines only for the 15 and 10 minute levels - the file has hour lines alone', () => {
    const g = boardGeometry(DEFAULT_WINDOW, 1.5);
    expect(stepLineHeight(g, 60)).toBeNull();
    expect(stepLineHeight(g, 30)).toBeNull();
    expect(stepLineHeight(g, 15)).toBeCloseTo(15 * g.pxPerMinute, 6);
  });
});

describe('marking free time', () => {
  const g = boardGeometry(DEFAULT_WINDOW, 1);
  it('snaps a drag to whole slots, either direction, at least one slot', () => {
    expect(selectionRange(g, 9 * 60 + 10, 9 * 60 + 10, 30)).toEqual({ start: 9 * 60, end: 9 * 60 + 30 });
    expect(selectionRange(g, 9 * 60 + 10, 10 * 60 + 40, 30)).toEqual({ start: 9 * 60, end: 11 * 60 });
    expect(selectionRange(g, 10 * 60 + 40, 9 * 60 + 10, 30)).toEqual({ start: 9 * 60, end: 11 * 60 });
  });
  it('stops at the edges of the board', () => {
    expect(selectionRange(g, 18 * 60 + 40, 23 * 60, 30)).toEqual({ start: 18 * 60 + 30, end: 19 * 60 });
    expect(selectionRange(g, 0, 30, 30)).toEqual({ start: 7 * 60, end: 7 * 60 + 30 });
  });
  it('maps a horizontal fraction to the seven day columns', () => {
    expect(columnAtFraction(0)).toBe(0);
    expect(columnAtFraction(0.5)).toBe(3);
    expect(columnAtFraction(1)).toBe(6);
    expect(columnAtFraction(-1)).toBe(0);
  });
});
