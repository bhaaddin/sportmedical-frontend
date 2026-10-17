/*
 * MiniDayTooltip - `#mini-day-tooltip.mini-day-tooltip` (prototype `tooltipMarkup`, `positionMiniTooltip`,
 * `actuallyOpenMiniTooltip`, the flyout's click handler): the floating "Přehled dne" of the mini-calendar.
 * It is a child of the STAGE (not of the sidebar, which clips), fixed at `left: 448px`, with `top`
 * following the hovered cell (`miniTooltipTop`).
 *
 * Content comes from `dayTooltipModel` (the real sessions of the day: heading, percent, one bar per
 * činnost, planned time, term lines with their source). Pin / close buttons drive the mini state;
 * "Přejít na den" moves the board there, "Obsazenost" opens the reservation drawer. The document-level
 * rules of the prototype live here too: the safe corridor from the day to the flyout
 * (`isInsideSafeCorridor`), a press anywhere else resets to NEUTRAL, a right click on the days or while a
 * flyout is open resets as well.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { MINI_TOOLTIP_LEFT, dayTooltipModel, isInsideSafeCorridor, miniTooltipTop, type Box, type IsoDate } from '../model';
import { usePlannerActions, usePlannerSelector, usePlannerStore } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerCtx } from './context';
import { DAY_CELL_SELECTOR, getMiniController } from './left/miniController';
import { useStage } from './PlannerStage';
import './left/left.css';

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
};

const cellOf = (date: IsoDate): HTMLElement | null =>
  document.querySelector<HTMLElement>(`#mini-days [data-date="${date}"]`);

export function MiniDayTooltip() {
  const ctx = usePlannerCtx();
  const store = usePlannerStore();
  const act = usePlannerActions();
  const { scale, stageEl } = useStage();
  const controller = useMemo(() => getMiniController(store), [store]);
  const openDate = usePlannerSelector((s) => s.mini.openDate);
  const pinnedDate = usePlannerSelector((s) => s.mini.pinnedDate);
  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const pinned = pinnedDate !== null && pinnedDate === openDate;
  const model = openDate ? dayTooltipModel(ctx, openDate, pinned) : null;
  const visible = model !== null;
  const [top, setTop] = useState<number>(() => miniTooltipTop(0));

  // `top` follows the cell of the open day (design pixels: the stage is scaled, the rects are not).
  useLayoutEffect(() => {
    if (!openDate || !stageEl) return;
    const cell = cellOf(openDate);
    if (!cell) return;
    const raw = cell.getBoundingClientRect();
    const container = stageEl.getBoundingClientRect();
    setTop(miniTooltipTop((raw.top - container.top) / (scale || 1)));
  }, [openDate, calendarMonth, scale, stageEl, visible]);

  // A flyout whose day lost its terms (the data changed under it) closes itself.
  useEffect(() => {
    if (openDate && !model) controller.hide({ blur: false });
  }, [openDate, model, controller]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const m = store.getState().mini;
      const tip = document.getElementById('mini-day-tooltip');
      if (!tip || m.openDate === null || m.pinnedDate || e.pointerType === 'touch') return;
      const target = e.target instanceof Element ? e.target : null;
      const source = cellOf(m.openDate);
      const inside = isInsideSafeCorridor(
        e.clientX,
        e.clientY,
        source ? boxOf(source) : null,
        boxOf(tip),
        { tipVisible: true, pinned: false },
      );
      if (inside) {
        controller.cancelClose();
      } else if (target && !tip.contains(target) && !target.closest(DAY_CELL_SELECTOR) && !controller.hasClosePending()) {
        controller.scheduleHide();
      }
    };
    const onDown = (e: PointerEvent) => {
      const m = store.getState().mini;
      if (!m.pinnedDate && !m.zoomHoveredDate && m.openDate === null) return;
      const target = e.target instanceof Element ? e.target : null;
      const tip = document.getElementById('mini-day-tooltip');
      if (target && (tip?.contains(target) || target.closest(DAY_CELL_SELECTOR))) return;
      controller.hide();
    };
    const onContext = (e: MouseEvent) => {
      const m = store.getState().mini;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(DAY_CELL_SELECTOR)) e.preventDefault();
      if (m.pinnedDate || m.zoomHoveredDate || m.openDate !== null) controller.hide();
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('contextmenu', onContext);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('contextmenu', onContext);
    };
  }, [store, controller]);

  return (
    <div
      id="mini-day-tooltip"
      className={`mini-day-tooltip${pinned ? ' is-pinned' : ''}`}
      role="region"
      aria-label="Přehled dne"
      hidden={!visible}
      style={{ left: MINI_TOOLTIP_LEFT, top }}
      data-testid="mini-day-tooltip"
      onMouseEnter={() => controller.overTip(true)}
      onMouseLeave={() => controller.overTip(false)}
    >
      {model ? (
        <>
          <div className="tday-glint" />
          <div className="tday-padding">
            <div className="tday-overline-row">
              <div className="tday-overline">SPECTRUM · LIQUID CALENDAR</div>
              <div className="tday-top-controls">
                <span className={`tday-mode${pinned ? ' is-locked' : ''}`}>{pinned ? 'PŘIPNUTO' : 'NÁHLED'}</span>
                <button
                  type="button"
                  className={`tday-pin${pinned ? ' on' : ''}`}
                  data-mini-pin={model.date}
                  aria-label={pinned ? 'Odepnout detail' : 'Připnout detail'}
                  title={pinned ? 'Odepnout detail' : 'Připnout detail'}
                  aria-pressed={pinned}
                  onClick={() => act.mini(pinned ? { type: 'unpin', date: model.date } : { type: 'pin', date: model.date })}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m16 3 5 5-3 1-3 6-6-6 6-3 1-3Z" />
                    <path d="m9 15-6 6" />
                  </svg>
                </button>
                <button type="button" className="tday-x" data-mini-close="1" aria-label="Zavřít detail" title="Zavřít detail" onClick={() => controller.hide()}>
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div className="tday-heading">
              <div>
                <h3>{model.heading}</h3>
                <small>Přehled naplánovaného dne</small>
              </div>
              <div className="tday-pct">{model.percent}%</div>
            </div>
            <div className="tday-bar">
              {model.bars.map((bar) => (
                <i key={bar.categoryId} style={{ width: `${bar.widthPercent.toFixed(2)}%`, background: bar.color, color: bar.color }} />
              ))}
            </div>
            <div className="tday-caption"><span>{model.plannedLabel}</span><span>{model.referenceLabel}</span></div>
            <div className="tday-stats">
              <div className="tday-stat"><strong>{model.stats.terms}</strong><span>Termíny</span></div>
              <div className="tday-stat"><strong>{model.stats.slots}</strong><span>Sloty</span></div>
              <div className="tday-stat"><strong>{model.stats.plannedTime}</strong><span>Plánovaný čas</span></div>
            </div>
            <div className="tday-events">
              {model.events.map((event) => (
                <div className="tday-event" key={event.id} style={{ '--tone': event.tone } as React.CSSProperties}>
                  <i />
                  <div>
                    <strong>{event.name}</strong>
                    <small>{event.meta}</small>
                  </div>
                  <span>{event.slotsLabel}</span>
                </div>
              ))}
            </div>
            <div className="tday-actions">
              <button type="button" data-tooltip-day={model.date} onClick={() => { controller.hide(); act.selectDay(model.date); }}>
                Přejít na den
              </button>
              <button type="button" className="primary" data-tooltip-reservations={model.date} onClick={() => { controller.hide(); act.openReservationDrawer(model.date); }}>
                Obsazenost <Icon name="arrow-up-right" />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
