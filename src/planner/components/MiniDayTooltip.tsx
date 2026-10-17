/*
 * MiniDayTooltip - `#mini-day-tooltip.mini-day-tooltip` (prototype line 2999, `tooltipMarkup`,
 * `positionMiniTooltip`): the floating "Přehled dne" flyout of the mini-calendar. It is a child
 * of the STAGE (not of the sidebar, which clips), fixed at `left: 448px`, with `top` following
 * the hovered cell (`miniTooltipTop`).
 *
 * SHELL: the hidden element; `hidden` follows `mini.openDate`. TO DO by the owner of
 * MiniCalendarPanel (it is the same feature): content from `dayTooltipModel(ctx, date, pinned)`
 * (heading, percent, bars, stats, events, "Přejít na den" -> `act.selectDay`, "Obsazenost" ->
 * `act.openReservationDrawer`), pin / close buttons (`act.mini({ type: 'pin' | 'unpin' | 'hide' })`),
 * pointer-over-tip tracking (`pointerOverTip`) and the safe corridor (`isInsideSafeCorridor`).
 */
import { MINI_TOOLTIP_LEFT } from '../model';
import { usePlannerSelector } from '../state/PlannerStoreProvider';

export function MiniDayTooltip() {
  const openDate = usePlannerSelector((s) => s.mini.openDate);
  const pinned = usePlannerSelector((s) => s.mini.pinnedDate !== null);
  return (
    <div
      id="mini-day-tooltip"
      className={`mini-day-tooltip${pinned ? ' is-pinned' : ''}`}
      role="region"
      aria-label="Přehled dne"
      hidden={openDate === null}
      style={{ left: MINI_TOOLTIP_LEFT }}
      data-testid="mini-day-tooltip"
    />
  );
}
