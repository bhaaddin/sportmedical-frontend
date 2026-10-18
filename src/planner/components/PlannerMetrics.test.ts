import { describe, expect, it } from 'vitest';
import { demoBaseline, demoCategories, demoDemands, demoSessions } from '../data/demoFixtures';
import {
  carouselModel,
  clampCarouselIndex,
  makeContext,
  moveOverlay,
  placementOverlay,
  pointerCoords,
  resizeOverlay,
  selectionFromPointer,
  weekEventsModel,
  weekHeadModel,
  beginPlacement,
  TIMELINE_HEIGHT,
  type PlannerContext,
} from '../model';
import { boardGeometry, cardBox, hourLabels, minuteAtY, yOfMinute } from './board/boardGeometry';
import {
  DECK_CARD_GAP,
  DECK_CARD_WIDTH,
  DESIGN_BOARD,
  DESIGN_STAGE,
  boardMetricsOf,
  deckVisibleCount,
  fitStage,
} from './PlannerMetrics';
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from './PlannerStage';

describe('fitStage: the stage grows into the room, in both directions', () => {
  it('is exactly the file at the file\'s aspect ratio, at any size', () => {
    expect(fitStage(1672, 941)).toEqual({ scale: 1, width: 1672, height: 941 });
    const half = fitStage(836, 470.5);
    expect(half.scale).toBe(0.5);
    expect(half.width).toBeCloseTo(1672, 9);
    expect(half.height).toBeCloseTo(941, 9);
    const big = fitStage(3344, 1882);
    expect(big.scale).toBe(2);
    expect(big.width).toBeCloseTo(1672, 9);
    expect(big.height).toBeCloseTo(941, 9);
  });

  it('a wide room widens the stage (height is the limit), a tall room heightens it (width is the limit)', () => {
    const wide = fitStage(2000, 941); // 2000 x ~1000 screens
    expect(wide.scale).toBe(1);
    expect(wide.width).toBe(2000);
    expect(wide.height).toBe(941);
    const tall = fitStage(1672, 1204);
    expect(tall.scale).toBe(1);
    expect(tall.width).toBe(1672);
    expect(tall.height).toBe(1204);
    const ultra = fitStage(2532, 1012);
    expect(ultra.scale).toBeCloseTo(1012 / 941, 9);
    expect(ultra.height).toBeCloseTo(941, 9);
    expect(ultra.width).toBeCloseTo(2532 / (1012 / 941), 9);
  });

  it('the stage times the scale is the room: nothing is left over, and the logical size is never below the file\'s', () => {
    for (const [w, h] of [[1252, 652], [1412, 832], [1892, 1012], [1972, 932], [2532, 1012], [2532, 1372], [1572, 1132], [1280, 400], [900, 1400]]) {
      const f = fitStage(w, h);
      expect(f.width * f.scale).toBeCloseTo(w, 6);
      expect(f.height * f.scale).toBeCloseTo(h, 6);
      expect(f.width).toBeGreaterThanOrEqual(STAGE_WIDTH - 1e-9);
      expect(f.height).toBeGreaterThanOrEqual(STAGE_HEIGHT - 1e-9);
      expect(Math.min(f.width / STAGE_WIDTH, f.height / STAGE_HEIGHT)).toBeCloseTo(1, 9);
    }
  });

  it('falls back to the file\'s stage for a room without size (jsdom, hidden) and keeps `fitScale`', () => {
    expect(fitStage(0, 0)).toEqual(DESIGN_STAGE);
    expect(fitStage(-1, 500)).toEqual(DESIGN_STAGE);
    expect(fitScale(1672, 941)).toBe(1);
    expect(fitScale(836, 941)).toBe(0.5);
    expect(fitScale(1672, 470.5)).toBe(0.5);
    expect(fitScale(3344, 941)).toBe(1);
    expect(fitScale(0, 0)).toBe(1);
  });
});

describe('board metrics', () => {
  it('the file\'s board: 1152 x 455 = 58 px hours + seven 156.29 px days', () => {
    expect(DESIGN_BOARD.width).toBe(1094);
    expect(DESIGN_BOARD.dayWidth).toBeCloseTo(1094 / 7, 9);
    expect(DESIGN_BOARD.height).toBe(455);
    expect(DESIGN_BOARD.measured).toBe(false);
  });

  it('a measured body: days share what the hour column leaves, hours share the height', () => {
    const m = boardMetricsOf(1471, 620, 58);
    expect(m.width).toBe(1413);
    expect(m.dayWidth).toBeCloseTo(1413 / 7, 9);
    expect(m.height).toBe(620);
    expect(m.measured).toBe(true);
    expect(boardMetricsOf(1152, 455).width).toBe(1094);
  });
});

describe('deckVisibleCount: as many činnost cards as fit', () => {
  it('shows the file\'s two cards in the file\'s deck and never fewer', () => {
    // viewport 652.4 minus its 2 x 12 px padding
    expect(deckVisibleCount(652.4 - 24)).toBe(2);
    expect(deckVisibleCount(0)).toBe(2);
    expect(deckVisibleCount(300)).toBe(2);
    expect(deckVisibleCount(2 * DECK_CARD_WIDTH + DECK_CARD_GAP)).toBe(2);
  });

  it('adds cards when the deck is wider and is monotonic', () => {
    const at = (cards: number) => cards * DECK_CARD_WIDTH + (cards - 1) * DECK_CARD_GAP;
    expect(deckVisibleCount(at(3))).toBe(3);
    expect(deckVisibleCount(at(4))).toBe(4);
    expect(deckVisibleCount(at(5))).toBe(5);
    let last = 0;
    for (let w = 400; w < 2400; w += 25) {
      const n = deckVisibleCount(w);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    // the card keeps about the file's width: within 20 % of 309.7 px
    for (let w = 628; w < 2400; w += 31) {
      const n = deckVisibleCount(w);
      const card = (w - (n - 1) * DECK_CARD_GAP) / n;
      expect(card).toBeGreaterThan(DECK_CARD_WIDTH * 0.8);
      expect(card).toBeLessThan(DECK_CARD_WIDTH * 1.25);
    }
  });

  it('the carousel model follows the visible count (2 = the prototype\'s answers)', () => {
    expect(carouselModel(6, 0)).toEqual(carouselModel(6, 0, 2));
    expect(carouselModel(6, 0, 2).pageLabel).toBe('1–2 / 6');
    const three = carouselModel(6, 0, 3);
    expect(three.pageLabel).toBe('1–3 / 6');
    expect(three.rightLimit).toBe(3);
    expect(three.dots).toEqual([true, true, true, false, false, false]);
    expect(carouselModel(6, 9, 3).index).toBe(3);
    // everything in view: nothing to page
    const all = carouselModel(4, 2, 4);
    expect(all.showCarousel).toBe(false);
    expect(all.prevDisabled && all.nextDisabled).toBe(true);
    expect(all.pageLabel).toBe('1–4 / 4');
    expect(clampCarouselIndex(6, 9)).toBe(4);
    expect(clampCarouselIndex(6, 9, 3)).toBe(3);
    expect(clampCarouselIndex(3, 5, 3)).toBe(0);
  });
});

/* ------------------------------ the maths of the board at a measured size ------------------------------ */

const ctx: PlannerContext = makeContext({
  categories: demoCategories, demands: demoDemands, baselineSessions: demoBaseline, sessions: demoSessions, today: '2026-11-10',
});

describe('the week model at a measured timeline height (the default is the file\'s 455 px)', () => {
  it('weekHeadModel / weekEventsModel: the default argument is the file, a height scales every pixel', () => {
    expect(weekHeadModel('2026-11-16', ctx.window)).toEqual(weekHeadModel('2026-11-16', ctx.window, TIMELINE_HEIGHT));
    const file = weekEventsModel(ctx, '2026-11-16', 'all');
    const tall = weekEventsModel(ctx, '2026-11-16', 'all', 620);
    expect(tall.length).toBe(file.length);
    expect(file.length).toBeGreaterThan(3);
    for (let i = 0; i < file.length; i++) {
      const a = file[i]!;
      const b = tall[i]!;
      expect(b.top).toBeCloseTo((a.top * 620) / TIMELINE_HEIGHT, 6);
      if (a.height > 25) expect(b.height).toBeCloseTo((a.height * 620) / TIMELINE_HEIGHT, 6);
      expect(b.left).toBe(a.left); // the day column is a percentage: the width does not matter here
    }
    const hours = weekHeadModel('2026-11-16', ctx.window, 620).hours;
    expect(hours[1]!.top).toBeCloseTo(620 / 12 + 11, 9);
    expect(hours).toHaveLength(12);
  });

  it('the board geometry takes the measured height as its base: 12 hours = the body, rows grow, zoom still multiplies', () => {
    const win = { startMinutes: 420, endMinutes: 1140 };
    const g = boardGeometry(win, 1, 620);
    expect(g.height).toBeCloseTo(620, 9);
    expect(g.pxPerHour).toBeCloseTo(620 / 12, 9);
    expect(yOfMinute(g, 600)).toBeCloseTo((180 / 720) * 620, 9);
    expect(minuteAtY(g, (180 / 720) * 620)).toBeCloseTo(600, 9);
    expect(hourLabels(g)[2]!.top).toBeCloseTo((120 / 720) * 620 + 11, 9);
    expect(cardBox(g, 480, 600).height).toBeCloseTo((120 / 720) * 620, 9);
    expect(boardGeometry(win, 1.5, 620).height).toBeCloseTo(620 * (65 / 52), 9);
    // the default is still the file's 455
    expect(boardGeometry(win, 1).height).toBe(455);
  });
});

describe('pointer to day and minute on a board of any measured size', () => {
  const winMinutes = 720;
  const rectOf = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
  const place = (rect: ReturnType<typeof rectOf>, day: number, minute: number) => ({
    x: rect.left + ((day + 0.5) / 7) * rect.width,
    y: rect.top + ((minute - 420) / winMinutes) * rect.height,
  });

  for (const rect of [rectOf(0, 0, 1094, 455), rectOf(60, 30, 1500, 620), rectOf(101.5, 55.25, 1413.3, 663.4), rectOf(10, 10, 700, 1204 - 267 - 219)]) {
    it(`board ${rect.width} x ${rect.height} at (${rect.left}, ${rect.top}): every day and a 5-minute grid are hit`, () => {
      for (const day of [0, 3, 6]) {
        for (const minute of [420, 545, 600, 735, 1000, 1130]) {
          const { x, y } = place(rect, day, minute);
          const point = pointerCoords(rect, x, y);
          const start = beginPlacement(ctx, ctx.categories[0]!.id, point);
          if (start.kind !== 'start') throw new Error('no start');
          expect(start.drag.day).toBe(day);
          const slot = ctx.categories[0]!.slotMinutes;
          const expected = Math.min(1140 - slot, Math.round(minute / 5) * 5);
          expect(Math.abs(start.drag.startMinutes - expected)).toBeLessThanOrEqual(0.0001);
        }
      }
    });
  }

  it('selectionFromPointer: the interval depends on fractions only - the same pointer on two sizes is the same interval', () => {
    const small = rectOf(0, 0, 1094, 455);
    const large = rectOf(40, 25, 1900, 700);
    const id = ctx.categories[0]!.id;
    const results = [small, large].map((rect) => {
      const a = place(rect, 2, 600);
      const b = place(rect, 2, 690);
      const start = beginPlacement(ctx, id, pointerCoords(rect, a.x, a.y));
      if (start.kind !== 'start') throw new Error('no start');
      const preview = selectionFromPointer(ctx, start.drag, id, '2026-11-16', pointerCoords(rect, b.x, b.y));
      return preview ? [preview.date, preview.start, preview.end, preview.quantity] : null;
    });
    expect(results[0]).not.toBeNull();
    expect(results[1]).toEqual(results[0]);
  });
});

describe('overlays at a measured timeline height', () => {
  const preview = (() => {
    const id = ctx.categories[0]!.id;
    const start = beginPlacement(ctx, id, { x: 0.5, y: 0.25 });
    if (start.kind !== 'start') throw new Error('no start');
    const p = selectionFromPointer(ctx, start.drag, id, '2026-11-16', { x: 0.5, y: 0.5 });
    if (!p) throw new Error('no preview');
    return p;
  })();

  it('the default is the file; a measured height moves the preview and keeps the HUD inside the board', () => {
    const file = placementOverlay(ctx, preview, 1094);
    expect(placementOverlay(ctx, preview, 1094, TIMELINE_HEIGHT)).toEqual(file);
    const tall = placementOverlay(ctx, preview, 1500, 620);
    expect(tall.preview.top).toBeCloseTo((file.preview.top * 620) / TIMELINE_HEIGHT, 6);
    expect(tall.preview.height).toBeCloseTo((file.preview.height * 620) / TIMELINE_HEIGHT, 6);
    expect(tall.hud.top).toBeLessThanOrEqual(620 - 141);
    expect(tall.hud.left).toBeLessThanOrEqual(1500 - 254);
    expect(tall.hud.left).toBeCloseTo(Math.min(1500 - 254, Math.max(7, ((preview.col + 0.5) * 1500) / 7 + 18)), 6);
  });

  it('move and edge-pull overlays take the same height', () => {
    const session = ctx.sessions.find((s) => s.origin !== 'public' && s.date >= '2026-11-16' && s.date <= '2026-11-22') ?? ctx.sessions[0]!;
    const col = Math.max(0, Math.min(6, Math.round((Date.parse(session.date) - Date.parse('2026-11-16')) / 86400000)));
    const move = {
      kind: 'move', eventId: session.id, date: session.date, start: session.start, end: session.end, col,
      startMinutes: Number(session.start.slice(0, 2)) * 60 + Number(session.start.slice(3)), endMinutes: Number(session.end.slice(0, 2)) * 60 + Number(session.end.slice(3)),
      validation: { ok: true, reason: '' },
    } as unknown as Parameters<typeof moveOverlay>[1];
    const a = moveOverlay(ctx, move, 1094);
    const b = moveOverlay(ctx, move, 1500, 620);
    expect(a).not.toBeNull();
    expect(b!.ghost.top).toBeCloseTo((a!.ghost.top * 620) / TIMELINE_HEIGHT, 6);
    expect(moveOverlay(ctx, move, 1094, TIMELINE_HEIGHT)).toEqual(a);

    const resize = {
      kind: 'resize', eventId: session.id, date: session.date, categoryId: session.categoryId, edge: 'bottom', added: 1, capacity: session.capacity + 1,
      start: session.start, end: session.end, startMinutes: move.startMinutes, endMinutes: move.endMinutes + 30, col, validation: { ok: true, reason: '' },
    } as unknown as Parameters<typeof resizeOverlay>[1];
    const ra = resizeOverlay(ctx, resize, 1094, 455);
    const rb = resizeOverlay(ctx, resize, 1500, 620, 620);
    expect(ra).not.toBeNull();
    expect(rb!.range.top).toBeCloseTo((ra!.range.top * 620) / TIMELINE_HEIGHT, 6);
    expect(resizeOverlay(ctx, resize, 1094, 455, TIMELINE_HEIGHT)).toEqual(ra);
  });
});

