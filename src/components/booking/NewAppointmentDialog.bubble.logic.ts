/*
 * Etapa 12, "rovnou na bublinku": where the booking bubble sits next to the
 * slot the desk marked in the grid, and where its caret points. Pure numbers,
 * so the flipping can be tested without a DOM.
 *
 * The anchor is the marked slot's box in VIEWPORT pixels - exactly what
 * `element.getBoundingClientRect()` gives (`x`, `y`, `width`, `height`),
 * measured at the moment the dialog is opened. The bubble prefers the right of
 * the slot, then the left, then below, then above; whatever fits whole wins,
 * and when nothing does it stays on the right, clamped to the screen with its
 * content scrolling inside.
 */

export interface BubbleAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Which side of the anchor the bubble sits on. */
export type BubbleSide = 'right' | 'left' | 'below' | 'above';

export interface BubblePlacement {
  side: BubbleSide;
  /** The bubble's top-left corner, viewport pixels. */
  top: number;
  left: number;
  /**
   * Where the caret is on the bubble's edge that faces the anchor: px from the
   * bubble's top (sides) or from its left (above/below).
   */
  caret: number;
}

/** The bubble's width on a desktop and a tablet, as drawn: between 420 and 480. */
export const BUBBLE_WIDTH = 440;
/** Breathing room between the bubble and the screen edge, and between it and the slot. */
export const BUBBLE_MARGIN = 16;
export const BUBBLE_GAP = 12;
/** The caret is 14 px wide; it never sits in the rounded corner. */
export const CARET_SIZE = 14;
const CARET_INSET = 22;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function placeBubble(
  anchor: BubbleAnchor,
  viewport: Size,
  size: Size,
  margin: number = BUBBLE_MARGIN,
  gap: number = BUBBLE_GAP,
): BubblePlacement {
  const centerX = anchor.x + anchor.width / 2;
  const centerY = anchor.y + anchor.height / 2;
  const maxLeft = viewport.width - margin - size.width;
  const maxTop = viewport.height - margin - size.height;

  const beside = (side: 'right' | 'left', left: number): BubblePlacement => {
    const top = clamp(centerY - size.height / 2, margin, maxTop);
    return { side, top, left, caret: clamp(centerY - top, CARET_INSET, size.height - CARET_INSET) };
  };
  const stacked = (side: 'below' | 'above', top: number): BubblePlacement => {
    const left = clamp(centerX - size.width / 2, margin, maxLeft);
    return { side, top, left, caret: clamp(centerX - left, CARET_INSET, size.width - CARET_INSET) };
  };

  const rightLeft = anchor.x + anchor.width + gap;
  if (rightLeft + size.width <= viewport.width - margin) return beside('right', rightLeft);

  const leftLeft = anchor.x - gap - size.width;
  if (leftLeft >= margin) return beside('left', leftLeft);

  const belowTop = anchor.y + anchor.height + gap;
  if (belowTop + size.height <= viewport.height - margin) return stacked('below', belowTop);

  const aboveTop = anchor.y - gap - size.height;
  if (aboveTop >= margin) return stacked('above', aboveTop);

  /* Nothing fits whole: the right, clamped to the screen; the body scrolls. */
  return beside('right', clamp(rightLeft, margin, maxLeft));
}

/** The tallest the bubble may be on this screen: the body scrolls past it. */
export function bubbleMaxHeight(viewportHeight: number, margin: number = BUBBLE_MARGIN): number {
  return Math.max(240, viewportHeight - 2 * margin);
}
