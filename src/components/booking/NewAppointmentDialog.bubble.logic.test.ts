import { describe, expect, it } from 'vitest';
import { BUBBLE_GAP, BUBBLE_MARGIN, bubbleMaxHeight, placeBubble } from './NewAppointmentDialog.bubble.logic';

const viewport = { width: 1440, height: 900 };
const size = { width: 440, height: 600 };

describe('placeBubble', () => {
  it('sits to the right of a slot on the left half, centred on it, caret at the slot', () => {
    const anchor = { x: 300, y: 400, width: 160, height: 40 };
    const p = placeBubble(anchor, viewport, size);
    expect(p.side).toBe('right');
    expect(p.left).toBe(300 + 160 + BUBBLE_GAP);
    expect(p.top).toBe(420 - 300);
    expect(p.caret).toBe(300);
  });

  it('flips to the left when the right has no room', () => {
    const anchor = { x: 1200, y: 400, width: 160, height: 40 };
    const p = placeBubble(anchor, viewport, size);
    expect(p.side).toBe('left');
    expect(p.left).toBe(1200 - BUBBLE_GAP - 440);
  });

  it('clamps to the screen top and bottom, and the caret follows the slot', () => {
    const top = placeBubble({ x: 300, y: 0, width: 160, height: 10 }, viewport, size);
    expect(top.top).toBe(BUBBLE_MARGIN);
    expect(top.caret).toBe(22); /* the caret never sits in the rounded corner */
    const bottom = placeBubble({ x: 300, y: 870, width: 160, height: 20 }, viewport, size);
    expect(bottom.top).toBe(900 - BUBBLE_MARGIN - 600);
    expect(bottom.caret).toBe(600 - 22);
  });

  it('goes below the slot when neither side fits (an upright tablet), then above', () => {
    const tablet = { width: 834, height: 1112 };
    const below = placeBubble({ x: 200, y: 100, width: 400, height: 40 }, tablet, size);
    expect(below.side).toBe('below');
    expect(below.top).toBe(100 + 40 + BUBBLE_GAP);
    expect(below.left).toBe(400 - 220);
    expect(below.caret).toBe(220);

    const above = placeBubble({ x: 200, y: 1000, width: 400, height: 40 }, tablet, size);
    expect(above.side).toBe('above');
    expect(above.top).toBe(1000 - BUBBLE_GAP - 600);
  });

  it('falls back to the right, clamped, when nothing fits whole', () => {
    const small = { width: 800, height: 500 };
    const p = placeBubble({ x: 300, y: 200, width: 200, height: 100 }, small, { width: 440, height: 468 });
    expect(p.side).toBe('right');
    expect(p.left).toBe(800 - BUBBLE_MARGIN - 440);
    expect(p.top).toBe(BUBBLE_MARGIN);
  });
});

describe('bubbleMaxHeight', () => {
  it('leaves the margin above and below, and never shrinks under 240', () => {
    expect(bubbleMaxHeight(900)).toBe(900 - 2 * BUBBLE_MARGIN);
    expect(bubbleMaxHeight(100)).toBe(240);
  });
});
