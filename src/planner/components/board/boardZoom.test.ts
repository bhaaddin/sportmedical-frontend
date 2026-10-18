import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOW, snapPointerMinute } from '../../model';
import { boardGeometry, minuteAtY, yOfMinute } from './boardGeometry';
import { createBoardSettings } from './boardSettings';
import {
  clampZoom,
  focusMinuteFor,
  formatZoom,
  lineStepFor,
  migrateLegacyZoom,
  minuteAtClientY,
  minuteAtViewportY,
  pinchDistance,
  placementSnapFor,
  presetOf,
  readStoredZoom,
  scrollTopFor,
  snapStepFor,
  stepPreset,
  stepZoom,
  wheelFactor,
  ZOOM_PRESETS,
} from './boardZoom';
import { selectionRange } from './boardGeometry';

const memoryStorage = (initial: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
};

describe('zoom: clamp, steps and presets', () => {
  it('clamps to 1-6 with two decimals and treats nonsense as the file\'s 1x', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.345)).toBe(2.35);
    expect(clampZoom(6)).toBe(6);
    expect(clampZoom(60)).toBe(6);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('draws lines every 60 / 30 / 15 / 10 minutes: half hour from 2x, quarter from 3.5x, ten minutes from 5x', () => {
    expect(lineStepFor(1)).toBe(60);
    expect(lineStepFor(1.99)).toBe(60);
    expect(lineStepFor(2)).toBe(30);
    expect(lineStepFor(3.49)).toBe(30);
    expect(lineStepFor(3.5)).toBe(15);
    expect(lineStepFor(4.99)).toBe(15);
    expect(lineStepFor(5)).toBe(10);
    expect(lineStepFor(6)).toBe(10);
    expect(lineStepFor(0)).toBe(60);
    expect(lineStepFor(99)).toBe(10);
  });

  it('snaps marking and moving to the visible line, never coarser than the file\'s 30 minutes', () => {
    expect([1, 1.5, 2, 3, 3.5, 4.5, 5, 6].map(snapStepFor)).toEqual([30, 30, 30, 30, 15, 15, 10, 10]);
  });

  it('snaps the club planning drag to 5 minutes at 1x (the file) and to the visible line from 2x', () => {
    expect([1, 1.9, 2, 3.5, 5, 6].map((z) => placementSnapFor(z))).toEqual([5, 5, 30, 15, 10, 10]);
  });

  it('maps the gear\'s presets to the zoom: Hodina 1x, 30 min 2x, 15 min 3.5x, 10 min 6x', () => {
    expect(ZOOM_PRESETS.map((p) => [p.label, p.zoom, p.step])).toEqual([
      ['Hodina', 1, 60],
      ['30 min', 2, 30],
      ['15 min', 3.5, 15],
      ['10 min', 6, 10],
    ]);
    expect(presetOf(1).key).toBe('hour');
    expect(presetOf(1.4).key).toBe('hour');
    expect(presetOf(2.5).key).toBe('half');
    expect(presetOf(3).key).toBe('quarter');
    expect(presetOf(5).key).toBe('ten');
    expect(stepPreset(1, 1).key).toBe('half');
    expect(stepPreset(6, 1).key).toBe('ten');
    expect(stepPreset(1, -1).key).toBe('hour');
    expect(stepPreset(3.5, -1).key).toBe('half');
  });

  it('steps along the ladder 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6 and stops at the ends', () => {
    let z = 1;
    const seen = [z];
    for (let i = 0; i < 12; i += 1) {
      z = stepZoom(z, 1);
      seen.push(z);
    }
    expect(seen.slice(0, 10)).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 6]);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(6, -1)).toBe(5);
    expect(stepZoom(2.2, 1)).toBe(2.5);
    expect(stepZoom(2.2, -1)).toBe(2);
  });

  it('writes the zoom for the control in Czech: 2×, 1,5×', () => {
    expect(formatZoom(1)).toBe('1×');
    expect(formatZoom(2)).toBe('2×');
    expect(formatZoom(1.5)).toBe('1,5×');
    expect(formatZoom(3.5)).toBe('3,5×');
    expect(formatZoom(80)).toBe('6×');
  });

  it('a wheel notch is a clear step, a trackpad pinch finer, up zooms in and down zooms out', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1.2);
    expect(wheelFactor(100)).toBeLessThan(0.85);
    expect(wheelFactor(-4)).toBeGreaterThan(1);
    expect(wheelFactor(-4)).toBeLessThan(1.1);
    expect(wheelFactor(0)).toBe(1);
    // a line-mode wheel (Firefox) counts 16 px a line
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48), 9);
  });

  it('measures a pinch', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('the saved zoom: the new key, the migration of the old one', () => {
  it('moves the old levels to the nearest preset: 0.6 -> 1, 1 -> 2, 1.5 -> 3.5, 2 -> 6', () => {
    expect(migrateLegacyZoom(0.6)).toBe(1);
    expect(migrateLegacyZoom(1)).toBe(2);
    expect(migrateLegacyZoom(1.5)).toBe(3.5);
    expect(migrateLegacyZoom(2)).toBe(6);
    expect(migrateLegacyZoom(1.4)).toBe(3.5);
    expect(migrateLegacyZoom(1.8)).toBe(6);
    expect(migrateLegacyZoom(0.7)).toBe(1);
    expect(migrateLegacyZoom(Number.NaN)).toBe(1);
  });

  it('reads calendarZoomV2 first; falls back to a migrated calendarZoom; else 1x', () => {
    expect(readStoredZoom(memoryStorage())).toEqual({ zoom: 1, migrated: false });
    expect(readStoredZoom(memoryStorage({ calendarZoomV2: '4' }))).toEqual({ zoom: 4, migrated: false });
    expect(readStoredZoom(memoryStorage({ calendarZoomV2: '4', calendarZoom: '2' }))).toEqual({ zoom: 4, migrated: false });
    expect(readStoredZoom(memoryStorage({ calendarZoom: '1.5' }))).toEqual({ zoom: 3.5, migrated: true });
    // out of range or broken values never break the board
    expect(readStoredZoom(memoryStorage({ calendarZoomV2: '9' }))).toEqual({ zoom: 1, migrated: false });
    expect(readStoredZoom(memoryStorage({ calendarZoomV2: 'x', calendarZoom: '1' }))).toEqual({ zoom: 2, migrated: true });
    expect(readStoredZoom(memoryStorage({ calendarZoom: '7' }))).toEqual({ zoom: 1, migrated: false });
    expect(readStoredZoom(null)).toEqual({ zoom: 1, migrated: false });
  });

  it('the store migrates once, writes the new key and keeps the old one for the old grid', () => {
    const storage = memoryStorage({ calendarZoom: '2' });
    const store = createBoardSettings(() => storage);
    expect(store.getState().zoom).toBe(6);
    expect(storage.getItem('calendarZoomV2')).toBe('6');
    expect(storage.getItem('calendarZoom')).toBe('2');
    // after that the new key rules, even if the old one changes
    storage.setItem('calendarZoom', '0.6');
    store.reset();
    expect(store.getState().zoom).toBe(6);
  });

  it('the store clamps, persists under the new key and survives blocked storage', () => {
    const storage = memoryStorage();
    const store = createBoardSettings(() => storage);
    store.setZoom(3.456);
    expect(store.getState().zoom).toBe(3.46);
    expect(storage.getItem('calendarZoomV2')).toBe('3.46');
    store.setZoom(100);
    expect(store.getState().zoom).toBe(6);
    store.setZoom(-3);
    expect(store.getState().zoom).toBe(1);
    store.setResolution('quarter');
    expect(store.getState().zoom).toBe(3.5);
    store.stepZoom(1);
    expect(store.getState().zoom).toBe(4);
    store.stepResolution(-1);
    expect(store.getState().zoom).toBe(2);
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const blocked = createBoardSettings(() => blockedStorage);
    expect(blocked.getState().zoom).toBe(1);
    blocked.setZoom(4);
    expect(blocked.getState().zoom).toBe(4);
  });
});

describe('pointer to minute with a scrolled board (6x)', () => {
  const g = boardGeometry(DEFAULT_WINDOW, 6, 455);
  const bodyTop = 200;

  it('maps the pointer through the timeline rectangle (which already moved with the scroll)', () => {
    const scrollTop = 1000;
    const rect = { top: bodyTop - scrollTop, height: g.height };
    // 10:00 is at y = (600-420) * px/min
    const y = yOfMinute(g, 600);
    expect(minuteAtClientY(g, rect, g.height, rect.top + y)).toBeCloseTo(600, 9);
    // the pointer 3 px into the row of 10:20 is in that row
    const row = minuteAtClientY(g, rect, g.height, rect.top + yOfMinute(g, 620) + 3);
    expect(Math.floor(row / 10) * 10).toBe(620);
  });

  it('gives the same minute from the scroll offset (the keyboard / zoom anchor path)', () => {
    const scrollTop = 1234.5;
    const rect = { top: bodyTop - scrollTop, height: g.height };
    for (const clientY of [bodyTop, bodyTop + 100, bodyTop + 250.5, bodyTop + 411]) {
      expect(minuteAtViewportY(g, scrollTop, bodyTop, 1, clientY)).toBeCloseTo(minuteAtClientY(g, rect, g.height, clientY), 9);
    }
  });

  it('corrects for the stage scale (client px per design px)', () => {
    const scale = 0.5;
    const scrollTop = 400;
    const rect = { top: bodyTop - scrollTop * scale, height: g.height * scale };
    const clientY = bodyTop + 80 * scale;
    expect(minuteAtClientY(g, rect, g.height, clientY)).toBeCloseTo(minuteAtViewportY(g, scrollTop, bodyTop, scale, clientY), 9);
    expect(minuteAtClientY(g, rect, g.height, clientY)).toBeCloseTo(minuteAtY(g, scrollTop + 80), 9);
  });

  it('lands a drag on the right ten-minute slot', () => {
    const scrollTop = 2000;
    const rect = { top: bodyTop - scrollTop, height: g.height };
    const at = (minuteInRow: number) => minuteAtClientY(g, rect, g.height, rect.top + yOfMinute(g, minuteInRow) + 1);
    const range = selectionRange(g, at(14 * 60 + 10), at(14 * 60 + 40), 10);
    expect(range).toEqual({ start: 14 * 60 + 10, end: 14 * 60 + 50 });
    // dragging upwards gives the same rows
    expect(selectionRange(g, at(14 * 60 + 40), at(14 * 60 + 10), 10)).toEqual(range);
  });
});

describe('keeping the time under the pointer fixed while zooming', () => {
  it('the minute under the pointer stays under it after the zoom', () => {
    const before = boardGeometry(DEFAULT_WINDOW, 2, 455);
    const after = boardGeometry(DEFAULT_WINDOW, 5, 455);
    const viewport = 455;
    const scrollTop = 300;
    const offset = 120; // the pointer is 120 px below the top of the body
    const minute = minuteAtViewportY(before, scrollTop, 0, 1, offset);
    const next = scrollTopFor(after, minute, offset, viewport);
    expect(minuteAtViewportY(after, next, 0, 1, offset)).toBeCloseTo(minute, 9);
  });

  it('stays inside the content: the top is 0 and the bottom is height - viewport', () => {
    const g = boardGeometry(DEFAULT_WINDOW, 6, 455);
    expect(scrollTopFor(g, 420, 300, 455)).toBe(0);
    expect(scrollTopFor(g, 1140, 0, 455)).toBeCloseTo(g.height - 455, 9);
    expect(scrollTopFor(boardGeometry(DEFAULT_WINDOW, 1, 455), 700, 100, 455)).toBe(0);
  });

  it('the first zoom-in shows now when today is in the week and inside the hours, else the first session, else the top', () => {
    const w = { startMinutes: 420, endMinutes: 1140 };
    expect(focusMinuteFor({ window: w, nowMinute: 600, firstSessionMinute: 480 })).toBe(600);
    expect(focusMinuteFor({ window: w, nowMinute: null, firstSessionMinute: 480 })).toBe(480);
    expect(focusMinuteFor({ window: w, nowMinute: 1300, firstSessionMinute: 480 })).toBe(480);
    expect(focusMinuteFor({ window: w, nowMinute: 100, firstSessionMinute: null })).toBe(420);
    expect(focusMinuteFor({ window: w, nowMinute: null, firstSessionMinute: 60 })).toBe(420);
  });
});

describe('the minute a pointer means in club planning', () => {
  it('rounds to the nearest 5 minutes as the file does (1x)', () => {
    expect(snapPointerMinute(863)).toBe(865);
    expect(snapPointerMinute(862.4)).toBe(860);
    expect(snapPointerMinute(863, 5)).toBe(865);
  });

  it('means the row the pointer is in once the lines are 10 / 15 / 30 minutes apart', () => {
    expect(snapPointerMinute(863, 10)).toBe(860);
    expect(snapPointerMinute(869.9, 10)).toBe(860);
    expect(snapPointerMinute(870, 10)).toBe(870);
    expect(snapPointerMinute(863, 15)).toBe(855);
    expect(snapPointerMinute(863, 30)).toBe(840);
    // a pointer exactly on a line, off by floating point dust, is still that row
    expect(snapPointerMinute(859.9999999, 10)).toBe(860);
  });
});
