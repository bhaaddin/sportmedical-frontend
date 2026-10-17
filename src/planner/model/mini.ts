/*
 * Mini-calendar interaction: the hover / pinned flyout, its safe corridor and
 * the three mutually exclusive zoom states (NEUTRAL, HOVER, PINNED).
 *
 * Port of `miniState`, `showMiniTooltip`, `scheduleHideMiniTooltip`,
 * `hideMiniTooltip`, `actuallyOpenMiniTooltip`, `pinMiniTooltip`,
 * `isInsideSafeCorridor`, `positionMiniTooltip`, `syncMiniActiveCells` and the
 * day-button click rule. The timers (120 / 245 / 220 ms) belong to the UI;
 * this file decides WHAT they do, as pure transitions on `MiniState`.
 *
 * `state.selectedDate` is only navigation metadata and never a visual fallback.
 */
import type { IsoDate } from './types';

export const MINI_HOVER_OPEN_MS = 120;
export const MINI_HOVER_SWITCH_MS = 245;
export const MINI_HOVER_CLOSE_MS = 220;

/** The flyout is a stage child at fixed `left`, only `top` follows the day cell. */
export const MINI_TOOLTIP_LEFT = 448;
export const MINI_TOOLTIP_TOP_MIN = 164;
export const MINI_TOOLTIP_TOP_MAX = 495;

export interface MiniState {
  hoverDate: IsoDate | null;
  /** The day whose flyout is open (null = flyout hidden). */
  openDate: IsoDate | null;
  pinnedDate: IsoDate | null;
  /** Hover zoom: works for EVERY date, even without terms. */
  zoomHoveredDate: IsoDate | null;
  hoverCandidate: IsoDate | null;
  isPointerOverTip: boolean;
}

export const initialMiniState: MiniState = {
  hoverDate: null,
  openDate: null,
  pinnedDate: null,
  zoomHoveredDate: null,
  hoverCandidate: null,
  isPointerOverTip: false,
};

export const miniTipVisible = (m: MiniState): boolean => m.openDate !== null;

/** `top` of the flyout for a cell whose top edge is `cellTopInDesignPx` below the stage top. */
export const miniTooltipTop = (cellTopInDesignPx: number): number =>
  Math.max(MINI_TOOLTIP_TOP_MIN, Math.min(MINI_TOOLTIP_TOP_MAX, cellTopInDesignPx - 85));

/* ------------------------------ transitions ------------------------------ */

export type MiniAction =
  | { type: 'hide' }
  | { type: 'clearCandidate' }
  | { type: 'hoverCandidate'; date: IsoDate; zoomNow: boolean }
  | { type: 'zoomHover'; date: IsoDate }
  | { type: 'openFlyout'; date: IsoDate; pinned: boolean }
  | { type: 'closeFlyoutKeepZoom' }
  | { type: 'pin'; date: IsoDate }
  | { type: 'unpin'; date: IsoDate }
  | { type: 'pinEmpty'; date: IsoDate }
  | { type: 'pointerOverTip'; value: boolean };

export function miniReduce(m: MiniState, a: MiniAction): MiniState {
  switch (a.type) {
    case 'hide':
      return { ...initialMiniState };
    case 'clearCandidate':
      return { ...m, hoverCandidate: null };
    case 'hoverCandidate':
      return { ...m, hoverCandidate: a.date, zoomHoveredDate: a.zoomNow ? a.date : m.zoomHoveredDate };
    case 'zoomHover':
      return { ...m, zoomHoveredDate: a.date };
    case 'openFlyout':
      return {
        ...m,
        hoverCandidate: null,
        openDate: a.date,
        hoverDate: a.date,
        pinnedDate: a.pinned ? a.date : m.pinnedDate,
        zoomHoveredDate: a.pinned ? null : a.date,
      };
    case 'closeFlyoutKeepZoom':
      return { ...m, openDate: null, hoverDate: null };
    case 'pin':
      return { ...m, pinnedDate: a.date };
    case 'unpin':
      // De-pinning returns to the soft hover context without changing the day.
      return { ...m, pinnedDate: null, zoomHoveredDate: a.date };
    case 'pinEmpty':
      // Empty date: pinned zoom is still meaningful. No fabricated popup.
      return { ...m, pinnedDate: a.date };
    case 'pointerOverTip':
      return { ...m, isPointerOverTip: a.value };
  }
}

/* ------------------------------ decisions ------------------------------ */

export type MiniHoverPlan =
  | { kind: 'ignore' }
  | {
      kind: 'hover';
      /** Zoom the hovered cell immediately (not while switching between flyouts). */
      zoomNow: boolean;
      /** null = no timer (empty day, or its flyout is already open). */
      timer: { delayMs: number; then: 'open' | 'closeFlyout' } | null;
    };

/** What `showMiniTooltip(date)` does. A pinned day or a running drag ignores all hover. */
export function miniHoverPlan(m: MiniState, date: IsoDate, hasEvents: boolean, dragging: boolean): MiniHoverPlan {
  if (m.pinnedDate || dragging) return { kind: 'ignore' };
  const tipHidden = !miniTipVisible(m);
  const switching = !tipHidden && m.openDate !== date;
  if (!switching && !hasEvents) return { kind: 'hover', zoomNow: true, timer: null };
  if (!switching && m.openDate === date && !tipHidden) return { kind: 'hover', zoomNow: true, timer: null };
  return {
    kind: 'hover',
    zoomNow: !switching,
    timer: { delayMs: switching ? MINI_HOVER_SWITCH_MS : MINI_HOVER_OPEN_MS, then: hasEvents ? 'open' : 'closeFlyout' },
  };
}

/** Is the open-timer still valid when it fires? */
export const miniOpenTimerValid = (m: MiniState, date: IsoDate, dragging: boolean): boolean =>
  !(m.pinnedDate || m.hoverCandidate !== date || dragging);

export type MiniClickPlan = 'unpin' | 'pinWithFlyout' | 'pinEmptyAndSelect';

/** What a click on a day button does. */
export function miniDayClickPlan(m: MiniState, date: IsoDate, hasEvents: boolean): MiniClickPlan {
  if (m.pinnedDate === date) return 'unpin';
  return hasEvents ? 'pinWithFlyout' : 'pinEmptyAndSelect';
}

/** The close timer may only hide when the pointer is neither over the flyout nor pinned. */
export const miniCloseTimerValid = (m: MiniState): boolean => !(m.isPointerOverTip || m.pinnedDate);

export interface ZoomFocus {
  focusDate: IsoDate | null;
  hasFocus: boolean;
  isPinned: boolean;
  zoomState: 'neutral' | 'hover' | 'pinned';
}

/** `syncMiniActiveCells`: which day (if any) has the zoom focus. */
export function miniZoomFocus(m: MiniState, visibleDates: readonly IsoDate[]): ZoomFocus {
  const focusDate = m.pinnedDate || m.zoomHoveredDate || null;
  const hasFocus = !!focusDate && visibleDates.includes(focusDate);
  const isPinned = hasFocus && !!m.pinnedDate;
  return {
    focusDate: hasFocus ? focusDate : null,
    hasFocus,
    isPinned,
    zoomState: isPinned ? 'pinned' : hasFocus ? 'hover' : 'neutral',
  };
}

export interface MiniCellFlags {
  focused: boolean;
  pinned: boolean;
  hoverAnchor: boolean;
  /** `aria-current="date"` */
  current: boolean;
}

export function miniCellFlags(m: MiniState, zoom: ZoomFocus, date: IsoDate, selectedDate: IsoDate): MiniCellFlags {
  const focused = zoom.hasFocus && zoom.focusDate === date;
  return {
    focused,
    pinned: focused && zoom.isPinned,
    hoverAnchor: !zoom.isPinned && m.openDate === date,
    current: date === selectedDate,
  };
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Floating flyout safety corridor: a move from the day cell to the popup stays
 * inside a widening funnel, even across neighbouring days. Coordinates are
 * client pixels (both rects are measured, so the stage scale cancels out).
 */
export function isInsideSafeCorridor(
  clientX: number,
  clientY: number,
  src: Box | null,
  dest: Box | null,
  opts: { tipVisible: boolean; pinned: boolean },
): boolean {
  if (!opts.tipVisible || !src || !dest || opts.pinned) return false;
  const x0 = src.right - 3;
  const x1 = dest.left + 6;
  if (clientX < x0 || clientX > x1 || x1 <= x0) return false;
  const proportion = Math.max(0, Math.min(1, (clientX - x0) / (x1 - x0)));
  const cy = src.top + (src.bottom - src.top) / 2;
  const min = (1 - proportion) * (cy - 27) + proportion * (dest.top - 16);
  const max = (1 - proportion) * (cy + 27) + proportion * (dest.bottom + 16);
  return clientY >= min && clientY <= max;
}
