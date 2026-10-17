/*
 * WeekBoardPanel - `section.planner.glass-panel` (prototype lines 2905-2941): the toolbar (week
 * arrows, "Dnes", heading + week counter, Den / Týden / Měsíc, činnost filter, the gear) and the
 * 07:00-19:00 board - cards, club windows, day marks, the now-line, the marking of free time, the
 * moving of a booking - with the day / month alternates.
 *
 * The work is in `./board/` (BoardSurface draws and wires, `boardModel` decides what is drawn). This
 * file only chooses the data it is drawn from:
 *
 *   - the lab and the shell tests (no `BoardConfig`): the planner's own data source - exactly the file;
 *   - the real route (`PlannerPage` provides `realCalendar`): the same board over the clinic's real
 *     calendar - bookings, blocks, the calendars / worker / služba filters - read with the calendar
 *     page's queries (`useBoardCalendar`), so the lab never touches the API.
 *
 * Club planning's three drag layers (placement, moving a term, pulling an edge) are
 * `PlanningBoardLayer`, mounted by BoardSurface at the end of `#day-board`.
 * Store: `view`, `filter`, `weekStart`, `selectedDate`, `planning.*`.
 */
import { useMemo } from 'react';
import { addDays, monthCells } from '../model';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { BoardSurface } from './board/BoardSurface';
import { useBoardCalendar } from './board/boardCalendar';
import { useBoardConfig } from './board/boardConfig';

/** The real calendar, read for the days the shown view needs. */
function RealBoard() {
  const view = usePlannerSelector((s) => s.view);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const days = useMemo(() => {
    if (view === 'day') return [selectedDate];
    if (view === 'month') return monthCells(calendarMonth);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [view, weekStart, selectedDate, calendarMonth]);
  const calendar = useBoardCalendar(days);
  return <BoardSurface calendar={calendar} />;
}

export function WeekBoardPanel() {
  const config = useBoardConfig();
  return config.realCalendar ? <RealBoard /> : <BoardSurface calendar={null} />;
}
