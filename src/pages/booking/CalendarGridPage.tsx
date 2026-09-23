import { useEffect, useMemo, useState } from "react";
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { Link as MuiLink } from "@mui/material";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi } from "../../api/clinicServices";
import { holidaysApi, type ClinicHoliday } from "../../api/holidays";
import { readPublicClinic, readSettings } from "../../api/clinicSettings";
import { usePermission } from "../../auth/usePermission";
import { appointmentsApi } from "../../api/appointments";
import { workingHoursApi } from "../../api/workingHours";
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
import { NOW_LINE_COLOR_KEY, resolveNowLineColor } from "../../components/booking/grid/nowLine";
import {
  parseTimeOfDay,
  spanOnDay,
  touchesDay,
  visibleHours,
  type MinuteRange,
} from "../../components/booking/grid/timeRange";
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatDateOnly,
  pragueDateKey,
} from "../../utils/time";
import { inactiveAmong } from "./calendarLifecycle";

/**
 * The calendar - contract screen 5.1, laid out as the owner asked:
 *
 *   LEFT   mini calendar, day / week / month, the calendars, who works, services
 *   TOP    previous / next, today, day / week / month, employee and service filters
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

export default function CalendarGridPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const mayManageCalendars = usePermission("settings.clinic.manage");
  const mayBook = usePermission("bookings.create");
  const mayBlock = usePermission("bookings.edit");

  const [view, setView] = useState<ViewMode>("week");
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
   * The now-line colour is the administrator's setting. `/api/settings` is
   * readable only with settings.clinic.manage, so everybody else - and an
   * installation where nobody has set it - gets the theme's error colour.
   */
  const settingsQuery = useQuery({
    queryKey: ["settings", NOW_LINE_COLOR_KEY],
    queryFn: () => readSettings([NOW_LINE_COLOR_KEY]),
    enabled: mayManageCalendars,
    staleTime: 5 * 60 * 1000,
  });
  const nowLineColor = resolveNowLineColor(
    settingsQuery.data?.[NOW_LINE_COLOR_KEY],
    theme.palette.error.main,
  );

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
      for (const a of byDay.get(dayKey) ?? []) items.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
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
    setView("day");
  };

  const openBooking = (prefill: BookingPrefill) =>
    setBooking((current) => ({ key: (current?.key ?? 0) + 1, prefill }));

  const bookFromGrid = (request: GridBookingRequest) =>
    openBooking({
      initialDate: request.dayKey,
      initialCalendarId: request.calendarId,
      initialStart: request.start,
      initialEnd: request.end,
    });

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

  const rangeText =
    view === "day"
      ? formatDateOnly(anchor)
      : `${formatDateOnly(days[0])} – ${formatDateOnly(days[days.length - 1])}`;

  return (
    <Box
      tabIndex={0}
      aria-label={t("booking.grid.title")}
      sx={{ maxWidth: 1680, mx: "auto", outline: "none" }}
      onKeyDown={onGridKeyDown}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("booking.grid.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>{rangeText}</Typography>
        </Box>

        {/* 7.2: wrapping needs `gap` rather than `spacing`, which lays out with
            margins and breaks across wrapped lines on a phone. */}
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Tooltip title={t("booking.grid.previous")}>
            <IconButton aria-label={t("booking.grid.previous")} onClick={() => stepBy(-1)}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Button startIcon={<TodayIcon />} onClick={() => setAnchor(pragueDateKey(new Date()))}>
            {t("booking.grid.today")}
          </Button>
          <Tooltip title={t("booking.grid.next")}>
            <IconButton aria-label={t("booking.grid.next")} onClick={() => stepBy(1)}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next: ViewMode | null) => next && setView(next)}
          >
            <ToggleButton value="day">{t("booking.grid.day")}</ToggleButton>
            <ToggleButton value="week">{t("booking.grid.week")}</ToggleButton>
            <ToggleButton value="month">{t("booking.grid.month")}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            size="small"
            label={GRID_TEXT.employee}
            value={employeeId ?? ""}
            onChange={(e) => chooseEmployee(e.target.value === "" ? null : e.target.value)}
            sx={{ minWidth: 180 }}
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
              sx={{ minWidth: 180 }}
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
          {mayBook ? (
            <Button
              variant="contained"
              onClick={() =>
                openBooking({
                  initialDate: anchor,
                  initialCalendarId: shown.length === 1 ? shown[0].id : undefined,
                })
              }
            >
              {t("booking.new.title")}
            </Button>
          ) : null}
          {onlineBookingOff ? (
            <Tooltip title={GRID_TEXT.onlineBookingOffWhy}>
              <Chip color="warning" label={GRID_TEXT.onlineBookingOff} />
            </Tooltip>
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "260px minmax(0, 1fr)" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <GridSidebar
          anchor={anchor}
          view={view}
          onDate={setAnchor}
          onView={setView}
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
                  mayBook={mayBook}
                  mayBlock={mayBlock}
                  onOpen={setOpenId}
                  onBook={bookFromGrid}
                  onPickDay={pickDay}
                />
              )}
            </AsyncSection>
          </AsyncSection>
        </Box>
      </Box>

      {/* 5.8. The row is gone from the answer once it is cancelled, so the
          dialog closes itself rather than showing a stale copy. */}
      {booking ? (
        <NewAppointmentDialog
          key={booking.key}
          open
          onClose={() => setBooking(null)}
          onBooked={() => void appointmentsQuery.refetch()}
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
              {t(`booking.workingHours.weekday.${dayOfWeekOf(dayKey)}`)}{" "}
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
 * The month - contract 5.1.
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
  onOpen,
  onPickDay,
}: SharedProps & {
  anchor: string;
  anchorMonth: string;
  todayKey: string;
  onPickDay: (day: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const weekdayHeads = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
          minWidth: 840,
          gap: "1px",
          backgroundColor: "divider",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {weekdayHeads.map((d) => (
          <Box
            key={"h" + d}
            sx={{
              backgroundColor: "background.paper",
              px: 1,
              py: 0.5,
              fontWeight: 700,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {t(`booking.workingHours.weekday.${d}`)}
          </Box>
        ))}

        {days.map((dayKey) => {
          const appointments = byDay.get(dayKey) ?? [];
          const mark = marks.get(dayKey) ?? OPEN_MARK;
          const outsideMonth = dayKey.slice(0, 7) !== anchorMonth;
          const shownHere = appointments.slice(0, MAX_PER_DAY);
          const hidden = appointments.length - shownHere.length;
          const lit = emphasis(dayKey, anchor, "month");
          return (
            <Box
              key={dayKey}
              data-testid={`month-day-${dayKey}`}
              sx={{
                backgroundColor: mark.closed
                  ? "action.hover"
                  : lit === "week"
                    ? alpha(theme.palette.primary.main, 0.05)
                    : "background.paper",
                boxShadow:
                  lit === "day" ? `inset 0 0 0 2px ${theme.palette.primary.main}` : "none",
                minHeight: 104,
                p: 0.5,
                opacity: outsideMonth ? 0.5 : 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.5,
                  gap: 0.5,
                }}
              >
                <ButtonBase
                  onClick={() => onPickDay(dayKey)}
                  aria-label={formatDateOnly(dayKey)}
                  sx={{
                    fontSize: 12,
                    px: 0.5,
                    borderRadius: 1,
                    fontWeight: dayKey === todayKey || mark.redNumber ? 800 : 500,
                    color: mark.redNumber
                      ? "error.main"
                      : dayKey === todayKey
                        ? "primary.main"
                        : "text.secondary",
                  }}
                >
                  {Number(dayKey.slice(8, 10))}.
                </ButtonBase>
                {mark.label ? (
                  <Tooltip title={mark.detail ?? ""}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: mark.redNumber ? "error.main" : "text.secondary",
                        textAlign: "right",
                      }}
                    >
                      {mark.label}
                    </Typography>
                  </Tooltip>
                ) : null}
              </Box>

              <Stack spacing={0.25}>
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
                    {t("booking.grid.more", { count: hidden })}
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
