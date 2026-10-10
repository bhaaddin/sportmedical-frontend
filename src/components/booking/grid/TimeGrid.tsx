import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Button, ButtonBase, ClickAwayListener, IconButton, Paper, Popover, Popper, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "react-i18next";
import { isTerminalStatus, statusTally } from "../../../api/bookingContracts";
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from "../../../api/bookingContracts";
import { pragueDateKey, type DateOnly } from "../../../utils/time";
import { drawnBlocksOfDay } from "./clubWindows";
import { CALENDAR_DISPLAY_OFFLINE, useCalendarDisplay } from "../../../api/displaySettings";
import { DESIGN } from "../../../theme";
import { StatusChip } from "../../ui/StatusChip";
import { errorText } from "../errorText";
import { AppointmentButton } from "./AppointmentButton";
import { AppointmentHoverCard } from "./AppointmentHoverCard";
import { BlockDetailDialog, BlockReasonDialog, type BlockTarget } from "./BlockDialogs";
import { calendarDayOpen, subColumnClosedLabel, type DayMark } from "./dayMarks";
import { dayBelongsTo, emphasis } from "./filters";
import { GRID_TEXT } from "./gridText";
import {
  columnStep,
  DRAG_THRESHOLD_PX,
  ghostLabel,
  glideFrom,
  moveRefusal,
  movedNoticeText,
  refusalText,
  rememberedNotify,
  samePlace,
  settle,
  snapMove,
  subscribeMoveNotice,
  TOUCH_DRAG_PRESS_MS,
  TOUCH_SCROLL_SLACK_PX,
  type MoveNotice,
  type MoveRefusal,
} from "./moveDrag";
import { nowLinePlacement } from "./nowLine";
import { longDate, minutesFree, reservationsCount, shortDate, weekdayShort } from "./periodTitle";
import { pxPerMinuteOf } from "./resolution";
import {
  dragRange,
  formatMinutes,
  localDateTime,
  minuteAt,
  parseTimeOfDay,
  rangeToInstants,
  selectionLabel,
  spanLabel,
  spanOnDay,
  touchesDay,
  type MinuteRange,
} from "./timeRange";
import type { ClubBlockPick } from "../calendar/ClubBlockPopover";
import { MoveConfirmDialog } from "../calendar/MoveConfirmDialog";
import {
  afternoonFree,
  appointmentInColumn,
  cleanHex,
  clubBlockDates,
  colourOfActivity,
  EMPTY_CATALOGUE,
  inRange,
  laneItemOf,
  layoutLanes,
  rangePill,
  workEndOf,
  type Catalogue,
  type ColumnSpec,
} from "../calendar/model";
import { InquiryChip } from "../calendar/InquiryChip";
import type { InquiryRef } from "../calendar/inquiries";
import { SelectionPopover } from "../calendar/SelectionPopover";
import { useDayRangeSurface, type DayRangeApi } from "../calendar/useDayRange";
import type { MultiSelectApi } from "../calendar/useMultiSelect";
import type { PickedTime } from "../calendar/multiSelect";
import { PickedBar } from "../calendar/PickedBar";
import { adjustPicked, busyIntervals, clampPainted, paintNote, tapBandStart, touchBandMinutes, withPastTime, type AdjustMode, type ClampResult } from "../calendar/pickLogic";

/*
 * The day and week grid - contract 5.1, drawn to the board of 3. 10. 2026
 * (Main, L01-Tyden, Z-60 / Z-30 / Z-10, N-Slot).
 *
 *   - **Columns are činnosti** in the day view (Matko's decision 10), one per
 *     činnost, grouped under the calendar that is their capacity container,
 *     each headed with its colour dot, its name and "N rezervací". In the week
 *     the columns are the days, with a sub-column per calendar when several
 *     are on screen. Simultaneous bookings (group bookings, parallel stations)
 *     sit in lanes side by side, never over each other; past three lanes the
 *     rest fold into a "+N" chip.
 *   - **Dragging.** Press on a free part of a column, drag across the slots,
 *     and the board's popover offers "Objednat pacienta" (bookings.create),
 *     "Zablokovat čas" (bookings.edit) and "Rezervovat pro klub". On touch a
 *     tap picks one slot and a long press starts a drag. In the week, a drag
 *     across the day HEADERS picks a run of days instead (the same popover).
 *   - **The now-line**, per the owner's rules in `nowLine.ts`.
 *   - **Blocks**: manual ones hatched grey with their reason; a club's block
 *     tinted with the club's colour and named, not bookable, opening the
 *     club's popover.
 *   - **Closed days** are one hatched block down the whole column saying why;
 *     a booking taken on such a day is drawn over the hatch.
 */

const SLOT_MINUTES = 30;
const GUTTER = 56;
/** Narrowest a činnost column may get before the grid scrolls sideways. */
const SUB_COLUMN_MIN = 170;
const LONG_PRESS_MS = 380;
/** The smallest tap target (px) of a slot when picking by touch. */
const TOUCH_TARGET_PX = 44;
/** A card shorter than this (px) is drawn as one line. */
const DENSE_BELOW = 40;

/** The board's hatch, in whatever colour the thing is: the owner's holiday or lunch colour. */
const hatchOf = (color: string) =>
  `repeating-linear-gradient(135deg, ${alpha(color, 0.22)} 0px, ${alpha(color, 0.22)} 7px, ${alpha(color, 0.07)} 7px, ${alpha(color, 0.07)} 14px)`;

export interface GridBookingRequest {
  calendarId: string;
  /** The činnost column it was dragged in, when the grid has činnost columns. */
  activityId?: string | null;
  dayKey: DateOnly;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. */
  start: string;
  end: string;
  /** The same range as instants, for whoever needs UTC (the club reservation). */
  startUtc: string;
  endUtc: string;
  /** Etapa 12: where in the viewport it was marked, so the booking opens as a bubble beside it (absent → the drawer). */
  anchor?: { x: number; y: number; width: number; height: number };
}

/** An appointment dropped on a new time. */
export interface GridMoveRequest {
  appointment: DayAppointment;
  calendarId: string;
  dayKey: DateOnly;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. */
  start: string;
  end: string;
  startUtc: string;
  endUtc: string;
  /**
   * "Upozornit klienta na změnu" (Etapa 12): the patient gets a notification and
   * an e-mail about the new time. On by default; the confirm popover's checkbox
   * carries the desk's choice here for the page and the API to pass on.
   */
  notifyPatient: boolean;
}

/** A card being dragged (Etapa 12): what is held, where it was taken hold of, and where it hovers now. */
interface Moving {
  appointment: DayAppointment;
  /** The calendar it came from (the row's, or its column's when the row names none). */
  fromCalendarId: string;
  /** How far (minutes) down the card the pointer took hold. */
  grabMinutes: number;
  length: number;
  pointerType: string;
  target: MoveTarget | null;
}

/** The column and snapped slot under the pointer while a card is dragged. */
export interface MoveTarget {
  columnKey: string;
  calendarId: string;
  activityId: string | null;
  dayKey: DateOnly;
  range: MinuteRange;
  /** `null`: the card may land here. */
  refusal: MoveRefusal | null;
}

/** A press on a card that has not become a drag yet. */
interface CardPress {
  appointment: DayAppointment;
  dayKey: DateOnly;
  spec: ColumnSpec;
  columnNode: HTMLElement | null;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  grabMinutes: number;
  length: number;
  timer: number | undefined;
  started: boolean;
}

/** A card drawn away from where the server has it: moved optimistically, waiting for the answer. */
interface Override {
  appointment: DayAppointment;
  startUtc: string;
  endUtc: string;
  /** The server has said yes; the override goes once the data shows the new time. */
  settled: boolean;
}

/**
 * "Výběr termínů" (a club order picked straight in the grid). While `active`, every drag ADDS a place (no popover);
 * the painted range is stopped only at what is taken (never at the minutes the order needs), picked ranges can be
 * resized, moved and removed, and refusals are reported through `onNote`.
 */
export interface GridPickMode {
  active: boolean;
  /** Only the calendars of the order's service may be picked. */
  allowedCalendar: (calendarId: string) => boolean;
  /** The clinic's today: nothing before it can be picked. */
  today: DateOnly;
  /** The clinic's current minute of today: time already gone cannot be picked. */
  nowMinute?: number;
  onNote: (text: string | null) => void;
  onAdjust: (id: string, range: MinuteRange) => void;
  onRemove: (id: string) => void;
  /** Picks the server named in a refusal. */
  conflictIds?: ReadonlySet<string>;
  /** Etapa 10: a short label of the činnosti a picked window is restricted to ("Spiroergometrie"); null = all. */
  tagOf?: (id: string) => string | null;
  /** Editing an order: its own club blocks do not count as taken (the picks start on top of them). */
  ignoreClubBlockIds?: ReadonlySet<string>;
}

interface Selection {
  columnKey: string;
  calendarId: string;
  activityId: string | null;
  dayKey: DateOnly;
  range: MinuteRange;
  x: number;
  y: number;
}

export interface TimeGridProps {
  days: DateOnly[];
  view: "day" | "week";
  selectedDay: DateOnly;
  calendars: Calendar[];
  appointmentsByDay: Map<string, DayAppointment[]>;
  previewByCalendar: Map<string, Map<string, PreviewDay>>;
  blocksByCalendar: Map<string, TimeBlock[]>;
  marks: Map<string, DayMark>;
  /** Whole hours drawn, `end` exclusive. */
  openSpan: { start: number; end: number };
  now: Date;
  employeeId: string | null;
  nowLineColor: string;
  holidayColor: string;
  /** `#RRGGBB` — the admin's colour for the lunch band (CalendarDisplaySettings); the offline default when absent. */
  lunchColor?: string;
  mayBook: boolean;
  mayBlock: boolean;
  onOpen: (id: string) => void;
  onBook: (request: GridBookingRequest) => void;
  /** Etapa 12: "Přidat do objednávky klubu" on the popover of a single dragged range - the page opens the picker. */
  onAddToClubOrder?: (selection: Selection) => void;
  onPickDay: (day: DateOnly) => void;
  /** Club orders that do not block time yet: a dashed chip under the header of their days. */
  inquiriesByDay?: Map<string, InquiryRef[]>;
  onOpenInquiry?: (orderId: string) => void;
  /** Vertical zoom multiplier for row height; 1 is the default density. */
  zoom?: number;
  /** Zoom by a step (±0.1), from ctrl/⌘+wheel over the grid. */
  onZoom?: (delta: number) => void;
  /** Minutes between grid lines - the "ROZLIŠENÍ" level. Defaults to a half hour. */
  resolutionStep?: number;
  /** The činnost columns of the day view (grouped by calendar). Absent: one column per calendar. */
  columns?: ColumnSpec[];
  /** Colours of činnosti and služby; absent: the calendar's colour. */
  catalogue?: Catalogue;
  /** On a tablet the week shows three days at a time and scrolls; the desktop shows seven. */
  device?: "tablet" | "desktop";
  /** Dragging across day headers (week) picks a run of days; the page owns the popover. */
  rangeSelect?: DayRangeApi;
  /** Several places at once: a Ctrl/⌘/Shift drag (or the touch toggle) adds to it instead of replacing. */
  multi?: MultiSelectApi;
  /** "Výběr termínů": painting adds places for a club order. */
  pick?: GridPickMode;
  /**
   * Touch picking in "výběr termínů": taps instead of long-press drags (tap the start, then the end), and a grid
   * tall enough that a slot is at least 44 px; on a narrow screen three day columns fit.
   */
  touchPick?: boolean;
  /** A click on a club's block: the page opens its popover. */
  onOpenClubBlock?: (pick: ClubBlockPick) => void;
  /**
   * Dragging a booking to another time of its own calendar (Etapa 12: a press
   * that travels, or a long press on touch; the ghost shows the snapped slot;
   * Esc snaps back). Without `onMoveCommit` the drop is handed here at once and
   * the card returns to its place - the page confirms and moves it the old way.
   */
  onMove?: (request: GridMoveRequest) => void;
  /**
   * The grid owns the move: the card stays drawn at the new slot and this
   * commits it (the page calls the API and refetches; a rejected promise glides
   * the card back and shows the server's sentence in the grid's own toast).
   * With `moveCommit: "confirm"` (the default) a small popover anchored to the
   * moved card asks first - "Přesunutí rezervace", "Upozornit klienta na změnu",
   * "Přesunout" / "Zrušit" - and `notifyPatient` carries the checkbox.
   */
  onMoveCommit?: (request: GridMoveRequest) => Promise<void>;
  /** `"confirm"` asks beside the card before committing (default); `"direct"` commits on the drop. */
  moveCommit?: "confirm" | "direct";
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

export function toRequest(
  calendarId: string,
  activityId: string | null,
  dayKey: DateOnly,
  range: MinuteRange,
): GridBookingRequest {
  const { startUtc, endUtc } = rangeToInstants(dayKey, range);
  return {
    calendarId,
    activityId,
    dayKey,
    start: localDateTime(dayKey, range.start),
    end: localDateTime(dayKey, range.end),
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
  };
}

export function TimeGrid(props: TimeGridProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    days,
    view,
    calendars,
    openSpan,
    marks,
    previewByCalendar,
    now,
    nowLineColor,
    holidayColor,
    lunchColor = CALENDAR_DISPLAY_OFFLINE.lunchColor,
    mayBook,
    mayBlock,
    zoom = 1,
    resolutionStep = SLOT_MINUTES,
    catalogue = EMPTY_CATALOGUE,
    device = "desktop",
    rangeSelect,
    multi,
    inquiriesByDay,
  } = props;
  const light = theme.palette.mode === "light";

  /* Zoom with the mouse: ctrl/⌘ + wheel over the grid, the way maps and editors
     do it. A native non-passive listener so preventDefault actually stops the
     page from zooming the browser; a plain wheel still scrolls the day. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const onZoomProp = props.onZoom;
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null || onZoomProp === undefined) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      onZoomProp(event.deltaY < 0 ? 0.1 : -0.1);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onZoomProp]);

  /* Zoom scales the whole vertical scale: the hour's height (46 / 52 / 78 px at
     the board's three levels) and, with it, every minute→pixel placement below. */
  const touchPick = props.touchPick === true && props.pick?.active === true;
  const pxPerMinute = touchPick ? Math.max(pxPerMinuteOf(zoom), TOUCH_TARGET_PX / SLOT_MINUTES) : pxPerMinuteOf(zoom);
  /* Touch picking: the first tap of a range waits here for the second. */
  const [tapAnchor, setTapAnchor] = useState<{ columnKey: string; dayKey: DateOnly; minute: number } | null>(null);
  const pickRunning = props.pick?.active === true;
  useEffect(() => {
    if (!pickRunning) setTapAnchor(null);
  }, [pickRunning]);

  const [pending, setPending] = useState<Selection | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [openBlock, setOpenBlock] = useState<{ calendar: Calendar; block: TimeBlock } | null>(
    null,
  );

  /* The sub-columns of a day: činnosti in the day view, calendars in the week. */
  const calendarSpecs: ColumnSpec[] = calendars.map((c) => ({
    key: c.id,
    calendarId: c.id,
    activityId: null,
    title: c.name,
    colorHex: c.color,
    serviceId: c.clinicServiceId,
    capacity: 1,
  }));
  const subSpecs: ColumnSpec[] = view === "day" && props.columns ? props.columns : calendarSpecs;
  const calendarOf = (id: string) => calendars.find((c) => c.id === id);
  const groupedByCalendar = calendars.length > 1 && view === "day" && props.columns !== undefined;

  const topMinute = openSpan.start * 60;
  const bottomMinute = openSpan.end * 60;
  const height = (bottomMinute - topMinute) * pxPerMinute;
  const hours = Array.from({ length: openSpan.end - openSpan.start }, (_, i) => openSpan.start + i);
  const dragEnabled = mayBook || mayBlock;
  const pendingCalendar = pending ? calendarOf(pending.calendarId) : undefined;
  const todayKey = pragueDateKey(now);

  /* ------------------------------------------------------------------------
   * Moving a card (Etapa 12). The press lives in a ref until it has travelled
   * far enough (or been held long enough on touch) to be a drag; from then on
   * `moving` holds the card and the snapped slot under the pointer, drawn as a
   * ghost in the target column. A drop commits: through `onMoveCommit` with the
   * card kept at its new slot (an override over the server's data), or the old
   * way through `onMove`. The rest - the summary on a click, the confirm
   * popover beside the moved card, the toast, the glide back - follows.
   * ---------------------------------------------------------------------- */
  const moveEnabled = mayBook && (props.onMove !== undefined || props.onMoveCommit !== undefined);
  const moveCommit = props.moveCommit ?? "confirm";
  const [moving, setMoving] = useState<Moving | null>(null);
  const movingRef = useRef<Moving | null>(null);
  movingRef.current = moving;
  const pressRef = useRef<CardPress | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /* A click that follows a drop is the browser's, not the desk's: swallowed once. */
  const justDraggedRef = useRef(false);
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map());
  const [proposal, setProposal] = useState<GridMoveRequest | null>(null);
  /* `undefined`: the moved card has not been looked up yet (the popover waits a layout pass for it). */
  const [proposalAnchor, setProposalAnchor] = useState<Element | null | undefined>(undefined);
  const [selected, setSelected] = useState<{ appointment: DayAppointment; element: HTMLElement; calendarName?: string } | null>(null);
  const [notice, setNotice] = useState<MoveNotice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  /* The card's rect at the slot it is leaving; the next layout glides it from there. */
  const flipRef = useRef<{ id: string; from: DOMRect } | null>(null);
  const { settings: displaySettings } = useCalendarDisplay();

  const showNotice = useCallback((next: MoveNotice) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(next);
    noticeTimer.current = window.setTimeout(() => setNotice(null), next.tone === "error" ? 6000 : 4000);
  }, []);
  useEffect(() => subscribeMoveNotice(showNotice), [showNotice]);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  /* What the columns draw: the server's bookings, with the moved ones at their new slot. */
  const shownByDay = useMemo(() => {
    if (overrides.size === 0) return props.appointmentsByDay;
    const out = new Map<string, DayAppointment[]>();
    for (const [day, list] of props.appointmentsByDay) out.set(day, list.filter((a) => !overrides.has(a.id)));
    for (const [, o] of overrides) {
      const day = pragueDateKey(o.startUtc);
      const moved: DayAppointment = { ...o.appointment, startUtc: o.startUtc, endUtc: o.endUtc };
      out.set(day, [...(out.get(day) ?? []), moved]);
    }
    return out;
  }, [props.appointmentsByDay, overrides]);

  /* A settled override goes once the server's data shows the card at its new time (or no longer at all). */
  useEffect(() => {
    if (overrides.size === 0) return;
    const stale: string[] = [];
    for (const [id, o] of overrides) {
      if (!o.settled) continue;
      let found: DayAppointment | undefined;
      for (const list of props.appointmentsByDay.values()) {
        found = list.find((a) => a.id === id);
        if (found) break;
      }
      if (found === undefined || new Date(found.startUtc).getTime() === new Date(o.startUtc).getTime()) stale.push(id);
    }
    if (stale.length === 0) return;
    setOverrides((current) => {
      const next = new Map(current);
      for (const id of stale) next.delete(id);
      return next;
    });
  }, [props.appointmentsByDay, overrides]);

  const cardElement = (id: string): HTMLElement | null =>
    scrollRef.current?.querySelector<HTMLElement>(`[data-testid="appointment-cell-${id}"]`) ?? null;

  const setOverride = (id: string, value: Override | null) =>
    setOverrides((current) => {
      const next = new Map(current);
      if (value === null) next.delete(id);
      else next.set(id, value);
      return next;
    });

  /* The card is drawn back where the server has it: glide it there from where it was. */
  const releaseOverride = (id: string) => {
    const element = cardElement(id);
    if (element) flipRef.current = { id, from: element.getBoundingClientRect() };
    setOverride(id, null);
  };
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (flip === null) return;
    flipRef.current = null;
    const element = cardElement(flip.id);
    if (element) glideFrom(element, flip.from);
  }, [overrides]);

  /* The confirm popover hangs off the moved card once it is drawn at its new slot. */
  useLayoutEffect(() => {
    if (proposal === null) {
      setProposalAnchor(undefined);
      return;
    }
    setProposalAnchor(cardElement(proposal.appointment.id));
  }, [proposal, overrides]);

  const targetAt = (press: CardPress, x: number, y: number, fromCalendarId: string): MoveTarget | null => {
    const under = typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
    const node = (under?.closest?.("[data-column-key]") as HTMLElement | null) ?? press.columnNode;
    if (!node) return null;
    const columnKey = node.dataset.columnKey ?? "";
    const dayKey = (node.dataset.dayKey ?? press.dayKey) as DateOnly;
    const spec = subSpecs.find((s) => s.key === columnKey);
    const calendar = spec ? calendarOf(spec.calendarId) : undefined;
    if (!spec || !calendar) return null;
    const row = previewByCalendar.get(calendar.id)?.get(dayKey);
    const mark = marks.get(dayKey) ?? OPEN_MARK;
    const open = calendarDayOpen(mark, row) && dayBelongsTo(row, props.employeeId);
    const rect = node.getBoundingClientRect();
    const range = snapMove({
      pointerOffsetPx: y - rect.top,
      grabMinutes: press.grabMinutes,
      length: press.length,
      step: columnStep(calendar, resolutionStep),
      pxPerMinute,
      topMinute,
      bottomMinute,
    });
    const refusal = moveRefusal({
      appointment: press.appointment,
      range,
      dayKey,
      sameColumn: calendar.id === fromCalendarId && (spec.activityId === null || spec.activityId === press.appointment.activityId),
      open,
      row,
      blocks: (props.blocksByCalendar.get(calendar.id) ?? []).filter((b) => touchesDay(b.startUtc, b.endUtc, dayKey)),
      others: (props.appointmentsByDay.get(dayKey) ?? []).filter((a) => appointmentInColumn(spec, a)),
      capacity: spec.capacity,
    });
    return { columnKey, calendarId: calendar.id, activityId: spec.activityId, dayKey, range, refusal };
  };

  const toMoveRequest = (appointment: DayAppointment, target: MoveTarget): GridMoveRequest => {
    const { startUtc, endUtc } = rangeToInstants(target.dayKey, target.range);
    return {
      appointment,
      calendarId: target.calendarId,
      dayKey: target.dayKey,
      start: localDateTime(target.dayKey, target.range.start),
      end: localDateTime(target.dayKey, target.range.end),
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
      notifyPatient: rememberedNotify(),
    };
  };

  /* The commit the grid owns: the card stays put; a refusal glides it back and says why. */
  const commitMove = (request: GridMoveRequest) => {
    const commit = props.onMoveCommit;
    if (!commit) return;
    const id = request.appointment.id;
    commit(request).then(
      () => {
        setOverrides((current) => {
          const o = current.get(id);
          if (!o) return current;
          const next = new Map(current);
          next.set(id, { ...o, settled: true });
          return next;
        });
        const element = cardElement(id);
        if (element) settle(element);
        showNotice({ text: movedNoticeText(request.notifyPatient), tone: "info" });
      },
      (error: unknown) => {
        releaseOverride(id);
        showNotice({ text: errorText(error, t), tone: "error" });
      },
    );
  };

  const cancelProposal = () => {
    if (proposal === null) return;
    setProposal(null);
    releaseOverride(proposal.appointment.id);
  };
  const confirmProposal = (request: GridMoveRequest) => {
    setProposal(null);
    commitMove(request);
  };

  const endPress = () => {
    const press = pressRef.current;
    if (press?.timer !== undefined) window.clearTimeout(press.timer);
    pressRef.current = null;
    const w = windowHandlers.current;
    window.removeEventListener("pointermove", w.move);
    window.removeEventListener("pointerup", w.up);
    window.removeEventListener("pointercancel", w.cancel);
  };

  const startDrag = (press: CardPress) => {
    press.started = true;
    if (press.timer !== undefined) window.clearTimeout(press.timer);
    press.timer = undefined;
    const fromCalendarId = press.appointment.calendarId ?? press.spec.calendarId;
    setSelected(null);
    setPending(null);
    const { x, y } = pointerRef.current;
    setMoving({
      appointment: press.appointment,
      fromCalendarId,
      grabMinutes: press.grabMinutes,
      length: press.length,
      pointerType: press.pointerType,
      target: targetAt(press, x, y, fromCalendarId),
    });
  };

  const cancelDrag = () => {
    const press = pressRef.current;
    if (press?.started) justDraggedRef.current = true;
    endPress();
    setMoving(null);
  };

  const dropCard = () => {
    const press = pressRef.current;
    const current = movingRef.current;
    endPress();
    setMoving(null);
    if (!press?.started || current === null) return;
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
    const target = current.target;
    if (target === null) return;
    if (samePlace(current.appointment, target.dayKey, target.range, target.calendarId, current.fromCalendarId)) return;
    if (target.refusal !== null) {
      showNotice({ text: `${GRID_TEXT.moveRefused} · ${refusalText(target.refusal)}`, tone: "error" });
      return;
    }
    const request = toMoveRequest(current.appointment, target);
    if (props.onMoveCommit === undefined) {
      props.onMove?.(request);
      return;
    }
    setOverride(request.appointment.id, {
      appointment: current.appointment,
      startUtc: request.startUtc,
      endUtc: request.endUtc,
      settled: false,
    });
    if (moveCommit === "direct") commitMove(request);
    else setProposal(request);
  };

  /* The window listeners live for one press; they read the latest closures through this ref. */
  const latest = useRef({ startDrag, cancelDrag, dropCard, targetAt });
  latest.current = { startDrag, cancelDrag, dropCard, targetAt };
  const windowHandlers = useRef({
    move: (event: PointerEvent) => {
      const press = pressRef.current;
      if (!press || event.pointerId !== press.pointerId) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (!press.started) {
        if (press.pointerType === "mouse") {
          if (distance > DRAG_THRESHOLD_PX) latest.current.startDrag(press);
        } else if (distance > TOUCH_SCROLL_SLACK_PX) {
          /* A finger that moves before the long press is scrolling. */
          latest.current.cancelDrag();
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      const current = movingRef.current;
      if (current === null) return;
      const target = latest.current.targetAt(press, event.clientX, event.clientY, current.fromCalendarId);
      setMoving((m) => {
        if (m === null) return m;
        const same =
          m.target === target ||
          (m.target !== null &&
            target !== null &&
            m.target.columnKey === target.columnKey &&
            m.target.dayKey === target.dayKey &&
            m.target.range.start === target.range.start &&
            m.target.refusal === target.refusal);
        return same ? m : { ...m, target };
      });
    },
    up: (event: PointerEvent) => {
      const press = pressRef.current;
      if (!press || event.pointerId !== press.pointerId) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (press.started) latest.current.dropCard();
      else latest.current.cancelDrag();
    },
    cancel: (event: PointerEvent) => {
      const press = pressRef.current;
      if (!press || event.pointerId !== press.pointerId) return;
      latest.current.cancelDrag();
    },
  });

  const cardPress = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>, appointment: DayAppointment, spec: ColumnSpec, dayKey: DateOnly) => {
      if (!moveEnabled || event.button !== 0 || isTerminalStatus(appointment.status)) return;
      if (pressRef.current !== null) return;
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const span = spanOnDay(appointment.startUtc, appointment.endUtc, dayKey);
      const press: CardPress = {
        appointment,
        dayKey,
        spec,
        columnNode: element.closest<HTMLElement>("[data-column-key]"),
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        pointerType: event.pointerType || "mouse",
        grabMinutes: Math.max(0, (event.clientY - rect.top) / pxPerMinute),
        length: Math.max(1, span.end - span.start),
        timer: undefined,
        started: false,
      };
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (press.pointerType !== "mouse") {
        press.timer = window.setTimeout(() => {
          if (pressRef.current === press && !press.started) latest.current.startDrag(press);
        }, TOUCH_DRAG_PRESS_MS);
      }
      pressRef.current = press;
      const w = windowHandlers.current;
      window.addEventListener("pointermove", w.move, { passive: false });
      window.addEventListener("pointerup", w.up);
      window.addEventListener("pointercancel", w.cancel);
    },
    onContextMenu: (event: React.MouseEvent) => {
      /* A long press on touch must become a drag, not the browser's menu. */
      if (pressRef.current !== null) event.preventDefault();
    },
  };
  /* An unmount mid-press must not leave listeners on the window. */
  useEffect(() => endPress, []);

  /* Esc drops the drag and snaps back; it also closes the summary. */
  useEffect(() => {
    if (moving === null && selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (movingRef.current !== null) {
        event.preventDefault();
        latest.current.cancelDrag();
      }
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moving, selected]);

  /* A dragged card must not also scroll the page under the finger. */
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    const onTouchMove = (event: TouchEvent) => {
      if (movingRef.current !== null && event.cancelable) event.preventDefault();
    };
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => node.removeEventListener("touchmove", onTouchMove);
  }, []);

  const selectCard = (appointment: DayAppointment, element: HTMLElement, calendarName?: string) => {
    setSelected((current) => (current?.appointment.id === appointment.id ? null : { appointment, element, calendarName }));
  };
  const openSelected = () => {
    if (selected === null) return;
    const id = selected.appointment.id;
    setSelected(null);
    props.onOpen(id);
  };

  /* How wide the scroll area is, so a tablet week can show exactly three days. */
  const [viewportWidth, setViewportWidth] = useState(0);
  const [overflow, setOverflow] = useState(false);
  const measure = useCallback(() => {
    const node = scrollRef.current;
    if (node === null) return;
    setOverflow(node.scrollWidth > node.clientWidth + 1);
    setViewportWidth(node.clientWidth);
  }, []);

  let dayMin: number;
  const narrowPick = touchPick && viewportWidth > 0 && viewportWidth < 600;
  const subMin = narrowPick ? 110 : SUB_COLUMN_MIN;
  if (view === "day") dayMin = Math.max(subMin, subSpecs.length * subMin);
  else if (device === "tablet" && viewportWidth > 0) dayMin = Math.max(Math.floor((viewportWidth - GUTTER) / 3), narrowPick ? 100 : 140);
  else dayMin = Math.max(150, calendars.length * 120);
  const template = `${GUTTER}px repeat(${days.length}, minmax(${dayMin}px, 1fr))`;
  const minWidth = GUTTER + days.length * dayMin;

  const rowsOf = (dayKey: string) =>
    calendars
      .map((c) => previewByCalendar.get(c.id)?.get(dayKey))
      .filter((row): row is PreviewDay => row !== undefined);

  const placementOf = (dayKey: string) =>
    nowLinePlacement({
      now,
      dayKey,
      view,
      rows: rowsOf(dayKey),
      closed: (marks.get(dayKey) ?? OPEN_MARK).closed,
    });
  /* The one column that is today and working, if it is on screen: the line
     runs across the whole grid from it, and the pill sits in the gutter. */
  const todayPlacement = days.map(placementOf).find((p) => p !== null) ?? null;
  const yOf = (minute: number) => (minute - topMinute) * pxPerMinute;

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver !== "undefined" && scrollRef.current
        ? new ResizeObserver(measure)
        : null;
    if (observer && scrollRef.current) observer.observe(scrollRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure, days.length, subSpecs.length, zoom]);
  const scrollByColumn = (direction: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: direction * dayMin, behavior: "smooth" });

  /* A drag or tap ended: it is the one selection (popover), or - Ctrl/⌘/Shift or the touch
     toggle - one more place in the tray. */
  const handleSelect = (selection: Selection, additive: boolean) => {
    if (multi && (additive || multi.touchMode)) {
      setPending(null);
      multi.add({
        kind: "time",
        columnKey: selection.columnKey,
        calendarId: selection.calendarId,
        activityId: selection.activityId,
        dayKey: selection.dayKey,
        range: selection.range,
      });
      return;
    }
    multi?.clear();
    setPending(selection);
  };

  const choose = (action: "book" | "block") => {
    if (!pending) return;
    const request = toRequest(pending.calendarId, pending.activityId, pending.dayKey, pending.range);
    if (action === "book") props.onBook({ ...request, anchor: { x: pending.x, y: pending.y, width: 0, height: 0 } });
    if (action === "block") {
      setBlockTarget({
        calendarId: pending.calendarId,
        calendarName: pendingCalendar?.name ?? "",
        dayKey: pending.dayKey,
        range: pending.range,
      });
    }
    setPending(null);
  };

  const addToClubOrder = () => {
    if (!pending) return;
    props.onAddToClubOrder?.(pending);
    setPending(null);
  };

  const live = (dayKey: string) =>
    (shownByDay.get(dayKey) ?? []).filter((a) => statusTally(a.status) !== "cancelled");
  const countIn = (dayKey: string, spec: ColumnSpec) =>
    live(dayKey).filter((a) => appointmentInColumn(spec, a)).length;
  /* The day view's second line: "3 rezervace", plus "· odpoledne volno" when nothing reaches the afternoon. */
  const columnSubtitle = (dayKey: string, spec: ColumnSpec) => {
    const mine = live(dayKey).filter((a) => appointmentInColumn(spec, a));
    const free =
      spec.activityId !== null &&
      afternoonFree({
        bookings: mine.map((a) => ({ start: laneItemOf(a, dayKey).start })),
        workEnd: workEndOf([previewByCalendar.get(spec.calendarId)?.get(dayKey)]),
      });
    return `${reservationsCount(mine.length)}${free ? ` · ${GRID_TEXT.afternoonFree}` : ""}`;
  };

  /* The chip in a day's header: SVÁTEK for a holiday, the label for a worked
     holiday or a day with nothing to book. A plain closed day says it down the
     column instead. */
  const headerChip = (mark: DayMark) => {
    if (mark.label === null) return null;
    if (mark.label === GRID_TEXT.publicHoliday) {
      return (
        <Tooltip title={mark.detail ?? ""}>
          <span>
            <StatusChip
              size="sm"
              sx={{ bgcolor: alpha(holidayColor, 0.16), color: holidayColor, letterSpacing: "0.06em" }}
            >
              {GRID_TEXT.holidayPill}
            </StatusChip>
          </span>
        </Tooltip>
      );
    }
    if (mark.closed) return null;
    return (
      <Tooltip title={mark.detail ?? ""}>
        <span>
          <StatusChip size="sm" tone={mark.redNumber ? "beige" : "grey"}>
            {mark.label}
          </StatusChip>
        </span>
      </Tooltip>
    );
  };

  const rangeEnabled = rangeSelect !== undefined && view === "week" && (mayBook || mayBlock);
  const highlight = rangeSelect?.highlight ?? null;
  useDayRangeSurface(scrollRef, rangeEnabled ? rangeSelect : undefined);

  const firstHighlighted = highlight ? days.find((d) => inRange(d, highlight)) : undefined;

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5 }}>
        {overflow ? <ScrollArrow direction={-1} onClick={() => scrollByColumn(-1)} /> : null}

        <Box
          ref={scrollRef}
          data-testid="time-grid-scroll"
          data-moving={moving !== null ? "true" : undefined}
          onClickCapture={(event) => {
            /* The click the browser fires after a drop is not a click on the card. */
            if (justDraggedRef.current) {
              justDraggedRef.current = false;
              event.stopPropagation();
              event.preventDefault();
            }
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: `${DESIGN.radius.lg}px`,
            bgcolor: "background.paper",
            cursor: moving !== null ? "grabbing" : undefined,
            "&[data-moving] *": { cursor: "grabbing !important" },
          }}
        >
          {/* Header row: one cell per day, the činnosti / calendars within. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: template,
              minWidth,
              bgcolor: "action.hover",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box />
            {days.map((dayKey) => {
              const mark = marks.get(dayKey) ?? OPEN_MARK;
              const emphasised = emphasis(dayKey, props.selectedDay, view) === "day";
              const today = dayKey === todayKey;
              const holiday = mark.label === GRID_TEXT.publicHoliday;
              const chip = headerChip(mark);
              const dateRow = view === "week" || mark.label !== null || mark.redNumber;
              const pickedNow = rangeSelect?.pickedState(dayKey) ?? null;
              const picked = inRange(dayKey, highlight) || pickedNow === "active";
              const pickedPast = !picked && pickedNow === "past";
              const weekendShut = mark.closed && !holiday;
              return (
                <Box
                  key={dayKey}
                  sx={{
                    position: "relative",
                    minWidth: 0,
                    borderLeft: "1px solid",
                    borderColor: "divider",
                    ...((inquiriesByDay?.get(dayKey) ?? []).some((i) => i.current)
                      ? { outline: "2px dashed", outlineColor: "primary.main", outlineOffset: -3 }
                      : {}),
                    bgcolor: picked
                      ? DESIGN.selection.bg
                      : pickedPast
                        ? alpha(DESIGN.selection.bg, 0.4)
                        : holiday
                        ? alpha(holidayColor, 0.1)
                        : today && view === "week"
                          ? alpha(theme.palette.text.primary, 0.05)
                          : weekendShut
                            ? alpha(theme.palette.text.primary, 0.025)
                            : undefined,
                  }}
                >
                  {dateRow ? (
                    <ButtonBase
                      data-range-day={dayKey}
                      data-testid={`day-header-${dayKey}`}
                      aria-current={emphasised ? "date" : undefined}
                      onPointerDown={(event) => {
                        if (!rangeEnabled || event.button !== 0 || rangeSelect?.tapMode) return;
                        rangeSelect?.begin(dayKey, event);
                      }}
                      onPointerEnter={() => rangeSelect?.enter(dayKey)}
                      onPointerUp={() => rangeSelect?.cancelPress()}
                      onPointerCancel={() => rangeSelect?.cancelPress()}
                      onClick={(event) => {
                        if (rangeEnabled && rangeSelect) {
                          if (rangeSelect.tapsSelect) {
                            rangeSelect.tap(dayKey, { x: event.clientX, y: event.clientY });
                            return;
                          }
                          if (rangeSelect.chosen) return;
                          if (rangeSelect.isAdditive(event)) return;
                        }
                        props.onPickDay(dayKey);
                      }}
                      sx={{
                        display: "block",
                        width: "100%",
                        minHeight: 44,
                        px: 1.5,
                        pt: 1,
                        pb: view === "week" ? 1 : 0.5,
                        textAlign: "left",
                        touchAction: "manipulation",
                        userSelect: "none",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography
                          component="span"
                          sx={{
                            fontWeight: today ? 700 : 600,
                            fontSize: 13,
                            color: holiday ? holidayColor : weekendShut ? "text.secondary" : "text.primary",
                          }}
                        >
                          {weekdayShort(dayKey)}
                        </Typography>
                        {today ? (
                          <StatusChip tone="primary" size="sm" sx={{ letterSpacing: "0.06em" }}>
                            {GRID_TEXT.todayPill}
                          </StatusChip>
                        ) : null}
                        {chip}
                      </Box>
                      <Typography
                        component="span"
                        data-testid={`day-number-${dayKey}`}
                        sx={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: mark.redNumber || emphasised ? 700 : 400,
                          color: mark.redNumber ? "error.main" : "text.secondary",
                        }}
                      >
                        {shortDate(dayKey)}
                      </Typography>
                    </ButtonBase>
                  ) : null}

                  {(inquiriesByDay?.get(dayKey) ?? []).length > 0 ? (
                    <Box data-testid={`inquiries-${dayKey}`} sx={{ display: "flex", flexDirection: "column", gap: 0.375, px: 1.25, pb: 0.5 }}>
                      {(inquiriesByDay?.get(dayKey) ?? []).slice(0, 2).map((inquiry) => (
                        <InquiryChip key={inquiry.orderId} inquiry={inquiry} {...(props.onOpenInquiry ? { onOpen: props.onOpenInquiry } : {})} />
                      ))}
                    </Box>
                  ) : null}

                  {picked && highlight && dayKey === firstHighlighted ? (
                    <Box
                      data-testid="range-pill"
                      sx={{
                        position: "absolute",
                        left: 4,
                        bottom: -12,
                        zIndex: 8,
                        px: 1.1,
                        py: "3px",
                        borderRadius: "6px",
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {rangePill(highlight)}
                    </Box>
                  ) : null}

                  {view === "day" ? (
                    <Box sx={{ display: "flex" }}>
                      {groupedByCalendar
                        ? groupSpecs(subSpecs).map((group, gi) => (
                            <Box
                              key={group.calendarId}
                              sx={{
                                flex: `${group.specs.length} 1 0`,
                                minWidth: 0,
                                borderLeft: gi === 0 ? "none" : "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Typography
                                sx={{
                                  px: 1.25,
                                  pt: 0.75,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "text.secondary",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {calendarOf(group.calendarId)?.name}
                              </Typography>
                              <Box sx={{ display: "flex" }}>
                                {group.specs.map((spec, i) => (
                                  <ColumnHeader
                                    key={spec.key}
                                    spec={spec}
                                    first={i === 0}
                                    subtitle={columnSubtitle(dayKey, spec)}
                                  />
                                ))}
                              </Box>
                            </Box>
                          ))
                        : subSpecs.map((spec, i) => (
                            <ColumnHeader
                              key={spec.key}
                              spec={spec}
                              first={i === 0}
                              subtitle={columnSubtitle(dayKey, spec)}
                            />
                          ))}
                    </Box>
                  ) : calendars.length > 1 ? (
                    <Box sx={{ display: "flex", px: 0.5, pb: 0.5, gap: 0.5 }}>
                      {calendars.map((calendar) => (
                        <Box
                          key={calendar.id}
                          title={`${calendar.name} · ${reservationsCount(
                            countIn(dayKey, {
                              key: calendar.id,
                              calendarId: calendar.id,
                              activityId: null,
                              title: calendar.name,
                              colorHex: calendar.color,
                              serviceId: null,
                              capacity: 1,
                            }),
                          )}`}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            px: 0.5,
                            fontSize: 10,
                            color: "text.secondary",
                            borderTop: `2px solid ${calendar.color}`,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {calendar.name}
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>

          {/* Body: the gutter and the day columns, with the now-line laid over all of them. */}
          <Box sx={{ position: "relative" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: template, minWidth }}>
              <Box sx={{ position: "relative", height }}>
                {hours.map((hour) => (
                  <Typography
                    key={hour}
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: Math.max(2, yOf(hour * 60) - 7),
                      fontSize: 11,
                      fontWeight: 400,
                      lineHeight: 1,
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </Typography>
                ))}
                {/* From the 15-minute level down the rows are tall enough to name the half hours too. */}
                {resolutionStep <= 15
                  ? hours.map((hour) => (
                      <Typography
                        key={`${hour}-half`}
                        aria-hidden
                        sx={{
                          position: "absolute",
                          right: 8,
                          top: yOf(hour * 60 + 30) - 6,
                          fontSize: 10,
                          lineHeight: 1,
                          color: "text.disabled",
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {String(hour).padStart(2, "0")}:30
                      </Typography>
                    ))
                  : null}
                {todayPlacement ? (
                  <Box
                    aria-hidden
                    data-testid="now-pill"
                    sx={{
                      position: "absolute",
                      left: 2,
                      top: yOf(todayPlacement.minute) - 9,
                      px: 0.625,
                      py: "2px",
                      borderRadius: `${DESIGN.radius.sm}px`,
                      bgcolor: nowLineColor,
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      fontVariantNumeric: "tabular-nums",
                      zIndex: 6,
                    }}
                  >
                    {formatMinutes(todayPlacement.minute)}
                  </Box>
                ) : null}
              </Box>

              {days.map((dayKey) => {
                const mark = marks.get(dayKey) ?? OPEN_MARK;
                const placement = placementOf(dayKey);
                const today = dayKey === todayKey;
                const holiday = mark.label === GRID_TEXT.publicHoliday;
                const appointments = shownByDay.get(dayKey) ?? [];
                const picked = inRange(dayKey, highlight);

                return (
                  <Box
                    key={dayKey}
                    data-testid={`day-column-${dayKey}`}
                    sx={{
                      position: "relative",
                      height,
                      display: "flex",
                      borderLeft: "1px solid",
                      borderColor: "divider",
                      bgcolor: today && view === "week"
                        ? light
                          ? DESIGN.page
                          : "action.selected"
                        : undefined,
                    }}
                  >
                    {subSpecs.map((spec) => {
                      const calendar = calendarOf(spec.calendarId);
                      if (!calendar) return null;
                      const row = previewByCalendar.get(calendar.id)?.get(dayKey);
                      const belongs = dayBelongsTo(row, props.employeeId);
                      return (
                        <SubColumn
                          key={spec.key}
                          spec={spec}
                          calendar={calendar}
                          dayKey={dayKey}
                          row={row}
                          dayClosed={mark.closed}
                          open={calendarDayOpen(mark, row) && belongs}
                          dragEnabled={dragEnabled}
                          appointments={appointments.filter((a) => appointmentInColumn(spec, a))}
                          blocks={(props.blocksByCalendar.get(calendar.id) ?? []).filter((b) =>
                            touchesDay(b.startUtc, b.endUtc, dayKey),
                          )}
                          allBlocks={props.blocksByCalendar.get(calendar.id) ?? []}
                          catalogue={catalogue}
                          topMinute={topMinute}
                          bottomMinute={bottomMinute}
                          pxPerMinute={pxPerMinute}
                          gridStep={resolutionStep}
                          lunchColor={lunchColor}
                          now={now}
                          pending={
                            pending?.columnKey === spec.key && pending.dayKey === dayKey
                              ? pending.range
                              : null
                          }
                          picked={(multi?.items ?? []).filter(
                            (i): i is PickedTime => i.kind === "time" && i.columnKey === spec.key && i.dayKey === dayKey,
                          )}
                          pickedPast={dayKey < todayKey}
                          pick={props.pick}
                          touchPick={touchPick}
                          tapAnchor={tapAnchor?.columnKey === spec.key && tapAnchor.dayKey === dayKey ? tapAnchor.minute : null}
                          onTapAnchor={(minute) => setTapAnchor(minute === null ? null : { columnKey: spec.key, dayKey, minute })}
                          onSelect={handleSelect}
                          onOpen={(id) => {
                            setSelected(null);
                            props.onOpen(id);
                          }}
                          onOpenBlock={(block) => setOpenBlock({ calendar, block })}
                          onOpenClubBlock={props.onOpenClubBlock}
                          moveEnabled={moveEnabled}
                          cardPress={cardPress}
                          movingId={moving?.appointment.id ?? null}
                          ghost={
                            moving !== null && moving.target !== null && moving.target.columnKey === spec.key && moving.target.dayKey === dayKey
                              ? { appointment: moving.appointment, range: moving.target.range, refusal: moving.target.refusal }
                              : null
                          }
                          proposalId={proposal?.appointment.id ?? null}
                          selectedId={selected?.appointment.id ?? null}
                          onSelectCard={(appointment, element) => selectCard(appointment, element, calendar.name)}
                        />
                      );
                    })}

                    {/*
                      A closed day — a public holiday or a clinic closure — is one
                      hatched block down the whole column, not the day chopped into
                      bookable cells (owner: "místo 2× dvě políčka po patnácti tak
                      bude celý políčko"), with the reason written on it. A holiday
                      wears the owner's holiday colour; anything else is grey. It sits
                      over the sub-columns and under the now-line, and takes no clicks.
                    */}
                    {mark.closed && mark.label ? (
                      <Box
                        aria-hidden
                        data-testid={`closed-block-${dayKey}`}
                        sx={{
                          position: "absolute",
                          inset: "1px 3px",
                          zIndex: 4,
                          pointerEvents: "none",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          px: 1,
                          borderRadius: `${DESIGN.radius.sm}px`,
                          border: `1px dashed ${holiday ? alpha(holidayColor, 0.7) : DESIGN.hatch.closedLine}`,
                          backgroundImage: holiday ? hatchOf(holidayColor) : DESIGN.hatch.closed,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            letterSpacing: "0.03em",
                            color: holiday ? DESIGN.hatch.holidayInk : DESIGN.muted,
                          }}
                        >
                          {holiday ? GRID_TEXT.holidayClosed : mark.label}
                        </Typography>
                        {mark.detail ? (
                          <Typography
                            sx={{ fontSize: 11, color: holiday ? DESIGN.hatch.holidayInk : DESIGN.muted, opacity: 0.85 }}
                          >
                            {mark.detail}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}

                    {picked ? (
                      <Box
                        aria-hidden
                        data-testid={`range-overlay-${dayKey}`}
                        sx={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 3,
                          pointerEvents: "none",
                          bgcolor: alpha(DESIGN.selection.line, 0.1),
                          borderLeft: `2px solid ${DESIGN.selection.line}`,
                          borderRight: `2px solid ${DESIGN.selection.line}`,
                        }}
                      />
                    ) : null}

                    {placement?.verticalLines
                      ? (["left", "right"] as const).map((edge) => (
                          <Box
                            key={edge}
                            aria-hidden
                            data-testid={`now-edge-${edge}`}
                            sx={{
                              position: "absolute",
                              [edge]: 0,
                              width: 2,
                              top: yOf(Math.max(placement.span.start, topMinute)),
                              height:
                                (Math.min(placement.span.end, bottomMinute) -
                                  Math.max(placement.span.start, topMinute)) *
                                pxPerMinute,
                              backgroundColor: alpha(nowLineColor, 0.55),
                              pointerEvents: "none",
                              zIndex: 5,
                            }}
                          />
                        ))
                      : null}
                  </Box>
                );
              })}
            </Box>

            {todayPlacement ? (
              <Box
                role="img"
                aria-label={t("booking.grid.now")}
                data-testid="now-line"
                sx={{
                  position: "absolute",
                  left: GUTTER,
                  right: 0,
                  top: yOf(todayPlacement.minute),
                  height: 0,
                  borderTop: `2px solid ${nowLineColor}`,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
            ) : null}
          </Box>
        </Box>

        {overflow ? <ScrollArrow direction={1} onClick={() => scrollByColumn(1)} /> : null}
      </Box>

      <Legend holidayColor={holidayColor} nowLineColor={nowLineColor} />

      {/* The board's popover (N-Slot): what to do with the time just dragged. */}
      <SelectionPopover
        anchor={pending ? { x: pending.x, y: pending.y } : null}
        title={pending ? spanLabel(pending.range) : ""}
        subtitle={
          pending
            ? `${longDate(pending.dayKey, false)} · ${minutesFree(pending.range.end - pending.range.start)}`
            : ""
        }
        caption={pendingCalendar?.name}
        mayBook={mayBook}
        mayBlock={mayBlock}
        onBook={() => choose("book")}
        onBlock={() => choose("block")}
        onAddToClubOrder={props.onAddToClubOrder ? addToClubOrder : undefined}
        onClose={() => setPending(null)}
      />

      {blockTarget ? (
        <BlockReasonDialog target={blockTarget} onClose={() => setBlockTarget(null)} />
      ) : null}

      {openBlock ? (
        <BlockDetailDialog
          calendarId={openBlock.calendar.id}
          calendarName={openBlock.calendar.name}
          block={openBlock.block}
          mayRemove={mayBlock}
          onClose={() => setOpenBlock(null)}
        />
      ) : null}

      {/* One click on a card: it is highlighted and this summary sits beside it (no backdrop - the next click
          lands where it was aimed). Double click, Enter or "Otevřít detail" open the appointment itself. */}
      <Popper
        open={selected !== null && selected.element.isConnected && moving === null}
        anchorEl={selected !== null && selected.element.isConnected ? selected.element : null}
        placement="right-start"
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }, { name: "flip", enabled: true }, { name: "preventOverflow", options: { padding: 8 } }]}
        sx={{ zIndex: (th) => th.zIndex.modal - 1 }}
      >
        {selected ? (
          <ClickAwayListener onClickAway={() => setSelected(null)} mouseEvent="onPointerDown" touchEvent="onTouchStart">
            <Paper
              role="dialog"
              aria-label={GRID_TEXT.openDetail}
              data-testid="appointment-summary"
              sx={{ p: 1, borderRadius: "10px", boxShadow: DESIGN.shadow.menu, border: "1px solid", borderColor: "divider", maxWidth: 300 }}
            >
              <AppointmentHoverCard
                appointment={selected.appointment}
                calendarName={selected.calendarName}
                fields={displaySettings.hoverFields}
              />
              <Button size="small" onClick={openSelected} sx={{ mt: 0.5, minHeight: 36, width: "100%" }}>
                {GRID_TEXT.openDetail}
              </Button>
            </Paper>
          </ClickAwayListener>
        ) : null}
      </Popper>

      {/* The drop in "confirm" mode: the card already sits in its new slot, the popover hangs off it. */}
      {proposal && proposalAnchor !== undefined ? (
        <MoveConfirmDialog
          key={proposal.appointment.id}
          move={proposal}
          anchorEl={proposalAnchor?.isConnected ? proposalAnchor : null}
          onClose={cancelProposal}
          onConfirm={confirmProposal}
        />
      ) : null}

      {/* The grid's own toast: a move kept, or why one was refused. Never a modal. */}
      {notice ? (
        <Box
          role="status"
          data-testid="grid-notice"
          data-tone={notice.tone}
          sx={{
            position: "absolute",
            left: "50%",
            bottom: 52,
            transform: "translateX(-50%)",
            zIndex: 7,
            maxWidth: "calc(100% - 32px)",
            px: 1.75,
            py: 1,
            borderRadius: "10px",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
            bgcolor: notice.tone === "error" ? DESIGN.tone.red.bg : theme.palette.text.primary,
            color: notice.tone === "error" ? DESIGN.danger : theme.palette.background.paper,
            border: notice.tone === "error" ? `1px solid ${DESIGN.tone.red.line}` : "none",
            boxShadow: DESIGN.shadow.menu,
            pointerEvents: "none",
          }}
        >
          {notice.text}
        </Box>
      ) : null}
    </Box>
  );
}

/** Consecutive specs of one calendar, for the group band over the činnost headers. */
function groupSpecs(specs: readonly ColumnSpec[]) {
  const groups: { calendarId: string; specs: ColumnSpec[] }[] = [];
  for (const spec of specs) {
    const last = groups[groups.length - 1];
    if (last && last.calendarId === spec.calendarId) last.specs.push(spec);
    else groups.push({ calendarId: spec.calendarId, specs: [spec] });
  }
  return groups;
}

function ColumnHeader({ spec, first, subtitle }: { spec: ColumnSpec; first: boolean; subtitle: string }) {
  return (
    <Box
      data-testid={`column-header-${spec.key}`}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1.25,
        py: 1.1,
        borderLeft: first ? "none" : "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.875, minWidth: 0 }}>
        <Box
          aria-hidden
          data-testid={`column-dot-${spec.key}`}
          sx={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, bgcolor: spec.colorHex }}
        />
        <Typography
          component="h3"
          sx={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {spec.title}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

function ScrollArrow({ direction, onClick }: { direction: -1 | 1; onClick: () => void }) {
  const label = direction < 0 ? GRID_TEXT.scrollLeft : GRID_TEXT.scrollRight;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: `${DESIGN.radius.lg}px`,
        bgcolor: "action.hover",
      }}
    >
      <IconButton size="small" aria-label={label} title={label} onClick={onClick} sx={{ width: 32, height: 56 }}>
        {direction < 0 ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}

/** The key under the grid: Právě vybíráte · Obsazeno · Zablokováno · Svátek · Aktuální čas. */
function Legend({ holidayColor, nowLineColor }: { holidayColor: string; nowLineColor: string }) {
  const theme = useTheme();
  const swatch = { width: 13, height: 13, borderRadius: "4px", flexShrink: 0 } as const;
  const items: { label: string; box: React.ReactNode }[] = [
    {
      label: GRID_TEXT.legendSelecting,
      box: (
        <Box
          sx={{
            ...swatch,
            border: `2px solid ${DESIGN.selection.line}`,
            bgcolor: DESIGN.selection.bg,
          }}
        />
      ),
    },
    {
      label: GRID_TEXT.legendBooked,
      box: (
        <Box
          sx={{
            ...swatch,
            bgcolor: DESIGN.appointment.bg,
            borderLeft: `3px solid ${theme.palette.text.secondary}`,
          }}
        />
      ),
    },
    {
      label: GRID_TEXT.legendBlocked,
      box: (
        <Box
          sx={{
            ...swatch,
            backgroundImage: DESIGN.hatch.closed,
            border: `1px dashed ${DESIGN.hatch.closedLine}`,
          }}
        />
      ),
    },
    {
      label: GRID_TEXT.legendHoliday,
      box: (
        <Box
          sx={{
            ...swatch,
            backgroundImage: hatchOf(holidayColor),
            border: `1px dashed ${alpha(holidayColor, 0.7)}`,
          }}
        />
      ),
    },
    {
      label: GRID_TEXT.legendNow,
      box: <Box sx={{ width: 13, height: 0, borderTop: `2px solid ${nowLineColor}`, flexShrink: 0 }} />,
    },
  ];
  return (
    <Box aria-hidden sx={{ display: "flex", flexWrap: "wrap", gap: 2.75, mt: 1.5, px: 0.5 }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.875 }}>
          {item.box}
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const additiveKey = (event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
  event.ctrlKey || event.metaKey || event.shiftKey;

function SubColumn({
  spec,
  calendar,
  dayKey,
  row,
  dayClosed,
  open,
  dragEnabled,
  appointments,
  blocks,
  allBlocks,
  catalogue,
  topMinute,
  bottomMinute,
  pxPerMinute,
  gridStep,
  now,
  pending,
  picked,
  pickedPast,
  pick,
  touchPick,
  tapAnchor,
  onTapAnchor,
  onSelect,
  onOpen,
  onOpenBlock,
  onOpenClubBlock,
  moveEnabled,
  cardPress,
  movingId,
  ghost,
  proposalId,
  selectedId,
  onSelectCard,
  lunchColor,
}: {
  spec: ColumnSpec;
  calendar: Calendar;
  dayKey: DateOnly;
  row: PreviewDay | undefined;
  /** The whole day is shut - the column-wide block says why, so this one stays quiet. */
  dayClosed: boolean;
  open: boolean;
  dragEnabled: boolean;
  appointments: DayAppointment[];
  /** The admin's lunch-band colour, from CalendarDisplaySettings — not the theme's error red. */
  lunchColor: string;
  /** The calendar's blocks touching this day. */
  blocks: TimeBlock[];
  /** All of the calendar's blocks in view, to name how far a club's block reaches. */
  allBlocks: TimeBlock[];
  catalogue: Catalogue;
  topMinute: number;
  bottomMinute: number;
  pxPerMinute: number;
  /** Minutes between the grid lines drawn. */
  gridStep: number;
  now: Date;
  pending: MinuteRange | null;
  /** The places marked for the tray that fall in this column and day. */
  picked: PickedTime[];
  /** The day is before today: the marks are drawn muted. */
  pickedPast: boolean;
  pick?: GridPickMode;
  touchPick: boolean;
  /** Touch picking: the minute of the first tap in this column and day, waiting for the end. */
  tapAnchor: number | null;
  onTapAnchor: (minute: number | null) => void;
  onSelect: (selection: Selection, additive: boolean) => void;
  onOpen: (id: string) => void;
  onOpenBlock: (block: TimeBlock) => void;
  onOpenClubBlock?: (pick: ClubBlockPick) => void;
  /** Cards may be dragged to another time (bookings.create and a mover on the grid). */
  moveEnabled: boolean;
  /** The grid's pointer handling of a card press: the drag, or the click it stays. */
  cardPress: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>, appointment: DayAppointment, spec: ColumnSpec, dayKey: DateOnly) => void;
    onContextMenu: (event: React.MouseEvent) => void;
  };
  /** The card being dragged: drawn faded where it still is. */
  movingId: string | null;
  /** The dragged card's shadow in this column: the snapped slot, red when it cannot land. */
  ghost: { appointment: DayAppointment; range: MinuteRange; refusal: MoveRefusal | null } | null;
  /** The card sitting in its new slot while the confirm popover is open. */
  proposalId: string | null;
  /** The card a click picked out. */
  selectedId: string | null;
  onSelectCard: (appointment: DayAppointment, element: HTMLElement) => void;
}) {
  const theme = useTheme();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const [folded, setFolded] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  /* A touch press: waits for a long press to become a drag; a tap picks one slot. */
  const touch = useRef<{
    x: number;
    y: number;
    minute: number;
    timer: number | undefined;
    dragging: boolean;
  } | null>(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    draggingRef.current = drag !== null;
  }, [drag]);

  /* A drag snaps to the calendar's own step, or to the finer grid when the
     grid has been zoomed below it - what is drawn is what can be aimed at. */
  const step = columnStep(calendar, gridStep);
  const bounds = { start: topMinute, end: bottomMinute };
  const canDrag = dragEnabled && open;
  const painting = pick?.active === true;
  /* "Výběr termínů": what a paint from `anchor` to `current` may become here (stopped at what is taken and at the need). */
  const busyHere = (ignoreId?: string) =>
    withPastTime(
      busyIntervals({
      dayKey,
      ...(row !== undefined
        ? { row: { isOpen: row.isOpen, startTime: row.startTime, endTime: row.endTime, breakStart: row.breakStart, breakEnd: row.breakEnd } }
        : {}),
      appointments,
      blocks: pick?.ignoreClubBlockIds === undefined ? blocks : blocks.filter((b) => b.clubBlockId == null || !pick.ignoreClubBlockIds?.has(b.clubBlockId)),
      picks: picked,
      ...(ignoreId !== undefined ? { ignoreId } : {}),
      }),
      pick !== undefined && dayKey === pick.today ? (pick.nowMinute ?? 0) : 0,
    );
  const paint = (anchor: number, current: number): ClampResult => {
    const none = { trimmedBusy: false };
    if (pick === undefined) return { range: null, ...none };
    if (!pick.allowedCalendar(calendar.id)) return { range: null, refused: "service", ...none };
    if (dayKey < pick.today) return { range: null, refused: "past", ...none };
    const wanted = dragRange(anchor, current, step, bounds);
    const direction = Math.floor(current / step) < Math.floor(anchor / step) ? "up" : "down";
    if (dayKey === pick.today && pick.nowMinute !== undefined && (direction === "down" ? wanted.start : wanted.end - 1) < pick.nowMinute) {
      return { range: null, refused: "past", ...none };
    }
    return clampPainted({
      range: wanted,
      direction,
      busy: busyHere(),
    });
  };
  const [adjust, setAdjust] = useState<{ id: string; range: MinuteRange } | null>(null);
  const liveRange = drag ? (painting ? paint(drag.anchor, drag.current).range : dragRange(drag.anchor, drag.current, step, bounds)) : painting ? null : pending;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    /* A drag on a touch screen must not also scroll the page. */
    const onTouchMove = (event: TouchEvent) => {
      if (draggingRef.current && event.cancelable) event.preventDefault();
    };
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => node.removeEventListener("touchmove", onTouchMove);
  }, []);
  useEffect(
    () => () => {
      if (touch.current?.timer !== undefined) window.clearTimeout(touch.current.timer);
    },
    [],
  );

  const place = (range: MinuteRange) => {
    const start = Math.max(range.start, topMinute);
    const end = Math.min(range.end, bottomMinute);
    return {
      top: (start - topMinute) * pxPerMinute,
      height: Math.max(0, (end - start) * pxPerMinute),
    };
  };

  const workStart = row?.isOpen ? parseTimeOfDay(row.startTime) : null;
  const workEnd = row?.isOpen ? parseTimeOfDay(row.endTime) : null;
  const breakStart = row?.isOpen ? parseTimeOfDay(row.breakStart) : null;
  const breakEnd = row?.isOpen ? parseTimeOfDay(row.breakEnd) : null;
  /* This calendar alone is shut today while the day itself is open. */
  const ownClosed = row !== undefined && !row.isOpen && !dayClosed;
  /* A column nobody may drag on is shaded whole - unless it carries its own
     closed block, which says why instead. Without a preview row nothing is
     known about the hours, so an open column is left clear. */
  const shade = alpha(theme.palette.text.primary, 0.035);
  const shadeWhole = !open && !ownClosed;

  const minuteOf = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return minuteAt(event.clientY - rect.top, pxPerMinute, topMinute);
  };

  const hourLine = `repeating-linear-gradient(to bottom, transparent 0, transparent ${60 * pxPerMinute - 1}px, ${theme.palette.divider} ${60 * pxPerMinute - 1}px, ${theme.palette.divider} ${60 * pxPerMinute}px)`;
  const stepLine =
    gridStep > 0 && gridStep < 60
      ? `, repeating-linear-gradient(to bottom, transparent 0, transparent ${gridStep * pxPerMinute - 1}px, ${alpha(theme.palette.divider, 0.6)} ${gridStep * pxPerMinute - 1}px, ${alpha(theme.palette.divider, 0.6)} ${gridStep * pxPerMinute}px)`
      : "";

  const select = (range: MinuteRange, x: number, y: number, additive = false) =>
    onSelect(
      {
        columnKey: spec.key,
        calendarId: calendar.id,
        activityId: spec.activityId,
        dayKey,
        range,
        x,
        y,
      },
      additive,
    );

  /* A press ended: a paint in "výběr termínů" (clamped, always one more place), else the ordinary selection. */
  const commit = (anchor: number, current: number, x: number, y: number, additive: boolean) => {
    if (painting && pick !== undefined) {
      const result = paint(anchor, current);
      pick.onNote(paintNote(result));
      if (result.range !== null) select(result.range, x, y, true);
      return;
    }
    select(dragRange(anchor, current, step, bounds), x, y, additive);
  };

  /* Simultaneous bookings in lanes. */
  const layout = layoutLanes(appointments.map((a) => laneItemOf(a, dayKey)));
  const byId = new Map(appointments.map((a) => [a.id, a]));

  const testId =
    spec.activityId === null
      ? `sub-column-${calendar.id}-${dayKey}`
      : `sub-column-${calendar.id}:${spec.activityId}-${dayKey}`;

  return (
    <Box
      ref={nodeRef}
      data-testid={testId}
      data-column-key={spec.key}
      data-day-key={dayKey}
      onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
        if (!canDrag || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("[data-grid-item]")) return;
        const minute = minuteOf(event);
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          const press = {
            x: event.clientX,
            y: event.clientY,
            minute,
            dragging: false,
            timer: undefined as number | undefined,
          };
          press.timer = window.setTimeout(() => {
            press.dragging = true;
            setDrag({ anchor: minute, current: minute });
          }, LONG_PRESS_MS);
          touch.current = press;
          return;
        }
        const element = event.currentTarget;
        if (typeof element.setPointerCapture === "function") {
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            /* A pointer the browser no longer tracks; the drag still works inside the column. */
          }
        }
        setDrag({ anchor: minute, current: minute });
        event.preventDefault();
      }}
      onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
        const press = touch.current;
        if (press && !press.dragging) {
          /* Moving before the long press is a scroll, not a drag. */
          if (Math.abs(event.clientX - press.x) > 8 || Math.abs(event.clientY - press.y) > 8) {
            window.clearTimeout(press.timer);
            touch.current = null;
          }
          return;
        }
        if (!drag) return;
        const minute = minuteOf(event);
        setDrag((current) => (current ? { ...current, current: minute } : current));
      }}
      onPointerUp={(event: React.PointerEvent<HTMLDivElement>) => {
        const press = touch.current;
        if (press) {
          touch.current = null;
          window.clearTimeout(press.timer);
          if (!press.dragging) {
            if (painting && touchPick && pick !== undefined) {
              /* Tap the start, then tap the end: the range between them (the same slot twice = that one slot). */
              /* A slot drawn shorter than 44 px is tapped by position in a taller band (the nearest whole slots). */
              const band = touchBandMinutes(step, pxPerMinute);
              const bandStart = tapBandStart(press.minute, band);
              if (tapAnchor === null) {
                const first = paint(bandStart, bandStart);
                if (first.range === null) {
                  pick.onNote(paintNote(first));
                  return;
                }
                onTapAnchor(bandStart);
                pick.onNote(`Začátek ${formatMinutes(bandStart)} — klepněte na konec.`);
                return;
              }
              onTapAnchor(null);
              commit(tapAnchor, bandStart >= tapAnchor ? bandStart + band - step : bandStart, event.clientX, event.clientY, true);
              return;
            }
            /* A tap on a free slot: that one slot is the selection. */
            commit(press.minute, press.minute, event.clientX, event.clientY, additiveKey(event));
            return;
          }
        }
        if (!drag) return;
        const end = minuteOf(event);
        const anchor = drag.anchor;
        setDrag(null);
        commit(anchor, end, event.clientX, event.clientY, additiveKey(event));
      }}
      onPointerCancel={() => {
        if (touch.current) window.clearTimeout(touch.current.timer);
        touch.current = null;
        setDrag(null);
      }}
      sx={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: "100%",
        borderLeft: "1px solid",
        borderColor: "divider",
        "&:first-of-type": { borderLeft: "none" },
        backgroundColor: shadeWhole ? shade : "transparent",
        cursor: canDrag ? "cell" : "default",
        userSelect: "none",
      }}
    >
      {/* Working hours stay clear; the rest of the day is shaded, so the owner
          sees where the day ends (5.1). */}
      {workStart !== null && workEnd !== null && open ? (
        <>
          {workStart > topMinute ? (
            <Box
              aria-hidden
              sx={{ position: "absolute", left: 0, right: 0, ...place({ start: topMinute, end: workStart }), bgcolor: shade, zIndex: 0 }}
            />
          ) : null}
          {workEnd < bottomMinute ? (
            <Box
              aria-hidden
              sx={{ position: "absolute", left: 0, right: 0, ...place({ start: workEnd, end: bottomMinute }), bgcolor: shade, zIndex: 0 }}
            />
          ) : null}
        </>
      ) : null}

      {/* Grid lines on the resolution step, with every hour a touch stronger,
          so a drag has something to aim at. */}
      <Box
        aria-hidden
        data-testid="grid-lines"
        data-step={gridStep}
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          backgroundImage: `${hourLine}${stepLine}`,
        }}
      />

      {breakStart !== null && breakEnd !== null && open ? (
        <Box
          aria-label={GRID_TEXT.lunchBreak}
          sx={{
            position: "absolute",
            left: 3,
            right: 3,
            ...place({ start: breakStart, end: breakEnd }),
            borderRadius: `${DESIGN.radius.sm}px`,
            border: `1px dashed ${alpha(lunchColor, 0.8)}`,
            backgroundImage: hatchOf(lunchColor),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              color: DESIGN.muted,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {GRID_TEXT.lunchBreak}
          </Typography>
        </Box>
      ) : null}

      {/* This calendar alone is off today - "Dovolená — jméno", or why else. */}
      {ownClosed ? (
        <Box
          aria-hidden
          data-testid={`calendar-closed-${calendar.id}-${dayKey}`}
          sx={{
            position: "absolute",
            inset: 3,
            zIndex: 1,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 1,
            borderRadius: `${DESIGN.radius.sm}px`,
            border: `1px dashed ${DESIGN.hatch.closedLine}`,
            backgroundImage: DESIGN.hatch.closed,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: DESIGN.muted }}>
            {subColumnClosedLabel(row)}
          </Typography>
        </Box>
      ) : null}

      {drawnBlocksOfDay(blocks, dayKey, breakStart !== null && breakEnd !== null ? { start: breakStart, end: breakEnd } : null).map(({ block, span: blockSpan }) => {
        const club = block.kind === "club";
        const colour = cleanHex(block.colorHex) ?? DESIGN.faint;
        const label = club ? (block.clubName ?? GRID_TEXT.clubBlock) : block.reason || GRID_TEXT.blocked;
        const blockTime = `${formatMinutes(blockSpan.start)}–${formatMinutes(blockSpan.end)}`;
        return (
          <Box
            key={block.id}
            component="button"
            type="button"
            data-grid-item="block"
            data-kind={club ? "club" : "manual"}
            title={club ? `${GRID_TEXT.clubBlock} · ${label} · ${blockTime}` : undefined}
            onClick={(event: React.MouseEvent) => {
              if (club) {
                const dates = clubBlockDates(allBlocks, block.clubBlockId, block);
                onOpenClubBlock?.({
                  clubBlockId: block.clubBlockId ?? block.id,
                  clubId: block.clubId ?? null,
                  clubName: block.clubName ?? label,
                  colorHex: block.colorHex ?? null,
                  range: dates,
                  x: event.clientX,
                  y: event.clientY,
                });
                return;
              }
              onOpenBlock(block);
            }}
            aria-haspopup="dialog"
            sx={{
              position: "absolute",
              left: 3,
              right: 3,
              ...place(blockSpan),
              zIndex: 2,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              font: "inherit",
              fontSize: 11,
              fontWeight: 600,
              px: 0.75,
              cursor: "pointer",
              color: club ? DESIGN.ink : DESIGN.muted,
              border: `1px dashed ${club ? alpha(colour, 0.8) : DESIGN.hatch.closedLine}`,
              borderLeft: club ? `3px solid ${colour}` : undefined,
              borderRadius: `${DESIGN.radius.sm}px`,
              /*
               * One block from its start to its end (owner, Etapa 12: "when a team books,
               * it gets the whole day WITHOUT the time step dividing the order"). The hatch
               * is translucent, so on its own the grid's step lines beneath (zIndex 1) showed
               * through and a whole-day window read as a stack of little slots. An opaque
               * base under the hatch masks them; the colour runs uninterrupted, one label,
               * one border. The server cuts an order's day into the open stretches
               * around lunch; `drawnBlocksOfDay` joins those back into the one block
               * the desk ordered ("not divided into segments"), lunch band included.
               */
              backgroundColor: theme.palette.background.paper,
              backgroundImage: club ? hatchOf(colour) : DESIGN.hatch.closed,
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
            }}
          >
            <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {label}
            </Box>
            {club ? (
              <Box component="span" aria-hidden="true" data-testid="club-block-time" sx={{ fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", opacity: 0.85 }}>
                {blockTime}
              </Box>
            ) : null}
          </Box>
        );
      })}

      {appointments.map((appointment) => {
        const placement = layout.placed.get(appointment.id);
        if (!placement) return null;
        const placed = place(spanOnDay(appointment.startUtc, appointment.endUtc, dayKey));
        const cardHeight = Math.max(18, placed.height - 2);
        const accent = colourOfActivity(catalogue, appointment.activityId, spec.colorHex);
        const widthPct = 100 / placement.lanes;
        const draggable = moveEnabled && !isTerminalStatus(appointment.status);
        const beingMoved = movingId === appointment.id;
        const proposed = proposalId === appointment.id;
        const isSelected = selectedId === appointment.id;
        return (
          <Box
            key={appointment.id}
            data-testid={`appointment-cell-${appointment.id}`}
            data-lane={placement.lane}
            data-lanes={placement.lanes}
            data-draggable={draggable ? "true" : undefined}
            data-selected={isSelected ? "true" : undefined}
            data-proposed={proposed ? "true" : undefined}
            onPointerDown={draggable ? (event: React.PointerEvent<HTMLDivElement>) => cardPress.onPointerDown(event, appointment, spec, dayKey) : undefined}
            onContextMenu={draggable ? cardPress.onContextMenu : undefined}
            sx={{
              position: "absolute",
              left: `calc(${placement.lane * widthPct}% + 3px)`,
              width: `calc(${widthPct}% - 6px)`,
              top: placed.top + 1,
              height: cardHeight,
              /*
               * A booking on a shut day - the owner took a Saturday patient and
               * could find them only through the hover - sits ABOVE the day's
               * hatched block (zIndex 4), under the now-line (5). Full card,
               * clickable; the hatch stays visible around it. A card waiting for
               * its confirmation or picked by a click comes forward.
               */
              zIndex: proposed || isSelected ? 6 : dayClosed ? 5 : 2,
              borderRadius: `${DESIGN.radius.sm}px`,
              /* The card still at its old place while its ghost is dragged. */
              opacity: beingMoved ? 0.35 : 1,
              transition: "opacity 150ms ease-out, box-shadow 150ms ease-out",
              /* In its new slot, waiting for "Přesunout": the ghost's dashed edge, so the desk sees it is not settled. */
              outline: proposed ? `2px dashed ${accent}` : isSelected ? `2px solid ${theme.palette.primary.main}` : "none",
              outlineOffset: 1,
              boxShadow: proposed || isSelected ? DESIGN.shadow.menu : "none",
              cursor: draggable ? "grab" : undefined,
              touchAction: draggable ? "manipulation" : undefined,
              WebkitTouchCallout: "none",
              userSelect: "none",
              willChange: proposed ? "transform" : undefined,
            }}
          >
            <AppointmentButton
              appointment={appointment}
              calendar={calendar}
              now={now}
              onOpen={onOpen}
              onSelect={(_id, element) => onSelectCard(appointment, element)}
              hover={!isSelected && !proposed && movingId === null}
              layout="block"
              accent={accent}
              dense={cardHeight < DENSE_BELOW || placement.lanes >= 3}
            />
          </Box>
        );
      })}

      {/* The dragged card's shadow at the snapped slot it would take: its colour and the new time; red and
          named when it cannot land there (taken, outside the hours, another calendar). */}
      {ghost ? (
        <Box
          data-testid="move-preview"
          data-refused={ghost.refusal ?? undefined}
          aria-hidden
          sx={{
            position: "absolute",
            left: 3,
            right: 3,
            ...place(ghost.range),
            zIndex: 6,
            pointerEvents: "none",
            overflow: "hidden",
            px: "7px",
            py: "4px",
            borderRadius: `${DESIGN.radius.sm}px`,
            borderLeft: `3px solid ${ghost.refusal ? DESIGN.danger : colourOfActivity(catalogue, ghost.appointment.activityId, spec.colorHex)}`,
            outline: `2px dashed ${ghost.refusal ? DESIGN.danger : colourOfActivity(catalogue, ghost.appointment.activityId, spec.colorHex)}`,
            outlineOffset: -1,
            backgroundColor: ghost.refusal
              ? alpha(DESIGN.danger, 0.16)
              : alpha(colourOfActivity(catalogue, ghost.appointment.activityId, spec.colorHex), 0.22),
            color: ghost.refusal ? DESIGN.danger : theme.palette.text.primary,
            lineHeight: 1.25,
          }}
        >
          <Box component="span" data-testid="move-preview-time" sx={{ display: "block", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {ghostLabel(ghost.range)}
          </Box>
          <Box component="span" sx={{ display: "block", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ghost.appointment.patientName?.trim() || ghost.appointment.activityName}
          </Box>
          {ghost.refusal ? (
            <Box component="span" sx={{ display: "block", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              {refusalText(ghost.refusal)}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {layout.overflow.map((chip) => {
        const place_ = place({ start: chip.start, end: chip.end });
        const widthPct = 100 / chip.lanes;
        return (
          <Box
            key={chip.key}
            component="button"
            type="button"
            data-grid-item="overflow"
            data-testid={`lane-overflow-${chip.ids[0]}`}
            aria-label={`Dalších ${chip.ids.length} rezervací ve stejný čas`}
            onClick={(event: React.MouseEvent) => setFolded({ ids: chip.ids, x: event.clientX, y: event.clientY })}
            sx={{
              position: "absolute",
              left: `calc(${chip.lane * widthPct}% + 3px)`,
              width: `calc(${widthPct}% - 6px)`,
              top: place_.top + 1,
              height: Math.max(18, place_.height - 2),
              zIndex: dayClosed ? 5 : 2,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: `${DESIGN.radius.sm}px`,
              bgcolor: "background.paper",
              color: "text.primary",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              p: 0,
            }}
          >
            +{chip.ids.length}
          </Box>
        );
      })}

      <Popover
        open={folded !== null}
        onClose={() => setFolded(null)}
        anchorReference="anchorPosition"
        anchorPosition={folded ? { top: folded.y, left: folded.x } : undefined}
        slotProps={{ paper: { sx: { width: 260, maxWidth: "calc(100vw - 24px)", p: 1, borderRadius: "10px", boxShadow: DESIGN.shadow.menu } } }}
      >
        {folded
          ? folded.ids.map((id) => {
              const a = byId.get(id);
              if (!a) return null;
              return (
                <Box key={id} sx={{ mb: 0.5, minHeight: 44 }}>
                  <AppointmentButton
                    appointment={a}
                    calendar={calendar}
                    now={now}
                    onOpen={(appointmentId) => {
                      setFolded(null);
                      onOpen(appointmentId);
                    }}
                    layout="row"
                    accent={colourOfActivity(catalogue, a.activityId, spec.colorHex)}
                  />
                </Box>
              );
            })
          : null}
      </Popover>

      {painting && tapAnchor !== null ? (
        <Box
          data-testid="tap-anchor"
          aria-hidden
          sx={{
            position: "absolute",
            left: 4,
            right: 4,
            ...place({ start: tapAnchor, end: tapAnchor + touchBandMinutes(step, pxPerMinute) }),
            zIndex: 4,
            pointerEvents: "none",
            border: `2px dashed ${DESIGN.selection.line}`,
            borderRadius: `${DESIGN.radius.md}px`,
            bgcolor: alpha(DESIGN.selection.line, 0.12),
            color: DESIGN.selection.line,
            fontSize: 11,
            fontWeight: 700,
            px: 0.75,
            display: "flex",
            alignItems: "center",
          }}
        >
          {`Začátek ${formatMinutes(tapAnchor)}`}
        </Box>
      ) : null}

      {painting && pick !== undefined
        ? picked.map((item) => {
            const range = adjust?.id === item.id ? adjust.range : item.range;
            return (
              <PickedBar
                key={item.id}
                id={item.id}
                range={range}
                place={place(range)}
                pxPerMinute={pxPerMinute}
                step={step}
                conflict={pick.conflictIds?.has(item.id) === true}
                tag={pick.tagOf?.(item.id) ?? null}
                touch={touchPick}
                onDrag={(mode: AdjustMode, delta: number) =>
                  setAdjust({
                    id: item.id,
                    range: adjustPicked({
                      original: item.range,
                      mode,
                      delta,
                      step,
                      bounds,
                      busy: busyHere(item.id),
                    }),
                  })
                }
                onEnd={() => {
                  if (adjust !== null && adjust.id === item.id && (adjust.range.start !== item.range.start || adjust.range.end !== item.range.end)) {
                    pick.onAdjust(item.id, adjust.range);
                  }
                  setAdjust(null);
                }}
                onRemove={() => pick.onRemove(item.id)}
              />
            );
          })
        : null}

      {(painting ? [] : picked).map((item) => (
        <Box
          key={item.id}
          data-testid="picked-range"
          data-past={pickedPast ? "true" : undefined}
          sx={{
            position: "absolute",
            left: 4,
            right: 4,
            ...place(item.range),
            zIndex: 3,
            pointerEvents: "none",
            border: `2px ${pickedPast ? "dashed" : "solid"} ${DESIGN.selection.line}`,
            borderRadius: `${DESIGN.radius.md}px`,
            backgroundColor: DESIGN.selection.bg,
            opacity: pickedPast ? 0.45 : 1,
          }}
        >
          <Typography
            sx={{
              position: "absolute",
              top: -13,
              left: -2,
              px: 1.1,
              py: "3px",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.3,
              borderRadius: "6px",
              backgroundColor: DESIGN.selection.line,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {selectionLabel(item.range)}
          </Typography>
        </Box>
      ))}

      {liveRange ? (
        <Box
          data-testid="drag-selection"
          sx={{
            position: "absolute",
            left: 4,
            right: 4,
            ...place(liveRange),
            zIndex: 4,
            pointerEvents: "none",
            border: `2px solid ${DESIGN.selection.line}`,
            borderRadius: `${DESIGN.radius.md}px`,
            backgroundColor: DESIGN.selection.bg,
          }}
        >
          <Typography
            sx={{
              position: "absolute",
              top: -13,
              left: -2,
              px: 1.1,
              py: "3px",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.3,
              borderRadius: "6px",
              backgroundColor: DESIGN.selection.line,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {selectionLabel(liveRange)}
          </Typography>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 34,
              height: 6,
              borderRadius: "3px",
              bgcolor: DESIGN.selection.line,
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              bottom: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 34,
              height: 6,
              borderRadius: "3px",
              bgcolor: DESIGN.selection.line,
            }}
          />
        </Box>
      ) : null}
    </Box>
  );
}
