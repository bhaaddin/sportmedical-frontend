import { useEffect } from 'react';
import { UNDO_TEXT, type UndoOp } from './undoState';
import { useBoardUndo } from './useBoardUndo';
import type { BoardNotice } from './useBoardMove';

/**
 * R15c (d): the "Vrátit zpět" bar. Loaded lazily the first time a move or a cancel arms it (the planner's first load does not carry it);
 * `entry.seq` changes with every new change, which re-arms the 30 s window (the last change only).
 */
export function BoardUndo({
  entry,
  refresh,
  notify,
  describeError,
}: {
  entry: { op: UndoOp; seq: number };
  refresh: () => Promise<void>;
  notify: (notice: BoardNotice) => void;
  describeError: (error: unknown) => string;
}) {
  const undo = useBoardUndo({ refresh, notify, describeError });
  const { arm } = undo;
  useEffect(() => {
    arm(entry.op);
  }, [entry.seq]); // eslint-disable-line react-hooks/exhaustive-deps -- a new change (seq) arms; the op object alone must not re-arm
  if (!undo.armed || !undo.op) return null;
  return (
    <div className="board-undo" role="status" data-testid="board-undo" data-kind={undo.op.kind} title={undo.op.kind === 'cancel' ? UNDO_TEXT.cancelHint : undefined}>
      <span className="undo-text">{undo.op.kind === 'move' ? UNDO_TEXT.moved : UNDO_TEXT.cancelled}</span>
      <span className="undo-left" data-testid="board-undo-left">{UNDO_TEXT.left(undo.seconds)}</span>
      <button type="button" className="undo-run" data-testid="board-undo-run" disabled={undo.running} onClick={undo.run}>{UNDO_TEXT.action}</button>
      <button type="button" className="undo-dismiss" aria-label={UNDO_TEXT.dismiss} disabled={undo.running} onClick={undo.dismiss}>×</button>
    </div>
  );
}

export default BoardUndo;
