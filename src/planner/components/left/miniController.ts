/*
 * The timers of the mini-calendar's hover flyout (prototype `showMiniTooltip`,
 * `scheduleHideMiniTooltip`, `hideMiniTooltip`, `cancelMiniOpen`, `cancelMiniClose`).
 *
 * The decisions are pure and live in '../../model/mini.ts' (`miniHoverPlan`, `miniOpenTimerValid`,
 * `miniCloseTimerValid`); this file only owns the two timers and applies the plan to the store.
 * Two sibling components share one controller per store: the day buttons (enter / leave / focus /
 * click) and the flyout (pointer over the tip, the safe corridor), so the controller is looked up
 * by store instead of being passed down.
 */
import {
  MINI_HOVER_CLOSE_MS,
  computeDayPlan,
  miniCloseTimerValid,
  miniHoverPlan,
  miniOpenTimerValid,
  type IsoDate,
  type PlannerContext,
} from '../../model';
import type { PlannerStore } from '../../state/PlannerStoreProvider';
import { plannerActions } from '../../state/plannerState';
import { selectIsGesturing } from '../../state/selectors';

export const DAY_CELL_SELECTOR = '#mini-days .day-cell';

export interface MiniController {
  /** The context the "has this day any term" decision reads; set by the calendar on every render. */
  setContext(ctx: PlannerContext | null): void;
  /** `showMiniTooltip(date)` - hover or keyboard focus on a day. */
  show(date: IsoDate): void;
  /** `scheduleHideMiniTooltip()` - leaving a day, the flyout or the corridor. */
  scheduleHide(): void;
  /** `cancelMiniClose()` */
  cancelClose(): void;
  /** `cancelMiniOpen()` */
  cancelOpen(): void;
  /** `hideMiniTooltip(true)`: back to NEUTRAL. `blur` also drops the browser focus of a mouse-clicked day. */
  hide(options?: { blur?: boolean }): void;
  /** The pointer entered / left the flyout. */
  overTip(over: boolean): void;
  hasClosePending(): boolean;
  dispose(): void;
}

export function createMiniController(store: PlannerStore): MiniController {
  let ctx: PlannerContext | null = null;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  const dispatch = store.dispatch;
  const miniAction = (action: Parameters<typeof plannerActions.mini>[0]) => dispatch(plannerActions.mini(action));

  const clearOpenTimer = () => {
    if (openTimer !== null) clearTimeout(openTimer);
    openTimer = null;
  };
  const clearCloseTimer = () => {
    if (closeTimer !== null) clearTimeout(closeTimer);
    closeTimer = null;
  };

  const controller: MiniController = {
    setContext(next) {
      ctx = next;
    },
    cancelOpen() {
      clearOpenTimer();
      if (store.getState().mini.hoverCandidate !== null) miniAction({ type: 'clearCandidate' });
    },
    cancelClose: clearCloseTimer,
    hasClosePending: () => closeTimer !== null,
    show(date) {
      const state = store.getState();
      const dragging = selectIsGesturing(state);
      if (state.mini.pinnedDate || dragging) return;
      clearCloseTimer();
      clearOpenTimer();
      const hasEvents = ctx ? computeDayPlan(ctx, date).entries.length > 0 : false;
      const plan = miniHoverPlan(state.mini, date, hasEvents, dragging);
      if (plan.kind === 'ignore') return;
      miniAction({ type: 'hoverCandidate', date, zoomNow: plan.zoomNow });
      if (!plan.timer) return;
      const { delayMs, then } = plan.timer;
      openTimer = setTimeout(() => {
        openTimer = null;
        const now = store.getState();
        if (!miniOpenTimerValid(now.mini, date, selectIsGesturing(now))) return;
        if (then === 'open') {
          miniAction({ type: 'openFlyout', date, pinned: false });
        } else {
          // Moving deliberately onto an EMPTY day closes the previous flyout but keeps the hover zoom.
          miniAction({ type: 'zoomHover', date });
          miniAction({ type: 'closeFlyoutKeepZoom' });
        }
      }, delayMs);
    },
    scheduleHide() {
      controller.cancelOpen();
      if (store.getState().mini.pinnedDate) return;
      clearCloseTimer();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        if (!miniCloseTimerValid(store.getState().mini)) return;
        controller.hide({ blur: false });
      }, MINI_HOVER_CLOSE_MS);
    },
    hide(options = {}) {
      clearCloseTimer();
      clearOpenTimer();
      miniAction({ type: 'hide' });
      // A mouse-clicked day keeps the browser focus; after Esc / right click the next key press would
      // otherwise draw a focus square on it.
      if (options.blur !== false && typeof document !== 'undefined') {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.matches(DAY_CELL_SELECTOR)) active.blur();
      }
    },
    overTip(over) {
      miniAction({ type: 'pointerOverTip', value: over });
      if (over) {
        clearCloseTimer();
        controller.cancelOpen();
      } else {
        controller.scheduleHide();
      }
    },
    dispose() {
      clearOpenTimer();
      clearCloseTimer();
    },
  };
  return controller;
}

const controllers = new WeakMap<PlannerStore, MiniController>();

/** The one controller of a store (created on first use). */
export function getMiniController(store: PlannerStore): MiniController {
  let controller = controllers.get(store);
  if (!controller) {
    controller = createMiniController(store);
    controllers.set(store, controller);
  }
  return controller;
}
