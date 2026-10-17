/*
 * MiniCalendarPanel - `.mini-calendar` inside `.sidebar` (prototype lines 2863-2877).
 *
 * SHELL. Done: month heading (`#month-title`), previous / next month buttons,
 * the weekday row and the legend. TO DO by the owner of this file:
 *   - the 42 day buttons inside `#mini-days` (`renderCalendar`, `renderMiniCell`):
 *     use `miniCellModel(ctx, date, preview)` from '../model' (arcs, liquid level,
 *     aria-label) and `selectActivePreview(state)` for the live drag preview;
 *   - hover / pin / zoom behaviour (`showMiniTooltip`, `hideMiniTooltip`, the 120/245/220 ms
 *     timers, `syncMiniActiveCells`): decisions are pure in '../model/mini.ts'
 *     (`miniHoverPlan`, `miniDayClickPlan`, `miniZoomFocus`, `miniCellFlags`),
 *     state transitions go through `act.mini({...})`; the flyout itself is `MiniDayTooltip.tsx`.
 * Store: `calendarMonth`, `selectedDate`, `mini`. Data: `usePlannerCtx()`.
 */
import { monthTitle, weekNames } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';

export function MiniCalendarPanel() {
  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const zoomState = usePlannerSelector((s) => (s.mini.pinnedDate ? 'pinned' : s.mini.zoomHoveredDate ? 'hover' : 'neutral'));
  const act = usePlannerActions();
  return (
    <div className="mini-calendar" data-testid="mini-calendar">
      <div className="mini-month-heading">
        <h2 id="month-title">{monthTitle(calendarMonth)}</h2>
        <div className="month-buttons">
          <button className="icon-button ghost" data-command="previousMonth" aria-label="Předchozí měsíc" onClick={() => act.previousMonth()}>
            <Icon name="chevron-left" />
          </button>
          <button className="icon-button ghost" data-command="nextMonth" aria-label="Následující měsíc" onClick={() => act.nextMonth()}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>
      <div className="weekdays" aria-hidden="true">
        {weekNames.map((n) => <span key={n}>{n}</span>)}
      </div>
      <div id="mini-days" className="mini-days" data-testid="mini-days" data-zoom-state={zoomState} />
      <div className="calendar-legend spectrum-legend">
        <span><i className="legend-spectrum" /><strong>PRSTENEC</strong> plánované činnosti</span>
        <span><i className="legend-liquid" /><strong>LIQUID</strong> využití dne</span>
      </div>
    </div>
  );
}
