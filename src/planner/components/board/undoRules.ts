/*
 * R15c (d): the one undo rule the board needs before anything is armed - can a cancelled booking be given back? - apart from the state
 * machine, the texts and the API calls (`undoState.ts`, `useBoardUndo.ts`, `BoardUndo.tsx`), which load lazily on the first move or cancel.
 */

/** What the cancelled booking looks like to the rule: the fields of a read appointment that matter. */
export interface CancelledBookingFacts {
  patientId: string;
  unregisteredName?: string | null;
  quickRegistrationPending?: boolean | null;
  partnerName?: string | null;
  clubDiscountPercent?: number | null;
}

/** Can the cancel be undone by creating the booking again? (See `undoState.ts` for what that means.) */
export function cancelUndoable(a: CancelledBookingFacts): boolean {
  if (a.quickRegistrationPending === true) return false;
  if ((a.partnerName ?? '') !== '' || (a.clubDiscountPercent ?? 0) > 0) return false;
  if (a.patientId !== '' && a.patientId !== '00000000-0000-0000-0000-000000000000') return true;
  return (a.unregisteredName ?? '').trim() !== '';
}
