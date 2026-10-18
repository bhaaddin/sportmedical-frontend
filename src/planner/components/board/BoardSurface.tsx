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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, ClickAwayListener, Paper, Popover, Popper } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../../api/appointments';
import { statusName, type DayAppointment, type TimeBlock } from '../../../api/bookingContracts';
import { CALENDAR_DISPLAY_OFFLINE } from '../../../api/displaySettings';
import { AppointmentDetail } from '../../../components/booking/AppointmentDetail';
import { NewAppointmentDialog } from '../../../components/booking/NewAppointmentDialog';
import { AppointmentHoverCard } from '../../../components/booking/grid/AppointmentHoverCard';
import { BlockDetailDialog, BlockReasonDialog, type BlockTarget } from '../../../components/booking/grid/BlockDialogs';
import { GRID_TEXT } from '../../../components/booking/grid/gridText';
import { columnStep } from '../../../components/booking/grid/moveDrag';
import { longDate, minutesFree } from '../../../components/booking/grid/periodTitle';
import { resolutionOf } from '../../../components/booking/grid/resolution';
import { localDateTime, pragueMinuteOfDay, spanLabel, spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import type { GridMoveRequest } from '../../../components/booking/grid/moveRequest';
import { MoveConfirmDialog } from '../../../components/booking/calendar/MoveConfirmDialog';
import { AddToClubOrderDialog } from '../../../components/booking/calendar/AddToClubOrderDialog';
import { ClubBlockPopover, type ClubBlockPick } from '../../../components/booking/calendar/ClubBlockPopover';
import { SelectionPopover } from '../../../components/booking/calendar/SelectionPopover';
import { ClubOrderEntry } from '../../../components/clubs/order/ClubOrderEntry';
import { editSessionFor } from '../../../components/clubs/order/editSession';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { DESIGN } from '../../../theme';
import { pragueDateKey } from '../../../utils/time';
import { errorText } from '../../../components/booking/errorText';
import { addDays, weekHeadModel, type IsoDate } from '../../model';
import { plannerKeys } from '../../data/PlannerDataSource';
import { usePlannerData } from '../../data/PlannerDataProvider';
import { usePlannerActions, usePlannerSelector } from '../../state/PlannerStoreProvider';
import { PlanningBoardLayer } from '../PlanningBoardLayer';
import { DESIGN_TIMELINE_HEIGHT, useBoardMetrics } from '../PlannerMetrics';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { DayList, MonthMatrix } from './AlternateView';
import { BookingCard, SessionCard, WindowBlock } from './BoardCards';
import { BoardToolbar } from './BoardToolbar';
import type { BoardCalendarData } from './boardCalendar';
import { useBoardConfig } from './boardConfig';
import { boardGeometry, hourLabels, STANDARD_TIMELINE_HEIGHT, stepLineHeight, widenWindow, yOfMinute } from './boardGeometry';
import {
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
import { useBoardNow } from './useBoardNow';
import { useBoardSelection, type BoardSelection } from './useBoardSelection';
import { useNextFree } from './useNextFree';
import { useClubPlanner } from '../../club/ClubPlannerContext';
import { useSafeNavigate } from './useSafeNavigate';
import './board.css';

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
  anchor?: { x: number; y: number; width: number; height: number };
}

interface PendingSelection extends BoardSelection {
  calendarId: string | null;
  calendarName: string | null;
}

export function BoardSurface({ calendar }: { calendar: BoardCalendarData | null }) {
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
  const resolution = resolutionOf(settings.zoom);
  /* A board widened above the planning window opens at the planning window, not at the odd hour. */
  const windowTop = drawnWindow.startMinutes;
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = yOfMinute(geometry, ctx.window.startMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowTop, weekStart, standardLayout]);
  const head = useMemo(() => weekHeadModel(weekStart, ctx.window), [weekStart, ctx.window]);
  const days = head.days.map((d) => d.date);

  const boardRef = useRef<HTMLDivElement | null>(null);
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

  /* ---- a selected card shows its summary; the click goes on to the detail ---- */
  const [selected, setSelected] = useState<{ card: BookingCardModel; element: HTMLElement } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  /* ---- moving a booking ---- */
  const commitMove = useCallback(
    async (move: GridMoveRequest) => {
      const notice = await appointmentsApi.reschedule(move.calendarId, move.appointment.id, move.startUtc, undefined, { notifyPatient: move.notifyPatient });
      await refreshCalendar();
      return notice;
    },
    [refreshCalendar],
  );
  const move = useBoardMove({
    boardRef,
    geometry,
    days,
    calendar,
    dayMarks,
    resolutionStep: resolution.step,
    paused: planningOwnsPointer,
    onCommit: commitMove,
    onNotice: showNotice,
    describeError: (error) => errorText(error, t),
    onDragStart: () => setSelected(null),
  });

  /* ---- the model ---- */
  const model = useMemo(
    () =>
      buildBoardModel({
        ctx,
        weekStart,
        filter,
        geometry,
        dayMarks,
        dayMarkColors: catalogue?.dayMarkColors ?? { holiday: '#E7CBA9', lunch: '#CBD1D8' },
        calendar: calendar
          ? {
              calendars: calendar.calendars,
              appointments: move.appointments,
              blocksByCalendar: calendar.blocksByCalendar as Map<string, TimeBlock[]>,
              catalogue: calendar.catalogue,
              mayBook: calendar.mayBook,
              excludeClubId: config.excludeClubId,
              ...(config.excludeClubBlockIds ? { excludeClubBlockIds: config.excludeClubBlockIds } : {}),
            }
          : null,
        nowMinute,
      }),
    [ctx, weekStart, filter, geometry, dayMarks, catalogue, calendar, move.appointments, config.excludeClubId, config.excludeClubBlockIds, nowMinute],
  );

  /* ---- marking free time ---- */
  /* Marking free time is the everyday calendar's gesture; while a club order is planned the board belongs to the order
     (a press on an empty board there is the planning layer's: it asks for a činnost first). */
  const mayMark = calendar !== null && (calendar.mayBook || calendar.mayBlock) && config.mode === 'standard';
  const step = useMemo(() => {
    const own = calendar?.calendars.map((c) => columnStep(c, resolution.step)) ?? [];
    return own.length ? Math.min(resolution.step, ...own) : resolution.step;
  }, [calendar, resolution.step]);
  const [pending, setPending] = useState<PendingSelection | null>(null);

  /** The calendar a marked time belongs to: the first that works that day (and is not off for the worker). */
  const calendarFor = useCallback(
    (day: IsoDate, range: MinuteRange): { id: string; name: string } | null => {
      if (!calendar) return null;
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
    [calendar],
  );

  const selection = useBoardSelection({
    boardRef,
    geometry,
    days,
    step,
    enabled: mayMark && view === 'week' && !planningOwnsPointer && move.moving === null,
    dayOpen: (day) => !(dayMarks[day]?.closed ?? false),
    onSelect: (sel) => {
      setSelected(null);
      const cal = calendarFor(sel.day, sel.range);
      setPending({ ...sel, calendarId: cal?.id ?? null, calendarName: cal?.name ?? null });
    },
  });

  /* ---- what the popover's actions open ---- */
  const [booking, setBooking] = useState<{ key: number; prefill: BookingPrefill } | null>(null);
  const openBooking = useCallback((prefill: BookingPrefill) => setBooking((c) => ({ key: (c?.key ?? 0) + 1, prefill })), []);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [openBlock, setOpenBlock] = useState<{ calendarId: string; calendarName: string; block: TimeBlock } | null>(null);
  const [addToClub, setAddToClub] = useState<{ day: IsoDate; calendarId: string; range: MinuteRange } | null>(null);
  const [clubPick, setClubPick] = useState<ClubBlockPick | null>(null);
  const [folded, setFolded] = useState<{ keys: string[]; x: number; y: number } | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const selectionAnchor = (): { x: number; y: number; width: number; height: number } => {
    const el = boardRef.current?.querySelector<HTMLElement>('.board-selection');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : { x: pending?.x ?? 0, y: pending?.y ?? 0, width: 0, height: 0 };
  };

  const chooseBook = () => {
    if (!pending || !pending.calendarId) return;
    const anchor = selectionAnchor();
    openBooking({
      initialDate: pending.day,
      initialCalendarId: pending.calendarId,
      initialStart: localDateTime(pending.day, pending.range.start),
      initialEnd: localDateTime(pending.day, pending.range.end),
      ...(filter !== 'all' && calendar?.catalogue.activities.has(filter) ? { initialActivityId: filter } : {}),
      anchor,
    });
    setPending(null);
  };
  const chooseBlock = () => {
    if (!pending || !pending.calendarId) return;
    setBlockTarget({ calendarId: pending.calendarId, calendarName: pending.calendarName ?? '', dayKey: pending.day, range: pending.range });
    setPending(null);
  };
  const chooseClub = () => {
    if (!pending || !pending.calendarId) return;
    setAddToClub({ day: pending.day, calendarId: pending.calendarId, range: pending.range });
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
  const holiday = catalogue?.dayMarkColors.holiday ?? '#E7CBA9';
  const lunch = catalogue?.dayMarkColors.lunch ?? '#CBD1D8';
  const nowColor = calendar?.display.nowLineColor ?? CALENDAR_DISPLAY_OFFLINE.nowLineColor;
  const stepPx = stepLineHeight(geometry, resolution.step);
  const tall = geometry.height > baseTimeline + 1;
  const labels = hourLabels(geometry);
  const visibleCards = model.cards;

  const pendingRange = selection.live ?? (pending ? { col: pending.col, range: pending.range } : null);
  const ghost = move.moving?.target ?? null;
  const filterActive = settings.ticked !== null || settings.serviceSet !== null || settings.employeeId !== null;

  const dayRows = useMemo(
    () =>
      dayListModel(
        ctx,
        selectedDate,
        filter,
        calendar ? move.appointments : [],
        (a: DayAppointment) => {
          const name = statusName(a.status);
          return name ? t(`booking.status.${name}`) : t('booking.status.unknown');
        },
        calendar !== null,
      ),
    [ctx, selectedDate, filter, calendar, move.appointments, t],
  );
  const monthTiles = useMemo(
    () => monthTilesModel(ctx, calendarMonth, filter, calendar ? move.appointments : [], dayMarks, calendar !== null),
    [ctx, calendarMonth, filter, calendar, move.appointments, dayMarks],
  );

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
      <BoardToolbar head={head} view={view} filter={filter} categories={ctx.categories} today={ctx.today} act={act} entry={entry} filterActive={filterActive} />
      <div id="week-board" className="week-board">
        <div className="board-head">
          <div className="time-head" />
          <div id="day-headings" className="day-headings">
            {head.days.map((d, i) => {
              const mark = dayMarks[d.date];
              const isToday = d.date === ctx.today;
              const flag = mark?.closed ? mark.label?.trim() || 'Zavřeno' : null;
              return (
                <div
                  className={`day-title${isToday ? ' is-today' : ''}${mark?.closed ? ' is-closed' : ''}`}
                  title={flag ?? undefined}
                  key={d.date}
                  data-day={d.date}
                  data-col={i}
                  aria-current={isToday ? 'date' : undefined}
                >
                  {d.weekName}
                  <strong>{d.label}</strong>
                </div>
              );
            })}
          </div>
        </div>
        <div className={`board-body${tall ? ' is-tall' : ''}`} id="board-body" data-testid="board-body" ref={bodyRef}>
          <div className="hour-column" id="hour-column" style={{ height: `${geometry.height}px` }}>
            {labels.map((h) => <div className="hour-label" key={h.label} style={{ top: `${h.top}px` }}>{h.label}</div>)}
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
            data-zoom={settings.zoom}
            data-step={resolution.step}
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
                    <div
                      className="board-shade is-lunch"
                      style={{
                        '--col': s.col,
                        top: s.lunch.top,
                        height: s.lunch.height,
                        '--shade-line': withAlpha(lunch, 0.8),
                        '--shade-hatch': hatchOf(lunch, 0.22, 0.07),
                      } as CSSProperties}
                      data-testid={`lunch-${s.day}`}
                      title={`Oběd ${s.lunch.from}–${s.lunch.to}`}
                    >
                      Oběd
                    </div>
                  ) : null}
                  {s.closed ? (
                    <div
                      className="board-shade is-closed"
                      style={{
                        '--col': s.col,
                        '--shade-line': withAlpha(holiday, 0.7),
                        '--shade-hatch': hatchOf(holiday, 0.22, 0.07),
                      } as CSSProperties}
                      data-testid={`closed-${s.day}`}
                    >
                      {s.closedLabel}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

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
                <div className={`move-lanes board-move-lanes${ghost.refusal ? ' is-invalid' : ''}`} style={{ '--col': ghost.col } as CSSProperties} aria-hidden="true" />
                <div
                  className={`move-ghost board-move-ghost${ghost.refusal ? ' not-allowed' : ''}`}
                  data-testid="move-ghost"
                  data-refused={ghost.refusal ?? undefined}
                  aria-hidden="true"
                  style={{
                    '--col': ghost.col,
                    ...toneVars(move.moving ? (model.cards.find((c) => c.kind === 'booking' && c.appointment.id === move.moving!.appointment.id)?.tone ?? '#0fead6') : '#0fead6'),
                    '--move-tone': 'var(--ev-border)',
                    top: (ghost.range.start - geometry.startMinutes) * geometry.pxPerMinute,
                    height: Math.max(24, (ghost.range.end - ghost.range.start) * geometry.pxPerMinute),
                  } as CSSProperties}
                >
                  <div className="move-ghost-times" data-testid="move-ghost-time">{spanLabel(ghost.range)}</div>
                  <div className="move-ghost-foot">{move.moving?.appointment.patientName?.trim() || move.moving?.appointment.activityName}</div>
                  {ghost.refusal ? <div className="move-ghost-reason">{refusalLabel(ghost.refusal)}</div> : null}
                </div>
              </>
            ) : null}

            {planningPossible ? <PlanningBoardLayer /> : null}
          </div>
        </div>
        {noticeNode}
      </div>

      <div id="alternate-view" className="alternate-view" hidden={view === 'week'} data-testid="alternate-view">
        {view === 'day' ? (
          <DayList
            model={dayRows}
            onOpen={(row) => {
              if (row.kind === 'booking') openBookingDetail(row.id);
              else act.openDialog({ kind: ctx.sessions.find((s) => s.id === row.id)?.origin === 'public' ? 'eventDetail' : 'agendaDetail', id: row.id });
            }}
            onCreate={createTerm}
          />
        ) : null}
        {view === 'month' ? (
          <MonthMatrix
            model={monthTiles}
            onPick={(date) => {
              act.selectDay(date);
              act.setView('day');
            }}
          />
        ) : null}
      </div>

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

      {move.proposal && move.proposalAnchor !== undefined ? (
        <MoveConfirmDialog
          key={move.proposal.appointment.id}
          move={move.proposal}
          anchorEl={move.proposalAnchor?.isConnected ? move.proposalAnchor : null}
          onClose={move.cancelProposal}
          onConfirm={move.confirmProposal}
        />
      ) : null}

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
          marked={{ id: 'pending-range', kind: 'time', columnKey: addToClub.calendarId, calendarId: addToClub.calendarId, activityId: null, dayKey: addToClub.day, range: addToClub.range }}
          calendars={calendar.calendars}
          serviceId={settings.serviceSet !== null && settings.serviceSet.size === 1 ? [...settings.serviceSet][0]! : null}
          today={ctx.today}
          onClose={() => setAddToClub(null)}
          onAdded={() => {
            setAddToClub(null);
            void refreshCalendar();
          }}
        />
      ) : null}

      <ClubBlockPopover
        pick={clubPick}
        today={ctx.today}
        onOpen={goBlock}
        onOpenOrder={goOrder}
        {...(calendar?.mayBook && nav.available ? { onEditTerms: (order: ClubOrderView) => void editTerms(order) } : {})}
        onClose={() => setClubPick(null)}
      />

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
        <AppointmentDetail
          appointmentId={openApp.id}
          calendarId={openApp.calendarId}
          calendar={calendar?.calendarById.get(openApp.calendarId)}
          open
          onClose={() => setOpenId(null)}
          onChanged={() => void refreshCalendar()}
        />
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
