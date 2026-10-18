import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { boardSettings } from '../board/boardSettings';
import { at, drag, giveBoardGeometry, mountPlanner, ownerSource, press, release, term } from './testHarness';

/*
 * Club planning on a ZOOMED board: at 6x the timeline is six times the body's height and the body scrolls inside the
 * panel. The day board is the scroll CONTENT, so its rectangle already carries the scroll offset: the pointer must land
 * on the right ten-minute slot wherever the board is scrolled to, the HUDs must stay inside the visible part, and at 1x
 * everything is the file's (5 minutes). (Real geometry in Chromium: the report's screenshots.)
 */

const BODY = { width: 1500, height: 620 };
const HOUR_COLUMN = 58;
const ZOOM = 6;
const SCROLL = 1500;
/** The day board as the scrolled page lays it out: 6 x the body's height, moved up by the scroll offset. */
const TALL = { left: 60, top: 30 - SCROLL, width: BODY.width, height: BODY.height * ZOOM };
const WIDE = { left: 60, top: 30, width: BODY.width, height: BODY.height };

function injectMeasuredBoard(boardHeight: number) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const cs = real(el, pseudo);
    const sizes: Record<string, { width: string; height: string }> = {
      'board-body': { width: `${BODY.width + HOUR_COLUMN}px`, height: `${BODY.height}px` },
      'hour-column': { width: `${HOUR_COLUMN}px`, height: `${boardHeight}px` },
      'day-board': { width: `${BODY.width}px`, height: `${boardHeight}px` },
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
  window.localStorage.clear();
  boardSettings.reset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  boardSettings.reset();
});

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;
const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-session-id="${id}"]`)!;

async function ready(geometry: typeof TALL) {
  await screen.findByTestId('planning-carousel');
  await waitFor(() => expect(document.getElementById('day-board')).not.toBeNull());
  const board = document.getElementById('day-board')!;
  giveBoardGeometry(board, geometry);
  return board;
}

describe('club planning at 6x (ten-minute rows, the board scrolled by 1500 px)', () => {
  beforeEach(() => {
    boardSettings.setZoom(ZOOM);
    injectMeasuredBoard(TALL.height);
  });

  it('draws a board six times the body and a drag-to-place anchors on the ten-minute row under the pointer', async () => {
    mountPlanner(ownerSource());
    const b = await ready(TALL);
    await waitFor(() => expect(Number.parseFloat(b.style.height)).toBeCloseTo(TALL.height, 3));
    expect(b).toHaveAttribute('data-step', '10');
    expect(document.getElementById('board-body')).toHaveClass('is-tall');
    fireEvent.click(card('k'));
    press(b, at(2, 14 * 60 + 23, TALL)); // 3 minutes into the 14:20 row
    drag(b, at(2, 15 * 60 + 52, TALL)); // inside the 15:50 row
    const preview = document.getElementById('drag-preview')!;
    // anchor 14:20 (not 14:25 as at 1x); 14:20 -> 15:50 is 90 min = two slots of 60
    expect(preview).toHaveTextContent('14:20 – 16:20');
    expect(preview).toHaveTextContent('+2 slotů');
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('every ten-minute row under the pointer is its own slot, up and down', async () => {
    mountPlanner(ownerSource());
    const b = await ready(TALL);
    const rows: string[] = [];
    for (const minute of [9 * 60 + 1, 9 * 60 + 9, 9 * 60 + 11, 12 * 60 + 38]) {
      fireEvent.click(card('k')); // (Esc ends the drag and may disarm the činnost)
      press(b, at(1, minute, TALL));
      drag(b, at(1, minute, TALL));
      rows.push(document.getElementById('drag-preview')!.textContent ?? '');
      fireEvent.keyDown(document, { key: 'Escape' });
    }
    // the pointer means the row it is in: the row's top line
    expect(rows[0]).toContain('09:00 – 10:00');
    expect(rows[1]).toContain('09:00 – 10:00'); // 9:09 is still in the 09:00 row
    expect(rows[2]).toContain('09:10 – 10:10');
    expect(rows[3]).toContain('12:30 – 13:30');
  });

  it('moving a term snaps its start to the visible ten-minute row', async () => {
    mountPlanner(ownerSource({ sessions: [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2)] }));
    const b = await ready(TALL);
    press(cardOf('t1'), at(1, 8 * 60 + 67, TALL)); // grabbed 67 minutes into the term
    drag(b, at(3, 11 * 60 + 1, TALL)); // the term would start at 09:54 -> the 09:50 row
    const ghost = document.getElementById('move-ghost')!;
    expect(ghost).not.toHaveAttribute('hidden');
    expect(ghost).toHaveTextContent('09:50 – 11:50');
    release(b, at(3, 11 * 60 + 1, TALL));
    expect(await screen.findByRole('heading', { name: 'Opravdu přesunout termín?' })).toBeInTheDocument();
  });

  it('pulling an edge counts the distance against the zoomed board: one 60 min slot is 1/12 of its height', async () => {
    mountPlanner(ownerSource({ sessions: [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2)] }));
    const b = await ready(TALL);
    const handle = document.querySelector<HTMLElement>('[data-session-id="t1"] .term-resize-handle[data-expand-edge="bottom"]')!;
    const from = at(1, 600, TALL);
    press(handle, from);
    const slotPx = (60 / 720) * TALL.height;
    drag(b, { clientX: from.clientX, clientY: from.clientY + 2 * slotPx + 1 });
    expect(document.getElementById('term-resize-hud')).toHaveTextContent('2 → 4 slotů');
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('the HUD stays inside the part of the board the desk sees (the body scrolled by 1500 px)', async () => {
    mountPlanner(ownerSource());
    const b = await ready(TALL);
    const body = document.getElementById('board-body')!;
    body.scrollTop = SCROLL;
    fireEvent.scroll(body);
    fireEvent.click(card('k'));
    // 14:20 is at y = (860-420)/720 * 3720 = 2273 px of the board; the scroll region shows 1500 .. 2120
    press(b, at(2, 14 * 60 + 23, TALL));
    drag(b, at(2, 14 * 60 + 40, TALL));
    const hud = document.getElementById('drag-hud')!;
    const top = Number.parseFloat(hud.style.top);
    // the file's rule alone would put it at 2273 - 143 = 2130, below the visible 1500 .. 2120 band; it is pulled up into it
    expect(top).toBeGreaterThanOrEqual(SCROLL + 7);
    expect(top + 141).toBeLessThanOrEqual(SCROLL + BODY.height + 0.5);
    fireEvent.keyDown(document, { key: 'Escape' });
  });
});

describe('club planning at 1x is the file\'s', () => {
  beforeEach(() => injectMeasuredBoard(WIDE.height));

  it('anchors on five minutes and keeps the HUD rule of the file', async () => {
    mountPlanner(ownerSource());
    const b = await ready(WIDE);
    expect(b).toHaveAttribute('data-step', '60');
    fireEvent.click(card('k'));
    press(b, at(2, 14 * 60 + 23, WIDE));
    drag(b, at(2, 14 * 60 + 30, WIDE));
    expect(document.getElementById('drag-preview')).toHaveTextContent('14:25 – 15:25');
    const hud = document.getElementById('drag-hud')!;
    const top = ((14 * 60 + 25 - 420) / 720) * WIDE.height;
    expect(Number.parseFloat(hud.style.top)).toBeCloseTo(top - 143, 3);
    fireEvent.keyDown(document, { key: 'Escape' });
  });
});
