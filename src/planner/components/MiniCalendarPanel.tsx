/*
 * MiniCalendarPanel - `.mini-calendar` inside `.sidebar` (prototype lines 2863-2877, `renderCalendar`,
 * `renderMiniCell`, `changeMonth`, `syncMiniActiveCells`).
 *
 * The 42 day buttons of `#mini-days`: the colour spectrum ring and the liquid level of each day come
 * from the REAL sessions of that day against the real day budget (`miniCellModel`), the live ring of an
 * active planning drag / move / resize from `selectActivePreview`, closed days (holiday, closure) from
 * `listDayMarks` (their number in the holiday colour of the display settings). Hover / focus open the
 * flyout through the shared controller (timers), a click pins it (or, on an empty day, pins the zoom and
 * moves the board there). Keyboard: arrows move over the days (crossing a month turns the page), Page Up /
 * Page Down turn the month, Home / End jump to the start / end of the week, Enter pins.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  miniCellFlags,
  miniCellModel,
  miniDayClickPlan,
  miniZoomFocus,
  monthCells,
  monthTitle,
  sameMonth,
  dateOf,
  weekNames,
  type IsoDate,
} from '../model';
import { usePlannerActions, usePlannerSelector, usePlannerStore } from '../state/PlannerStoreProvider';
import { selectActivePreview } from '../state/selectors';
import { Icon } from './Icons';
import { CLOSED_DAY_TEXT, DEFAULT_HOLIDAY_COLOR, effectiveHolidayColor, lockedDayLook } from '../model/dayLock';
import { usePlannerCtx, usePlannerModelState } from './context';
import { MiniDayButton } from './left/MiniDayButton';
import { getMiniController } from './left/miniController';
import './left/left.css';

const FALLBACK_HOLIDAY_COLOR = DEFAULT_HOLIDAY_COLOR;

export function MiniCalendarPanel() {
  const ctx = usePlannerCtx();
  const { dayMarks, catalogue } = usePlannerModelState();
  const store = usePlannerStore();
  const act = usePlannerActions();
  const controller = useMemo(() => getMiniController(store), [store]);

  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const mini = usePlannerSelector((s) => s.mini);
  const preview = usePlannerSelector(selectActivePreview);

  const cells = useMemo(() => monthCells(calendarMonth), [calendarMonth]);
  const monthDate = useMemo(() => dateOf(calendarMonth), [calendarMonth]);
  const zoom = miniZoomFocus(mini, cells);
  const holidayColor = effectiveHolidayColor(catalogue?.dayMarkColors.holiday ?? FALLBACK_HOLIDAY_COLOR);
  const holidayLook = lockedDayLook({ kind: 'holiday', label: null }, holidayColor);
  const closedLook = lockedDayLook({ kind: 'closed', label: null }, holidayColor);

  const [focusedDate, setFocusedDate] = useState<IsoDate | null>(null);
  const pendingFocus = useRef<IsoDate | null>(null);

  useEffect(() => {
    controller.setContext(ctx);
  }, [controller, ctx]);
  useEffect(() => () => controller.dispose(), [controller]);

  // After the keyboard turned the month page, put the focus on the day it was heading for.
  useEffect(() => {
    const wanted = pendingFocus.current;
    if (!wanted) return;
    const el = document.querySelector<HTMLButtonElement>(`#mini-days [data-date="${wanted}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  }, [calendarMonth]);

  const models = useMemo(
    () => cells.map((date) => miniCellModel(ctx, date, preview)),
    [cells, ctx, preview],
  );

  const tabbableDate: IsoDate = (() => {
    if (focusedDate && cells.includes(focusedDate)) return focusedDate;
    if (zoom.focusDate) return zoom.focusDate;
    if (cells.includes(selectedDate)) return selectedDate;
    return cells.find((d) => sameMonth(dateOf(d), monthDate)) ?? cells[0]!;
  })();

  const closedAnyInView = cells.some((d) => dayMarks[d]?.closed && dayMarks[d]?.kind !== 'holiday' && sameMonth(dateOf(d), monthDate));
  const holidayAnyInView = cells.some((d) => dayMarks[d]?.closed && dayMarks[d]?.kind === 'holiday' && sameMonth(dateOf(d), monthDate));

  const onDayClick = (date: IsoDate, hasTerms: boolean, event: React.MouseEvent<HTMLButtonElement>) => {
    const plan = miniDayClickPlan(store.getState().mini, date, hasTerms);
    // A mouse click drops the browser focus (no focus square after Esc); a key press keeps it.
    controller.hide({ blur: event.detail > 0 });
    // Clicking an already pinned date is a deliberate RESET to NEUTRAL.
    if (plan === 'unpin') return;
    if (plan === 'pinWithFlyout') {
      if (sameMonth(dateOf(date), monthDate)) act.focusDate(date, false);
      act.mini({ type: 'openFlyout', date, pinned: true });
      return;
    }
    // Empty date: pinned zoom is still meaningful. No fabricated popup.
    act.mini({ type: 'pinEmpty', date });
    act.selectDay(date);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.day-cell') : null;
    const from = target?.dataset.date;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: IsoDate | null = null;
    let monthDelta: 1 | -1 | null = null;
    switch (event.key) {
      case 'ArrowLeft': next = addDays(from, -1); break;
      case 'ArrowRight': next = addDays(from, 1); break;
      case 'ArrowUp': next = addDays(from, -7); break;
      case 'ArrowDown': next = addDays(from, 7); break;
      case 'Home': next = addDays(from, -((dateOf(from).getDay() + 6) % 7)); break;
      case 'End': next = addDays(from, 6 - ((dateOf(from).getDay() + 6) % 7)); break;
      case 'PageUp': monthDelta = -1; break;
      case 'PageDown': monthDelta = 1; break;
      default: return;
    }
    event.preventDefault();
    if (monthDelta !== null) {
      const d = dateOf(from);
      const moved = new Date(d.getFullYear(), d.getMonth() + monthDelta, Math.min(d.getDate(), 28), 12);
      const iso = `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`;
      pendingFocus.current = iso;
      if (monthDelta < 0) act.previousMonth(); else act.nextMonth();
      return;
    }
    if (!next) return;
    if (cells.includes(next)) {
      document.querySelector<HTMLButtonElement>(`#mini-days [data-date="${next}"]`)?.focus();
      return;
    }
    pendingFocus.current = next;
    if (next < cells[0]!) act.previousMonth(); else act.nextMonth();
  };

  return (
    <div className="mini-calendar" data-testid="mini-calendar">
      <div className="mini-month-heading">
        <h2 id="month-title" aria-live="polite">{monthTitle(calendarMonth)}</h2>
        <div className="month-buttons">
          <button className="icon-button ghost" data-command="previousMonth" aria-label="Předchozí měsíc" onClick={() => { controller.hide(); act.previousMonth(); }}>
            <Icon name="chevron-left" />
          </button>
          <button className="icon-button ghost" data-command="nextMonth" aria-label="Následující měsíc" onClick={() => { controller.hide(); act.nextMonth(); }}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>
      <div className="weekdays" aria-hidden="true">
        {weekNames.map((n) => <span key={n}>{n}</span>)}
      </div>
      <div
        id="mini-days"
        className={[
          'mini-days',
          zoom.hasFocus ? 'has-mini-focus zoom-focus-active' : '',
          zoom.isPinned ? 'has-pinned-focus zoom-focus-pinned' : '',
        ].filter(Boolean).join(' ')}
        data-testid="mini-days"
        data-zoom-state={zoom.zoomState}
        role="group"
        aria-label={`Kalendář ${monthTitle(calendarMonth)}`}
        onKeyDown={onKeyDown}
      >
        {models.map((model) => {
          const date = model.date;
          const mark = dayMarks[date];
          const flags = miniCellFlags(mini, zoom, date, selectedDate);
          return (
            <MiniDayButton
              key={date}
              model={model}
              flags={flags}
              otherMonth={!sameMonth(dateOf(date), monthDate)}
              previewing={!!preview && preview.date === date}
              today={date === ctx.today}
              closed={mark?.closed
                ? mark.kind === 'holiday'
                  ? { label: mark.label ?? null, color: holidayColor, kind: 'holiday', fill: holidayLook.fill, ink: holidayLook.ink }
                  : { label: mark.label ?? null, color: CLOSED_DAY_TEXT, kind: 'closed' }
                : null}
              tabbable={date === tabbableDate}
              onClick={(event) => onDayClick(date, model.hasTerms, event)}
              onEnter={() => controller.show(date)}
              onLeave={() => controller.scheduleHide()}
              onFocus={() => { setFocusedDate(date); controller.show(date); }}
              onBlur={() => {
                const m = store.getState().mini;
                if (m.pinnedDate || m.zoomHoveredDate || m.openDate !== null) controller.scheduleHide();
              }}
            />
          );
        })}
      </div>
      <div className="calendar-legend spectrum-legend">
        <span title="Prstenec: plánované činnosti"><i className="legend-spectrum" /><strong>PRSTENEC</strong>{holidayAnyInView || closedAnyInView ? null : ' plánované činnosti'}</span>
        <span title="Liquid: využití dne"><i className="legend-liquid" /><strong>LIQUID</strong>{holidayAnyInView || closedAnyInView ? null : ' využití dne'}</span>
        {holidayAnyInView ? (
          <span data-testid="mini-legend-holiday" style={{ '--legend-fill': holidayLook.fill } as React.CSSProperties}><i className="legend-closed is-holiday" /><strong>SVÁTEK</strong></span>
        ) : null}
        {closedAnyInView ? (
          <span data-testid="mini-legend-closed" style={{ '--legend-fill': closedLook.fill } as React.CSSProperties}><i className="legend-closed is-closed" /><strong>ZAVŘENO</strong></span>
        ) : null}
      </div>
    </div>
  );
}
