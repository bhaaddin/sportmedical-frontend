/*
 * R15c (d) - UNDO for a move and a cancel: a "Vrátit zpět" action for 30 seconds after the change, through the existing API.
 *
 *   move    PUT .../time back to the previous start. Always possible while the old place is still free (the server decides; a refusal
 *           is said, the booking stays where it is). The patient is told again only if the move told them.
 *   cancel  A cancelled booking cannot be reopened by the API (a cancelled status has no way out), so Undo CREATES the booking again:
 *           same patient / walk-in, činnost, calendar, start, note and agreed price. It is a NEW reservation: the old one stays
 *           cancelled in the history, a notice the first cancel sent is not recalled, and if somebody took the slot meanwhile the
 *           server refuses and it stays cancelled. Offered only where re-creating is possible (`cancelUndoable`): a registered
 *           patient or a walk-in with a name; never a club term, a pending quick registration or a time outside the offer.
 *
 * Only the LAST change can be undone (a newer change replaces the older one and its window ends with it). Pure state machine, no
 * clock of its own: callers pass `now`.
 */

export const UNDO_WINDOW_MS = 30_000;

export interface MoveUndo {
  kind: 'move';
  calendarId: string;
  appointmentId: string;
  /** Where it was: `startUtc` back. */
  fromStartUtc: string;
  /** Tell the patient about the return only when the move told them. */
  notifyPatient: boolean;
}

export interface CancelUndo {
  kind: 'cancel';
  calendarId: string;
  activityId: string;
  startUtc: string;
  patientId: string | null;
  name: string | null;
  phone: string | null;
  note: string | null;
  agreedPriceCzk: number | null;
}

export type UndoOp = MoveUndo | CancelUndo;

export interface UndoEntry {
  id: number;
  op: UndoOp;
  expiresAt: number;
}

export type UndoPhase = 'idle' | 'armed' | 'running';

export interface UndoState {
  phase: UndoPhase;
  entry: UndoEntry | null;
  seq: number;
}

export const UNDO_IDLE: UndoState = { phase: 'idle', entry: null, seq: 0 };

export type UndoEvent =
  | { type: 'push'; op: UndoOp; now: number }
  | { type: 'tick'; now: number }
  | { type: 'start'; id: number; now: number }
  | { type: 'settled'; id: number }
  | { type: 'dismiss' };

export function undoReducer(state: UndoState, event: UndoEvent): UndoState {
  switch (event.type) {
    case 'push': {
      const id = state.seq + 1;
      return { phase: 'armed', seq: id, entry: { id, op: event.op, expiresAt: event.now + UNDO_WINDOW_MS } };
    }
    case 'tick':
      return state.phase === 'armed' && state.entry !== null && event.now >= state.entry.expiresAt ? { ...state, phase: 'idle', entry: null } : state;
    case 'start':
      /* a late click (the window ran out) or a stale one (a newer change replaced it) does nothing */
      return state.phase === 'armed' && state.entry !== null && state.entry.id === event.id && event.now < state.entry.expiresAt ? { ...state, phase: 'running' } : state;
    case 'settled':
      return state.phase === 'running' && state.entry?.id === event.id ? { ...state, phase: 'idle', entry: null } : state;
    case 'dismiss':
      return state.phase === 'running' ? state : { ...state, phase: 'idle', entry: null };
    default:
      return state;
  }
}

/** Whole seconds left, never negative. */
export const secondsLeft = (entry: UndoEntry | null, now: number): number => (entry === null ? 0 : Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)));

export { cancelUndoable, type CancelledBookingFacts } from './undoRules';

export const UNDO_TEXT = {
  moved: 'Termín přesunut.',
  cancelled: 'Rezervace zrušena.',
  action: 'Vrátit zpět',
  dismiss: 'Zavřít',
  restoredMove: 'Vráceno zpět: termín je zase na původním místě.',
  restoredCancel: 'Vráceno zpět: rezervace byla vytvořena znovu (nová rezervace, původní zůstává v historii jako zrušená).',
  failed: 'Vrátit zpět se nepodařilo',
  cancelHint: 'Vrácení vytvoří rezervaci znovu - je to nová rezervace; zrušení, které už pacient dostal, se nevrací.',
  left: (s: number) => `${s} s`,
} as const;
