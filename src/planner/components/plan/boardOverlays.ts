/*
 * Overlay geometry for a board of ANY height.
 *
 * The model's overlays (`placementOverlay`, `moveOverlay`, `resizeOverlay`) put the preview/ghost/range at pixel
 * offsets of the prototype's 455 px timeline. The board can be taller (the calendar's zoom levels enlarge it,
 * `board/boardGeometry.ts`), so the texts stay the model's and the positions are recomputed here from the
 * board's real size - the same formulas of the prototype with `height` in place of `TIMELINE_HEIGHT`.
 */
import {
  clamp,
  moveOverlay,
  resizeOverlay,
  timeAsMinutes,
  type MoveOverlay,
  type MovePreview,
  type PlacementOverlay,
  type PlacementPreview,
  type PlannerContext,
  type ResizeOverlay,
  type ResizePreview,
} from '../../model';
import { planOverlay } from './placementPlan';
import type { CategoryFigure } from './orderFigures';

export interface BoardSize {
  /** `board.clientWidth` / `clientHeight` in design px (unaffected by the stage scale). */
  width: number;
  height: number;
  /**
   * The part of the board the desk can see, when the board scrolls inside its panel (a zoomed-in board): `viewTop` is
   * the scroll offset, `viewHeight` the height of the scroll region - both in the board's own px. A HUD never leaves it.
   * Absent = the whole board (the file).
   */
  viewTop?: number;
  viewHeight?: number;
}

/** A HUD's `top`: the rule of the file, then kept inside the visible part of a scrolled board. */
function hudTop(raw: number, hudHeight: number, board: BoardSize): number {
  const top = clamp(raw, 7, board.height - hudHeight);
  if (board.viewTop === undefined || board.viewHeight === undefined) return top;
  const low = board.viewTop + 7;
  const high = Math.max(low, board.viewTop + board.viewHeight - hudHeight);
  return clamp(top, low, Math.min(high, Math.max(7, board.height - hudHeight)));
}

const yOf = (ctx: PlannerContext, minutes: number, height: number): number =>
  ((minutes - ctx.window.startMinutes) / (ctx.window.endMinutes - ctx.window.startMinutes)) * height;

/** The drag preview + HUD for a board of this size; the numbers are the order's own (`added` players counted in). */
export function placementOverlayFor(
  ctx: PlannerContext,
  p: PlacementPreview,
  f: CategoryFigure,
  added: number,
  board: BoardSize,
): PlacementOverlay {
  const o = planOverlay(ctx, p, f, added, board.width);
  const top = yOf(ctx, p.startMinutes, board.height);
  const bottom = yOf(ctx, p.endMinutes, board.height);
  const centre = ((p.col + 0.5) * board.width) / 7;
  return {
    preview: { ...o.preview, top, height: bottom - top },
    hud: {
      ...o.hud,
      left: Math.min(board.width - 254, Math.max(7, centre + 18)),
      top: hudTop(top > 154 ? top - 143 : bottom + 10, 141, board),
    },
  };
}

export function moveOverlayFor(ctx: PlannerContext, p: MovePreview, board: BoardSize): MoveOverlay | null {
  const o = moveOverlay(ctx, p, board.width);
  if (!o) return null;
  const top = yOf(ctx, p.startMinutes, board.height);
  const bottom = yOf(ctx, p.endMinutes, board.height);
  const centre = ((p.col + 0.5) * board.width) / 7;
  return {
    ...o,
    ghost: { ...o.ghost, top, height: Math.max(27, bottom - top) },
    hud: {
      ...o.hud,
      left: clamp(centre + 20, 8, board.width - 267),
      top: hudTop(top > 195 ? top - 168 : bottom + 10, 169, board),
    },
  };
}

export function resizeOverlayFor(ctx: PlannerContext, p: ResizePreview, board: BoardSize): ResizeOverlay | null {
  const o = resizeOverlay(ctx, p, board.width, board.height);
  if (!o) return null;
  const original = ctx.sessions.find((e) => e.id === p.eventId);
  if (!original) return null;
  const span = ctx.window.endMinutes - ctx.window.startMinutes;
  const oldStart = timeAsMinutes(original.start);
  const oldEnd = timeAsMinutes(original.end);
  const extStart = p.edge === 'top' ? p.startMinutes : oldEnd;
  const extEnd = p.edge === 'top' ? oldStart : p.endMinutes;
  const edgePx = ((((p.edge === 'top' ? p.startMinutes : p.endMinutes) - ctx.window.startMinutes) / span) * board.height);
  return {
    ...o,
    range: { top: yOf(ctx, p.startMinutes, board.height), height: Math.max(18, ((p.endMinutes - p.startMinutes) / span) * board.height) },
    added: { ...o.added, top: yOf(ctx, extStart, board.height), height: Math.max(9, ((extEnd - extStart) / span) * board.height) },
    hud: { ...o.hud, top: board.viewTop === undefined ? clamp(edgePx > 190 ? edgePx - 190 : edgePx + 12, 6, board.height - 172) : hudTop(edgePx > 190 ? edgePx - 190 : edgePx + 12, 172, board) },
  };
}
