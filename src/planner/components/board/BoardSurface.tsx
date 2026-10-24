/*
 * The week board - toolbar, day headings, hour column, the 07:00-19:00 timeline with everything on
 * it, and the Den / Měsíc alternates - bound to the planner's data (`usePlannerModel`) and, on the
 * real route, to the clinic's calendar (`calendar`, from `useBoardCalendar`).
 *
 * What lives here and what does not
 *   here        the DOM of `section.planner`, the pure model (`buildBoardModel`) turned into elements,
 *               the gestures of the everyday calendar (mark free time, move a booking) and the dialogs
 *               they open - all of them our existing components, untouched.
 *   not here    club planning's drag layers (placement, moving a term, pulling an edge): they belong to
 *               `PlanningBoardLayer`, mounted at the end of the day board. While a činnost is armed
 *               (`planning.selectedCategoryId !== null`) or one of those gestures runs, this component
 *               keeps its hands off the board.
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Button, ClickAwayListener, Paper, Popover, Popper, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../../api/appointments';
import { statusName, type DayAppointment, type TimeBlock } from '../../../api/bookingContracts';
import { CALENDAR_DISPLAY_OFFLINE } from '../../../api/displaySettings';
import { NewAppointmentDialog } from '../../../components/booking/NewAppointmentDialog';
import { AppointmentHoverCard } from '../../../components/booking/grid/AppointmentHoverCard';
import { BlockDetailDialog, BlockReasonDialog, type BlockTarget } from '../../../components/booking/grid/BlockDialogs';
import { CAL_TEXT } from '../../../components/booking/calendar/calendarText';
import { GRID_TEXT } from '../../../components/booking/grid/gridText';
import { columnStep } from '../../../components/booking/grid/moveDrag';
import { longDate, minutesFree } from '../../../components/booking/grid/periodTitle';
import { localDateTime, pragueMinuteOfDay, spanLabel, spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import type { GridMoveRequest } from '../../../components/booking/grid/moveRequest';
import { MoveConfirmDialog } from '../../../components/booking/calendar/MoveConfirmDialog';
import { AddToClubOrderDialog } from '../../../components/booking/calendar/AddToClubOrderDialog';
import type { ClubBlockPick } from '../../../components/booking/calendar/ClubBlockPopover';
import { SelectionPopover } from '../../../components/booking/calendar/SelectionPopover';
import { dayCount, daysWord, rangeDates } from '../../../components/booking/calendar/model';
import type { PickedRange } from '../../../components/booking/calendar/multiSelect';
import { ClubOrderEntry } from '../../../components/clubs/order/ClubOrderEntry';
import { editSessionFor } from '../../../components/clubs/order/editSession';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { DESIGN, accentLiteral } from '../../../theme';
import { addDaysToDateOnly, pragueDateKey } from '../../../utils/time';
import { errorText } from '../../../components/booking/errorText';
import { addDays, monthCells, normalizeFilter, usesServiceFilter, weekHeadModel, type IsoDate } from '../../model';
import { blockableRanges } from '../../model/daySelect';
import { PLANNER_TEXT } from '../../text';
import { plannerKeys } from '../../data/PlannerDataSource';
import { usePlannerData } from '../../data/PlannerDataProvider';
import { usePlannerActions, usePlannerSelector } from '../../state/PlannerStoreProvider';
import { PlanningBoardLayer } from '../PlanningBoardLayer';
import { useStage } from '../PlannerStage';
import { DESIGN_TIMELINE_HEIGHT, useBoardMetrics } from '../PlannerMetrics';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { clubItemsByDay, clubLinesByDay, lunchOfMarks, phoneEntries, phoneMonthRows, weekStripModel } from './phoneModel';
import { BookingCard, SessionCard, WindowBlock } from './BoardCards';
import { BoardToolbar } from './BoardToolbar';
import type { BoardCalendarData } from './boardCalendar';
import { useBoardConfig } from './boardConfig';
import { boardGeometry, boxOfSpan, hourLabels, STANDARD_TIMELINE_HEIGHT, stepLineHeight, widenWindow, yOfMinute } from './boardGeometry';
import {
  clampZoom,
  focusMinuteFor,
  lineStepFor,
  minuteAtViewportY,
  pinchDistance,
  scrollTopFor,
  snapStepFor,
  stepZoom,
  wheelFactor,
  ZOOM_MAX,
  ZOOM_MIN,
} from './boardZoom';
import {
  blockedDaysOf,
  buildBoardModel,
  dayListModel,
  monthTilesModel,
  toneVars,
  withAlpha,
  type BoardWindowModel,
  type BookingCardModel,
  type SessionCardModel,
} from './boardModel';
import { boardSettings, useBoardSettings } from './boardSettings';
import { useBoardMove, type BoardNotice } from './useBoardMove';
import { cancelUndoable } from './undoRules';
import type { UndoOp } from './undoState';
import type { Appointment } from '../../../api/bookingContracts';
import { useBoardNow } from './useBoardNow';
import { useBoardSelection, type BoardSelection } from './useBoardSelection';
import { DaysBlockDialog } from './month/DaysBlockDialog';
import { useDaySelect } from './month/useDaySelect';
import { useDayPick } from '../plan/useDayPick';
import { PlanFxHost } from '../../motion/PlanFxHost';
import { useInquiries } from './useInquiries';
import { useNextFree } from './useNextFree';
import { inquiryLabel, inquiryTitle } from '../../model/inquiries';
import { useClubPlanner } from '../../club/ClubPlannerContext';
import { useSafeNavigate } from './useSafeNavigate';
import { calendarColumns, calendarOfColumn, columnChips } from './calendarColumns';
import { CalendarStrip } from './CalendarStrip';
import { Icon } from '../Icons';
import { DayList, MonthMatrix } from './AlternateView';
import { PhoneAgenda, PhoneMonthList } from './PhoneAgenda';
import { clubHolding, clubReservedText, offeredHolding, HOLD_TEXT } from './clubHold';
import { gapBusy } from './gapContext';
import { firstGapQuestion, nextGapQuestion, type GapKind, type GapQuestion } from '../../model/gaps';
import { LunchBandEl } from './BoardCards';
import { isOverrideForbidden, workerBusyOf, type WorkerBusy } from '../../../api/workerBusy';
import { CLOSED_DAY_TEXT, DEFAULT_HOLIDAY_COLOR, effectiveHolidayColor, lockedDayLook } from '../../../colors/dayLock';
import './board.css';

/* R4 (and R17 / R13): new pop-outs are loaded when first needed, so the planner chunk keeps its budget */
/* R15c: the undo bar and the keyboard shortcuts load on first use / after the first paint, not with the planner */
const ShortcutsHelp = lazy(() => import('./ShortcutsHelp').then((m) => ({ default: m.ShortcutsHelp })));
const BoardUndo = lazy(() => import('./BoardUndo').then((m) => ({ default: m.BoardUndo })));
const BoardShortcuts = lazy(() => import('./BoardShortcuts').then((m) => ({ default: m.BoardShortcuts })));
const ClubBlockPopover = lazy(() => import('../../../components/booking/calendar/ClubBlockPopover').then((m) => ({ default: m.ClubBlockPopover })));
/* R17 / R4: the lunch controls and the clash drawing are layers of their own, loaded only when a Stage 2 server and the setting ask for them */
/* The appointment's detail opens on a click: loaded then (as `useRecordOpener` already does for the reservation drawer) */
const AppointmentDetail = lazy(() => import('../../../components/booking/AppointmentDetail').then((m) => ({ default: m.AppointmentDetail })));
const LunchLayer = lazy(() => import('./LunchLayer'));
const ClashLayer = lazy(() => import('./ClashLayer'));
const OfferedAsk = lazy(() => import('./OfferedAsk'));
const GapChoice = lazy(() => import('./GapChoice'));
const WorkerBusyDialog = lazy(() => import('../../../components/booking/WorkerBusyNotice').then((m) => ({ default: m.WorkerBusyDialog })));

const hatchOf = (hex: string, strong: number, weak: number) =>
  `repeating-linear-gradient(135deg, ${withAlpha(hex, strong)} 0px, ${withAlpha(hex, strong)} 7px, ${withAlpha(hex, weak)} 7px, ${withAlpha(hex, weak)} 14px)`;

interface BookingPrefill {
  initialDate?: string;
  initialCalendarId?: string;
  initialStart?: string;
  initialEnd?: string;
  initialActivityId?: string;
  /** The patient's card said "Objednat termín": the dialog opens with them chosen. */
  initialPatientId?: string;
  /** R17: booked into the lunch slot (`into-lunch`): the day's lunch goes, the booking comes. */
  intoLunch?: boolean;
  anchor?: { x: number; y: number; width: number; height: number };
}

interface PendingSelection extends BoardSelection {
  calendarId: string | null;
  calendarName: string | null;
}

export function BoardSurface({ calendar }: { calendar: BoardCalendarData | null }) {
  /* The prototype's cyan, moved to the desk's accent: the move ghost of a card that has no colour of its own. */
  const ghostTone = accentLiteral(useTheme(), '#0fead6');
  const { t } = useTranslation();
  const ctx = usePlannerCtx();
  const { dayMarks, catalogue, order } = usePlannerModelState();
  const config = useBoardConfig();
  const settings = useBoardSettings();
  const act = usePlannerActions();
  const nav = useSafeNavigate();
  const { source } = usePlannerData();
  const queryClient = useQueryClient();

  const view = usePlannerSelector((s) => s.view);
  const filter = usePlannerSelector((s) => s.filter);
  /* R1: the main planner filters by služba; a club's own board filters by the činnosti of its order */
  const clubMode = catalogue?.capabilities.mode ? catalogue.capabilities.mode === 'club' : ctx.demands.length > 0;
  const byService = usesServiceFilter(ctx.categories, clubMode);
  /* a saved / stale value that is no služba of this catalogue (an old činnost id) goes back to 'all' */
  const filterFixed = byService ? normalizeFilter(filter, ctx.categories) : filter;
  useEffect(() => {
    if (filterFixed !== filter) act.setFilter(filterFixed);
  }, [filterFixed, filter, act]);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const armed = usePlannerSelector((s) => s.planning.selectedCategoryId !== null);
  const gesturing = usePlannerSelector((s) => s.planning.drag !== null || s.planning.move !== null || s.planning.resize !== null);
  const planningOwnsPointer = armed || gesturing;

  const now = useBoardNow();
  const nowMinute = config.nowMinute ?? pragueMinuteOfDay(now);
  /* Standard ordering (`order.club === false`) has no club deck under the board: the board takes its room. */
  const standardLayout = order?.club === false;
  /* In the standard layout the hours widen to what lies outside the planning window that week (a booking at 01:00 is
     not dropped off the top); club planning keeps the planning window - its overlays are measured against it. */
  const outside = useMemo(() => {
    if (!standardLayout || !calendar) return [];
    const spans: { start: number; end: number }[] = [];
    const inWeek = (day: string) => day >= weekStart && day <= addDays(weekStart, 6);
    for (const a of calendar.appointments) {
      const day = pragueDateKey(a.startUtc);
      if (inWeek(day)) spans.push(spanOnDay(a.startUtc, a.endUtc, day));
    }
    for (const list of calendar.blocksByCalendar.values()) {
      for (const b of list) {
        const day = pragueDateKey(b.startUtc);
        if (inWeek(day) && touchesDay(b.startUtc, b.endUtc, day)) spans.push(spanOnDay(b.startUtc, b.endUtc, day));
      }
    }
    return spans;
  }, [standardLayout, calendar, weekStart]);
  const drawnWindow = useMemo(() => widenWindow(ctx.window, outside), [ctx.window, outside]);
  /* The fluid stage: the 12 hours of the planning window are drawn in the height the board really has (measured, design
     px), so extra height gives taller rows and extra width wider day columns (`PlannerMetrics`). Until it is measured
     (jsdom, the first frame) the file's numbers: 455 px, 629 px in the standard layout. */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const metrics = useBoardMetrics(bodyRef);
  const baseTimeline = metrics.measured ? metrics.height : standardLayout ? STANDARD_TIMELINE_HEIGHT : DESIGN_TIMELINE_HEIGHT;
  const geometry = useMemo(
    () => boardGeometry(drawnWindow, settings.zoom, baseTimeline, ctx.window.endMinutes - ctx.window.startMinutes),
    [drawnWindow, ctx.window, settings.zoom, baseTimeline],
  );
  /* Club planning's layer listens to every press on an empty board (and says "Nejprve vyberte činnost" when nothing is
     armed). Standard ordering without an order has nothing to arm, so there the board's presses are the desk's own. */
  const planningPossible = !standardLayout && (config.mode === 'club' || ctx.demands.length > 0);
  /* The zoom (1-6x) decides which lines the board draws and the step marking and moving snap to (`boardZoom.ts`). */
  const lineStep = lineStepFor(settings.zoom);
  const snapStep = snapStepFor(settings.zoom);
  /* A board widened above the planning window opens at the planning window, not at the odd hour. The scroll is NOT reset
     by the week arrows or the Den / Týden / Měsíc switch: the hours the desk scrolled to stay. */
  const windowTop = drawnWindow.startMinutes;
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = yOfMinute(geometry, ctx.window.startMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowTop, standardLayout]);
  const head = useMemo(() => weekHeadModel(weekStart, ctx.window), [weekStart, ctx.window]);
  const days = head.days.map((d) => d.date);
  /* Reviewer 2.4: two or three calendars on screen split every day of the standard calendar into one column per calendar. */
  /* R2: one column per SLUŽBA - a služba's extra calendars ride in its primary's column (`calendar.alias`). */
  const columns = useMemo(() => {
    const alias = calendar?.alias;
    const representatives = (calendar?.calendars ?? []).filter((c) => (alias?.get(c.id) ?? c.id) === c.id);
    return calendarColumns(representatives, config.mode === 'standard');
  }, [calendar?.calendars, calendar?.alias, config.mode]);
  /* ... and its head, its month-tile count and its compact chip carry the SLUŽBA's own name and colour, not the calendar's ("Ordinace 1"). */
  const namedColumns = useMemo(() => {
    if (!columns) return null;
    const groupOf = new Map((calendar?.groups ?? []).filter((g) => g.serviceId !== null).flatMap((g) => g.calendarIds.map((id) => [id, g] as const)));
    return columns.map((c) => {
      const g = groupOf.get(c.id);
      return g ? { ...c, name: g.name, color: g.colour } : c;
    });
  }, [columns, calendar?.groups]);
  const split = useMemo(() => (columns ? columns.map((c) => c.id) : null), [columns]);
  const subs = columns ? columns.length : 1;
  /* The compact layouts head the columns of the one day they show: they read the calendars from the store. */
  useEffect(() => {
    boardSettings.publishColumns(namedColumns ? namedColumns.map((c) => ({ id: c.id, name: c.name, color: c.color, serviceId: c.clinicServiceId ?? null })) : null);
    return () => boardSettings.publishColumns(null);
  }, [namedColumns]);
  const calendarOpen = useCallback(
    (calendarId: string, day: IsoDate) => {
      const row = calendar?.previewByCalendar.get(calendarId)?.get(day);
      return row === undefined || row.isOpen;
    },
    [calendar],
  );

  const boardRef = useRef<HTMLDivElement | null>(null);
  /* Two fingers on the board are a pinch (zoom), never a mark, a move or a placement. */
  const [pinching, setPinching] = useState(false);
  const [notice, setNotice] = useState<BoardNotice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const showNotice = useCallback((next: BoardNotice) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(next);
    noticeTimer.current = window.setTimeout(() => setNotice(null), next.tone === 'error' ? 6000 : 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const refreshPlanner = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: plannerKeys.all(source.id) });
  }, [queryClient, source.id]);
  const refreshCalendar = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['day-range'] });
    await queryClient.invalidateQueries({ queryKey: ['blocks'] });
    refreshPlanner();
  }, [queryClient, refreshPlanner]);

  /* R15c (d): a move and a cancel can be taken back for 30 s (the last one only); see undoState.ts for what a cancel can and cannot give back */
  const [undoEntry, setUndoEntry] = useState<{ op: UndoOp; seq: number } | null>(null);
  const armUndo = useCallback((op: UndoOp) => setUndoEntry((prev) => ({ op, seq: (prev?.seq ?? 0) + 1 })), []);
  const armCancelUndo = useCallback(
    (a: Appointment) => {
      if (!cancelUndoable(a)) {
        showNotice({ text: 'Rezervace zrušena. Tohle zrušení už nejde vrátit zpět (klubový termín, nedokončená rychlá registrace nebo host bez jména) - vytvořte rezervaci znovu.', tone: 'info' });
        return;
      }
      armUndo({ kind: 'cancel', calendarId: a.calendarId, activityId: a.activityId, startUtc: a.startUtc, patientId: a.patientId || null, name: a.unregisteredName ?? null, phone: a.unregisteredPhone ?? null, note: a.note ?? null, agreedPriceCzk: a.agreedPriceCzk ?? null });
    },
    [armUndo, showNotice],
  );

  /* ---- a selected card shows its summary; the click goes on to the detail ---- */
  const [selected, setSelected] = useState<{ card: BookingCardModel; element: HTMLElement } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  /* ---- moving a booking ---- */
  const commitMove = useCallback(
    async (move: GridMoveRequest) => {
      const notice = await appointmentsApi.reschedule(move.calendarId, move.appointment.id, move.startUtc, undefined, { notifyPatient: move.notifyPatient });
      armUndo({ kind: 'move', calendarId: move.calendarId, appointmentId: move.appointment.id, fromStartUtc: move.appointment.startUtc, notifyPatient: move.notifyPatient });
      await refreshCalendar();
      return notice;
    },
    [refreshCalendar, armUndo],
  );
  const move = useBoardMove({
    boardRef,
    geometry,
    days,
    calendar,
    dayMarks,
    split,
    ...(calendar?.alias ? { alias: calendar.alias } : {}),
    resolutionStep: snapStep,
    paused: planningOwnsPointer || pinching,
    onCommit: commitMove,
    onNotice: showNotice,
    describeError: (error) => errorText(error, t),
    onRefused: (error, request) => {
      /* R4: the worker is busy in another calendar - the clash is named and the owner may override it with a reason */
      const busy = workerBusyOf(error);
      if (busy === null) return false;
      setBusyMove({ request, busy, forbidden: false, working: false });
      return true;
    },
    onDragStart: () => setSelected(null),
  });
  const [busyMove, setBusyMove] = useState<{ request: GridMoveRequest; busy: WorkerBusy; forbidden: boolean; working: boolean } | null>(null);
  const overrideBusyMove = useCallback(
    async (reason: string) => {
      const current = busyMove;
      if (!current) return;
      setBusyMove({ ...current, working: true });
      try {
        await appointmentsApi.reschedule(current.request.calendarId, current.request.appointment.id, current.request.startUtc, reason, { notifyPatient: current.request.notifyPatient });
        armUndo({ kind: 'move', calendarId: current.request.calendarId, appointmentId: current.request.appointment.id, fromStartUtc: current.request.appointment.startUtc, notifyPatient: current.request.notifyPatient });
        await refreshCalendar();
        setBusyMove(null);
        showNotice({ text: 'Termín přesunut. Výjimka je zapsaná v historii rezervace.', tone: 'info' });
      } catch (error) {
        if (isOverrideForbidden(error)) setBusyMove({ ...current, forbidden: true, working: false });
        else {
          setBusyMove(null);
          showNotice({ text: errorText(error, t), tone: 'error' });
        }
      }
    },
    [busyMove, refreshCalendar, showNotice, t, armUndo],
  );

  /* ---- the model ---- */
  const model = useMemo(
    () =>
      buildBoardModel({
        ctx,
        weekStart,
        filter,
        geometry,
        dayMarks,
        dayMarkColors: catalogue?.dayMarkColors ?? { holiday: DEFAULT_HOLIDAY_COLOR, lunch: '#CBD1D8' },
        calendar: calendar
          ? {
              calendars: calendar.calendars,
              appointments: move.appointments,
              blocksByCalendar: calendar.drawBlocksByCalendar as Map<string, TimeBlock[]>,
              catalogue: calendar.catalogue,
              mayBook: calendar.mayBook,
              excludeClubId: config.excludeClubId,
              ...(config.excludeClubBlockIds ? { excludeClubBlockIds: config.excludeClubBlockIds } : {}),
              split,
              ...(calendar.alias ? { alias: calendar.alias } : {}),
              isOpen: calendarOpen,
            }
          : null,
        nowMinute,
      }),
    [ctx, weekStart, filter, geometry, dayMarks, catalogue, calendar, move.appointments, config.excludeClubId, config.excludeClubBlockIds, nowMinute, split, calendarOpen],
  );

  /* ---- zoom: 1x = the 12 hours fill the body; above, the body scrolls and the time under the pointer stays put ---- */
  const weekRef = useRef<HTMLDivElement | null>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  /* The body's visible height in design px (the fitted height the zoom multiplies). */
  const viewport = metrics.measured ? metrics.height : baseTimeline;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const focusRef = useRef<() => number>(() => drawnWindow.startMinutes);
  focusRef.current = () =>
    focusMinuteFor({
      window: drawnWindow,
      nowMinute: days.includes(ctx.today) ? nowMinute : null,
      firstSessionMinute: model.cards.length > 0 ? Math.min(...model.cards.map((c) => c.startMinute)) : null,
    });
  /* What the next zoom change keeps fixed: the minute under a pointer / the centre, or "show now / the first session". */
  const anchorRef = useRef<{ kind: 'minute'; minute: number; offset: number } | { kind: 'focus' } | null>(null);
  const prevZoomRef = useRef(settings.zoom);
  const prevGeometryRef = useRef(geometry);
  const topMinuteRef = useRef<number | null>(null);
  const wheelZoomRef = useRef<number | null>(null);

  const requestZoom = useCallback((next: number, pointerClientY?: number) => {
    const target = clampZoom(next);
    const current = boardSettings.getState().zoom;
    if (target === current) return;
    const body = bodyRef.current;
    if (body) {
      const rect = body.getBoundingClientRect();
      const view = viewportRef.current;
      const scale = rect.height > 0 && view > 0 ? rect.height / view : 1;
      if (pointerClientY === undefined && current <= ZOOM_MIN + 0.001) {
        anchorRef.current = { kind: 'focus' };
      } else {
        const y = pointerClientY ?? rect.top + rect.height / 2;
        anchorRef.current = {
          kind: 'minute',
          minute: minuteAtViewportY(geometryRef.current, body.scrollTop, rect.top, scale, y),
          offset: (y - rect.top) / scale,
        };
      }
    }
    boardSettings.setZoom(target);
  }, []);

  useLayoutEffect(() => {
    const from = prevZoomRef.current;
    const anchor = anchorRef.current;
    anchorRef.current = null;
    const previous = prevGeometryRef.current;
    prevZoomRef.current = settings.zoom;
    prevGeometryRef.current = geometry;
    const body = bodyRef.current;
    if (!body || from === settings.zoom) return;
    const view = viewportRef.current;
    let top: number;
    if (settings.zoom <= ZOOM_MIN) {
      top = scrollTopFor(geometry, ctx.window.startMinutes, 0, view);
    } else if (anchor?.kind === 'minute') {
      top = scrollTopFor(geometry, anchor.minute, anchor.offset, view);
    } else if (from <= ZOOM_MIN || anchor?.kind === 'focus') {
      top = scrollTopFor(geometry, focusRef.current(), view / 3, view);
    } else {
      /* A change from outside (the gear): keep the middle of what was on screen. */
      const topMinute = topMinuteRef.current ?? previous.startMinutes;
      top = scrollTopFor(geometry, topMinute + view / 2 / previous.pxPerMinute, view / 2, view);
    }
    body.scrollTop = top;
    topMinuteRef.current = geometry.startMinutes + top / geometry.pxPerMinute;
    boardSettings.setTopMinute(topMinuteRef.current);
  });

  /* The first time the board is measured with a saved zoom above 1x: back to the hours it showed, else now / the first session. */
  const restoredRef = useRef(false);
  useLayoutEffect(() => {
    if (restoredRef.current || !metrics.measured) return;
    restoredRef.current = true;
    const body = bodyRef.current;
    if (!body || settings.zoom <= ZOOM_MIN) return;
    const remembered = boardSettings.getTopMinute();
    const top =
      remembered !== null
        ? Math.max(0, Math.min(geometry.height - viewport, yOfMinute(geometry, remembered)))
        : scrollTopFor(geometry, focusRef.current(), viewport / 3, viewport);
    body.scrollTop = top;
    topMinuteRef.current = geometry.startMinutes + top / geometry.pxPerMinute;
  }, [metrics.measured, settings.zoom, geometry, viewport]);

  /* Ctrl / Cmd + wheel over the board zooms it (and only then keeps the browser from zooming the page); two fingers pinch. */
  useEffect(() => {
    const node = weekRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = boardSettings.getState().zoom;
      const held = wheelZoomRef.current;
      const base = held !== null && Math.abs(held - current) < 0.011 ? held : current;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base * wheelFactor(event.deltaY, event.deltaMode)));
      wheelZoomRef.current = next;
      requestZoom(next, event.clientY);
    };
    let pinch: { zoom: number; distance: number } | null = null;
    const points = (event: TouchEvent) => {
      const a = event.touches[0];
      const b = event.touches[1];
      return a && b ? { a: { x: a.clientX, y: a.clientY }, b: { x: b.clientX, y: b.clientY } } : null;
    };
    const onTouchStart = (event: TouchEvent) => {
      const two = event.touches.length === 2 ? points(event) : null;
      if (!two) return;
      pinch = { zoom: boardSettings.getState().zoom, distance: Math.max(1, pinchDistance(two.a, two.b)) };
      setPinching(true);
      if (event.cancelable) event.preventDefault();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch) return;
      const two = event.touches.length === 2 ? points(event) : null;
      if (!two) return;
      if (event.cancelable) event.preventDefault();
      requestZoom(pinch.zoom * (pinchDistance(two.a, two.b) / pinch.distance), (two.a.y + two.b.y) / 2);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (pinch && event.touches.length < 2) {
        pinch = null;
        setPinching(false);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('touchstart', onTouchStart, { passive: false });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [requestZoom]);

  /* + / − / 0 with the board focused (the board itself or anything on it). */
  const onBoardKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
    const current = boardSettings.getState().zoom;
    if (event.key === '+' || event.key === '=' || event.key === 'Add') requestZoom(stepZoom(current, 1));
    else if (event.key === '-' || event.key === '_' || event.key === 'Subtract') requestZoom(stepZoom(current, -1));
    else if (event.key === '0') requestZoom(ZOOM_MIN);
    else return;
    event.preventDefault();
  };
  const zoomControl = useMemo(
    () => ({
      zoom: settings.zoom,
      onStep: (direction: -1 | 1) => requestZoom(stepZoom(boardSettings.getState().zoom, direction)),
      onReset: () => requestZoom(ZOOM_MIN),
    }),
    [settings.zoom, requestZoom],
  );

  /* ---- marking free time ---- */
  /* Marking free time is the everyday calendar's gesture; while a club order is planned the board belongs to the order
     (a press on an empty board there is the planning layer's: it asks for a činnost first). */
  const mayMark = calendar !== null && (calendar.mayBook || calendar.mayBlock) && config.mode === 'standard';
  const step = useMemo(() => {
    const own = calendar?.calendars.map((c) => columnStep(c, snapStep)) ?? [];
    return own.length ? Math.min(snapStep, ...own) : snapStep;
  }, [calendar, snapStep]);
  const [pending, setPending] = useState<PendingSelection | null>(null);

  /* ---- the month: several days marked at once (a mouse drags, Ctrl / Cmd / Shift adds a place; touch has toggles) ---- */
  const phone = useStage().layout === 'phone';
  const monthSurface = useRef<HTMLDivElement | null>(null);
  /* While a club order is planned the month plans for the order: a click on a day takes the whole day (`useDayPick`). */
  const clubDays = calendar !== null && calendar.mayBook && config.mode === 'club' && !phone && view === 'month';
  const maySelectDays = clubDays || (calendar !== null && (calendar.mayBook || calendar.mayBlock) && config.mode === 'standard' && !phone && view === 'month');
  const select = useDaySelect(ctx.today, maySelectDays, monthSurface);
  const dayPick = useDayPick();
  /* Club planning, week: a click on a day's heading takes that whole day (Shift: from the last day taken to this one). */
  const clubWeekDays = calendar !== null && calendar.mayBook && config.mode === 'club' && view === 'week';
  const lastPickedDay = useRef<IsoDate | null>(null);
  const pickHeadingDay = (date: IsoDate, shift: boolean) => {
    const from = shift && lastPickedDay.current !== null ? lastPickedDay.current : date;
    lastPickedDay.current = date;
    void dayPick.pick([{ from: from < date ? from : date, to: from < date ? date : from }]);
  };
  /* The phone's month is a list: a tap on a row takes that whole day for the order (the day itself opens from the week strip). */
  const clubPhoneDays = calendar !== null && calendar.mayBook && config.mode === 'club' && phone && view === 'month';
  /* A drag over several days plans them at once; places added with Ctrl / Shift wait for the tray's button. */
  useEffect(() => {
    if (!clubDays || !select.chosen) return;
    const chosen = select.chosen;
    select.clear();
    void dayPick.pick([{ from: chosen.from, to: chosen.to }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubDays, select.chosen]);
  const [dayBlock, setDayBlock] = useState<readonly { from: IsoDate; to: IsoDate }[] | null>(null);

  /** The calendar a marked time belongs to: the first that works that day (and is not off for the worker). */
  const calendarFor = useCallback(
    (day: IsoDate, range: MinuteRange, sub = 0): { id: string; name: string } | null => {
      if (!calendar) return null;
      /* a split day: a mark belongs to the calendar of the column it was made in */
      if (columns) {
        const own = calendarOfColumn(columns, sub);
        return own ? { id: own.id, name: own.name } : null;
      }
      const works = (row: { isOpen: boolean; startTime: string | null; endTime: string | null } | undefined) => {
        if (!row) return true;
        if (!row.isOpen) return false;
        return true;
      };
      void range;
      const open = calendar.calendars.find((c) => works(calendar.previewByCalendar.get(c.id)?.get(day)));
      const pick = open ?? calendar.calendars[0];
      return pick ? { id: pick.id, name: pick.name } : null;
    },
    [calendar, columns],
  );

  const [offeredAsk, setOfferedAsk] = useState<{ club: string; orderId: string | null; x: number; y: number; go: () => void } | null>(null);
  const selection = useBoardSelection({
    boardRef,
    geometry,
    days,
    step,
    enabled: mayMark && view === 'week' && !planningOwnsPointer && !pinching && move.moving === null,
    subs,
    dayOpen: (day, sub) => !(dayMarks[day]?.closed ?? false) && (columns === null || calendarOpen(columns[sub]?.id ?? '', day)),
    onSelect: (sel) => {
      setSelected(null);
      const cal = calendarFor(sel.day, sel.range, sel.sub);
      /* R13: a place a club holds is not for booking, blocking or planning: say whose it is instead of opening the menu */
      const held = cal ? clubHolding(calendar?.blocksByCalendar.get(cal.id) ?? [], sel.day, sel.range) : null;
      if (held) {
        showNotice({ text: clubReservedText(held), tone: 'error' });
        return;
      }
      const next = { ...sel, calendarId: cal?.id ?? null, calendarName: cal?.name ?? null };
      /* R22: a day only OFFERED to a club does not refuse - the club may decline - but it asks first */
      const offered = cal ? offeredHolding(calendar?.drawBlocksByCalendar.get(cal.id) ?? [], sel.day, sel.range) : null;
      if (offered) {
        setOfferedAsk({ club: offered.clubName?.trim() || 'klub', orderId: offered.clubOrderId ?? null, x: sel.x, y: sel.y, go: () => setPending(next) });
        return;
      }
      setPending(next);
    },
  });

  /* ---- what the popover's actions open ---- */
  const [booking, setBooking] = useState<{ key: number; prefill: BookingPrefill } | null>(null);
  const openBooking = useCallback((prefill: BookingPrefill) => setBooking((c) => ({ key: (c?.key ?? 0) + 1, prefill })), []);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [openBlock, setOpenBlock] = useState<{ calendarId: string; calendarName: string; block: TimeBlock } | null>(null);
  const [addToClub, setAddToClub] = useState<{ marked: PickedRange } | null>(null);
  const [clubPick, setClubPick] = useState<ClubBlockPick | null>(null);
  const [folded, setFolded] = useState<{ keys: string[]; x: number; y: number } | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const selectionAnchor = (): { x: number; y: number; width: number; height: number } => {
    const el = boardRef.current?.querySelector<HTMLElement>('.board-selection');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : { x: pending?.x ?? 0, y: pending?.y ?? 0, width: 0, height: 0 };
  };

  /* R23: a click that leaves a hole shorter than a slot before (or the board step after) asks which place is meant - before the dialog opens */
  const [gapAsk, setGapAsk] = useState<{ q: GapQuestion; x: number; y: number; sel: PendingSelection; anchor: { x: number; y: number; width: number; height: number } } | null>(null);
  const bookAt = (sel: PendingSelection, range: MinuteRange, anchor: { x: number; y: number; width: number; height: number }) => {
    openBooking({
      initialDate: sel.day,
      initialCalendarId: sel.calendarId!,
      initialStart: localDateTime(sel.day, range.start),
      initialEnd: localDateTime(sel.day, range.end),
      ...(filter !== 'all' && calendar?.catalogue.activities.has(filter) ? { initialActivityId: filter } : {}),
      anchor,
    });
    setPending(null);
    setGapAsk(null);
  };
  const gapBusyOf = (sel: PendingSelection) =>
    calendar && sel.calendarId
      ? gapBusy({
          calendarId: sel.calendarId,
          day: sel.day,
          columnCalendarIds: calendar.calendars.filter((c) => (calendar.alias.get(c.id) ?? c.id) === (calendar.alias.get(sel.calendarId!) ?? sel.calendarId)).map((c) => c.id),
          appointments: move.appointments,
          blocksByCalendar: calendar.blocksByCalendar,
          previewByCalendar: calendar.previewByCalendar,
          workerRule: calendar.workerRule,
          allCalendarIds: calendar.calendars.map((c) => c.id),
          today: ctx.today,
          nowMinute,
        })
      : [];
  const gapThresholds = (sel: PendingSelection): { slot: number; step: number } => {
    const own = calendar?.calendarById.get(sel.calendarId ?? '');
    const boardStep = own && own.displayStepMinutes > 0 ? own.displayStepMinutes : 30;
    const activity = filter !== 'all' ? calendar?.catalogue.activities.get(filter) : undefined;
    return { slot: activity && activity.durationMinutes > 0 ? activity.durationMinutes : boardStep, step: boardStep };
  };
  const answerGap = (kind: GapKind, chosen: MinuteRange) => {
    const ask = gapAsk;
    if (!ask) return;
    const after = nextGapQuestion(gapBusyOf(ask.sel), kind, chosen, gapThresholds(ask.sel).step);
    if (after) setGapAsk({ ...ask, q: after, sel: { ...ask.sel, range: chosen } });
    else bookAt(ask.sel, chosen, ask.anchor);
  };
  const chooseBook = () => {
    if (!pending || !pending.calendarId) return;
    const anchor = selectionAnchor();
    const { slot, step: boardStep } = gapThresholds(pending);
    const q = firstGapQuestion(gapBusyOf(pending), pending.range, slot, boardStep);
    if (!q) {
      bookAt(pending, pending.range, anchor);
      return;
    }
    setGapAsk({ q, x: pending.x, y: pending.y, sel: pending, anchor });
    setPending(null);
  };
  const chooseBlock = () => {
    if (!pending || !pending.calendarId) return;
    setBlockTarget({ calendarId: pending.calendarId, calendarName: pending.calendarName ?? '', dayKey: pending.day, range: pending.range });
    setPending(null);
  };
  const chooseClub = () => {
    if (!pending || !pending.calendarId) return;
    setAddToClub({ marked: { id: 'pending-range', kind: 'time', columnKey: pending.calendarId, calendarId: pending.calendarId, activityId: null, dayKey: pending.day, range: pending.range } });
    setPending(null);
  };

  /* ---- "Nová objednávka" ---- */
  const nextFree = useNextFree(calendar);
  const bookNextFree = useCallback(
    async (extra: { initialPatientId?: string } = {}) => {
      const found = await nextFree.nextFreeBooking();
      if (!found) return;
      act.focusDate(found.day, true);
      openBooking({ ...found.prefill, ...extra });
    },
    [nextFree, act, openBooking],
  );

  /*
   * What other screens hand over by router state, each applied once per history entry (the calendar page's rules):
   *   `newAppointment` (a timestamp; the sidebar's big button, a patient's "Objednat termín" with `patientId`)
   *                    opens the booking on the next free slot once the calendars and bookings are known;
   *   `openClubOrder`  opens the club order chooser;
   *   `date`           moves the board to that day ("Zobrazit v kalendáři" from the club reservations);
   *   `serviceId`      shows only that služba ("Nová objednávka -> Vybrat v kalendáři").
   */
  const handoff = nav.state as { newAppointment?: unknown; patientId?: unknown; openClubOrder?: unknown; date?: unknown; serviceId?: unknown } | null;
  const handled = useRef({ newAppointment: null as unknown, club: null as string | null, date: null as string | null, service: null as string | null });
  const newAppointmentKey = typeof handoff?.newAppointment === 'number' ? handoff.newAppointment : null;
  const landingPatient = typeof handoff?.patientId === 'string' ? handoff.patientId : undefined;
  const mayBook = calendar?.mayBook ?? false;
  /* R15c (e): the main calendar's keyboard shortcuts (never on a club's own screen, never while typing) */
  const [helpOpen, setHelpOpen] = useState(false);
  const onClubScreenForKeys = useClubPlanner() !== null;
  const shortcutsOn = calendar !== null && config.mode === 'standard' && !onClubScreenForKeys;
  const shortcutHandlers = {
    new: () => {
      if (!mayBook) showNotice({ text: 'Nemáte oprávnění vytvářet rezervace.', tone: 'error' });
      else void bookNextFree();
    },
    today: () => act.today(ctx.today),
    prev: () => (view === 'month' ? act.previousMonth() : view === 'day' ? act.selectDay(addDaysToDateOnly(selectedDate, -1)) : act.previousWeek()),
    next: () => (view === 'month' ? act.nextMonth() : view === 'day' ? act.selectDay(addDaysToDateOnly(selectedDate, 1)) : act.nextWeek()),
    day: () => act.setView('day'),
    week: () => act.setView('week'),
    month: () => act.setView('month'),
    help: () => setHelpOpen((open) => !open),
  };
  const calendarReady = calendar !== null && calendar.ready && calendar.calendars.length > 0;
  useEffect(() => {
    if (!config.realCalendar || newAppointmentKey === null || handled.current.newAppointment === newAppointmentKey) return;
    if (!mayBook || !calendarReady) return;
    handled.current.newAppointment = newAppointmentKey;
    void bookNextFree(landingPatient ? { initialPatientId: landingPatient } : {});
  }, [config.realCalendar, newAppointmentKey, landingPatient, mayBook, calendarReady, bookNextFree]);
  const wantsClubOrder = handoff?.openClubOrder === true;
  useEffect(() => {
    if (!config.realCalendar || !wantsClubOrder || !mayBook || handled.current.club === nav.key) return;
    handled.current.club = nav.key;
    setEntryOpen(true);
  }, [config.realCalendar, wantsClubOrder, mayBook, nav.key]);
  const landingDate = typeof handoff?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(handoff.date) ? handoff.date : null;
  useEffect(() => {
    if (!config.realCalendar || landingDate === null || handled.current.date === nav.key) return;
    handled.current.date = nav.key;
    act.selectDay(landingDate);
  }, [config.realCalendar, landingDate, nav.key, act]);
  const landingService = typeof handoff?.serviceId === 'string' ? handoff.serviceId : null;
  const knownServices = settings.facets.services;
  useEffect(() => {
    if (!config.realCalendar || landingService === null || handled.current.service === nav.key) return;
    if (!knownServices.some((s) => s.id === landingService)) return;
    handled.current.service = nav.key;
    if (knownServices.length === 1) boardSettings.showAllServices();
    else boardSettings.onlyService(landingService);
  }, [config.realCalendar, landingService, knownServices, nav.key]);

  /* ---- clicks on cards, windows ---- */
  const openSession = useCallback(
    (card: SessionCardModel) => {
      setSelected(null);
      /* The prototype's `openEvent`: a club's term is managed, a public one is only looked at. */
      act.openDialog({ kind: card.source === 'club' ? 'agendaDetail' : 'eventDetail', id: card.session.id });
    },
    [act],
  );
  const selectBooking = useCallback((card: BookingCardModel, element: HTMLElement) => {
    setSelected((current) => (current?.card.appointment.id === card.appointment.id ? null : { card, element }));
  }, []);
  const openBookingDetail = useCallback((id: string) => {
    setSelected(null);
    setOpenId(id);
  }, []);
  const openWindow = useCallback((w: BoardWindowModel, point: { x: number; y: number }) => {
    if (w.kind === 'club') {
      setClubPick({
        clubBlockId: w.block.clubBlockId ?? w.block.id,
        clubId: w.block.clubId ?? null,
        clubName: w.label,
        colorHex: w.block.colorHex ?? null,
        range: w.clubDates ?? { from: w.day, to: w.day },
        block: w.block,
        x: point.x,
        y: point.y,
      });
    } else {
      setOpenBlock({ calendarId: w.calendarId, calendarName: w.calendarName, block: w.block });
    }
  }, []);

  /* Escape closes the summary. */
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const openApp = openId && calendar ? calendar.appointments.find((a) => a.id === openId) ?? null : null;

  /* ---- club windows -> the order, or "Upravit termíny" (planning mode of the page) ---- */
  const goOrder = (orderId: string) => {
    setClubPick(null);
    nav.go('/clubs/objednavky', { state: { openOrderId: orderId } });
  };
  const goBlock = (pick: ClubBlockPick) => {
    setClubPick(null);
    nav.go('/clubs', { state: { clubBlockId: pick.clubBlockId, ...(pick.clubId ? { clubId: pick.clubId } : {}) } });
  };
  const editTerms = async (order: ClubOrderView) => {
    setClubPick(null);
    let activities: Awaited<ReturnType<typeof fetchBlockableActivities>> = [];
    try {
      activities = await fetchBlockableActivities();
    } catch {
      /* the session is built without the catalogue; the page asks for what is missing */
    }
    nav.go(nav.pathname, { state: { pickOrder: { start: editSessionFor(order, activities, ctx.today) } } });
  };

  const noticeNode = notice ? (
    <div className="board-notice" role="status" data-testid="board-notice" data-tone={notice.tone}>{notice.text}</div>
  ) : null;

  /* ---- styles that come from the data ---- */
  const holiday = effectiveHolidayColor(catalogue?.dayMarkColors.holiday);
  const lunch = catalogue?.dayMarkColors.lunch ?? '#CBD1D8';
  const nowColor = calendar?.display.nowLineColor ?? CALENDAR_DISPLAY_OFFLINE.nowLineColor;
  const stepPx = stepLineHeight(geometry, lineStep);
  const tall = geometry.height > baseTimeline + 1;
  const labels = hourLabels(geometry, lineStep);
  const visibleCards = model.cards;

  const pendingRange = selection.live ?? (pending ? { col: pending.col, sub: pending.sub, range: pending.range } : null);
  const ghost = move.moving?.target ?? null;
  /* the lunch controls exist for a user who may book or edit, in the standard calendar, on a Stage 2 server */
  const lunchOn = calendar !== null && config.mode === 'standard' && calendar.stage2 && (calendar.mayBlock || calendar.mayBook);
  const dayLabelOf = (day: IsoDate): string => {
    const d = head.days.find((x) => x.date === day);
    return d ? `${d.weekName} ${d.label}` : day;
  };
  const filterActive = settings.ticked !== null || settings.serviceSet !== null || settings.employeeId !== null;

  const statusWord = useCallback(
    (a: DayAppointment) => {
      const name = statusName(a.status);
      return name ? t(`booking.status.${name}`) : t('booking.status.unknown');
    },
    [t],
  );
  const dayRows = useMemo(
    () => dayListModel(ctx, selectedDate, filter, calendar ? move.appointments : [], statusWord, calendar !== null),
    [ctx, selectedDate, filter, calendar, move.appointments, statusWord],
  );
  /* Club orders that block no time yet (a request, an offer): their days are marked in the week, the list and the month. */
  const inquiries = useInquiries(config.inquiryOrderId ?? null, calendar !== null);
  const blockedDays = useMemo(
    () => (calendar && view === 'month' ? blockedDaysOf(monthCells(calendarMonth), calendar.calendars.map((c) => c.id), calendar.blocksByCalendar) : new Set<string>()),
    [calendar, view, calendarMonth],
  );
  /* The windows of clubs, per day of the month: the club order is visible in the month, not only in the week. */
  const monthClubLines = useMemo(
    () => (calendar && view === 'month' && !phone ? clubLinesByDay(monthCells(calendarMonth), calendar.calendars.map((c) => c.id), calendar.drawBlocksByCalendar, lunchOfMarks(dayMarks), config.excludeClubBlockIds) : undefined),
    [calendar, view, phone, calendarMonth, dayMarks, config.excludeClubBlockIds],
  );
  const monthClubItems = useMemo(
    () => (calendar && view === 'month' ? clubItemsByDay(monthCells(calendarMonth), calendar.calendars.map((c) => c.id), calendar.drawBlocksByCalendar, lunchOfMarks(dayMarks), config.excludeClubBlockIds, calendar.catalogue) : undefined),
    [calendar, view, calendarMonth, dayMarks, config.excludeClubBlockIds],
  );
  const monthTiles = useMemo(
    () => monthTilesModel(ctx, calendarMonth, filter, calendar ? move.appointments : [], dayMarks, calendar !== null, { inquiries, blockedDays, calendarColumns: namedColumns, holidayColor: catalogue?.dayMarkColors.holiday, ...(monthClubLines ? { clubLines: monthClubLines } : {}), ...(monthClubItems ? { clubItems: monthClubItems } : {}) }),
    [ctx, calendarMonth, filter, calendar, move.appointments, dayMarks, inquiries, blockedDays, monthClubLines, monthClubItems, namedColumns, catalogue],
  );
  const [inquiryPop, setInquiryPop] = useState<{ day: IsoDate; x: number; y: number } | null>(null);

  /* R13: the club's held time is on the desktop "Den" list too, not only in the week and on the phone */
  const dayHolds = useMemo(
    () => (view === 'day' && !phone ? phoneEntries([], model.windows, selectedDate).filter((e) => e.kind === 'club') : []),
    [view, phone, model.windows, selectedDate],
  );

  /* ---- the phone's list: the day as an agenda with the week's strip, the month as a list of days ---- */
  const phoneAgenda = useMemo(() => {
    if (!phone || view !== 'day') return null;
    const bookings = calendar ? move.appointments : [];
    return {
      entries: phoneEntries(dayRows.rows, model.windows, selectedDate),
      strip: weekStripModel({
        days: head.days,
        selected: selectedDate,
        today: ctx.today,
        dayMarks,
        rowCount: (date) => dayListModel(ctx, date, filter, bookings, statusWord, calendar !== null).rows.length,
        windows: model.windows,
        inquiries,
        holidayColor: catalogue?.dayMarkColors.holiday,
      }),
    };
  }, [phone, view, calendar, move.appointments, dayRows, model.windows, selectedDate, head, ctx, dayMarks, filter, statusWord, inquiries, catalogue]);
  const phoneMonth = useMemo(() => {
    if (!phone || view !== 'month') return null;
    const lines = calendar
      ? clubLinesByDay(monthCells(calendarMonth), calendar.calendars.map((c) => c.id), calendar.drawBlocksByCalendar, lunchOfMarks(dayMarks), config.excludeClubBlockIds)
      : new Map<IsoDate, string[]>();
    return phoneMonthRows(monthTiles.tiles, lines, ctx.today);
  }, [phone, view, calendar, calendarMonth, dayMarks, config.excludeClubBlockIds, monthTiles, ctx.today]);

  /* On a club's own screen "Klub" is the order switcher's "Nová objednávka klubu"; the toolbar keeps room for the heading. */
  const onClubScreen = useClubPlanner() !== null;
  const entry = calendar && calendar.mayBook
    ? { onNewBooking: () => void bookNextFree(), ...(nav.available && !onClubScreen ? { onClubOrder: () => setEntryOpen(true) } : {}) }
    : null;

  /* The empty day's button: a booking in the real calendar, the file's "Vytvořit termín" otherwise. */
  const createTerm = () => {
    if (calendar && calendar.mayBook) {
      void bookNextFree();
      return;
    }
    if (!armed) {
      act.toast('Nejprve vyberte činnost z dolních karet.');
      return;
    }
    act.openDialog({ kind: 'newEvent' });
  };

  const boardStyle = {
    height: `${geometry.height}px`,
    '--hour-step': `${geometry.pxPerHour}px`,
    '--subs': subs,
    ...(stepPx ? { '--step-px': `${stepPx}px` } : {}),
    '--now-color': nowColor,
    '--now-edge': withAlpha(nowColor, 0.55),
  } as CSSProperties;

  return (
    <section
      className="planner glass-panel"
      aria-label="Týdenní kalendář"
      data-testid="week-board-panel"
      data-real-calendar={calendar ? 'true' : 'false'}
      data-layout={standardLayout ? 'standard' : 'club'}
    >
      <BoardToolbar head={head} view={view} filter={filter} categories={ctx.categories} today={ctx.today} act={act} entry={entry} filterActive={filterActive} zoomControl={zoomControl} serviceFilter={!clubMode} />
      {config.mode === 'standard' && config.realCalendar ? <CalendarStrip columns={columns} /> : null}
      <div
        id="week-board"
        className="week-board"
        ref={weekRef}
        tabIndex={0}
        role="group"
        aria-label="Časová osa týdne"
        aria-keyshortcuts="+ - 0"
        data-testid="week-board"
        onKeyDown={onBoardKey}
      >
        <div className="board-head" data-subs={subs > 1 ? subs : undefined}>
          <div className="time-head" />
          <div id="day-headings" className="day-headings">
            {head.days.map((d, i) => {
              const mark = dayMarks[d.date];
              const isToday = d.date === ctx.today;
              const flag = mark?.closed ? mark.label?.trim() || 'Zavřeno' : null;
              const lock = mark?.closed ? lockedDayLook(mark, holiday) : null;
              const asked = inquiries.get(d.date) ?? [];
              return (
                <div
                  className={`day-title${isToday ? ' is-today' : ''}${mark?.closed ? ' is-closed' : ''}${lock ? ` is-lock is-lock-${lock.kind}` : ''}${asked.length ? ' has-inquiry' : ''}`}
                  style={lock ? ({ '--lock-fill': lock.fill, '--lock-ink': lock.ink } as CSSProperties) : undefined}
                  title={flag ?? undefined}
                  key={d.date}
                  data-day={d.date}
                  data-col={i}
                  aria-current={isToday ? 'date' : undefined}
                  {...(clubWeekDays
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        'data-pick-day': 'true',
                        title: flag ?? PLANNER_TEXT.days.headingHint,
                        'aria-label': `${PLANNER_TEXT.days.headingLabel(`${d.weekName} ${d.label}`)}${flag ? ` - ${flag}` : ''}`,
                        onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
                          if ((e.target as HTMLElement).closest('.day-inquiry')) return;
                          pickHeadingDay(d.date, e.shiftKey);
                        },
                        onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            pickHeadingDay(d.date, e.shiftKey);
                          }
                        },
                      }
                    : {})}
                >
                  {d.weekName}
                  <strong>{d.label}</strong>
                  {columns ? (
                    <span className="day-calendars" data-testid={`day-calendars-${d.date}`} style={{ '--subs': subs } as CSSProperties}>
                      {columnChips(namedColumns ?? columns).map((chip) => (
                        <span key={chip.id} className="day-calendar" data-calendar-id={chip.id} title={chip.name} style={{ '--cal': chip.colour } as CSSProperties}>
                          <i aria-hidden="true" />
                          <span>{chip.name}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {asked.length ? (
                    <button
                      type="button"
                      className={`day-inquiry${asked.some((i) => i.current) ? ' is-current' : ''}`}
                      data-testid={`day-inquiry-${d.date}`}
                      aria-label={`${PLANNER_TEXT.inquiry.flagLabel(asked.length)}. ${PLANNER_TEXT.inquiry.openOrder}`}
                      title={asked.map(inquiryTitle).join(' · ')}
                      onClick={(e) => {
                        if (asked.length === 1) goOrder(asked[0]!.orderId);
                        else setInquiryPop({ day: d.date, x: e.clientX, y: e.clientY });
                      }}
                    >
                      {asked.some((i) => i.current) ? PLANNER_TEXT.inquiry.current : PLANNER_TEXT.inquiry.flag(asked.length)}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div
          className={`board-body${tall ? ' is-tall' : ''}`}
          id="board-body"
          data-testid="board-body"
          ref={bodyRef}
          onScroll={(event) => {
            const g = geometryRef.current;
            const minute = g.startMinutes + event.currentTarget.scrollTop / g.pxPerMinute;
            topMinuteRef.current = minute;
            boardSettings.setTopMinute(minute);
          }}
        >
          <div className="hour-column" id="hour-column" style={{ height: `${geometry.height}px` }}>
            {labels.map((h) => <div className={`hour-label${h.sub ? ' is-sub' : ''}`} key={h.label} style={{ top: `${h.top}px` }}>{h.label}</div>)}
          </div>
          <div
            /* The planning layer toggles `is-armed` / `moving-existing-term` / ... on this element itself, so the
               class stays constant here; the board's own states are data attributes. */
            className="day-board"
            data-board-mode={config.mode}
            data-pickable={mayMark && !planningOwnsPointer ? 'true' : undefined}
            data-selecting={selection.live ? 'true' : undefined}
            data-moving={move.moving ? 'true' : undefined}
            id="day-board"
            data-testid="day-board"
            data-subs={subs > 1 ? subs : undefined}
            data-zoom={settings.zoom}
            data-step={lineStep}
            data-snap={snapStep}
            ref={boardRef}
            style={boardStyle}
            onClickCapture={(e) => {
              /* The click the browser fires after a drop is not a click on the card. */
              if (move.consumeJustDragged()) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            {...selection.handlers}
          >
            <div className="grid-lines" aria-hidden="true" />
            {stepPx ? <div className="board-substeps" aria-hidden="true" data-testid="board-substeps" /> : null}
            <div className="rugby-decoration" aria-hidden="true" />

            <div className="board-shading" aria-hidden="true" data-testid="board-shading">
              {model.shades.map((s) => (
                <div key={s.day}>
                  {s.noHours ? <div className="board-shade is-nohours" style={{ '--col': s.col } as CSSProperties} data-testid={`shade-nohours-${s.day}`} /> : null}
                  {s.before ? <div className="board-shade is-off" style={{ '--col': s.col, top: s.before.top, height: s.before.height } as CSSProperties} data-testid={`shade-before-${s.day}`} /> : null}
                  {s.after ? <div className="board-shade is-off" style={{ '--col': s.col, top: s.after.top, height: s.after.height } as CSSProperties} data-testid={`shade-after-${s.day}`} /> : null}
                  {s.lunch ? (
                    <LunchBandEl
                      day={s.day}
                      col={s.col}
                      box={s.lunch}
                      state={s.lunch.moved ? 'moved' : 'weekly'}
                      colour={lunch}
                    />
                  ) : null}
                  {s.lunchRemoved ? (
                    <LunchBandEl
                      day={s.day}
                      col={s.col}
                      box={s.lunchRemoved}
                      state="removed"
                      colour={lunch}
                    />
                  ) : null}
                  {s.closed && s.lock ? (
                    /* R6: ONE opaque block over the whole column - no hour lines, no hatch, no cards seen through it. */
                    <div
                      className={`board-shade is-closed board-lock is-${s.lock.kind}`}
                      style={{ '--col': s.col, '--lock-fill': s.lock.fill, '--lock-ink': s.lock.ink } as CSSProperties}
                      data-testid={`closed-${s.day}`}
                      data-lock={s.lock.kind}
                      title={s.lock.reason ? `${s.lock.label} - ${s.lock.reason}` : s.lock.label}
                    >
                      <span className="board-sticky board-lock-label">
                        <Icon name="lock" />
                        <strong>{s.lock.label}</strong>
                        {s.lock.reason ? <small>{s.lock.reason}</small> : null}
                        {s.hidden.length > 0 ? (
                          <span className="board-lock-booked" data-testid={`closed-hidden-${s.day}`}>
                            {s.hidden.slice(0, 4).map((line) => <small key={line}>{line}</small>)}
                            {s.hidden.length > 4 ? <small>{`+${s.hidden.length - 4}`}</small> : null}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {model.calendarShades.length ? (
              <div className="board-calendar-shades" aria-hidden="true" data-testid="board-calendar-shades">
                {model.calendarShades.map((c) => (
                  <div key={c.key} className="board-calendar-shade" data-testid={`calendar-closed-${c.calendarId}-${c.day}`} title={`${c.calendarName}: ${c.label}`} style={{ '--col': c.col, '--sub': c.sub, '--subs': c.subs, '--shade-line': withAlpha(CLOSED_DAY_TEXT, 0.7), '--shade-hatch': hatchOf(CLOSED_DAY_TEXT, 0.22, 0.07) } as CSSProperties}>
                    <span className="board-sticky">{c.label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {calendar?.workerRule.on && split !== null ? (
              <Suspense fallback={null}>
                <ClashLayer
                  days={days}
                  split={split}
                  {...(calendar.alias ? { alias: calendar.alias } : {})}
                  calendars={calendar.calendars}
                  appointments={move.appointments}
                  blocksByCalendar={calendar.blocksByCalendar}
                  workerRule={calendar.workerRule}
                  dayMarks={dayMarks}
                  geometry={geometry}
                />
              </Suspense>
            ) : null}

            {lunchOn ? (
              <Suspense fallback={null}>
                <LunchLayer
                  calendar={calendar!}
                  days={days}
                  dayMarks={dayMarks}
                  shades={model.shades}
                  geometry={geometry}
                  boardRef={boardRef}
                  step={snapStep}
                  calendarOpen={calendarOpen}
                  paused={planningOwnsPointer || pinching || move.moving !== null}
                  notify={showNotice}
                  refresh={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['grid-preview'] });
                    await refreshCalendar();
                  }}
                  dayLabelOf={dayLabelOf}
                  onBook={(prefill) => openBooking(prefill)}
                />
              </Suspense>
            ) : null}

            {model.windows.length ? (
              <div className="board-windows" data-testid="board-windows">
                {model.windows.map((w) => <WindowBlock key={w.key} window={w} onOpen={openWindow} />)}
              </div>
            ) : null}

            <div id="grid-events" className="grid-events">
              {visibleCards.map((card) =>
                card.kind === 'session' ? (
                  <SessionCard key={card.key} card={card} armed={armed} onOpen={openSession} />
                ) : (
                  <BookingCard
                    key={card.key}
                    card={card}
                    selected={selected?.card.appointment.id === card.appointment.id}
                    proposed={move.proposal?.appointment.id === card.appointment.id}
                    moving={move.moving?.appointment.id === card.appointment.id}
                    dragEnabled={card.draggable && !planningOwnsPointer}
                    onPress={move.press}
                    onSelect={selectBooking}
                    onOpen={openBookingDetail}
                  />
                ),
              )}
              {model.overflow.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="board-chip"
                  data-board-item="overflow"
                  data-testid={`board-overflow-${chip.keys[0]}`}
                  aria-label={`Dalších ${chip.keys.length} termínů ve stejný čas`}
                  style={{ left: chip.left, width: chip.width, top: chip.top, height: chip.height }}
                  onClick={(e) => setFolded({ keys: chip.keys, x: e.clientX, y: e.clientY })}
                >
                  +{chip.keys.length}
                </button>
              ))}
            </div>

            {model.nowLine ? (
              <>
                <div className="board-now" style={{ top: model.nowLine.top }} data-testid="now-line" role="img" aria-label="Aktuální čas">
                  <span className="board-now-pill" data-testid="now-pill">{model.nowLine.label}</span>
                </div>
                {(['left', 'right'] as const).map((edge) => (
                  <div
                    key={edge}
                    className="board-today-edge"
                    data-testid={`now-edge-${edge}`}
                    style={{
                      top: model.nowLine!.edge.top,
                      height: model.nowLine!.edge.height,
                      left: edge === 'left' ? `calc(${model.nowLine!.col} * 100% / 7)` : `calc(${model.nowLine!.col + 1} * 100% / 7 - 2px)`,
                    }}
                  />
                ))}
              </>
            ) : null}

            {pendingRange ? (
              <div
                className="drag-preview board-selection"
                data-testid="board-selection"
                style={{
                  '--col': pendingRange.col,
                  '--sub': pendingRange.sub,
                  '--subs': subs,
                  top: (pendingRange.range.start - geometry.startMinutes) * geometry.pxPerMinute,
                  height: Math.max(11, (pendingRange.range.end - pendingRange.range.start) * geometry.pxPerMinute),
                } as CSSProperties}
              >
                <div className="preview-content">
                  <b>{spanLabel(pendingRange.range)}</b>
                  <small>{pendingRange.range.end - pendingRange.range.start} min</small>
                </div>
              </div>
            ) : null}

            {ghost ? (
              <>
                <div className={`move-lanes board-move-lanes${ghost.refusal ? ' is-invalid' : ''}`} style={{ '--col': ghost.col, '--sub': ghost.sub, '--subs': ghost.subs } as CSSProperties} aria-hidden="true" />
                <div
                  className={`move-ghost board-move-ghost${ghost.refusal ? ' not-allowed' : ''}`}
                  data-testid="move-ghost"
                  data-refused={ghost.refusal ?? undefined}
                  aria-hidden="true"
                  style={{
                    '--col': ghost.col,
                    '--sub': ghost.sub,
                    '--subs': ghost.subs,
                    ...toneVars(move.moving ? (model.cards.find((c) => c.kind === 'booking' && c.appointment.id === move.moving!.appointment.id)?.tone ?? ghostTone) : ghostTone),
                    '--move-tone': 'var(--ev-border)',
                    top: (ghost.range.start - geometry.startMinutes) * geometry.pxPerMinute,
                    height: Math.max(24, (ghost.range.end - ghost.range.start) * geometry.pxPerMinute),
                  } as CSSProperties}
                >
                  <div className="move-ghost-times" data-testid="move-ghost-time">{spanLabel(ghost.range)}</div>
                  <div className="move-ghost-foot">{move.moving?.appointment.patientName?.trim() || move.moving?.appointment.activityName}</div>
                  {ghost.refusal ? <div className="move-ghost-reason">{ghost.refusalNote ?? refusalLabel(ghost.refusal)}</div> : null}
                </div>
              </>
            ) : null}

            {planningPossible ? <PlanningBoardLayer /> : null}
          </div>
        </div>
        {noticeNode}
      </div>

      <div id="alternate-view" className="alternate-view" hidden={view === 'week'} data-testid="alternate-view">
        {view === 'day' && phoneAgenda ? (
          <PhoneAgenda
            heading={dayRows.heading}
            strip={phoneAgenda.strip}
            entries={phoneAgenda.entries}
            empty={dayRows.empty}
            inquiries={inquiries.get(selectedDate) ?? []}
            onSelectDay={(date) => act.selectDay(date)}
            onStep={(direction) => act.selectDay(addDays(selectedDate, direction))}
            onOpenEntry={(entry, point) => {
              if (entry.kind === 'booking') openBookingDetail(entry.id);
              else if (entry.window) openWindow(entry.window, point);
              else act.openDialog({ kind: ctx.sessions.find((s) => s.id === entry.id)?.origin === 'public' ? 'eventDetail' : 'agendaDetail', id: entry.id });
            }}
            onOpenInquiry={goOrder}
            onCreate={createTerm}
            canCreate={calendar?.mayBook ?? false}
          />
        ) : null}
        {view === 'day' && !phoneAgenda ? (
          <DayList
            model={dayRows}
            onOpen={(row) => {
              if (row.kind === 'booking') openBookingDetail(row.id);
              else act.openDialog({ kind: ctx.sessions.find((s) => s.id === row.id)?.origin === 'public' ? 'eventDetail' : 'agendaDetail', id: row.id });
            }}
            onCreate={createTerm}
            inquiries={inquiries.get(selectedDate) ?? []}
            onOpenInquiry={goOrder}
            holds={dayHolds}
            onOpenHold={(entry, point) => { if (entry.window) openWindow(entry.window, point); }}
          />
        ) : null}
        {view === 'month' && phoneMonth ? (
          <PhoneMonthList
            heading={monthTiles.heading}
            rows={phoneMonth}
            {...(clubPhoneDays ? { hint: PLANNER_TEXT.days.phoneClubHint } : {})}
            onPick={(date) => {
              if (clubPhoneDays) {
                void dayPick.pick([{ from: date, to: date }]);
                return;
              }
              act.selectDay(date);
              act.setView('day');
            }}
          />
        ) : null}
        {view === 'month' && !phoneMonth ? (
          <MonthMatrix
            model={monthTiles}
            onPick={(date) => {
              if (clubDays) {
                void dayPick.pick([{ from: date, to: date }]);
                return;
              }
              act.selectDay(date);
              act.setView('day');
            }}
            {...(maySelectDays
              ? {
                  selection: {
                    select,
                    surfaceRef: monthSurface,
                    today: ctx.today,
                    mayBlock: calendar?.mayBlock ?? false,
                    onBlock: () => setDayBlock(blockableRanges(select.places, ctx.today)),
                    ...(clubDays
                      ? {
                          club: {
                            busy: dayPick.busy,
                            onPlan: () => {
                              const ranges = select.places.map((p) => ({ from: p.from, to: p.to }));
                              select.clear();
                              void dayPick.pick(ranges);
                            },
                          },
                        }
                      : {}),
                  },
                }
              : {})}
          />
        ) : null}
      </div>

      <PlanFxHost />

      {/* ---- everything below is real-size MUI, portalled out of the stage ---- */}
      <SelectionPopover
        anchor={pending ? { x: pending.x, y: pending.y } : null}
        title={pending ? spanLabel(pending.range) : ''}
        subtitle={pending ? `${longDate(pending.day, false)} · ${minutesFree(pending.range.end - pending.range.start)}` : ''}
        caption={pending?.calendarName ?? undefined}
        mayBook={calendar?.mayBook ?? false}
        mayBlock={calendar?.mayBlock ?? false}
        onBook={chooseBook}
        onBlock={chooseBlock}
        onAddToClubOrder={chooseClub}
        onClose={() => setPending(null)}
      />

      {/* The days dragged across in the month: book from the first, block whole days, or hand them to a club order. */}
      <SelectionPopover
        anchor={addToClub || clubDays || !select.chosen ? null : { x: select.chosen.x, y: select.chosen.y }}
        title={select.chosen ? rangeDates(select.chosen) : ''}
        subtitle={select.chosen ? daysWord(dayCount(select.chosen)) : ''}
        caption={calendar && calendar.calendars.length > 1 ? `${GRID_TEXT.calendars}: ${calendar.calendars.map((c) => c.name).join(', ')}` : calendar?.calendars[0]?.name}
        mayBook={calendar?.mayBook ?? false}
        mayBlock={calendar?.mayBlock ?? false}
        hints={{ book: CAL_TEXT.rangeBookHint, block: CAL_TEXT.rangeBlockHint }}
        onBook={() => {
          const chosen = select.chosen;
          if (!chosen || !calendar) return;
          select.clear();
          openBooking({ initialDate: chosen.from, ...(calendar.calendars[0] ? { initialCalendarId: calendar.calendars[0].id } : {}), anchor: { x: chosen.x, y: chosen.y, width: 0, height: 0 } });
        }}
        onBlock={() => {
          const chosen = select.chosen;
          if (!chosen) return;
          select.clear();
          setDayBlock(blockableRanges([chosen], ctx.today));
        }}
        onAddToClubOrder={() => {
          const chosen = select.chosen;
          if (chosen) setAddToClub({ marked: { id: 'popover-range', kind: 'days', from: chosen.from, to: chosen.to } });
        }}
        onClose={select.clear}
      />

      <Popper
        open={selected !== null && selected.element.isConnected && move.moving === null}
        anchorEl={selected !== null && selected.element.isConnected ? selected.element : null}
        placement="right-start"
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }, { name: 'flip', enabled: true }, { name: 'preventOverflow', options: { padding: 8 } }]}
        sx={{ zIndex: (th) => th.zIndex.modal - 1 }}
      >
        {selected ? (
          <ClickAwayListener onClickAway={() => setSelected(null)} mouseEvent="onPointerDown" touchEvent="onTouchStart">
            <Paper
              role="dialog"
              aria-label={GRID_TEXT.openDetail}
              data-testid="appointment-summary"
              sx={{ p: 1, borderRadius: '10px', boxShadow: DESIGN.shadow.menu, border: '1px solid', borderColor: 'divider', maxWidth: 300 }}
            >
              <AppointmentHoverCard appointment={selected.card.appointment} calendarName={selected.card.calendar?.name} fields={calendar?.display.hoverFields ?? []} />
              <Button size="small" onClick={() => openBookingDetail(selected.card.appointment.id)} sx={{ mt: 0.5, minHeight: 36, width: '100%' }}>
                {GRID_TEXT.openDetail}
              </Button>
            </Paper>
          </ClickAwayListener>
        ) : null}
      </Popper>

      {busyMove ? (
        <Suspense fallback={null}>
          <WorkerBusyDialog
            title="Přesun termínu"
            busy={busyMove.busy}
            working={busyMove.working}
            forbidden={busyMove.forbidden}
            onOverride={(reason) => void overrideBusyMove(reason)}
            onClose={() => setBusyMove(null)}
          />
        </Suspense>
      ) : null}
      {move.proposal && move.proposalAnchor !== undefined ? (
        <MoveConfirmDialog
          key={move.proposal.appointment.id}
          move={move.proposal}
          anchorEl={move.proposalAnchor?.isConnected ? move.proposalAnchor : null}
          onClose={move.cancelProposal}
          onConfirm={move.confirmProposal}
        />
      ) : null}

      {gapAsk ? (
        <Suspense fallback={null}>
          <GapChoice question={gapAsk.q} x={gapAsk.x} y={gapAsk.y} onChoose={(range) => answerGap(gapAsk.q.kind, range)} onClose={() => setGapAsk(null)} />
        </Suspense>
      ) : null}

      {offeredAsk ? (
        <Suspense fallback={null}>
          <OfferedAsk
            ask={offeredAsk}
            onClose={() => setOfferedAsk(null)}
            onOrder={(id) => {
              setOfferedAsk(null);
              goOrder(id);
            }}
          />
        </Suspense>
      ) : null}

      <Popover
        open={inquiryPop !== null}
        onClose={() => setInquiryPop(null)}
        anchorReference="anchorPosition"
        anchorPosition={inquiryPop ? { top: inquiryPop.y, left: inquiryPop.x } : undefined}
        slotProps={{ paper: { sx: { width: 280, maxWidth: 'calc(100vw - 24px)', p: 1, borderRadius: '10px', boxShadow: DESIGN.shadow.menu } } }}
      >
        <div data-testid="inquiry-popover" role="group" aria-label={PLANNER_TEXT.inquiry.listTitle} className="inquiry-popover">
          {(inquiryPop ? inquiries.get(inquiryPop.day) ?? [] : []).map((inquiry) => (
            <Button
              key={inquiry.orderId}
              fullWidth
              data-testid={`inquiry-pop-${inquiry.orderId}`}
              sx={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 44 }}
              onClick={() => {
                setInquiryPop(null);
                goOrder(inquiry.orderId);
              }}
            >
              {inquiryLabel(inquiry)}
            </Button>
          ))}
        </div>
      </Popover>

      <Popover
        open={folded !== null}
        onClose={() => setFolded(null)}
        anchorReference="anchorPosition"
        anchorPosition={folded ? { top: folded.y, left: folded.x } : undefined}
        slotProps={{ paper: { sx: { width: 260, maxWidth: 'calc(100vw - 24px)', p: 1, borderRadius: '10px', boxShadow: DESIGN.shadow.menu } } }}
      >
        <div data-testid="board-folded">
          {(folded ? model.folded.filter((c) => folded.keys.includes(c.key)) : []).map((c) => (
            <Button
              key={c.key}
              fullWidth
              sx={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 44 }}
              onClick={() => {
                setFolded(null);
                if (c.kind === 'booking') openBookingDetail(c.appointment.id);
                else openSession(c);
              }}
            >
              {c.timeLabel} · {c.name}
            </Button>
          ))}
        </div>
      </Popover>

      {dayBlock && calendar ? (
        <DaysBlockDialog
          ranges={dayBlock}
          calendars={calendar.calendars}
          onClose={() => setDayBlock(null)}
          onDone={(count) => {
            setDayBlock(null);
            select.clear();
            act.toast(PLANNER_TEXT.days.blockDone(count));
            void refreshCalendar();
          }}
        />
      ) : null}
      {blockTarget ? <BlockReasonDialog target={blockTarget} onClose={() => setBlockTarget(null)} /> : null}
      {openBlock ? (
        <BlockDetailDialog
          calendarId={openBlock.calendarId}
          calendarName={openBlock.calendarName}
          block={openBlock.block}
          mayRemove={calendar?.mayBlock ?? false}
          onClose={() => setOpenBlock(null)}
        />
      ) : null}

      {addToClub && calendar ? (
        <AddToClubOrderDialog
          marked={addToClub.marked}
          calendars={calendar.calendars}
          serviceId={settings.serviceSet !== null && settings.serviceSet.size === 1 ? [...settings.serviceSet][0]! : null}
          today={ctx.today}
          onClose={() => setAddToClub(null)}
          onAdded={() => {
            setAddToClub(null);
            select.clear();
            void refreshCalendar();
          }}
        />
      ) : null}

      {clubPick ? (
        <Suspense fallback={null}>
          <ClubBlockPopover
            pick={clubPick}
            today={ctx.today}
            onOpen={goBlock}
            onOpenOrder={goOrder}
            {...(calendar?.mayBook && nav.available ? { onEditTerms: (order: ClubOrderView) => void editTerms(order) } : {})}
            onClose={() => setClubPick(null)}
            mayRelease={calendar?.mayBlock ?? false}
            onReleased={() => void refreshCalendar()}
          />
        </Suspense>
      ) : null}

      <ClubOrderEntry
        open={entryOpen && (calendar?.mayBook ?? false)}
        onClose={() => setEntryOpen(false)}
        onPhone={(clubId) => {
          setEntryOpen(false);
          nav.go(nav.pathname, { state: { pickOrder: clubId !== undefined ? { clubId } : true } });
        }}
      />

      {booking && calendar?.mayBook ? (
        <NewAppointmentDialog
          key={booking.key}
          open
          onClose={() => setBooking(null)}
          onBooked={() => void refreshCalendar()}
          onFindNextFree={nextFree.findForDialog}
          {...booking.prefill}
        />
      ) : null}

      {openApp?.calendarId ? (
        <Suspense fallback={null}>
          <AppointmentDetail
            appointmentId={openApp.id}
            calendarId={openApp.calendarId}
            calendar={calendar?.calendarById.get(openApp.calendarId)}
            open
            onClose={() => setOpenId(null)}
            onChanged={() => void refreshCalendar()}
            onCancelled={armCancelUndo}
          />
        </Suspense>
      ) : null}

      {undoEntry !== null ? (
        <Suspense fallback={null}>
          <BoardUndo entry={undoEntry} refresh={refreshCalendar} notify={showNotice} describeError={(error) => errorText(error, t)} />
        </Suspense>
      ) : null}
      {shortcutsOn ? (
        <Suspense fallback={null}>
          <BoardShortcuts handlers={shortcutHandlers} />
        </Suspense>
      ) : null}
      {helpOpen ? (
        <Suspense fallback={null}>
          <ShortcutsHelp onClose={() => setHelpOpen(false)} />
        </Suspense>
      ) : null}
    </section>
  );
}

function refusalLabel(refusal: string): string {
  switch (refusal) {
    case 'calendar':
      return GRID_TEXT.moveOtherCalendar;
    case 'closed':
      return GRID_TEXT.moveClosed;
    case 'hours':
      return GRID_TEXT.moveOutsideHours;
    default:
      return GRID_TEXT.moveBusy;
  }
}
