/*
 * Derived views of `PlannerState` (no data, only navigation geometry).
 * Selectors that need terms take a `PlannerContext` from the model instead.
 */
import { addDays, monthCells, type IsoDate } from '../model';
import type { PlannerState } from './plannerState';

/** The 42 cells of the mini-calendar for the shown month. */
export const selectMonthCells = (s: Pick<PlannerState, 'calendarMonth'>): IsoDate[] => monthCells(s.calendarMonth);

/** The seven days of the shown week. */
export const selectWeekDays = (s: Pick<PlannerState, 'weekStart'>): IsoDate[] =>
  Array.from({ length: 7 }, (_, i) => addDays(s.weekStart, i));

/** Sunday of the shown week. */
export const selectWeekEnd = (s: Pick<PlannerState, 'weekStart'>): IsoDate => addDays(s.weekStart, 6);

/**
 * Days the UI needs terms for: the mini-calendar's 42 cells and the shown week
 * (they overlap except when the desk pages the month away from the week).
 * Used as the range of `listSessions`.
 */
export function selectVisibleRange(s: Pick<PlannerState, 'calendarMonth' | 'weekStart'>): { from: IsoDate; to: IsoDate } {
  const cells = monthCells(s.calendarMonth);
  const weekEnd = addDays(s.weekStart, 6);
  const from = [cells[0]!, s.weekStart].sort()[0]!;
  const to = [cells[cells.length - 1]!, weekEnd].sort().at(-1)!;
  return { from, to };
}

/** A činnost is armed for planning (`planState.selectedType`). */
export const selectIsPlanning = (s: Pick<PlannerState, 'planning'>): boolean => s.planning.selectedCategoryId !== null;

/** Any board gesture is in progress. */
export const selectIsGesturing = (s: Pick<PlannerState, 'planning'>): boolean =>
  s.planning.drag !== null || s.planning.move !== null || s.planning.resize !== null;

/** True while a modal layer covers the planner (dialog, drawer or summary). */
export const selectHasModal = (s: Pick<PlannerState, 'dialog' | 'drawer' | 'summary'>): boolean =>
  s.dialog !== null || s.drawer !== null || s.summary.open;

/** The live preview to project onto the mini-calendar (placement, move or resize), if valid. */
export function selectActivePreview(s: Pick<PlannerState, 'planning'>) {
  const { preview, movePreview, resizePreview } = s.planning;
  const p = preview ?? movePreview ?? resizePreview;
  return p && p.validation.ok ? p : null;
}

/** The toast shown now: the newest one. */
export const selectCurrentToast = (s: Pick<PlannerState, 'toasts'>) => s.toasts.at(-1) ?? null;
