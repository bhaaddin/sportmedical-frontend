/*
 * Geometry and text of the three live overlays drawn on the board while the
 * desk drags: the placement preview + HUD (`drawPreview`), the move ghost,
 * lanes and HUD (`drawExistingTermMove`) and the expansion range, added block
 * and HUD (`drawTermExpansion`).
 *
 * Pure: the UI renders what these return into `#drag-preview`, `#drag-hud`,
 * `#move-ghost`, `#move-lanes`, `#move-hud`, `#term-resize-range`,
 * `#term-resize-added`, `#term-resize-hud`.
 * `boardWidth` / `boardHeight` are the DESIGN pixel size of `#day-board`
 * (`board.clientWidth/Height`), unaffected by the stage scale. `timelineHeight` (the optional last argument of each
 * function) is the MEASURED height the 12 hours are drawn in (the fluid stage); it defaults to the file's 455 px.
 */
import { bookingState } from './booking';
import { categoryOrFallback, demandOf, slotMinutesOf } from './context';
import { plannedOf } from './order';
import { TIMELINE_HEIGHT } from './week';
import { clamp, dateOf, minutesAsTime, printable, timeAsMinutes, timeLeft } from './time';
import type { MovePreview, PlacementPreview, PlannerContext, ResizePreview } from './types';

const y = (ctx: PlannerContext, minutes: number, timeline = TIMELINE_HEIGHT): number =>
  ((minutes - ctx.window.startMinutes) / (ctx.window.endMinutes - ctx.window.startMinutes)) * timeline;

const colLeft = (col: number, pad: number) => `calc(${col} * 100% / 7 + ${pad}px)`;
const colWidth = (pad: number) => `calc(100% / 7 - ${pad * 2}px)`;

/* ------------------------------ placement ------------------------------ */

export interface PlacementOverlay {
  preview: {
    left: string;
    width: string;
    top: number;
    height: number;
    tone: string;
    invalid: boolean;
    limitReached: boolean;
    title: string;
    label: string;
    timeLabel: string;
  };
  hud: {
    left: number;
    top: number;
    tone: string;
    conflict: boolean;
    heading: string;
    activity: string;
    start: string;
    end: string;
    plus: string;
    progress: number;
    numbersMain: string;
    numbersOf: string;
    status: string;
  };
}

export function placementOverlay(ctx: PlannerContext, p: PlacementPreview, boardWidth: number, timelineHeight = TIMELINE_HEIGHT): PlacementOverlay {
  const c = categoryOrFallback(ctx, p.categoryId);
  const requested = demandOf(ctx, p.categoryId)?.requested ?? 0;
  const valid = p.validation.ok;
  const after = plannedOf(ctx, p.categoryId) + p.quantity;
  const progress = Math.round((after / requested) * 100);
  const centre = ((p.col + 0.5) * boardWidth) / 7;
  const pixelTop = y(ctx, p.startMinutes, timelineHeight);
  return {
    preview: {
      left: colLeft(p.col, 4),
      width: colWidth(4),
      top: pixelTop,
      height: y(ctx, p.endMinutes, timelineHeight) - y(ctx, p.startMinutes, timelineHeight),
      tone: c.color,
      invalid: !valid,
      limitReached: valid && p.isLimit,
      title: valid ? (p.isLimit ? `${p.start}–${p.end} · kapacita naplněna` : `${p.start}–${p.end}`) : p.validation.reason,
      label: `+${p.quantity} ${p.quantity === 1 ? 'slot' : 'slotů'}`,
      timeLabel: `${p.start} – ${p.end}`,
    },
    hud: {
      left: Math.min(boardWidth - 254, Math.max(7, centre + 18)),
      top: clamp(pixelTop > 154 ? pixelTop - 143 : y(ctx, p.endMinutes, timelineHeight) + 10, 7, timelineHeight - 141),
      tone: c.color,
      conflict: !valid,
      heading: valid ? 'ŽIVÝ NÁHLED PLÁNOVÁNÍ' : 'TERMÍN NELZE VYTVOŘIT',
      activity: c.name,
      start: p.start,
      end: p.end,
      plus: `+${p.quantity}`,
      progress,
      numbersMain: `${after}`,
      numbersOf: `/ ${requested} osob`,
      status: !valid
        ? p.validation.reason
        : p.isLimit
          ? '✓ Tímto bude požadavek klubu naplněn'
          : `${timeLeft(p.quantity * slotMinutesOf(ctx, p.categoryId))} · zbývá ${requested - after} osob`,
    },
  };
}

/* ------------------------------ move ------------------------------ */

export interface MoveOverlay {
  ghost: {
    left: string;
    width: string;
    top: number;
    height: number;
    tone: string;
    notAllowed: boolean;
    name: string;
    iconKey: string;
    timeLabel: string;
    foot: string;
  };
  lanes: { left: string; width: string; invalid: boolean };
  hud: {
    left: number;
    top: number;
    tone: string;
    invalid: boolean;
    heading: string;
    name: string;
    from: string;
    to: string;
    rule: { slots: string; text: string };
    message: string;
    conflict: boolean;
  };
}

export function moveOverlay(ctx: PlannerContext, p: MovePreview, boardWidth: number, timelineHeight = TIMELINE_HEIGHT): MoveOverlay | null {
  const original = ctx.sessions.find((e) => e.id === p.eventId);
  if (!original) return null;
  const c = categoryOrFallback(ctx, original.categoryId);
  const ok = p.validation.ok;
  const centre = ((p.col + 0.5) * boardWidth) / 7;
  const cellY = y(ctx, p.startMinutes, timelineHeight);
  const count = bookingState(original, ctx.today).confirmed;
  return {
    ghost: {
      left: colLeft(p.col, 4),
      width: colWidth(4),
      top: cellY,
      height: Math.max(27, y(ctx, p.endMinutes, timelineHeight) - y(ctx, p.startMinutes, timelineHeight)),
      tone: c.color,
      notAllowed: !ok,
      name: c.name,
      iconKey: c.iconKey,
      timeLabel: `${p.start} – ${p.end}`,
      foot: `${original.capacity} slotů · ${ok ? 'Připraveno k přesunu' : 'Časová kolize'}`,
    },
    lanes: { left: `calc(${p.col} * 100% / 7)`, width: 'calc(100% / 7)', invalid: !ok },
    hud: {
      left: clamp(centre + 20, 8, boardWidth - 267),
      top: clamp(cellY > 195 ? cellY - 168 : y(ctx, p.endMinutes, timelineHeight) + 10, 7, timelineHeight - 169),
      tone: c.color,
      invalid: !ok,
      heading: ok ? 'NÁHLED PŘESUNU' : 'NELZE PŘESUNOUT',
      name: c.name,
      from: `${printable(dateOf(original.date))} ${original.start}–${original.end}`,
      to: `${printable(dateOf(p.date))} ${p.start}–${p.end}`,
      rule: { slots: `${original.capacity} slotů`, text: ' · délka zachována' },
      message: !ok
        ? p.validation.reason
        : count
          ? `${count} potvrzených rezervací · vyžaduje souhlas`
          : 'Po puštění myši následuje potvrzení',
      conflict: !ok,
    },
  };
}

/* ------------------------------ resize ------------------------------ */

export interface ResizeOverlay {
  tone: string;
  invalid: boolean;
  left: string;
  width: string;
  range: { top: number; height: number };
  added: { top: number; height: number; label: string; times: string };
  hud: {
    left: number;
    top: number;
    eyebrow: string;
    name: string;
    times: string;
    delta: string;
    fromTo: string;
    note: string;
  };
}

/** Null when nothing is added yet (the prototype hides all three layers then). */
export function resizeOverlay(
  ctx: PlannerContext,
  p: ResizePreview,
  boardWidth: number,
  boardHeight: number,
  timelineHeight = TIMELINE_HEIGHT,
): ResizeOverlay | null {
  if (p.added <= 0) return null;
  const original = ctx.sessions.find((e) => e.id === p.eventId);
  if (!original) return null;
  const ok = p.validation.ok;
  const c = categoryOrFallback(ctx, original.categoryId);
  const oldStart = timeAsMinutes(original.start);
  const oldEnd = timeAsMinutes(original.end);
  const extStart = p.edge === 'top' ? p.startMinutes : oldEnd;
  const extEnd = p.edge === 'top' ? oldStart : p.endMinutes;
  const center = ((p.col + 0.5) * boardWidth) / 7;
  const eY = (p.edge === 'top' ? p.startMinutes : p.endMinutes) - ctx.window.startMinutes;
  const span = ctx.window.endMinutes - ctx.window.startMinutes;
  const ePx = (eY / span) * timelineHeight;
  const count = original.capacity + p.added;
  return {
    tone: c.color,
    invalid: !ok,
    left: colLeft(p.col, 4),
    width: colWidth(4),
    range: {
      top: y(ctx, p.startMinutes, timelineHeight),
      height: Math.max(18, ((p.endMinutes - p.startMinutes) / span) * timelineHeight),
    },
    added: {
      top: y(ctx, extStart, timelineHeight),
      height: Math.max(9, ((extEnd - extStart) / span) * timelineHeight),
      label: `+${p.added} ${p.added === 1 ? 'slot' : 'slotů'}`,
      times: `${minutesAsTime(extStart)}–${minutesAsTime(extEnd)}`,
    },
    hud: {
      left: clamp(center + 18, 8, boardWidth - 262),
      top: clamp(ePx > 190 ? ePx - 190 : ePx + 12, 6, boardHeight - 172),
      eyebrow: ok ? 'ROZŠÍŘENÍ TERMÍNU' : 'NELZE ROZŠÍŘIT',
      name: c.name,
      times: `${p.start} – ${p.end}`,
      delta: `+${p.added} míst`,
      fromTo: `${original.capacity} → ${count} slotů`,
      note: ok ? `${p.added * slotMinutesOf(ctx, original.categoryId)} min navíc · po puštění následuje potvrzení` : p.validation.reason,
    },
  };
}

