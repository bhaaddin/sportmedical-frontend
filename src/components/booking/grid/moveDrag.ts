import { isTerminalStatus, type Calendar, type DayAppointment, type PreviewDay, type TimeBlock } from '../../../api/bookingContracts';
import { pragueDateKey, type DateOnly } from '../../../utils/time';
import { GRID_TEXT } from './gridText';
import { minuteAt, parseTimeOfDay, spanOnDay, type MinuteRange } from './timeRange';

/*
 * Moving a booking by dragging its card (Etapa 12, the owner: "jeden klik a
 * táhnout mi to přesune, dvojklik mi ukáže celou info — musí to být dynamické").
 *
 * The pointer side: a press that travels more than `DRAG_THRESHOLD_PX` is a
 * drag; on touch a press held `TOUCH_DRAG_PRESS_MS` becomes one (a finger that
 * moves first is a scroll). A press that never travels is a click: it selects
 * the card and shows the summary; two of them inside `DOUBLE_TAP_MS` open the
 * detail. Everything below is the arithmetic the grid needs for that, kept
 * free of React so it can be tested on its own.
 */

/** A mouse press that travels this far (px) is a drag, not a click. */
export const DRAG_THRESHOLD_PX = 6;
/** A finger held this long on a card starts a drag; sooner movement is a scroll. */
export const TOUCH_DRAG_PRESS_MS = 250;
/** A finger that wanders this far before the long press is scrolling. */
export const TOUCH_SCROLL_SLACK_PX = 8;
/** Two clicks or taps on the same card within this window open its detail. */
export const DOUBLE_TAP_MS = 350;
/** How long the card takes to glide back to its slot after a cancelled move. */
export const GLIDE_BACK_MS = 280;
/** The settle after a confirmed move. */
export const SETTLE_MS = 150;

const DEFAULT_STEP = 30;

/** The step a column snaps to: its calendar's own, or the finer grid when zoomed below it. */
export function columnStep(calendar: Pick<Calendar, 'displayStepMinutes'>, gridStep: number): number {
  const calendarStep = calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : DEFAULT_STEP;
  return Math.min(calendarStep, gridStep > 0 ? gridStep : calendarStep);
}

/**
 * Where a dragged card lands: the pointer's minute less where the card was
 * taken hold of, snapped to the column's step, the whole card kept on the grid.
 */
export function snapMove(args: {
  /** The pointer's distance (px) from the top of the column under it. */
  pointerOffsetPx: number;
  /** How far (minutes) down the card the pointer took hold. */
  grabMinutes: number;
  /** The card's length in minutes. */
  length: number;
  step: number;
  pxPerMinute: number;
  topMinute: number;
  bottomMinute: number;
}): MinuteRange {
  const step = args.step > 0 ? args.step : DEFAULT_STEP;
  const raw = minuteAt(args.pointerOffsetPx, args.pxPerMinute, args.topMinute) - args.grabMinutes;
  const start = Math.min(
    Math.max(args.topMinute, Math.round(raw / step) * step),
    Math.max(args.topMinute, args.bottomMinute - args.length),
  );
  return { start, end: start + args.length };
}

/** Why a target cannot take the card; `null` when it can. */
export type MoveRefusal = 'calendar' | 'closed' | 'hours' | 'busy';

const overlaps = (a: MinuteRange, b: MinuteRange) => a.start < b.end && a.end > b.start;

/**
 * Whether a booking may land on `range` of a column that day. Only its own
 * calendar and činnost take it; the column must be open, the time inside the
 * working hours and clear of the lunch band, the blocks and - up to the
 * column's capacity - the other live bookings there.
 */
export function moveRefusal(args: {
  appointment: DayAppointment;
  range: MinuteRange;
  dayKey: DateOnly;
  /** The column is this booking's calendar and činnost. */
  sameColumn: boolean;
  open: boolean;
  row: PreviewDay | undefined;
  blocks: readonly TimeBlock[];
  /** The bookings drawn in that column that day (the moving one may be among them). */
  others: readonly DayAppointment[];
  capacity: number;
}): MoveRefusal | null {
  if (!args.sameColumn) return 'calendar';
  if (!args.open) return 'closed';
  const { row, range } = args;
  if (row !== undefined && row.isOpen) {
    const workStart = parseTimeOfDay(row.startTime);
    const workEnd = parseTimeOfDay(row.endTime);
    if (workStart !== null && range.start < workStart) return 'hours';
    if (workEnd !== null && range.end > workEnd) return 'hours';
    const breakStart = parseTimeOfDay(row.breakStart);
    const breakEnd = parseTimeOfDay(row.breakEnd);
    if (breakStart !== null && breakEnd !== null && overlaps(range, { start: breakStart, end: breakEnd })) return 'hours';
  }
  for (const block of args.blocks) {
    if (overlaps(range, spanOnDay(block.startUtc, block.endUtc, args.dayKey))) return 'busy';
  }
  const taken = args.others.filter(
    (other) =>
      other.id !== args.appointment.id &&
      !isTerminalStatus(other.status) &&
      overlaps(range, spanOnDay(other.startUtc, other.endUtc, args.dayKey)),
  ).length;
  if (taken >= Math.max(1, args.capacity)) return 'busy';
  return null;
}

/** The words on a refused ghost and in the refusal toast. */
export function refusalText(refusal: MoveRefusal): string {
  switch (refusal) {
    case 'calendar':
      return GRID_TEXT.moveOtherCalendar;
    case 'closed':
      return GRID_TEXT.moveClosed;
    case 'hours':
      return GRID_TEXT.moveOutsideHours;
    case 'busy':
      return GRID_TEXT.moveBusy;
  }
}

/** `10:30–11:00` on the ghost, the owner's spelling. */
export function ghostLabel(range: MinuteRange): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return `${fmt(range.start)}–${fmt(range.end)}`;
}

/** The card is already where the pointer let go of it. */
export function samePlace(appointment: DayAppointment, dayKey: DateOnly, range: MinuteRange, calendarId: string, fromCalendarId: string): boolean {
  if (calendarId !== fromCalendarId) return false;
  if (pragueDateKey(appointment.startUtc) !== dayKey) return false;
  return spanOnDay(appointment.startUtc, appointment.endUtc, dayKey).start === range.start;
}

/** The toast after a confirmed move: "Termín přesunut · pacientovi odesíláme oznámení" or "· bez oznámení". */
export function movedNoticeText(notifyPatient: boolean): string {
  return `${GRID_TEXT.moved} · ${notifyPatient ? GRID_TEXT.movedNotify : GRID_TEXT.movedSilent}`;
}

/* ---- "Upozornit klienta na změnu": remembered for the session. ---- */

const NOTIFY_KEY = 'sm.move.notifyPatient';

export function rememberedNotify(): boolean {
  try {
    const stored = window.sessionStorage.getItem(NOTIFY_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

export function rememberNotify(value: boolean): void {
  try {
    window.sessionStorage.setItem(NOTIFY_KEY, value ? '1' : '0');
  } catch {
    /* Private mode or storage off: the default holds. */
  }
}

/* ---- The notice bus: the confirm popover tells the grid a move went through. ---- */

export interface MoveNotice {
  text: string;
  tone: 'info' | 'error';
}

type NoticeListener = (notice: MoveNotice) => void;
const listeners = new Set<NoticeListener>();

export function emitMoveNotice(notice: MoveNotice): void {
  for (const listener of listeners) listener(notice);
}

export function subscribeMoveNotice(listener: NoticeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ---- Motion: the card glides back when a move is dropped, settles when it is kept. ---- */

export function reducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/**
 * FLIP: the card has just been drawn back where it belongs; it is shown first
 * where it was (`from`) and slides to its real place. A transform only - no
 * layout is touched - and nothing at all under `prefers-reduced-motion`.
 */
export function glideFrom(element: HTMLElement, from: DOMRect): void {
  const to = element.getBoundingClientRect();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  if (reducedMotion() || typeof element.animate !== 'function') return;
  element.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
    { duration: GLIDE_BACK_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

/** A confirmed move: the card breathes once at its new slot. */
export function settle(element: HTMLElement): void {
  if (reducedMotion() || typeof element.animate !== 'function') return;
  element.animate(
    [{ transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
    { duration: SETTLE_MS, easing: 'ease-out' },
  );
}
