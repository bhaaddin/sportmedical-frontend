import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { at, drag, giveBoardGeometry, mountPlanner, ownerSource, press, release, term } from './testHarness';

/*
 * The fluid stage in jsdom: the board is NOT the file's 1094 x 455 px but 1500 x 620 (what a wide, tall window measures),
 * injected the way the real page measures it (the computed size of `#board-body`; the rect of `#day-board`). Cards, the
 * placement preview, the move ghost and the edge pull must all follow the measured board, and the pointer must land on
 * the day and the minute it is over. (Real geometry in Chromium: scripts/planner-fluid-audit.mjs.)
 */

const WIDE = { left: 60, top: 30, width: 1500, height: 620 };
const HOUR_COLUMN = 58;
/** design px of the 12-hour timeline = the board body's height */
const px = (minutes: number) => (minutes / 720) * WIDE.height;

/** `getComputedStyle` of the board body / hour column / day board as a laid-out page would answer it. */
function injectMeasuredBoard() {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const cs = real(el, pseudo);
    const sizes: Record<string, { width: string; height: string }> = {
      'board-body': { width: `${WIDE.width + HOUR_COLUMN}px`, height: `${WIDE.height}px` },
      'hour-column': { width: `${HOUR_COLUMN}px`, height: `${WIDE.height}px` },
      'day-board': { width: `${WIDE.width}px`, height: `${WIDE.height}px` },
    };
    const own = sizes[(el as HTMLElement).id];
    if (!own) return cs;
    return new Proxy(cs, {
      get(target, prop) {
        if (prop === 'width' || prop === 'height') return own[prop];
        if (prop === 'boxSizing') return 'border-box';
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
  });
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  injectMeasuredBoard();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;
const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-session-id="${id}"]`)!;
const one = () => [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2), term('t2', '2026-11-18', '08:00', '09:00', 's', 1)];

async function ready() {
  await screen.findByTestId('planning-carousel');
  await waitFor(() => expect(document.getElementById('day-board')).not.toBeNull());
  const board = document.getElementById('day-board')!;
  giveBoardGeometry(board, WIDE);
  return board;
}

describe('a measured board of any size (fluid stage)', () => {
  it('draws the 12 hours and the cards in the measured height, not the 455 px of the file', async () => {
    mountPlanner(ownerSource({ sessions: one() }));
    const b = await ready();
    await waitFor(() => expect(Number.parseFloat(b.style.height)).toBeCloseTo(WIDE.height, 3));
    // 08:00-10:00 on Tuesday: top 60 min and height 120 min of 720, at the MEASURED height
    await waitFor(() => expect(Number.parseFloat(cardOf('t1').style.top)).toBeCloseTo(px(60), 3));
    expect(Number.parseFloat(cardOf('t1').style.height)).toBeCloseTo(px(120), 3);
    // the hour labels sit on the same scale (label offset 11 px as in the file)
    const labels = [...document.querySelectorAll<HTMLElement>('.hour-label')];
    expect(labels).toHaveLength(12);
    expect(Number.parseFloat(labels[1]!.style.top)).toBeCloseTo(px(60) + 11, 3);
    expect(Number.parseFloat(labels[11]!.style.top)).toBeCloseTo(px(660) + 11, 3);
    // the body does not scroll: the timeline IS the body's height
    expect(document.getElementById('board-body')).not.toHaveClass('is-tall');
  });

  it('a drag-to-place lands on the pointer\'s day and minute, and the preview follows the measured board', async () => {
    mountPlanner(ownerSource());
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(3, 600, WIDE)); // Thursday 10:00
    drag(b, at(3, 695, WIDE)); // 11:35 -> 2 slots of 60 min
    const preview = document.getElementById('drag-preview')!;
    expect(preview).toHaveTextContent('+2 slotů');
    expect(preview).toHaveTextContent('10:00 – 12:00');
    expect(Number.parseFloat(preview.style.top)).toBeCloseTo(px(180), 3);
    expect(Number.parseFloat(preview.style.height)).toBeCloseTo(px(120), 3);
    // the day column is a percentage of the board (jsdom normalises `calc(3 * 100% / 7 + 4px)`)
    expect(preview.style.left).toMatch(/42[.]85\d*%.*4px/);
    // the HUD is kept inside the measured board (left <= width - 254, top <= height - 141)
    const hud = document.getElementById('drag-hud')!;
    expect(Number.parseFloat(hud.style.left)).toBeCloseTo((3.5 * WIDE.width) / 7 + 18, 3);
    expect(Number.parseFloat(hud.style.top)).toBeLessThanOrEqual(WIDE.height - 141);
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('drops at the bottom of a tall board: the end of the window caps the interval, the HUD stays inside', async () => {
    mountPlanner(ownerSource());
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(6, 1050, WIDE)); // Sunday 17:30
    drag(b, at(6, 1139, WIDE));
    const preview = document.getElementById('drag-preview')!;
    expect(preview).toHaveTextContent('17:30 – 18:30');
    const hud = document.getElementById('drag-hud')!;
    expect(Number.parseFloat(hud.style.top)).toBeLessThanOrEqual(WIDE.height - 141);
    expect(Number.parseFloat(hud.style.left)).toBeLessThanOrEqual(WIDE.width - 254);
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('moving a term: the ghost and the proposed time follow the pointer on a board of this size', async () => {
    const source = ownerSource({ sessions: one() });
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540, WIDE)); // grabbed in the middle (09:00)
    drag(b, at(3, 660, WIDE)); // Thursday, 11:00 under the pointer -> the term starts at 10:00
    const ghost = document.getElementById('move-ghost')!;
    expect(ghost).not.toHaveAttribute('hidden');
    expect(ghost).toHaveTextContent('10:00 – 12:00');
    expect(Number.parseFloat(ghost.style.top)).toBeCloseTo(px(180), 3);
    expect(Number.parseFloat(ghost.style.height)).toBeCloseTo(px(120), 3);
    expect(document.getElementById('move-lanes')!.style.left).toMatch(/42[.]85\d*%/);
    release(b, at(3, 660, WIDE));
    expect(await screen.findByRole('heading', { name: 'Opravdu přesunout termín?' })).toBeInTheDocument();
  });

  it('pulling the bottom edge: the distance is measured against the board\'s own height', async () => {
    const source = ownerSource({ sessions: [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2)] });
    mountPlanner(source);
    const b = await ready();
    const handle = document.querySelector<HTMLElement>('[data-session-id="t1"] .term-resize-handle[data-expand-edge="bottom"]')!;
    const from = at(1, 600, WIDE);
    press(handle, from);
    // two 60-minute slots = 120 min = px(120) screen px on THIS board (155 px less would be 1 slot on the file's 455)
    drag(b, { clientX: from.clientX, clientY: from.clientY + px(120) + 1 });
    expect(document.getElementById('term-resize-hud')).toHaveTextContent('2 → 4 slotů');
    expect(document.getElementById('term-resize-added')).toHaveTextContent('+2 slotů');
    fireEvent.keyDown(document, { key: 'Escape' });
  });
});
