import { describe, expect, it } from 'vitest';
import { UNDO_IDLE, UNDO_WINDOW_MS, cancelUndoable, secondsLeft, undoReducer, type MoveUndo, type UndoState } from './undoState';

const move: MoveUndo = { kind: 'move', calendarId: 'c1', appointmentId: 'a1', fromStartUtc: '2026-12-10T08:00:00Z', notifyPatient: false };
const armed = (now = 1000): UndoState => undoReducer(UNDO_IDLE, { type: 'push', op: move, now });

describe('R15c (d) the undo state machine', () => {
  it('a change arms Undo for 30 seconds', () => {
    const s = armed(1000);
    expect(s).toMatchObject({ phase: 'armed', entry: { id: 1, expiresAt: 1000 + UNDO_WINDOW_MS } });
    expect(UNDO_WINDOW_MS).toBe(30_000);
    expect(secondsLeft(s.entry, 1000)).toBe(30);
    expect(secondsLeft(s.entry, 1000 + 29_001)).toBe(1);
    expect(secondsLeft(s.entry, 99_999_999)).toBe(0);
    expect(secondsLeft(null, 0)).toBe(0);
  });
  it('the window ends by itself, not before', () => {
    const s = armed(1000);
    expect(undoReducer(s, { type: 'tick', now: 1000 + UNDO_WINDOW_MS - 1 })).toBe(s);
    expect(undoReducer(s, { type: 'tick', now: 1000 + UNDO_WINDOW_MS })).toMatchObject({ phase: 'idle', entry: null });
  });
  it('start, running, settled returns to idle; a finished undo leaves nothing to click twice', () => {
    const run = undoReducer(armed(), { type: 'start', id: 1, now: 2000 });
    expect(run.phase).toBe('running');
    expect(undoReducer(run, { type: 'start', id: 1, now: 2001 })).toBe(run); // no double click
    expect(undoReducer(run, { type: 'settled', id: 1 })).toMatchObject({ phase: 'idle', entry: null });
    expect(undoReducer(run, { type: 'settled', id: 99 })).toBe(run);
  });
  it('a late click (the window ran out) does nothing', () => {
    const s = armed(1000);
    expect(undoReducer(s, { type: 'start', id: 1, now: 1000 + UNDO_WINDOW_MS })).toBe(s);
  });
  it('only the last change can be undone: a newer one replaces it, a stale click is ignored', () => {
    const second = undoReducer(armed(), { type: 'push', op: { ...move, appointmentId: 'a2' }, now: 5000 });
    expect(second.entry).toMatchObject({ id: 2, op: { appointmentId: 'a2' } });
    expect(undoReducer(second, { type: 'start', id: 1, now: 5001 })).toBe(second);
    expect(undoReducer(second, { type: 'start', id: 2, now: 5001 }).phase).toBe('running');
  });
  it('dismiss closes an armed undo but never one that is running', () => {
    expect(undoReducer(armed(), { type: 'dismiss' })).toMatchObject({ phase: 'idle', entry: null });
    const run = undoReducer(armed(), { type: 'start', id: 1, now: 2000 });
    expect(undoReducer(run, { type: 'dismiss' })).toBe(run);
  });
});

describe('R15c (d) what a cancel can and cannot give back', () => {
  it('a registered patient or a named walk-in can be booked again', () => {
    expect(cancelUndoable({ patientId: 'p1' })).toBe(true);
    expect(cancelUndoable({ patientId: '', unregisteredName: 'Jan Novák' })).toBe(true);
  });
  it('a club term, a pending quick registration and a booking with nobody cannot', () => {
    expect(cancelUndoable({ patientId: 'p1', partnerName: 'FK Slaný' })).toBe(false);
    expect(cancelUndoable({ patientId: 'p1', clubDiscountPercent: 10 })).toBe(false);
    expect(cancelUndoable({ patientId: 'p1', quickRegistrationPending: true })).toBe(false);
    expect(cancelUndoable({ patientId: '' })).toBe(false);
    expect(cancelUndoable({ patientId: '', unregisteredName: '  ' })).toBe(false);
    expect(cancelUndoable({ patientId: '00000000-0000-0000-0000-000000000000' })).toBe(false);
  });
});
