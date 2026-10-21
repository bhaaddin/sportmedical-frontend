/*
 * What the month shows around the tiles while days are marked: the toggles for touch ("Vybrat od–do", "Vybrat víc
 * dnů" - a finger has no Ctrl key) with the hint for the mouse, and the tray of the marked places with what to do
 * with them. The tray sticks to the bottom of the month's panel, in the planner's own classes (the panel is inside the
 * scaled stage; a `position: fixed` bar there would be fixed to the stage, not the window).
 */
import { blockableRanges, daysIn } from '../../../model/daySelect';
import { isPastPicked, pickedLabel } from '../../../../components/booking/calendar/multiSelect';
import { PLANNER_TEXT } from '../../../text';
import type { IsoDate } from '../../../model';
import type { DaySelectApi } from './useDaySelect';

export function MonthTools({ select, club = false }: { select: DaySelectApi; club?: boolean }) {
  return (
    <div className="month-tools" data-testid="month-tools">
      <button
        type="button"
        className={`app-button${select.tapMode ? ' primary' : ''}`}
        aria-pressed={select.tapMode}
        data-testid="month-tool-range"
        title={PLANNER_TEXT.days.rangeModeHint}
        onClick={() => {
          select.clear();
          select.setTapMode(!select.tapMode);
        }}
      >
        {PLANNER_TEXT.days.rangeMode}
      </button>
      <button
        type="button"
        className={`app-button${select.additiveMode ? ' primary' : ''}`}
        aria-pressed={select.additiveMode}
        data-testid="month-tool-more"
        title={PLANNER_TEXT.days.additiveModeHint}
        onClick={() => select.setAdditiveMode(!select.additiveMode)}
      >
        {PLANNER_TEXT.days.additiveMode}
      </button>
      <span className="month-hint">{club ? PLANNER_TEXT.days.clubHint : PLANNER_TEXT.days.hint}</span>
    </div>
  );
}

export function DayTray({
  select,
  today,
  mayBlock,
  onBlock,
  club,
}: {
  select: DaySelectApi;
  today: IsoDate;
  mayBlock: boolean;
  onBlock: () => void;
  club?: { onPlan: () => void; busy: boolean };
}) {
  const places = select.places;
  if (places.length === 0) return null;
  const blockable = daysIn(blockableRanges(places, today));
  return (
    <div className="day-tray" role="region" aria-label={PLANNER_TEXT.days.selectionLabel} data-testid="day-tray">
      <strong className="day-tray-count">{PLANNER_TEXT.days.selectedCount(places.length)}</strong>
      <div className="day-tray-chips" data-testid="day-tray-chips">
        {places.map((place) => {
          const past = isPastPicked(place, today);
          const label = pickedLabel(place);
          return (
            <span key={place.id} className={`day-tray-chip${past ? ' is-past' : ''}`} data-testid="day-tray-chip" data-past={past ? 'true' : undefined}>
              {label}
              {past ? <em>{PLANNER_TEXT.days.past}</em> : null}
              <button type="button" aria-label={PLANNER_TEXT.days.removePlace(label)} onClick={() => select.remove(place.id)}>×</button>
            </span>
          );
        })}
      </div>
      <div className="day-tray-actions">
        {club ? (
          <button type="button" className="app-button primary" data-testid="day-tray-plan" disabled={club.busy || blockable === 0} onClick={club.onPlan}>
            {PLANNER_TEXT.days.planDays}
          </button>
        ) : mayBlock ? (
          <button type="button" className="app-button primary" data-testid="day-tray-block" disabled={blockable === 0} onClick={onBlock}>
            {PLANNER_TEXT.days.block}
          </button>
        ) : null}
        <button type="button" className="app-button" data-testid="day-tray-clear" onClick={select.clear}>
          {PLANNER_TEXT.days.clearSelection}
        </button>
      </div>
    </div>
  );
}
