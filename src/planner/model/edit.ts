/*
 * Changing terms that already exist: moving, pulling an edge (expansion), the
 * smart editor, the "new term" dialog and deleting.
 *
 * Port of `beginExistingTermMove`, `validateTermMove`, `proposalForMove`,
 * `shiftedInternalSlots`, `confirmTermMovement`, `showTermMoveConfirm` (data),
 * `beginExistingTermResize`, `validateTermExpansion`, `proposalForTermExpansion`,
 * `slotsAfterExpansion`, `commitTermExpansion`, `showTermExpansionConfirm` (data),
 * `smartEditTerm` (validation + draft transitions), `smartSlotShift`,
 * `showSmartEditConfirmation` (data + commit), `newEventModal` (validation) and
 * `deleteConfirm`.
 *
 * Every function is pure. Commits re-validate against the CURRENT sessions and
 * refuse with a Czech reason when the term changed in the meantime (the
 * prototype's stale checks), because in the product two desks can edit at once.
 * The prototype's demo history / outbox (`recordTermUpdate`) is NOT here: it is
 * the data source's job to record the change and notify (see `termChangeImpact`).
 */
import { bookingState } from './booking';
import { categoryOrFallback, demandOf, minutesOf, slotMinutesOf, sourceFor } from './context';
import { plannedFrom, plannedOf } from './order';
import { dayIndexInWeek, makeSlots, validatePlacement, windowLabel } from './placement';
import {
  clamp,
  clockDuration,
  dateOf,
  detailedDate,
  minutesAsTime,
  timeAsMinutes,
  addDays,
} from './time';
import type {
  CategoryId,
  IsoDate,
  MoveDrag,
  MovePreview,
  PlannerContext,
  PlannerSession,
  PlannerSlot,
  ResizeDrag,
  ResizeEdge,
  ResizePreview,
  SmartEditDraft,
  Validation,
} from './types';

/** Pointer travel (px) before a press becomes a move / an edge pull. */
export const MOVE_START_DISTANCE = 7;
export const RESIZE_START_DISTANCE = 4;

const SNAP = 5;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const win = (ctx: Pick<PlannerContext, 'window'>) => ({
  start: ctx.window.startMinutes,
  end: ctx.window.endMinutes,
  span: ctx.window.endMinutes - ctx.window.startMinutes,
});

/* ===================================== move ===================================== */

/** Pointer down on a card: remember where inside the term it was grabbed. */
export function beginMove(
  ctx: PlannerContext,
  event: PlannerSession,
  pointer: { pointerId: number; clientX: number; clientY: number },
  rect: Rect,
): MoveDrag {
  const w = win(ctx);
  const downTime = w.start + ((pointer.clientY - rect.top) / rect.height) * w.span;
  return {
    id: event.id,
    pointerId: pointer.pointerId,
    x: pointer.clientX,
    y: pointer.clientY,
    started: false,
    oldDate: event.date,
    oldStart: event.start,
    oldEnd: event.end,
    grabOffset: clamp(downTime - timeAsMinutes(event.start), 0, minutesOf(event)),
  };
}

/** Has the pointer travelled far enough to start a move? */
export const moveHasStarted = (drag: Pick<MoveDrag, 'x' | 'y'>, clientX: number, clientY: number): boolean =>
  Math.hypot(clientX - drag.x, clientY - drag.y) >= MOVE_START_DISTANCE;

export function validateTermMove(
  ctx: PlannerContext,
  original: PlannerSession,
  date: IsoDate,
  start: string,
  end: string,
  inside: boolean,
): Validation {
  if (!inside) return { ok: false, reason: 'Přesuňte termín do oblasti plánovacího kalendáře.' };
  const a = timeAsMinutes(start);
  const b = timeAsMinutes(end);
  const w = win(ctx);
  if (a < w.start || b > w.end || a >= b) {
    return { ok: false, reason: `Čas je mimo plánovací okno ${windowLabel(ctx)}.` };
  }
  const conflict = ctx.sessions.find(
    (e) => e.id !== original.id && e.date === date && a < timeAsMinutes(e.end) && b > timeAsMinutes(e.start),
  );
  if (conflict) {
    return { ok: false, reason: `Kolize: ${categoryOrFallback(ctx, conflict.categoryId).name} · ${conflict.start}–${conflict.end}.` };
  }
  return { ok: true, reason: 'Čas je dostupný. Pusťte myš pro potvrzení změny.' };
}

/** The move the pointer currently proposes (`proposalForMove`); length and slots never change. */
export function proposalForMove(
  ctx: PlannerContext,
  drag: Pick<MoveDrag, 'id' | 'grabOffset'>,
  pointer: { clientX: number; clientY: number },
  rect: Rect,
  weekStart: IsoDate,
  /** Minutes the start snaps to: the file's 5, or the visible grid line of a zoomed board. */
  snap = SNAP,
): MovePreview | null {
  const original = ctx.sessions.find((e) => e.id === drag.id);
  if (!original) return null;
  const w = win(ctx);
  const inside =
    pointer.clientX >= rect.left &&
    pointer.clientX <= rect.left + rect.width &&
    pointer.clientY >= rect.top &&
    pointer.clientY <= rect.top + rect.height;
  const x = clamp((pointer.clientX - rect.left) / rect.width, 0, 0.999999);
  const y = (pointer.clientY - rect.top) / rect.height;
  const day = Math.floor(x * 7);
  const duration = minutesOf(original);
  let startMinutes = Math.round((w.start + y * w.span - drag.grabOffset) / snap) * snap;
  // Keep whole appointments in the working window; never change number or length of slots.
  startMinutes = clamp(startMinutes, w.start, w.end - duration);
  const start = minutesAsTime(startMinutes);
  const end = minutesAsTime(startMinutes + duration);
  const date = addDays(weekStart, day);
  const validation = validateTermMove(ctx, original, date, start, end, inside);
  return {
    kind: 'move',
    eventId: original.id,
    date,
    categoryId: original.categoryId,
    start,
    end,
    startMinutes,
    endMinutes: startMinutes + duration,
    col: day,
    quantity: original.capacity,
    validation,
    oldDate: original.date,
    oldStart: original.start,
    oldEnd: original.end,
  };
}

/** Move slot coordinates by exactly the delta of the parent term (identity and bookings kept). */
export function shiftedInternalSlots(original: PlannerSession, nextStart: string, nextDate: IsoDate): PlannerSlot[] | undefined {
  if (!Array.isArray(original.slots)) return original.slots;
  const offset = timeAsMinutes(nextStart) - timeAsMinutes(original.start);
  return original.slots.map((slot) => ({
    ...slot,
    ...(Object.prototype.hasOwnProperty.call(slot, 'date') ? { date: nextDate } : {}),
    start: minutesAsTime(timeAsMinutes(slot.start) + offset),
    end: minutesAsTime(timeAsMinutes(slot.end) + offset),
  }));
}

export interface EditResult {
  ok: boolean;
  /** Czech, for the toast; empty when ok. */
  reason: string;
  sessions: PlannerSession[];
  /** The term as it is now (ok) / as it was (not ok). */
  term: PlannerSession | null;
  /** The term before the change (ok). */
  before: PlannerSession | null;
}

const fail = (ctx: PlannerContext, reason: string): EditResult => ({
  ok: false, reason, sessions: [...ctx.sessions], term: null, before: null,
});

/** Commit a move (`confirmTermMovement`): re-validates, then shifts the term and its slots. */
export function confirmTermMovement(ctx: PlannerContext, id: string, proposal: Pick<MovePreview, 'date' | 'start' | 'end'>): EditResult {
  const old = ctx.sessions.find((e) => e.id === id);
  if (!old) return fail(ctx, 'Termín již neexistuje.');
  const check = validateTermMove(ctx, old, proposal.date, proposal.start, proposal.end, true);
  if (!check.ok) return fail(ctx, 'Přesun nelze potvrdit: ' + check.reason);
  let updated: PlannerSession | null = null;
  const sessions = ctx.sessions.map((event) => {
    if (event.id !== id) return event;
    updated = {
      ...event,
      date: proposal.date,
      start: proposal.start,
      end: proposal.end,
      slots: shiftedInternalSlots(old, proposal.start, proposal.date),
    };
    return updated;
  });
  return { ok: true, reason: '', sessions, term: updated, before: old };
}

/** Does the change touch confirmed or held places (the desk must acknowledge it)? */
export function needsReservationAck(ctx: PlannerContext, original: PlannerSession): { confirmed: number; held: number; needsAck: boolean } {
  const info = bookingState(original, ctx.today);
  return { confirmed: info.confirmed, held: info.held, needsAck: info.confirmed > 0 || info.held > 0 };
}

export interface MoveConfirmModel {
  tone: string;
  name: string;
  slotsPill: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
  facts: string[];
  needsAck: boolean;
  noticeTitle: string;
  noticeText: string;
  ackText: string;
  /** Nothing to confirm when the proposal equals the current term. */
  unchanged: boolean;
}

export function moveConfirmModel(ctx: PlannerContext, proposal: MovePreview): MoveConfirmModel | null {
  const original = ctx.sessions.find((e) => e.id === proposal.eventId);
  if (!original) return null;
  const { confirmed, held, needsAck } = needsReservationAck(ctx, original);
  return {
    tone: categoryOrFallback(ctx, original.categoryId).color,
    name: categoryOrFallback(ctx, original.categoryId).name,
    slotsPill: `${original.capacity} SLOTŮ`,
    oldDate: detailedDate(original.date),
    newDate: detailedDate(proposal.date),
    oldTime: `${original.start} – ${original.end}`,
    newTime: `${proposal.start} – ${proposal.end}`,
    facts: ['Činnost zůstává stejná', `${original.capacity} slotů beze změny`, `Délka ${clockDuration(minutesOf(original))} zachována`],
    needsAck,
    noticeTitle: needsAck
      ? `${confirmed} potvrzených rezervací · ${held} míst držených pro klub`
      : 'V tomto termínu nejsou rezervace ani klubové blokace',
    noticeText: needsAck
      ? 'Přesun automaticky aktualizuje termín v klubovém odkazu; jednotlivcům s rezervací připraví oznámení o novém čase.'
      : 'Přesun nezmění počty slotů ani plánování klubové objednávky. Změní se pouze datum a čas.',
    ackText: 'Potvrzuji automatickou aktualizaci klubového odkazu a oznámení dotčeným jednotlivcům po uložení.',
    unchanged: original.date === proposal.date && original.start === proposal.start && original.end === proposal.end,
  };
}

/* ===================================== resize ===================================== */

export function beginResize(
  event: PlannerSession,
  edge: ResizeEdge,
  pointer: { pointerId: number; clientY: number },
): ResizeDrag | null {
  if (edge !== 'top' && edge !== 'bottom') return null;
  return { id: event.id, original: structuredClone(event), edge, pointerId: pointer.pointerId, originY: pointer.clientY, started: false };
}

export const resizeHasStarted = (drag: Pick<ResizeDrag, 'originY'>, clientY: number): boolean =>
  Math.abs(clientY - drag.originY) >= RESIZE_START_DISTANCE;

export function validateTermExpansion(
  ctx: PlannerContext,
  original: PlannerSession,
  edge: ResizeEdge,
  extra: number,
  newStart: string,
  newEnd: string,
): Validation {
  if (!Number.isInteger(extra) || extra <= 0) {
    return { ok: false, reason: edge === 'top' ? 'Tažením nahoru přidejte celé sloty.' : 'Tažením dolů přidejte celé sloty.' };
  }
  const a = timeAsMinutes(newStart);
  const b = timeAsMinutes(newEnd);
  const w = win(ctx);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < w.start || b > w.end || a >= b) {
    return { ok: false, reason: `Rozšíření je mimo provozní čas ${windowLabel(ctx)}.` };
  }
  const duration = slotMinutesOf(ctx, original.categoryId);
  if (!duration) return { ok: false, reason: 'Činnost nemá nastavenou délku slotu.' };
  const demand = demandOf(ctx, original.categoryId);
  const remaining = (demand?.requested ?? 0) - plannedOf(ctx, original.categoryId);
  if (sourceFor(original) === 'club' && extra > remaining) {
    return { ok: false, reason: `V objednávce zbývá pouze ${remaining} míst pro tuto činnost.` };
  }
  // Inspect only the newly added interval: legacy demo terms can already overlap.
  const extA = edge === 'top' ? a : timeAsMinutes(original.end);
  const extB = edge === 'top' ? timeAsMinutes(original.start) : b;
  const collision = ctx.sessions.find(
    (other) => other.id !== original.id && other.date === original.date && extA < timeAsMinutes(other.end) && extB > timeAsMinutes(other.start),
  );
  if (collision) {
    return { ok: false, reason: `Kolize s termínem ${categoryOrFallback(ctx, collision.categoryId).name} (${collision.start}–${collision.end}).` };
  }
  return { ok: true, reason: `Volné místo pro +${extra} ${extra === 1 ? 'slot' : 'slotů'}. Pusťte myš pro potvrzení.` };
}

/**
 * The expansion the pointer currently proposes (`proposalForTermExpansion`).
 * `scale` is the stage scale: client px / design px of the board
 * (`rect.height / board.clientHeight`), because the travelled distance is
 * measured in screen pixels and converted to minutes by the design height.
 */
export function proposalForTermExpansion(
  ctx: PlannerContext,
  drag: ResizeDrag,
  clientY: number,
  scale: number,
  weekStart: IsoDate,
  timelineHeight = 455,
): ResizePreview | null {
  const original = ctx.sessions.find((e) => e.id === drag.id);
  if (!original) return null;
  const duration = slotMinutesOf(ctx, original.categoryId) || 30;
  const w = win(ctx);
  const signed = (clientY - drag.originY) * (drag.edge === 'top' ? -1 : 1);
  const travelledMinutes = ((signed / Math.max(0.01, scale)) * w.span) / timelineHeight;
  const added = Math.max(0, Math.round(travelledMinutes / duration));
  const from = timeAsMinutes(original.start);
  const to = timeAsMinutes(original.end);
  const a = drag.edge === 'top' ? from - added * duration : from;
  const b = drag.edge === 'bottom' ? to + added * duration : to;
  const start = minutesAsTime(Math.max(0, a));
  const end = minutesAsTime(Math.min(1439, b));
  const validation = validateTermExpansion(ctx, original, drag.edge, added, start, end);
  return {
    kind: 'resize',
    eventId: original.id,
    date: original.date,
    categoryId: original.categoryId,
    edge: drag.edge,
    added,
    capacity: original.capacity + added,
    start,
    end,
    startMinutes: a,
    endMinutes: b,
    col: dayIndexInWeek(weekStart, original.date),
    validation,
    original: drag.original,
  };
}

/** New slot list: existing slot objects and their bookings are NEVER rewritten, only extended. */
export function slotsAfterExpansion(
  ctx: PlannerContext,
  original: PlannerSession,
  proposal: Pick<ResizePreview, 'edge' | 'start' | 'added'>,
  stamp: string = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
): PlannerSlot[] {
  const duration = slotMinutesOf(ctx, original.categoryId);
  const current = Array.isArray(original.slots) ? original.slots : [];
  const baseStart = timeAsMinutes(original.start);
  const baseSpan = minutesOf(original);
  const base: PlannerSlot[] = Array.from({ length: original.capacity }, (_, i) => {
    const existing = current[i];
    if (existing && typeof existing === 'object') return { ...existing };
    const a = baseStart + Math.round((baseSpan * i) / original.capacity);
    const b = baseStart + Math.round((baseSpan * (i + 1)) / original.capacity);
    return { id: `${original.id}-base-${i + 1}`, date: original.date, categoryId: original.categoryId, start: minutesAsTime(a), end: minutesAsTime(b) };
  });
  const anchor = proposal.edge === 'top' ? timeAsMinutes(proposal.start) : timeAsMinutes(original.end);
  const extra: PlannerSlot[] = Array.from({ length: proposal.added }, (_, i) => ({
    id: `${original.id}-expand-${stamp}-${i + 1}`,
    date: original.date,
    categoryId: original.categoryId,
    start: minutesAsTime(anchor + i * duration),
    end: minutesAsTime(anchor + (i + 1) * duration),
  }));
  return proposal.edge === 'top' ? [...extra, ...base] : [...base, ...extra];
}

/** Commit an expansion (`commitTermExpansion`); refuses a stale or inconsistent term. */
export function commitTermExpansion(
  ctx: PlannerContext,
  original: PlannerSession,
  proposal: ResizePreview,
  stamp?: string,
): EditResult {
  const current = ctx.sessions.find((e) => e.id === original.id);
  if (!current) return fail(ctx, 'Termín již neexistuje.');
  const fields = ['date', 'start', 'end', 'categoryId', 'capacity', 'booked', 'clubBooked', 'publicBooked', 'released'] as const;
  const stale =
    fields.some((k) => current[k] !== original[k]) ||
    JSON.stringify(current.slots || []) !== JSON.stringify(original.slots || []);
  if (stale) return fail(ctx, 'Termín byl mezitím změněn. Rozšíření proveďte znovu.');
  if (Array.isArray(current.slots) && current.slots.length > current.capacity) {
    return fail(ctx, 'Nesoulad uložených slotů. Rozšíření nebylo provedeno.');
  }
  const check = validateTermExpansion(ctx, current, proposal.edge, proposal.added, proposal.start, proposal.end);
  if (!check.ok) return fail(ctx, 'Rozšíření nelze uložit: ' + check.reason);
  const updated: PlannerSession = {
    ...current,
    start: proposal.start,
    end: proposal.end,
    capacity: proposal.capacity,
    slots: slotsAfterExpansion(ctx, current, proposal, stamp),
    slotDuration: slotMinutesOf(ctx, current.categoryId),
  };
  return { ok: true, reason: '', sessions: ctx.sessions.map((e) => (e.id === current.id ? updated : e)), term: updated, before: current };
}

export interface ExpandConfirmModel {
  tone: string;
  name: string;
  pill: string;
  date: string;
  oldTime: string;
  newTime: string;
  oldFacts: string;
  newFacts: string;
  figures: { added: string; extraTime: string; lastLabel: string; lastValue: string };
  needsAck: boolean;
  noticeTitle: string;
  noticeText: string;
  ackText: string;
}

export function expandConfirmModel(ctx: PlannerContext, proposal: ResizePreview): ExpandConfirmModel | null {
  const original = ctx.sessions.find((e) => e.id === proposal.eventId);
  if (!original || !proposal.added) return null;
  const info = bookingState(original, ctx.today);
  const needsAck = info.confirmed > 0 || info.held > 0;
  const extra = proposal.added;
  const duration = slotMinutesOf(ctx, original.categoryId);
  const newCap = original.capacity + extra;
  const club = sourceFor(original) === 'club';
  const remaining = club ? Math.max(0, (demandOf(ctx, original.categoryId)?.requested ?? 0) - plannedOf(ctx, original.categoryId) - extra) : null;
  return {
    tone: categoryOrFallback(ctx, original.categoryId).color,
    name: categoryOrFallback(ctx, original.categoryId).name,
    pill: `+${extra} ${extra === 1 ? 'MÍSTO' : 'MÍST'}`,
    date: detailedDate(original.date),
    oldTime: `${original.start} – ${original.end}`,
    newTime: `${proposal.start} – ${proposal.end}`,
    oldFacts: `${original.capacity} slotů · ${clockDuration(minutesOf(original))}`,
    newFacts: `${newCap} slotů · ${clockDuration(timeAsMinutes(proposal.end) - timeAsMinutes(proposal.start))}`,
    figures: {
      added: `+${extra} ${extra === 1 ? 'místo' : 'míst'}`,
      extraTime: `+${clockDuration(extra * duration)}`,
      lastLabel: remaining === null ? 'NOVÁ KAPACITA' : 'ZBÝVÁ V OBJEDNÁVCE',
      lastValue: `${remaining === null ? newCap : remaining} míst`,
    },
    needsAck,
    noticeTitle: 'Původní rezervace a jejich časy zůstávají zachované',
    noticeText: `${info.confirmed} potvrzených rezervací · ${info.held} míst držených pro klub. Přidávají se pouze nové volné sloty ${proposal.edge === 'top' ? 'před původní termín' : 'za původní termín'}. Po potvrzení se přepočítají kapacity, přehledy a grafy.`,
    ackText: 'Potvrzuji rozšíření termínu při zachování stávajících rezervací, slotů a klubových návazností.',
  };
}

/* ===================================== smart editor ===================================== */

export function smartEditInitialDraft(original: PlannerSession): SmartEditDraft {
  return {
    date: original.date,
    categoryId: original.categoryId,
    start: original.start,
    end: original.end,
    capacity: Number(original.capacity) || 1,
    mode: 'auto',
    dirty: false,
  };
}

/** Places that block shrinking the term: bookings, or the last occupied slot index + 1. */
export function smartEditBooked(ctx: PlannerContext, original: PlannerSession): number {
  return Math.max(Number(original.booked) || 0, bookingState(original, ctx.today).confirmed);
}

/** The original sample term uses another length than the catalogue (shown as a note in the editor). */
export const smartEditIsLegacy = (ctx: PlannerContext, original: PlannerSession): boolean =>
  minutesOf(original) !== Number(original.capacity || 0) * slotMinutesOf(ctx, original.categoryId);

/** The edited term as it would be stored. */
export function smartEditCandidate(ctx: PlannerContext, original: PlannerSession, draft: SmartEditDraft): PlannerSession {
  return {
    ...original,
    date: draft.date,
    categoryId: draft.categoryId,
    start: draft.start,
    end: draft.end,
    capacity: draft.capacity,
    slotDuration: slotMinutesOf(ctx, draft.categoryId),
  };
}

/** `syncEnd`: end follows from start + capacity x slot length. */
export function smartEditSyncEnd(ctx: PlannerContext, draft: SmartEditDraft): SmartEditDraft {
  const st = timeAsMinutes(draft.start);
  const duration = slotMinutesOf(ctx, draft.categoryId);
  if (Number.isFinite(st) && Number.isSafeInteger(draft.capacity) && draft.capacity > 0) {
    return { ...draft, end: minutesAsTime(st + draft.capacity * duration) };
  }
  return draft;
}

/** What the end field shows: empty when the computed end would pass midnight. */
export const smartEditEndInputValue = (draft: SmartEditDraft): string =>
  timeAsMinutes(draft.end) <= 1439 ? draft.end : '';

/** `normalizeManualEnd`: manual end -> capacity (only exact multiples), else NaN. */
export function smartEditManualEnd(ctx: PlannerContext, draft: SmartEditDraft): SmartEditDraft {
  const a = timeAsMinutes(draft.start);
  const b = timeAsMinutes(draft.end);
  const dur = slotMinutesOf(ctx, draft.categoryId);
  const ratio = (b - a) / dur;
  if (Number.isInteger(ratio) && ratio > 0 && ratio <= 500) return { ...draft, capacity: ratio };
  return draft;
}

export type SmartEditAction =
  | { type: 'date'; value: IsoDate }
  | { type: 'category'; value: CategoryId }
  | { type: 'start'; value: string }
  | { type: 'end'; value: string }
  | { type: 'plus' }
  | { type: 'minus' }
  | { type: 'toggleMode' };

/** All field interactions of the smart editor as one transition. */
export function smartEditReduce(ctx: PlannerContext, draft: SmartEditDraft, action: SmartEditAction): SmartEditDraft {
  const auto = (next: SmartEditDraft): SmartEditDraft => smartEditSyncEnd(ctx, { ...next, mode: 'auto', dirty: true });
  switch (action.type) {
    case 'date': return auto({ ...draft, date: action.value });
    case 'category': return auto({ ...draft, categoryId: action.value });
    case 'start': return auto({ ...draft, start: action.value });
    case 'end': return smartEditManualEnd(ctx, { ...draft, end: action.value, dirty: true });
    case 'minus': return auto({ ...draft, capacity: Math.max(1, (Number.isInteger(draft.capacity) ? draft.capacity : 1) - 1) });
    case 'plus': return auto({ ...draft, capacity: (Number.isInteger(draft.capacity) ? draft.capacity : 0) + 1 });
    case 'toggleMode':
      return draft.mode === 'auto' ? { ...draft, mode: 'manual' } : smartEditSyncEnd(ctx, { ...draft, mode: 'auto', dirty: true });
  }
}

/** The full review of an edit (`reviewValidation`). */
export function smartEditValidation(ctx: PlannerContext, original: PlannerSession, draft: SmartEditDraft): Validation {
  if (!draft.dirty) return { ok: false, reason: 'Nejprve proveďte změnu. Původní termín zatím zůstává platný.' };
  const e = smartEditCandidate(ctx, original, draft);
  const a = timeAsMinutes(e.start);
  const b = timeAsMinutes(e.end);
  const d = slotMinutesOf(ctx, e.categoryId);
  const w = win(ctx);
  const booked = smartEditBooked(ctx, original);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !Number.isFinite(dateOf(e.date).getTime())) {
    return { ok: false, reason: 'Vyberte platné datum termínu.' };
  }
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < w.start || b > w.end || b <= a) {
    return { ok: false, reason: `Termín musí být v pracovním okně ${windowLabel(ctx)}.` };
  }
  if (!Number.isInteger(e.capacity) || e.capacity <= 0) {
    return { ok: false, reason: 'Délka musí tvořit alespoň jeden celý slot.' };
  }
  if (b - a !== e.capacity * d) {
    return { ok: false, reason: `Rozsah není násobkem ${d} minut. Opravte konec nebo počet slotů.` };
  }
  if (e.capacity < booked) {
    return { ok: false, reason: `Nelze zrušit obsazené sloty: ${booked} rezervací, nově pouze ${e.capacity} míst.` };
  }
  if (Array.isArray(original.slots)) {
    const lastOccupied = original.slots.reduce(
      (max, slot, i) => (slot.bookingId || slot.participantId || slot.reservationId ? Math.max(max, i + 1) : max),
      0,
    );
    if (e.capacity < lastOccupied) {
      return { ok: false, reason: `Na pozdějším slotu existuje rezervace. Zachovejte alespoň ${lastOccupied} slotů.` };
    }
  }
  const conflict = ctx.sessions.find(
    (other) => other.id !== original.id && other.date === e.date && a < timeAsMinutes(other.end) && b > timeAsMinutes(other.start),
  );
  if (conflict) {
    return { ok: false, reason: `Kolize: ${categoryOrFallback(ctx, conflict.categoryId).name} ${conflict.start}–${conflict.end}.` };
  }
  const updated = ctx.sessions.map((other) => (other.id === original.id ? e : other));
  const requested = demandOf(ctx, e.categoryId)?.requested ?? 0;
  if (sourceFor(original) === 'club' && plannedFrom(ctx, updated, e.categoryId) > requested) {
    const rest = requested - plannedFrom(ctx, ctx.sessions.filter((other) => other.id !== original.id), e.categoryId);
    return { ok: false, reason: `Objednávka klubu: pro ${categoryOrFallback(ctx, e.categoryId).name} zbývá ${Math.max(0, rest)} slotů.` };
  }
  if (
    e.date === original.date && e.start === original.start && e.end === original.end &&
    e.categoryId === original.categoryId && e.capacity === original.capacity
  ) {
    return { ok: false, reason: 'Termín je beze změny.' };
  }
  return { ok: true, reason: 'Vše sedí · bez časové kolize · rezervace zachovány' };
}

export interface SmartEditViewModel {
  accent: string;
  equation: { count: string; minutes: number };
  durationText: string;
  countText: string;
  next: { name: string; date: string; time: string; facts: string };
  validation: Validation;
  invalidCard: boolean;
  impacts: string[];
  canContinue: boolean;
  endReadOnly: boolean;
  toModeLabel: string;
  modeHelp: string;
  modeButton: string;
}

/** Everything `draw()` of the smart editor shows. */
export function smartEditViewModel(ctx: PlannerContext, original: PlannerSession, draft: SmartEditDraft): SmartEditViewModel {
  const duration = slotMinutesOf(ctx, draft.categoryId);
  const valid = smartEditValidation(ctx, original, draft);
  const booked = smartEditBooked(ctx, original);
  const capOk = Number.isInteger(draft.capacity);
  const serviceChanged = draft.categoryId !== original.categoryId;
  const capChanged = draft.capacity !== original.capacity;
  const length = Math.max(0, timeAsMinutes(draft.end) - timeAsMinutes(draft.start)) || 0;
  return {
    accent: categoryOrFallback(ctx, draft.categoryId).color,
    equation: { count: capOk ? String(draft.capacity) : '—', minutes: duration },
    durationText: capOk ? clockDuration(draft.capacity * duration) : 'Neúplný interval',
    countText: capOk ? String(draft.capacity) : '—',
    next: {
      name: categoryOrFallback(ctx, draft.categoryId).name,
      date: draft.date && Number.isFinite(dateOf(draft.date).getTime()) ? detailedDate(draft.date) : 'Vyberte datum',
      time: `${draft.start || '--:--'} – ${draft.end || '--:--'}`,
      facts: `${capOk ? draft.capacity : '—'} slotů · ${clockDuration(length)}`,
    },
    validation: valid,
    invalidCard: draft.dirty && !valid.ok,
    impacts: [
      serviceChanged
        ? `Změna činnosti ${categoryOrFallback(ctx, original.categoryId).name} → ${categoryOrFallback(ctx, draft.categoryId).name}`
        : 'Činnost zachována',
      capChanged ? `Kapacita ${original.capacity} → ${capOk ? draft.capacity : '—'} slotů` : `Kapacita ${original.capacity} slotů`,
      `${booked} existujících rezervací`,
    ],
    canContinue: valid.ok,
    endReadOnly: draft.mode === 'auto',
    toModeLabel: draft.mode === 'auto' ? 'automaticky' : 'ruční režim',
    modeHelp: draft.mode === 'auto' ? 'Konec se dopočítá podle počtu slotů' : 'Změna času Do přepočítá počet slotů',
    modeButton: draft.mode === 'auto' ? 'Upravit konec ručně' : 'Zapnout automatický konec',
  };
}

/** Slot list after a smart edit: ids and booking metadata kept by index, times regenerated. */
export function smartSlotShift(ctx: PlannerContext, original: PlannerSession, next: PlannerSession): PlannerSlot[] {
  const dur = slotMinutesOf(ctx, next.categoryId);
  const start = timeAsMinutes(next.start);
  const records = Array.isArray(original.slots) ? original.slots : [];
  return Array.from({ length: next.capacity }, (_, i) => ({
    ...(records[i] && typeof records[i] === 'object' ? records[i] : {}),
    id: records[i]?.id || `${original.id}-slot-${i + 1}`,
    date: next.date,
    start: minutesAsTime(start + i * dur),
    end: minutesAsTime(start + (i + 1) * dur),
    categoryId: next.categoryId,
  }));
}

export interface SmartConfirmModel {
  tone: string;
  oldCard: { name: string; date: string; time: string; facts: string };
  newCard: { name: string; date: string; time: string; facts: string };
  stats: { slotMinutes: string; booked: string };
  club: boolean;
  deliveryTitle: string;
  deliveryText: string;
  deliveryNote: string | null;
  needsAck: boolean;
  ackText: string;
}

export function smartConfirmModel(ctx: PlannerContext, original: PlannerSession, next: PlannerSession): SmartConfirmModel {
  const booked = smartEditBooked(ctx, original);
  const publicReservations = bookingState(original, ctx.today).publicCount;
  const club = sourceFor(original) === 'club';
  const needsAck =
    booked > 0 &&
    (next.categoryId !== original.categoryId ||
      next.date !== original.date || next.start !== original.start || next.end !== original.end ||
      next.capacity !== original.capacity);
  const nameOf = (id: CategoryId) => categoryOrFallback(ctx, id).name;
  return {
    tone: categoryOrFallback(ctx, next.categoryId).color,
    oldCard: { name: nameOf(original.categoryId), date: detailedDate(original.date), time: `${original.start} – ${original.end}`, facts: `${original.capacity} slotů · ${clockDuration(minutesOf(original))}` },
    newCard: { name: nameOf(next.categoryId), date: detailedDate(next.date), time: `${next.start} – ${next.end}`, facts: `${next.capacity} slotů · ${clockDuration(minutesOf(next))}` },
    stats: { slotMinutes: `${slotMinutesOf(ctx, next.categoryId)} min / slot`, booked: `${booked} obsazených` },
    club,
    deliveryTitle: club ? 'Aktualizace klubového odkazu' : 'Automatické informování klientů',
    deliveryText: club
      ? 'Po potvrzení se stejný termín aktualizuje ve sdíleném klubovém rozhraní. Odkaz klubu se nemění.'
      : booked > 0
        ? 'Po úspěšném uložení se dotčeným klientům automaticky zařadí oznámení o změně termínu.'
        : 'V termínu zatím nejsou žádné rezervace. Při uložení nevznikne žádné oznámení.',
    deliveryNote:
      club && publicReservations
        ? `V termínu jsou také ${publicReservations} individuální rezervace: jejich držitelům se připraví samostatná oznámení.`
        : null,
    needsAck,
    ackText: `Potvrzuji, že se změna týká ${booked} rezervací a že se musí zachovat jejich identita a aktualizovat návazné informace.`,
  };
}

/** Commit of the smart editor (`showSmartEditConfirmation` commit): stale check, re-validation, new slots. */
export function commitSmartEdit(ctx: PlannerContext, original: PlannerSession, next: PlannerSession): EditResult {
  const current = ctx.sessions.find((e) => e.id === original.id);
  if (!current) return fail(ctx, 'Termín byl mezitím odstraněn.');
  const stale = (['date', 'start', 'end', 'capacity', 'categoryId', 'booked'] as const).some((k) => current[k] !== original[k]);
  if (stale || JSON.stringify(current.slots || []) !== JSON.stringify(original.slots || [])) {
    return fail(ctx, 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.');
  }
  const a = timeAsMinutes(next.start);
  const b = timeAsMinutes(next.end);
  const dur = slotMinutesOf(ctx, next.categoryId);
  const booked = smartEditBooked(ctx, original);
  const collisions = ctx.sessions.find((e) => e.id !== original.id && e.date === next.date && a < timeAsMinutes(e.end) && b > timeAsMinutes(e.start));
  const updated: PlannerSession = {
    ...current,
    date: next.date, start: next.start, end: next.end, categoryId: next.categoryId,
    capacity: next.capacity, slotDuration: dur, slots: smartSlotShift(ctx, current, next), createdByPlanner: true,
  };
  const future = ctx.sessions.map((e) => (e.id === original.id ? updated : e));
  const w = win(ctx);
  const overOrder = sourceFor(original) === 'club' && plannedFrom(ctx, future, next.categoryId) > (demandOf(ctx, next.categoryId)?.requested ?? 0);
  if (a < w.start || b > w.end || !Number.isInteger(next.capacity) || next.capacity < booked || b - a !== next.capacity * dur || collisions || overOrder) {
    return fail(ctx, 'Úpravu nelze uložit: změnila se dostupnost nebo kapacita.');
  }
  return { ok: true, reason: '', sessions: future, term: updated, before: current };
}

/**
 * Who has to be told about a change (`recordTermUpdate`'s channel logic):
 * the club link is updated for club terms, individuals with a reservation get
 * a message. The data source performs it; this only counts.
 */
export function termChangeImpact(ctx: PlannerContext, original: PlannerSession): { clubLinkUpdated: boolean; individualRecipients: number } {
  const source = sourceFor(original);
  const st = bookingState(original, ctx.today);
  return { clubLinkUpdated: source === 'club', individualRecipients: source === 'public' ? st.confirmed : st.publicCount };
}

/* ===================================== new term, delete ===================================== */

export interface NewEventDefaults {
  date: IsoDate;
  categoryId: CategoryId;
  start: string;
  end: string;
  /** Prefilled slot count. */
  capacity: number;
}

/** Defaults of the "Vytvořit termín" dialog; null when no činnost is selected. */
export function newEventDefaults(
  ctx: PlannerContext,
  selectedCategory: CategoryId | null,
  selectedDate: IsoDate,
  defaults: Partial<{ date: IsoDate; start: string; end: string; categoryId: CategoryId }> = {},
): NewEventDefaults | null {
  const categoryId = defaults.categoryId || selectedCategory;
  if (!categoryId) return null;
  const start = defaults.start || '09:00';
  return {
    date: defaults.date || selectedDate,
    categoryId,
    start,
    end: defaults.end || minutesAsTime(timeAsMinutes(start) + slotMinutesOf(ctx, categoryId) * 2),
    capacity: 2,
  };
}

/** Live capacity line of the dialog (`update()`). */
export function automaticCapacityText(start: string, end: string, slotMinutes: number): string {
  const a = timeAsMinutes(start);
  const b = timeAsMinutes(end);
  const count = Math.floor((b - a) / slotMinutes);
  return Number.isFinite(count) && count > 0
    ? `${count} slotů · ${slotMinutes} min na osobu${(b - a) % slotMinutes ? ' · neúplný interval' : ''}`
    : 'Vyberte platný časový rozsah';
}

export type NewEventResult =
  | { ok: true; session: PlannerSession; sessions: PlannerSession[] }
  | { ok: false; reason: string };

/** Save of the "Vytvořit termín" dialog (`newEventModal` save handler). */
export function createFromDialog(
  ctx: PlannerContext,
  input: { date: IsoDate; categoryId: CategoryId; start: string; end: string },
  newId: () => string,
): NewEventResult {
  const { date, categoryId, start, end } = input;
  const mins = slotMinutesOf(ctx, categoryId);
  const delta = timeAsMinutes(end) - timeAsMinutes(start);
  if (!(delta > 0) || delta % mins !== 0) return { ok: false, reason: `Rozsah musí být násobkem ${mins} minut.` };
  const w = win(ctx);
  if (timeAsMinutes(start) < w.start || timeAsMinutes(end) > w.end) return { ok: false, reason: `Plánovací okno je ${windowLabel(ctx)}.` };
  const count = delta / mins;
  const check = validatePlacement(ctx, { date, categoryId, start, end, quantity: count });
  if (!check.ok) return { ok: false, reason: check.reason };
  const session: PlannerSession = {
    id: newId(), date, start, end, categoryId, capacity: count, booked: 0, showInList: true,
    slots: makeSlots(start, count, mins), createdByPlanner: true,
  };
  const next = [...ctx.sessions, session];
  if (plannedFrom(ctx, next, categoryId) > (demandOf(ctx, categoryId)?.requested ?? 0)) {
    return { ok: false, reason: 'Tímto termínem byste překročili požadavek klubu.' };
  }
  return { ok: true, session, sessions: next };
}

/** Confirmed delete: drop the term, its capacity returns to the order. */
export const deleteSession = (ctx: PlannerContext, id: string): PlannerSession[] => ctx.sessions.filter((x) => x.id !== id);
