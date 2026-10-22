/*
 * R15c (d) - runs the undo of the board (the state machine is `undoState.ts`): a ticking clock only while an undo is armed, the call
 * through the existing API, the refresh, and an honest sentence when it cannot be done (the booking stays as it is then).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { appointmentsApi } from '../../../api/appointments';
import { UNDO_IDLE, UNDO_TEXT, secondsLeft, undoReducer, type UndoOp } from './undoState';
import type { BoardNotice } from './useBoardMove';

/** The source code the desk's own bookings carry (as the booking dialog sends it). */
const SOURCE_STAFF = 0;

export interface UndoHandle {
  armed: boolean;
  running: boolean;
  op: UndoOp | null;
  seconds: number;
  arm: (op: UndoOp) => void;
  run: () => void;
  dismiss: () => void;
}

export function useBoardUndo(args: {
  refresh: () => Promise<void>;
  notify: (notice: BoardNotice) => void;
  describeError: (error: unknown) => string;
}): UndoHandle {
  const [state, dispatch] = useReducer(undoReducer, UNDO_IDLE);
  const [now, setNow] = useState(() => Date.now());
  const argsRef = useRef(args);
  argsRef.current = args;

  const armed = state.phase === 'armed' || state.phase === 'running';
  useEffect(() => {
    if (state.phase !== 'armed') return undefined;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.phase, state.entry?.id]);

  const arm = useCallback((op: UndoOp) => {
    const t = Date.now();
    setNow(t);
    dispatch({ type: 'push', op, now: t });
  }, []);

  const run = useCallback(() => {
    const entry = state.entry;
    if (!entry) return;
    const t = Date.now();
    if (state.phase !== 'armed' || t >= entry.expiresAt) return;
    dispatch({ type: 'start', id: entry.id, now: t });
    const { op } = entry;
    const call = async () => {
      if (op.kind === 'move') {
        await appointmentsApi.reschedule(op.calendarId, op.appointmentId, op.fromStartUtc, undefined, { notifyPatient: op.notifyPatient });
        return UNDO_TEXT.restoredMove;
      }
      if (op.patientId) {
        await appointmentsApi.create({ patientId: op.patientId, calendarId: op.calendarId, activityId: op.activityId, startUtc: op.startUtc, source: SOURCE_STAFF, note: op.note, agreedPriceCzk: op.agreedPriceCzk });
      } else {
        await appointmentsApi.createUnregistered({ calendarId: op.calendarId, activityId: op.activityId, startUtc: op.startUtc, name: op.name, phone: op.phone, note: op.note, agreedPriceCzk: op.agreedPriceCzk });
      }
      return UNDO_TEXT.restoredCancel;
    };
    void call().then(
      async (text) => {
        try {
          await argsRef.current.refresh();
        } finally {
          dispatch({ type: 'settled', id: entry.id });
          argsRef.current.notify({ text, tone: 'info' });
        }
      },
      (error: unknown) => {
        dispatch({ type: 'settled', id: entry.id });
        argsRef.current.notify({ text: `${UNDO_TEXT.failed}: ${argsRef.current.describeError(error)}`, tone: 'error' });
      },
    );
  }, [state.entry, state.phase]);

  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), []);

  return { armed, running: state.phase === 'running', op: state.entry?.op ?? null, seconds: secondsLeft(state.entry, now), arm, run, dismiss };
}
