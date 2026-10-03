import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RemoveIcon from "@mui/icons-material/Remove";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Link as MuiLink } from "@mui/material";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi } from "../../api/clinicServices";
import { holidaysApi, type ClinicHoliday } from "../../api/holidays";
import { readPublicClinic } from "../../api/clinicSettings";
import { usePermission } from "../../auth/usePermission";
import { appointmentsApi } from "../../api/appointments";
import { workingHoursApi } from "../../api/workingHours";
import { statusTally } from "../../api/bookingContracts";
import type { DayAppointment, PreviewDay, TimeBlock } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { AppointmentDetail } from "../../components/booking/AppointmentDetail";
import { NewAppointmentDialog } from "../../components/booking/NewAppointmentDialog";
import { AppointmentButton } from "../../components/booking/grid/AppointmentButton";
import { GridSidebar, type GridView } from "../../components/booking/grid/GridSidebar";
import { TimeGrid, type GridBookingRequest } from "../../components/booking/grid/TimeGrid";
import {
  closedHolidayDates,
  dayMark,
  holidayDates,
  yearsBetween,
  type DayMark,
} from "../../components/booking/grid/dayMarks";
import {
  dayBelongsTo,
  emphasis,
  employeesIn,
  mondayOf,
  toggleCalendar,
  visibleCalendars,
  type Employee,
} from "../../components/booking/grid/filters";
import { GRID_TEXT } from "../../components/booking/grid/gridText";
import {
  NEXT_FREE_HORIZON_DAYS,
  nextFreeSlotAcrossDays,
  type DayFacts,
} from "../../components/booking/grid/nextFreeSlot";
import type { FoundSlot } from "../../components/booking/NewAppointmentDialog";
import { resolveNowLineColor } from "../../components/booking/grid/nowLine";
import {
  WEEKDAY_ABBREVIATION,
  periodTitle,
  shortDate,
  weekdayLong,
} from "../../components/booking/grid/periodTitle";
import {
  RESOLUTIONS,
  resolutionOf,
  stepResolution,
} from "../../components/booking/grid/resolution";
import { useCalendarDisplay } from "../../api/displaySettings";
import {
  formatMinutes,
  localDateTime,
  parseTimeOfDay,
  pragueMinuteOfDay,
  spanOnDay,
  touchesDay,
  visibleHours,
  type MinuteRange,
} from "../../components/booking/grid/timeRange";
import { DESIGN } from "../../theme";
import { StatusChip } from "../../components/ui/StatusChip";
import { SectionLabel } from "../../components/ui/SectionLabel";
import {
  addDaysToDateOnly,
  formatDateOnly,
  pragueDateKey,
} from "../../utils/time";
import { inactiveAmong } from "./calendarLifecycle";

/**
 * The calendar - contract screen 5.1, drawn to the board of 3. 10. 2026:
 *
 *   TOP    ‹ › Dnes · the period · Den | Týden | Měsíc · Nová objednávka
 *          under it ROZLIŠENÍ − [Hodina | 30 min | 10 min] + · the filters
 *   LEFT   mini calendar, the calendars, who works, the SLUŽBY legend
 *   MAIN   the grid: time axis, bookings, working hours, holidays, drag & drop
 *
 * Rules that shape it and are easy to break:
 *
 *  - **It never asks for availability** (6.1). The grid draws appointments,
 *    blocks and working hours; a drag only picks a time and the booking dialog
 *    asks the server whether it can be booked.
 *  - **Filters filter.** The calendar checkboxes, the service and the employee
 *    decide what is drawn; they never just decorate a list that stays the same.
 *  - **Colour never carries meaning alone** (7.1). Every appointment shows its
 *    status as text, every closed day says why in words, and every one of them
 *    is a button, not a div with onClick.
 */

type ViewMode = GridView;

interface BookingPrefill {
  initialDate?: string;
  initialCalendarId?: string;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. Read by the dialog once it takes them. */
  initialStart?: string;
  initialEnd?: string;
  /** The patient's card said "Objednat termín": the drawer opens with them chosen. */
  initialPatientId?: string;
}

/** Shifts by whole calendar months, clamping a day the target month lacks. */
function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const d = String(Math.min(day, lastDay)).padStart(2, "0");
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${target.getUTCFullYear()}-${m}-${d}`;
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

/**
 * The last resort of "Nová objednávka" when the preview for the days ahead
 * cannot be had: the first Monday-to-Friday that is not a known holiday, at
 * the earliest opening time any known day has (08:00 when none is known).
 * A proposal, not a claim - the drawer asks the server whether it is free.
 */
function firstOpenWeekday(
  start: { dayKey: string; minute: number },
  known: ReadonlyMap<string, PreviewDay>,
  holidays: ReadonlyMap<string, ClinicHoliday>,
): { dayKey: string; slot: MinuteRange } | null {
  let opening: number | null = null;
  for (const row of known.values()) {
    const at = row.isOpen ? parseTimeOfDay(row.startTime) : null;
    if (at !== null && (opening === null || at < opening)) opening = at;
  }
  const openAt = opening ?? 8 * 60;
  let dayKey = start.dayKey;
  for (let i = 0; i < NEXT_FREE_HORIZON_DAYS; i += 1) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const holiday = holidays.get(dayKey);
    const workday = weekday >= 1 && weekday <= 5 && !(holiday?.isHoliday ?? false);
    const known_ = known.get(dayKey);
    const shut = known_ !== undefined && !known_.isOpen;
    if (workday && !shut && (i > 0 || start.minute <= openAt)) {
      return { dayKey, slot: { start: openAt, end: openAt + 30 } };
    }
    dayKey = addDaysToDateOnly(dayKey, 1);
  }
  return null;
}

/*
 * Stable `combine` functions: TanStack reruns one only when a result changed,
 * so the lists below keep their identity between renders and the memos built
 * on them do not rebuild every minute for nothing.
 */
function dataOfEach(results: { data?: TimeBlock[] }[]): (TimeBlock[] | undefined)[] {
  return results.map((r) => r.data);
}

function allHolidays(results: { data?: ClinicHoliday[] }[]): ClinicHoliday[] {
  return results.flatMap((r) => r.data ?? []);
}

/** The square ‹ › buttons of the top bar. */
function SquareButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 40,
            height: 40,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: `${DESIGN.radius.lg}px`,
            bgcolor: "background.paper",
            color: "text.primary",
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function CalendarGridPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const mayManageCalendars = usePermission("settings.clinic.manage");
  const mayBook = usePermission("bookings.create");
  const mayBlock = usePermission("bookings.edit");

  const [view, setView] = useState<ViewMode>("week");
  /* Vertical zoom for the grid — a per-viewer convenience, remembered locally. */
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("calendarZoom"));
      return v >= 0.6 && v <= 2 ? v : 1;
    } catch {
      return 1;
    }
  });
  const changeZoom = useCallback(
    (delta: number) =>
      setZoom((z) => {
        const next = Math.min(2, Math.max(0.6, Math.round((z + delta) * 10) / 10));
        try {
          localStorage.setItem("calendarZoom", String(next));
        } catch {
          /* storage blocked; zoom still works for this view */
        }
        return next;
      }),
    [],
  );
  const resolution = resolutionOf(zoom);
  const setResolution = (key: string) => {
    const level = RESOLUTIONS.find((r) => r.key === key);
    if (level) changeZoom(level.zoom - zoom);
  };
  const [anchor, setAnchor] = useState<string>(() => pragueDateKey(new Date()));
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  /* 5.9: the dialog is reachable from the button and from a drag on the grid. */
  const [booking, setBooking] = useState<{ key: number; prefill: BookingPrefill } | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());

  /*
   * 6.2 and the now-line: both are facts about the clock. The tick lands on
   * the minute, so the line moves when the clock on the wall does.
   */
  useEffect(() => {
    let interval: number | undefined;
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(
      () => {
        tick();
        interval = window.setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );
  const allIds = useMemo(() => calendars.map((c) => c.id), [calendars]);

  /*
   * Named, not silently dropped: an inactive calendar is not drawn here - its
   * hours no longer count and nothing new can be booked into it - and a
   * calendar that simply vanished would leave "where did it go" unanswered.
   */
  const hiddenInactive = useMemo(
    () => inactiveAmong(calendarsQuery.data ?? []),
    [calendarsQuery.data],
  );

  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  /* Only services a visible calendar runs: filtering by any other shows nothing, always. */
  const services = useMemo(
    () =>
      (servicesQuery.data ?? []).filter(
        (s) => s.isActive && calendars.some((c) => c.clinicServiceId === s.id),
      ),
    [servicesQuery.data, calendars],
  );

  const serviceCalendars = useMemo(
    () => visibleCalendars(calendars, null, serviceId),
    [calendars, serviceId],
  );
  const shown = useMemo(
    () => visibleCalendars(calendars, ticked, serviceId),
    [calendars, ticked, serviceId],
  );

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const monday = mondayOf(anchor);
      return Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(monday, i));
    }
    /*
     * Whole weeks around the month, so every row has seven columns. Six weeks
     * is 42 days, inside the 62-day ceiling the range endpoint enforces, so the
     * month is still one request (7.3).
     */
    const [year, month] = anchor.split("-").map(Number);
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const gridStart = mondayOf(firstOfMonth);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const gridEnd = addDaysToDateOnly(mondayOf(lastOfMonth), 6);
    const out: string[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDaysToDateOnly(d, 1)) out.push(d);
    return out;
  }, [view, anchor]);

  const anchorMonth = anchor.slice(0, 7);
  const from = days[0];
  const to = days[days.length - 1];

  /**
   * One request for the whole visible window and every calendar the user may
   * see (7.3). The checkboxes and filters then narrow it on this side, so
   * ticking a calendar redraws at once instead of asking again.
   */
  const appointmentsQuery = useQuery({
    queryKey: ["day-range", from, to, allIds.join(",")],
    queryFn: () => appointmentsApi.range(from, to, allIds),
    enabled: allIds.length > 0,
    placeholderData: (previous) => previous,
    /* The calendar is a shared board: a booking made online, or at another desk,
       should appear here on its own. A minute keeps it live without hammering the
       server, and refetchOnWindowFocus already covers coming back to the tab. */
    refetchInterval: 60_000,
  });

  /**
   * What each calendar does on each day - hours, break, worker, closed and
   * why. `preview` answers per calendar, so this is one call per calendar.
   */
  const previewQuery = useQuery({
    queryKey: ["grid-preview", from, to, allIds.join(",")],
    queryFn: async () => {
      const perCalendar = await Promise.all(
        calendars.map(async (calendar) => {
          const rows = await workingHoursApi.preview(calendar.id, from, to);
          return [calendar.id, new Map(rows.map((row) => [row.date, row]))] as const;
        }),
      );
      return new Map<string, Map<string, PreviewDay>>(perCalendar);
    },
    enabled: allIds.length > 0,
    placeholderData: (previous) => previous,
  });
  const previewByCalendar = useMemo(
    () => previewQuery.data ?? new Map<string, Map<string, PreviewDay>>(),
    [previewQuery.data],
  );

  const timeGridShown = !isPhone && view !== "month";

  /* Blocks are drawn only where there is a time axis to draw them on. */
  const blockLists = useQueries({
    queries: shown.map((calendar) => ({
      queryKey: ["blocks", calendar.id, from, to],
      queryFn: () => appointmentsApi.blocks(calendar.id, from, to),
      enabled: timeGridShown,
      placeholderData: (previous: TimeBlock[] | undefined) => previous,
    })),
    combine: dataOfEach,
  });
  const blocksByCalendar = useMemo(() => {
    const map = new Map<string, TimeBlock[]>();
    shown.forEach((calendar, i) => map.set(calendar.id, blockLists[i] ?? []));
    return map;
  }, [shown, blockLists]);

  /* The mini calendar may be showing the anchor's year while the grid spans New Year. */
  const years = useMemo(
    () => Array.from(new Set([...yearsBetween(from, to), Number(anchor.slice(0, 4))])),
    [from, to, anchor],
  );
  const holidays = useQueries({
    queries: years.map((year) => ({
      queryKey: ["holidays", year],
      queryFn: () => holidaysApi.year(year),
      staleTime: 10 * 60 * 1000,
    })),
    combine: allHolidays,
  });
  const holidayByDate = useMemo(
    () => new Map<string, ClinicHoliday>(holidays.map((h) => [h.date, h])),
    [holidays],
  );

  /*
   * The calendar's own display settings, from the one endpoint every signed-in
   * staff member may read. The now-line and holiday colours used to come from
   * the admin-only `/api/settings` (settings.clinic.manage), so every
   * receptionist saw the theme's error colour instead of the owner's choice;
   * they are the same owner's settings, so they are read from the same place.
   */
  const { settings: calendarDisplay, loaded: calendarDisplayLoaded } = useCalendarDisplay();
  const holidayColor = calendarDisplay.holidayColor;
  const lunchColor = calendarDisplay.lunchColor;
  const nowLineColor = resolveNowLineColor(
    calendarDisplay.nowLineColor,
    theme.palette.error.main,
  );

  /*
   * The calendar opens on the view the owner chose (calendar.defaultView),
   * not a hardcoded "week". It is applied once, when the setting first
   * arrives; the moment the person picks a view themselves it is theirs for
   * the session (changeView marks it), so a late-arriving setting never
   * yanks the grid out from under them.
   */
  const viewChosenByHand = useRef(false);
  const changeView = (next: ViewMode) => {
    viewChosenByHand.current = true;
    setView(next);
  };
  useEffect(() => {
    if (!calendarDisplayLoaded || viewChosenByHand.current) return;
    viewChosenByHand.current = true;
    setView(calendarDisplay.defaultView);
  }, [calendarDisplayLoaded, calendarDisplay.defaultView]);

  /* `pub.bookingEnabled`, through the endpoint every screen may read. Never throws. */
  const publicClinicQuery = useQuery({
    queryKey: ["public-clinic"],
    queryFn: readPublicClinic,
    staleTime: 5 * 60 * 1000,
  });
  const onlineBookingOff = publicClinicQuery.data?.bookingEnabled === false;

  const marks = useMemo(() => {
    const map = new Map<string, DayMark>();
    for (const dayKey of days) {
      const rows = shown
        .map((c) => previewByCalendar.get(c.id)?.get(dayKey))
        .filter((row): row is PreviewDay => row !== undefined);
      map.set(dayKey, dayMark(holidayByDate.get(dayKey), rows));
    }
    return map;
  }, [days, shown, previewByCalendar, holidayByDate]);

  /* Everybody the rota names in the period, for the calendars the service filter leaves. */
  const employees = useMemo(() => {
    const rows: PreviewDay[] = [];
    for (const calendar of serviceCalendars) {
      rows.push(...(previewByCalendar.get(calendar.id)?.values() ?? []));
    }
    const found = employeesIn(rows);
    return employee && !found.some((e) => e.id === employee.id)
      ? [...found, employee]
      : found;
  }, [serviceCalendars, previewByCalendar, employee]);
  const employeeId = employee?.id ?? null;
  const chooseEmployee = (id: string | null) =>
    setEmployee(id === null ? null : (employees.find((e) => e.id === id) ?? null));

  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const appointment of appointmentsQuery.data ?? []) {
      if (!appointment.calendarId || !shownIds.has(appointment.calendarId)) continue;
      const key = pragueDateKey(appointment.startUtc);
      const row = previewByCalendar.get(appointment.calendarId)?.get(key);
      if (!dayBelongsTo(row, employeeId)) continue;
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    return map;
  }, [appointmentsQuery.data, shownIds, previewByCalendar, employeeId]);

  /** The hours drawn: the working hours on screen, widened to anything outside them. */
  const openSpan = useMemo(() => {
    const working: MinuteRange[] = [];
    const items: MinuteRange[] = [];
    for (const dayKey of days) {
      for (const calendar of shown) {
        const row = previewByCalendar.get(calendar.id)?.get(dayKey);
        if (!row) continue;
        const start = parseTimeOfDay(row.startTime);
        const end = parseTimeOfDay(row.endTime);
        if (row.isOpen && start !== null && end !== null) working.push({ start, end });
      }
      /* A cancelled booking is not drawn, so it must not stretch the day either:
         one cancelled 01:00 slot used to open every day at one in the morning. */
      for (const a of byDay.get(dayKey) ?? []) {
        if (statusTally(a.status) === "cancelled") continue;
        items.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
      }
      for (const blocks of blocksByCalendar.values()) {
        for (const b of blocks) {
          if (touchesDay(b.startUtc, b.endUtc, dayKey)) items.push(spanOnDay(b.startUtc, b.endUtc, dayKey));
        }
      }
    }
    return visibleHours(working, items);
  }, [days, shown, previewByCalendar, byDay, blocksByCalendar]);

  /**
   * Which appointment the detail is opened on. Only its id and calendar are
   * taken from here - the detail reads the appointment itself (4.5, v26).
   */
  const openAppointment = useMemo(
    () =>
      openId === null
        ? null
        : ((appointmentsQuery.data ?? []).find((a) => a.id === openId) ?? null),
    [openId, appointmentsQuery.data],
  );

  const calendarById = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );

  const stepBy = (direction: number) =>
    setAnchor(
      view === "month"
        ? addMonths(anchor, direction)
        : addDaysToDateOnly(anchor, direction * (view === "day" ? 1 : 7)),
    );
  const todayKey = pragueDateKey(now);

  const pickDay = (day: string) => {
    setAnchor(day);
    changeView("day");
  };

  const openBooking = useCallback(
    (prefill: BookingPrefill) =>
      setBooking((current) => ({ key: (current?.key ?? 0) + 1, prefill })),
    [],
  );

  const bookFromGrid = (request: GridBookingRequest) =>
    openBooking({
      initialDate: request.dayKey,
      initialCalendarId: request.calendarId,
      initialStart: request.start,
      initialEnd: request.end,
    });

  /* "Rezervovat pro klub": the clubs screen takes the range and the calendar. */
  const clubFromGrid = (request: GridBookingRequest) =>
    navigate("/vyhrazeni", {
      state: {
        calendarId: request.calendarId,
        startUtc: request.startUtc,
        endUtc: request.endUtc,
      },
    });

  /**
   * "Nová objednávka" - the sidebar's big button and the one in the top bar:
   * open the booking dialog on the next free half hour from now, on the first
   * calendar on screen, exactly as if it had been dragged. What is on the
   * calendar already, the lunch break and the working hours are stepped
   * over - and so is a day the clinic is shut or offers nothing: on a Saturday
   * the proposal is Monday at opening time, not "today, zavřeno" (owner,
   * 3. 10. 2026). The grid moves to that day so the slot is in view. Whether
   * the time can really be booked is still the server's answer in the dialog
   * (6.1).
   */
  const factsOf = useCallback(
    (
      row: PreviewDay | undefined,
      dayKey: string,
      calendarId: string,
      appointments: readonly DayAppointment[],
      blocks: readonly TimeBlock[],
    ): DayFacts | undefined => {
      if (row === undefined) return undefined;
      const mark = dayMark(holidayByDate.get(dayKey), [row]);
      const offers = (row.offeredActivityIds ?? []).length > 0;
      if (mark.closed || !row.isOpen || !offers) return { open: false, bounds: null, busy: [] };
      const busy: MinuteRange[] = [];
      for (const a of appointments) {
        if (a.calendarId !== calendarId || statusTally(a.status) === "cancelled") continue;
        if (touchesDay(a.startUtc, a.endUtc, dayKey)) busy.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
      }
      for (const b of blocks) {
        if (touchesDay(b.startUtc, b.endUtc, dayKey)) busy.push(spanOnDay(b.startUtc, b.endUtc, dayKey));
      }
      const breakStart = parseTimeOfDay(row.breakStart);
      const breakEnd = parseTimeOfDay(row.breakEnd);
      if (breakStart !== null && breakEnd !== null) busy.push({ start: breakStart, end: breakEnd });
      const workStart = parseTimeOfDay(row.startTime);
      const workEnd = parseTimeOfDay(row.endTime);
      const bounds = workStart !== null && workEnd !== null ? { start: workStart, end: workEnd } : null;
      return { open: true, bounds, busy };
    },
    [holidayByDate],
  );

  /*
   * The month ahead for one calendar, asked for only when the days on screen
   * cannot answer. Cached briefly, so "Příští volný termín" pressed twice in
   * the drawer is one round trip.
   */
  const horizonFor = useCallback(
    (calendarId: string, fromDay: string) =>
      queryClient.fetchQuery({
        queryKey: ["next-free-horizon", calendarId, fromDay],
        queryFn: async () => {
          const to = addDaysToDateOnly(fromDay, NEXT_FREE_HORIZON_DAYS);
          const [rows, appointments, blocks] = await Promise.all([
            workingHoursApi.preview(calendarId, fromDay, to),
            appointmentsApi.range(fromDay, to, [calendarId]),
            appointmentsApi.blocks(calendarId, fromDay, to),
          ]);
          return { rows: new Map(rows.map((r) => [r.date, r])), appointments, blocks };
        },
        staleTime: 30_000,
      }),
    [queryClient],
  );

  const findNextFree = useCallback(
    async (
      calendarId: string,
      start: { dayKey: string; minute: number },
    ): Promise<{ dayKey: string; slot: MinuteRange } | null> => {
      const calendar = calendarById.get(calendarId);
      const step = calendar && calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : 30;

      /* The days on screen first: no request when today or tomorrow has room. */
      const visible = nextFreeSlotAcrossDays(start, step, (day) =>
        factsOf(
          previewByCalendar.get(calendarId)?.get(day),
          day,
          calendarId,
          appointmentsQuery.data ?? [],
          blocksByCalendar.get(calendarId) ?? [],
        ),
      );
      if (visible.kind === "found") return visible;
      if (visible.kind === "none") return null;

      /* Then the month ahead; if even that cannot be had, the first open weekday at opening time. */
      let known: ReadonlyMap<string, PreviewDay> = previewByCalendar.get(calendarId) ?? new Map();
      try {
        const horizon = await horizonFor(calendarId, start.dayKey);
        known = horizon.rows;
        const walk = nextFreeSlotAcrossDays(start, step, (day) =>
          factsOf(horizon.rows.get(day), day, calendarId, horizon.appointments, horizon.blocks),
        );
        if (walk.kind === "found") return walk;
        if (walk.kind === "none") return null;
      } catch {
        /* The preview could not be fetched; the fallback below says so by being generic. */
      }
      return firstOpenWeekday(start, known, holidayByDate);
    },
    [calendarById, factsOf, previewByCalendar, appointmentsQuery.data, blocksByCalendar, horizonFor, holidayByDate],
  );

  const bookNextFree = useCallback(
    async (extra: Pick<BookingPrefill, "initialPatientId"> = {}) => {
      const calendar = shown[0];
      if (!calendar) return;
      const nowDate = new Date();
      const dayKey = pragueDateKey(nowDate);
      const found = await findNextFree(calendar.id, { dayKey, minute: pragueMinuteOfDay(nowDate) });
      if (found) setAnchor(found.dayKey);
      openBooking(
        found
          ? {
              initialDate: found.dayKey,
              initialCalendarId: calendar.id,
              initialStart: localDateTime(found.dayKey, found.slot.start),
              initialEnd: localDateTime(found.dayKey, found.slot.end),
              ...extra,
            }
          : { initialDate: dayKey, initialCalendarId: calendar.id, ...extra },
      );
    },
    [shown, findNextFree, openBooking],
  );

  /* "Příští volný termín" on the drawer's slot card: after the moment it shows, exclusive. */
  const findNextFreeForDialog = useCallback(
    async (after: { date: string; time: string }, calendarId: string): Promise<FoundSlot | null> => {
      const [h, m] = after.time.split(":").map(Number);
      const minute = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0) + 1;
      const found = await findNextFree(calendarId, { dayKey: after.date, minute });
      if (!found) return null;
      setAnchor(found.dayKey);
      return {
        date: found.dayKey,
        time: formatMinutes(found.slot.start),
        end: formatMinutes(found.slot.end),
      };
    },
    [findNextFree],
  );

  /*
   * The sidebar lands here with `state.newAppointment` (a timestamp). Each new
   * value opens the dialog once, as soon as the calendars and today's bookings
   * are known - so the slot proposed is one that is visibly free.
   */
  const landing = location.state as { newAppointment?: number; patientId?: string } | null;
  const newAppointmentKey = landing?.newAppointment;
  /* The patient's card hands over who it is for; the sidebar hands over nobody. */
  const landingPatientId = typeof landing?.patientId === "string" ? landing.patientId : undefined;
  const handledNewAppointment = useRef<number | null>(null);
  const bookingsKnown = appointmentsQuery.isSuccess || appointmentsQuery.isError;
  useEffect(() => {
    if (typeof newAppointmentKey !== "number") return;
    if (handledNewAppointment.current === newAppointmentKey) return;
    if (!mayBook || shown.length === 0 || !bookingsKnown) return;
    handledNewAppointment.current = newAppointmentKey;
    void bookNextFree(landingPatientId ? { initialPatientId: landingPatientId } : {});
  }, [newAppointmentKey, landingPatientId, mayBook, shown.length, bookingsKnown, bookNextFree]);

  /**
   * 7.1: the grid steps with the keyboard and is not a focus trap.
   * `PageUp`/`PageDown` rather than Alt+Arrow, which the browser takes for its
   * own history navigation.
   */
  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpenId(null);
      return;
    }
    if (event.key === "PageUp") {
      stepBy(-1);
      event.preventDefault();
    }
    if (event.key === "PageDown") {
      stepBy(1);
      event.preventDefault();
    }
  };

  const title = periodTitle(view, days, anchor);
  const outlinedSelect = { minWidth: 180, "& .MuiInputBase-root": { bgcolor: "background.paper" } };

  return (
    <Box
      tabIndex={0}
      aria-label={t("booking.grid.title")}
      sx={{ maxWidth: 1680, mx: "auto", outline: "none" }}
      onKeyDown={onGridKeyDown}
    >
      {/* The top bar: ‹ › Dnes · the period · Den | Týden | Měsíc · Nová objednávka */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <SquareButton label={GRID_TEXT.previous} onClick={() => stepBy(-1)}>
            <ChevronLeftIcon fontSize="small" />
          </SquareButton>
          <SquareButton label={GRID_TEXT.next} onClick={() => stepBy(1)}>
            <ChevronRightIcon fontSize="small" />
          </SquareButton>
          <Button variant="outlined" onClick={() => setAnchor(pragueDateKey(new Date()))}>
            {GRID_TEXT.today}
          </Button>
        </Stack>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 18, md: 20 },
            fontWeight: 700,
            letterSpacing: "-0.01em",
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </Typography>

        {/* 7.2: wrapping needs `gap` rather than `spacing`, which lays out with
            margins and breaks across wrapped lines on a phone. */}
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <ToggleButtonGroup
            exclusive
            aria-label={GRID_TEXT.view}
            value={view}
            onChange={(_, next: ViewMode | null) => next && changeView(next)}
          >
            <ToggleButton value="day">{GRID_TEXT.dayView}</ToggleButton>
            <ToggleButton value="week">{GRID_TEXT.weekView}</ToggleButton>
            <ToggleButton value="month">{GRID_TEXT.monthView}</ToggleButton>
          </ToggleButtonGroup>
          {mayBook ? (
            <Button variant="contained" onClick={() => void bookNextFree()}>
              {GRID_TEXT.newAppointment}
            </Button>
          ) : null}
        </Stack>
      </Box>

      {/* The toolbar under it: ROZLIŠENÍ, the hint, the filters. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        {timeGridShown ? (
          <>
            <SectionLabel sx={{ mb: 0 }}>{GRID_TEXT.resolution}</SectionLabel>
            <SquareButton
              label={GRID_TEXT.coarser}
              onClick={() => setResolution(stepResolution(zoom, -1).key)}
              disabled={resolution.key === RESOLUTIONS[0].key}
            >
              <RemoveIcon fontSize="small" />
            </SquareButton>
            <ToggleButtonGroup
              exclusive
              aria-label={GRID_TEXT.resolution}
              value={resolution.key}
              onChange={(_, next: string | null) => next && setResolution(next)}
            >
              {RESOLUTIONS.map((level) => (
                <ToggleButton key={level.key} value={level.key}>
                  {level.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <SquareButton
              label={GRID_TEXT.finer}
              onClick={() => setResolution(stepResolution(zoom, 1).key)}
              disabled={resolution.key === RESOLUTIONS[RESOLUTIONS.length - 1].key}
            >
              <AddIcon fontSize="small" />
            </SquareButton>
            <Typography sx={{ fontSize: 12, color: "text.secondary", display: { xs: "none", lg: "block" } }}>
              {GRID_TEXT.gridStepHint(resolution.hint)}
            </Typography>
          </>
        ) : null}
        <Box sx={{ flex: 1 }} />
        {onlineBookingOff ? (
          <Tooltip title={GRID_TEXT.onlineBookingOffWhy}>
            <Chip color="warning" label={GRID_TEXT.onlineBookingOff} />
          </Tooltip>
        ) : null}
        <TextField
          select
          size="small"
          label={GRID_TEXT.employee}
          value={employeeId ?? ""}
          onChange={(e) => chooseEmployee(e.target.value === "" ? null : e.target.value)}
          sx={outlinedSelect}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">{GRID_TEXT.allEmployees}</MenuItem>
          {employees.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name}
            </MenuItem>
          ))}
        </TextField>
        {services.length > 0 ? (
          <TextField
            select
            size="small"
            label={GRID_TEXT.service}
            value={serviceId ?? ""}
            onChange={(e) => setServiceId(e.target.value === "" ? null : e.target.value)}
            sx={outlinedSelect}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">{GRID_TEXT.allServices}</MenuItem>
            {services.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <GridSidebar
          anchor={anchor}
          view={view}
          onDate={setAnchor}
          holidays={holidayDates(holidays)}
          closedDays={closedHolidayDates(holidays)}
          calendars={serviceCalendars}
          isTicked={(id) => ticked === null || ticked.has(id)}
          onToggle={(id) => setTicked(toggleCalendar(ticked, allIds, id))}
          onOnly={(id) => setTicked(new Set([id]))}
          employees={employees}
          employeeId={employeeId}
          onEmployee={chooseEmployee}
          services={services}
          serviceId={serviceId}
          onService={setServiceId}
        />

        <Box sx={{ minWidth: 0 }}>
          <AsyncSection
            isLoading={calendarsQuery.isLoading}
            isSettled={calendarsQuery.isSuccess}
            error={calendarsQuery.error}
            isEmpty={calendars.length === 0}
            emptyText={t("booking.grid.noCalendars")}
            onRetry={() => void calendarsQuery.refetch()}
            skeletonRows={3}
          >
            {hiddenInactive.length > 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("booking.grid.inactiveHidden", {
                  names: hiddenInactive.map((c) => c.name).join(", "),
                  count: hiddenInactive.length,
                })}
                {mayManageCalendars ? (
                  <>
                    {" "}
                    <MuiLink component={RouterLink} to="/calendars">
                      {t("booking.grid.inactiveWhere")}
                    </MuiLink>
                  </>
                ) : null}
              </Alert>
            ) : null}

            <AsyncSection
              isLoading={appointmentsQuery.isLoading}
              isSettled={appointmentsQuery.isSuccess && !appointmentsQuery.isPlaceholderData}
              /* With placeholder data the query stays 'success', so a failed fetch
                 never reaches `error` — it lands in `failureReason`. */
              error={appointmentsQuery.error ?? appointmentsQuery.failureReason}
              isEmpty={false}
              emptyText=""
              onRetry={() => void appointmentsQuery.refetch()}
              skeletonRows={6}
            >
              {previewQuery.error ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t("booking.grid.previewFailed")}
                </Alert>
              ) : null}

              {/* 7.2: on a phone the day is a list, not a shrunken grid. */}
              {!isPhone && view === "month" ? (
                <MonthGrid
                  days={days}
                  byDay={byDay}
                  calendarById={calendarById}
                  marks={marks}
                  anchor={anchor}
                  anchorMonth={anchorMonth}
                  now={now}
                  todayKey={todayKey}
                  holidayColor={holidayColor}
                  onOpen={setOpenId}
                  onPickDay={pickDay}
                />
              ) : isPhone ? (
                <DayList
                  days={days}
                  byDay={byDay}
                  calendarById={calendarById}
                  marks={marks}
                  now={now}
                  onOpen={setOpenId}
                />
              ) : (
                <TimeGrid
                  days={days}
                  view={view === "day" ? "day" : "week"}
                  selectedDay={anchor}
                  calendars={shown}
                  appointmentsByDay={byDay}
                  previewByCalendar={previewByCalendar}
                  blocksByCalendar={blocksByCalendar}
                  marks={marks}
                  openSpan={openSpan}
                  now={now}
                  employeeId={employeeId}
                  nowLineColor={nowLineColor}
                  holidayColor={holidayColor}
                  lunchColor={lunchColor}
                  zoom={zoom}
                  onZoom={changeZoom}
                  resolutionStep={resolution.step}
                  mayBook={mayBook}
                  mayBlock={mayBlock}
                  onOpen={setOpenId}
                  onBook={bookFromGrid}
                  onClub={clubFromGrid}
                  onPickDay={pickDay}
                />
              )}
            </AsyncSection>
          </AsyncSection>
        </Box>
      </Box>

      {/* 5.8. The row is gone from the answer once it is cancelled, so the
          dialog closes itself rather than showing a stale copy. */}
      {booking && mayBook ? (
        <NewAppointmentDialog
          key={booking.key}
          open
          onClose={() => setBooking(null)}
          onBooked={() => void appointmentsQuery.refetch()}
          onFindNextFree={findNextFreeForDialog}
          {...booking.prefill}
        />
      ) : null}

      {openAppointment?.calendarId ? (
        <AppointmentDetail
          appointmentId={openAppointment.id}
          calendarId={openAppointment.calendarId}
          calendar={calendarById.get(openAppointment.calendarId)}
          open
          onClose={() => setOpenId(null)}
          onChanged={() => void appointmentsQuery.refetch()}
        />
      ) : null}
    </Box>
  );
}

interface SharedProps {
  days: string[];
  byDay: Map<string, DayAppointment[]>;
  calendarById: Map<string, { id: string; name: string; color: string }>;
  marks: Map<string, DayMark>;
  now: Date;
  onOpen: (id: string) => void;
}

/** The phone view: a list, not a grid (7.2). */
function DayList({ days, byDay, calendarById, marks, now, onOpen }: SharedProps) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      {days.map((dayKey) => {
        const appointments = byDay.get(dayKey) ?? [];
        const mark = marks.get(dayKey) ?? OPEN_MARK;
        return (
          <Box key={dayKey}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              {weekdayLong(dayKey)}{" "}
              <Box component="span" sx={{ color: mark.redNumber ? "error.main" : "inherit" }}>
                {formatDateOnly(dayKey)}
              </Box>
              {mark.label ? (
                <Box component="span" sx={{ ml: 1, fontWeight: 400, color: "text.secondary" }}>
                  {mark.label}
                </Box>
              ) : null}
            </Typography>
            {appointments.length === 0 ? (
              <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
                {t("booking.grid.emptyDay")}
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {appointments.map((appointment) => (
                  <AppointmentButton
                    key={appointment.id}
                    appointment={appointment}
                    calendar={calendarById.get(appointment.calendarId ?? "")}
                    now={now}
                    onOpen={onOpen}
                    layout="row"
                  />
                ))}
              </Stack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * The month - contract 5.1, drawn to design-03: seven columns, the day
 * number (today a filled dark circle), the count on the right, up to three
 * rows "08:00 Jan Novák" and "+ N další"; a closed day says ZAVŘENO, a
 * holiday is tinted in the owner's holiday colour with a SVÁTEK chip.
 *
 * Deliberately not virtualised: a month is six rows. What can actually grow is
 * a single day's list, which is capped instead, with the rest named as a count.
 */
const MAX_PER_DAY = 3;

function MonthGrid({
  days,
  byDay,
  calendarById,
  marks,
  anchor,
  anchorMonth,
  now,
  todayKey,
  holidayColor,
  onOpen,
  onPickDay,
}: SharedProps & {
  anchor: string;
  anchorMonth: string;
  todayKey: string;
  holidayColor: string;
  onPickDay: (day: string) => void;
}) {
  const theme = useTheme();
  const weekdayHeads = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
          minWidth: 840,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: `${DESIGN.radius.xl}px`,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        {weekdayHeads.map((d, i) => (
          <Box
            key={"h" + d}
            sx={{
              bgcolor: "action.hover",
              px: 1.5,
              py: 1.25,
              fontWeight: 600,
              fontSize: 13,
              borderBottom: "1px solid",
              borderLeft: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
            }}
          >
            {WEEKDAY_ABBREVIATION[d]}
          </Box>
        ))}

        {days.map((dayKey, index) => {
          const appointments = byDay.get(dayKey) ?? [];
          const count = appointments.filter((a) => statusTally(a.status) !== "cancelled").length;
          const mark = marks.get(dayKey) ?? OPEN_MARK;
          const holiday = mark.label === GRID_TEXT.publicHoliday;
          const outsideMonth = dayKey.slice(0, 7) !== anchorMonth;
          const shownHere = appointments.slice(0, MAX_PER_DAY);
          const hidden = appointments.length - shownHere.length;
          const lit = emphasis(dayKey, anchor, "month");
          const today = dayKey === todayKey;
          const firstOfMonth = dayKey.slice(8, 10) === "01";
          const lastRow = index >= days.length - 7;
          return (
            <Box
              key={dayKey}
              data-testid={`month-day-${dayKey}`}
              sx={{
                minHeight: 104,
                p: 1,
                borderLeft: index % 7 === 0 ? "none" : "1px solid",
                borderBottom: lastRow ? "none" : "1px solid",
                borderColor: "divider",
                bgcolor: holiday
                  ? alpha(holidayColor, 0.1)
                  : mark.closed
                    ? "action.hover"
                    : lit === "week"
                      ? alpha(theme.palette.primary.main, 0.04)
                      : "background.paper",
                boxShadow:
                  lit === "day" ? `inset 0 0 0 2px ${theme.palette.primary.main}` : "none",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.75,
                  gap: 0.5,
                }}
              >
                <ButtonBase
                  onClick={() => onPickDay(dayKey)}
                  aria-label={formatDateOnly(dayKey)}
                  sx={{
                    minWidth: 22,
                    height: 22,
                    px: today ? 0 : 0.25,
                    borderRadius: today ? "50%" : 1,
                    fontSize: 13,
                    fontWeight: today || mark.redNumber || lit === "day" ? 700 : 500,
                    bgcolor: today ? "primary.main" : "transparent",
                    color: today
                      ? "primary.contrastText"
                      : mark.redNumber
                        ? "error.main"
                        : outsideMonth
                          ? "text.disabled"
                          : "text.primary",
                  }}
                >
                  {firstOfMonth && !today ? shortDate(dayKey) : Number(dayKey.slice(8, 10))}
                </ButtonBase>
                {holiday ? (
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
                ) : mark.closed ? (
                  <Tooltip title={mark.detail ?? mark.label ?? ""}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "text.secondary",
                      }}
                    >
                      {mark.label ?? GRID_TEXT.closedCaps}
                      {/* A booking taken on a shut day still counts - and is listed below, like any other. */}
                      {count > 0 ? ` · ${count}` : ""}
                    </Typography>
                  </Tooltip>
                ) : mark.label ? (
                  <Tooltip title={mark.detail ?? ""}>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", textAlign: "right" }}>
                      {mark.label}
                    </Typography>
                  </Tooltip>
                ) : count > 0 ? (
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{count}</Typography>
                ) : null}
              </Box>

              {holiday && mark.detail ? (
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: holidayColor }}>
                  {mark.detail}
                </Typography>
              ) : null}

              <Stack spacing={0.375}>
                {shownHere.map((appointment) => (
                  <AppointmentButton
                    key={appointment.id}
                    appointment={appointment}
                    calendar={calendarById.get(appointment.calendarId ?? "")}
                    now={now}
                    onOpen={onOpen}
                    layout="compact"
                  />
                ))}
                {hidden > 0 ? (
                  <Typography sx={{ fontSize: 11, color: "text.secondary", pl: 0.5 }}>
                    {GRID_TEXT.more(hidden)}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
