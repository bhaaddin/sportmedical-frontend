import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { appointmentsApi } from "../../api/appointments";
import { workingHoursApi } from "../../api/workingHours";
import {
  isLateStatus,
  statusName,
  statusTally,
  type DayAppointment,
  type PreviewDay,
} from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { readableTextOn } from "../../utils/calendarPalette";
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatDateOnly,
  formatPragueTime,
  hoursInPragueDay,
  isLate,
  pragueDateKey,
  startOfPragueDay,
  toDateOnly,
} from "../../utils/time";

/**
 * The calendar grid - contract screen 5.1.
 *
 * Three rules shape it and are worth stating where they are easy to break:
 *
 *  - **It never asks for availability** (6.1). Free time is the server's answer
 *    to a booking question, not a gap this screen can infer. The grid draws
 *    appointments and working hours; the white space between them is just white
 *    space, and it does not mean "bookable".
 *  - **The day is not 24 hours.** Its height comes from `hoursInPragueDay`, so
 *    the two clock-change days render 23 and 25 rows instead of silently
 *    dropping or duplicating an hour (3.3).
 *  - **Colour never carries meaning alone** (7.1). Every appointment shows its
 *    status as text, and every one of them is a button, not a div with onClick.
 */

type ViewMode = "day" | "week";

const SLOT_MINUTES = 30;
/**
 * Pixels per slot. A booking shows two lines - time with activity, and the
 * status in words, which 7.1 requires because colour may not carry it alone -
 * so the shortest slot has to be tall enough for both. At 26 a half-hour
 * booking overflowed its slot by 18px and sat on top of the next one.
 */
const ROW_HEIGHT = 46;
const DEFAULT_OPEN = { start: 7, end: 19 };

/** Monday of the week a date falls in. */
function startOfWeek(date: string): string {
  const shift = (dayOfWeekOf(date) + 6) % 7;
  return addDaysToDateOnly(date, -shift);
}

function minutesIntoDay(instant: string, dayKey: string): number {
  const dayStart = startOfPragueDay(dayKey).getTime();
  return Math.round((new Date(instant).getTime() - dayStart) / 60_000);
}

export default function CalendarGridPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<string>(toDateOnly(new Date()));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement | null>(null);

  /* 6.2: "late" is a fact about the clock, so it is recomputed, not stored. */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
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

  /** Everything is shown until the owner narrows it down. */
  const shown = useMemo(
    () => calendars.filter((c) => selected === null || selected.has(c.id)),
    [calendars, selected],
  );

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(monday, i));
  }, [view, anchor]);

  const from = days[0];
  const to = days[days.length - 1];

  /**
   * One request for the whole visible window and every visible calendar (7.3).
   * `placeholderData` keeps the previous answer on screen while the next one
   * loads, so stepping through days does not blink.
   */
  const appointmentsQuery = useQuery({
    queryKey: ["day-range", from, to, shown.map((c) => c.id).join(",")],
    queryFn: () =>
      appointmentsApi.range(
        from,
        to,
        shown.map((c) => c.id),
      ),
    enabled: shown.length > 0,
    placeholderData: (previous) => previous,
  });

  /**
   * Working hours behind the appointments. `preview` answers per calendar, so
   * this is one call per shown calendar - the range endpoint above is the one
   * that had to be a single call, because it is the one that grows with days.
   */
  const previewQueries = useQuery({
    queryKey: ["grid-preview", from, to, shown.map((c) => c.id).join(",")],
    queryFn: async () => {
      const perCalendar = await Promise.all(
        shown.map(async (calendar) => ({
          calendarId: calendar.id,
          days: await workingHoursApi.preview(calendar.id, from, to),
        })),
      );
      const byDate = new Map<string, PreviewDay[]>();
      for (const entry of perCalendar) {
        for (const day of entry.days) {
          byDate.set(day.date, [...(byDate.get(day.date) ?? []), day]);
        }
      }
      return byDate;
    },
    enabled: shown.length > 0,
    placeholderData: (previous) => previous,
  });

  /** The opening span across the shown calendars, so the grid is not always 00–24. */
  const openSpan = useMemo(() => {
    let earliest = 24;
    let latest = 0;
    for (const dayKey of days) {
      for (const preview of previewQueries.data?.get(dayKey) ?? []) {
        if (!preview.isOpen || !preview.startTime || !preview.endTime) continue;
        earliest = Math.min(earliest, Number(preview.startTime.slice(0, 2)));
        latest = Math.max(latest, Number(preview.endTime.slice(0, 2)) + 1);
      }
    }
    if (earliest > latest) return DEFAULT_OPEN;
    return { start: Math.max(0, earliest - 1), end: Math.min(24, latest) };
  }, [days, previewQueries.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const appointment of appointmentsQuery.data ?? []) {
      const key = pragueDateKey(appointment.startUtc);
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    return map;
  }, [appointmentsQuery.data]);

  const calendarById = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );

  const step = view === "day" ? 1 : 7;
  const todayKey = toDateOnly(now);

  /**
   * 7.1: the grid steps with the keyboard and is not a focus trap.
   *
   * The container carries `tabIndex` because a plain div receives no key events
   * of its own - the first version of this handler never fired at all, which
   * only showed up when the screen was actually driven from a keyboard.
   * `PageUp`/`PageDown` rather than Alt+Arrow, which the browser takes for its
   * own history navigation.
   */
  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpenId(null);
      return;
    }
    if (event.key === "PageUp") {
      setAnchor(addDaysToDateOnly(anchor, -step));
      event.preventDefault();
    }
    if (event.key === "PageDown") {
      setAnchor(addDaysToDateOnly(anchor, step));
      event.preventDefault();
    }
  };

  const rangeLabel =
    view === "day"
      ? formatDateOnly(anchor)
      : `${formatDateOnly(days[0])} – ${formatDateOnly(days[6])}`;

  return (
    <Box
      tabIndex={0}
      aria-label={t("booking.grid.title")}
      sx={{ maxWidth: 1400, mx: "auto", outline: "none" }}
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
          <Typography sx={{ color: "text.secondary" }}>{rangeLabel}</Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title={t("booking.grid.previous")}>
            <IconButton
              aria-label={t("booking.grid.previous")}
              onClick={() => setAnchor(addDaysToDateOnly(anchor, -step))}
            >
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Button
            startIcon={<TodayIcon />}
            onClick={() => setAnchor(toDateOnly(new Date()))}
          >
            {t("booking.grid.today")}
          </Button>
          {/* Without this the only way to reach a month back was to press the
              arrow week by week - thirty-five presses to reach January. */}
          <TextField
            type="date"
            size="small"
            label={t("booking.grid.jumpTo")}
            value={anchor}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          <Tooltip title={t("booking.grid.next")}>
            <IconButton
              aria-label={t("booking.grid.next")}
              onClick={() => setAnchor(addDaysToDateOnly(anchor, step))}
            >
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next) => next && setView(next as ViewMode)}
          >
            <ToggleButton value="day">{t("booking.grid.day")}</ToggleButton>
            <ToggleButton value="week">{t("booking.grid.week")}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.grid.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={3}
      >
        {/* Multiple calendars at once: the owner wants Prohlídky and Diagnostika
            side by side, told apart by colour and by name. */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}
        >
          {calendars.map((calendar) => {
            const on = selected === null || selected.has(calendar.id);
            return (
              <Chip
                key={calendar.id}
                label={calendar.name}
                onClick={() => {
                  const next = new Set(selected ?? calendars.map((c) => c.id));
                  if (next.has(calendar.id)) next.delete(calendar.id);
                  else next.add(calendar.id);
                  setSelected(next);
                }}
                sx={
                  on
                    ? {
                        backgroundColor: calendar.color,
                        color: readableTextOn(calendar.color),
                      }
                    : undefined
                }
                variant={on ? "filled" : "outlined"}
                aria-pressed={on}
              />
            );
          })}
        </Stack>

        <AsyncSection
          isLoading={appointmentsQuery.isLoading}
          isSettled={appointmentsQuery.isSuccess && !appointmentsQuery.isPlaceholderData}
          /* With placeholder data the query stays 'success', so a failed fetch
             never reaches `error` — it lands in `failureReason`. Reading only
             `error` made a broken week look like an empty one. */
          error={appointmentsQuery.error ?? appointmentsQuery.failureReason}
          isEmpty={false}
          emptyText=""
          onRetry={() => void appointmentsQuery.refetch()}
          skeletonRows={6}
        >
          {previewQueries.error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("booking.grid.previewFailed")}
            </Alert>
          ) : null}

          {/* 7.2: on a phone the day is a list, not a shrunken grid. */}
          {isPhone || view === "day" ? (
            <DayList
              days={days}
              byDay={byDay}
              calendarById={calendarById}
              now={now}
              openId={openId}
              onOpen={setOpenId}
            />
          ) : (
            <WeekGrid
              days={days}
              byDay={byDay}
              calendarById={calendarById}
              openSpan={openSpan}
              previewByDate={previewQueries.data ?? new Map()}
              now={now}
              todayKey={todayKey}
              gridRef={gridRef}
              onOpen={setOpenId}
            />
          )}
        </AsyncSection>
      </AsyncSection>
    </Box>
  );
}

interface SharedProps {
  days: string[];
  byDay: Map<string, DayAppointment[]>;
  calendarById: Map<string, { id: string; name: string; color: string }>;
  now: Date;
  onOpen: (id: string) => void;
}

/** The phone view, and the day view on any screen: a list, not a grid (7.2). */
function DayList({
  days,
  byDay,
  calendarById,
  now,
  openId,
  onOpen,
}: SharedProps & { openId: string | null }) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      {days.map((dayKey) => {
        const appointments = byDay.get(dayKey) ?? [];
        return (
          <Box key={dayKey}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              {t(`booking.workingHours.weekday.${dayOfWeekOf(dayKey)}`)}{" "}
              {formatDateOnly(dayKey)}
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
                    expanded={openId === appointment.id}
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

function WeekGrid({
  days,
  byDay,
  calendarById,
  openSpan,
  previewByDate,
  now,
  todayKey,
  gridRef,
  onOpen,
}: SharedProps & {
  openSpan: { start: number; end: number };
  previewByDate: Map<string, PreviewDay[]>;
  todayKey: string;
  gridRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const hours = Array.from(
    { length: openSpan.end - openSpan.start },
    (_, i) => openSpan.start + i,
  );

  return (
    <Box ref={gridRef} sx={{ overflowX: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `64px repeat(${days.length}, minmax(140px, 1fr))`,
          minWidth: 760,
        }}
      >
        <Box />
        {days.map((dayKey) => (
          <Box
            key={dayKey}
            sx={{
              px: 1,
              py: 0.5,
              textAlign: "center",
              fontWeight: 700,
              fontSize: 13,
              borderBottom: "2px solid",
              borderColor: dayKey === todayKey ? "primary.main" : "divider",
            }}
          >
            {t(`booking.workingHours.weekday.${dayOfWeekOf(dayKey)}`)}
            <Box
              component="span"
              sx={{ ml: 0.5, fontWeight: 400, color: "text.secondary" }}
            >
              {formatDateOnly(dayKey).replace(/\s\d{4}$/, "")}
            </Box>
          </Box>
        ))}

        <Box sx={{ position: "relative" }}>
          {hours.map((hour) => (
            <Box
              key={hour}
              sx={{
                height: ROW_HEIGHT * (60 / SLOT_MINUTES),
                fontSize: 11,
                color: "text.secondary",
                textAlign: "right",
                pr: 1,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </Box>
          ))}
        </Box>

        {days.map((dayKey) => (
          <DayColumn
            key={dayKey}
            dayKey={dayKey}
            appointments={byDay.get(dayKey) ?? []}
            calendarById={calendarById}
            openSpan={openSpan}
            preview={previewByDate.get(dayKey) ?? []}
            now={now}
            isToday={dayKey === todayKey}
            onOpen={onOpen}
          />
        ))}
      </Box>
    </Box>
  );
}

function DayColumn({
  dayKey,
  appointments,
  calendarById,
  openSpan,
  preview,
  now,
  isToday,
  onOpen,
}: {
  dayKey: string;
  appointments: DayAppointment[];
  calendarById: Map<string, { id: string; name: string; color: string }>;
  openSpan: { start: number; end: number };
  preview: PreviewDay[];
  now: Date;
  isToday: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const pixelsPerMinute = ROW_HEIGHT / SLOT_MINUTES;

  /**
   * 3.3: the height comes from the real length of that Prague day, so 29 March
   * is 23 hours tall and 25 October is 25 - never `24 * hourHeight`.
   */
  const dayHours = hoursInPragueDay(dayKey);
  const visibleMinutes = Math.min(openSpan.end - openSpan.start, dayHours) * 60;
  const topOffset = openSpan.start * 60;

  const closed = preview.find((p) => !p.isOpen);

  return (
    <Box
      sx={{
        position: "relative",
        height: visibleMinutes * pixelsPerMinute,
        borderLeft: "1px solid",
        borderColor: "divider",
        backgroundColor: closed ? "action.hover" : "transparent",
      }}
    >
      {/* Outside working hours is shaded, never hidden: the owner has to see
          where the day ends, and why it is closed if it is (5.1). */}
      {closed?.closedBecause ? (
        <Typography
          sx={{
            position: "absolute",
            top: 4,
            left: 4,
            fontSize: 11,
            color: "text.secondary",
          }}
        >
          {t(`booking.grid.closed.${closed.closedBecause}`, {
            defaultValue: t("booking.grid.closed.other"),
          })}
        </Typography>
      ) : null}

      {isToday ? (
        <NowLine now={now} dayKey={dayKey} topOffset={topOffset} />
      ) : null}

      {appointments.map((appointment) => {
        const startMinutes =
          minutesIntoDay(appointment.startUtc, dayKey) - topOffset;
        const endMinutes =
          minutesIntoDay(appointment.endUtc, dayKey) - topOffset;
        return (
          <Box
            key={appointment.id}
            sx={{
              position: "absolute",
              top: Math.max(0, startMinutes) * pixelsPerMinute,
              height: Math.max(
                18,
                (endMinutes - startMinutes) * pixelsPerMinute - 2,
              ),
              left: 2,
              right: 2,
            }}
          >
            <AppointmentButton
              appointment={appointment}
              calendar={calendarById.get(appointment.calendarId ?? "")}
              now={now}
              expanded={false}
              onOpen={onOpen}
              layout="block"
            />
          </Box>
        );
      })}
    </Box>
  );
}

function NowLine({
  now,
  dayKey,
  topOffset,
}: {
  now: Date;
  dayKey: string;
  topOffset: number;
}) {
  const { t } = useTranslation();
  const minutes = minutesIntoDay(now.toISOString(), dayKey) - topOffset;
  if (minutes < 0) return null;
  return (
    <Box
      aria-label={t("booking.grid.now")}
      sx={{
        position: "absolute",
        top: minutes * (ROW_HEIGHT / SLOT_MINUTES),
        left: 0,
        right: 0,
        height: 0,
        borderTop: "2px solid",
        borderColor: "error.main",
        zIndex: 2,
      }}
    />
  );
}

/**
 * One appointment. It is a `button`, not a div with an onClick (7.1), and its
 * status is written out as well as coloured, because colour may not be the only
 * carrier of the information.
 */
function AppointmentButton({
  appointment,
  calendar,
  now,
  expanded,
  onOpen,
  layout,
}: {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string };
  now: Date;
  expanded: boolean;
  onOpen: (id: string) => void;
  layout: "row" | "block";
}) {
  const { t } = useTranslation();
  const color = calendar?.color ?? "#37474F";
  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), now);
  const tally = statusTally(appointment.status);
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen(appointment.id)}
      aria-expanded={expanded}
      sx={{
        display: "block",
        width: "100%",
        height: layout === "block" ? "100%" : "auto",
        textAlign: "left",
        cursor: "pointer",
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 1,
        px: 1,
        py: 0.5,
        font: "inherit",
        fontSize: 12,
        overflow: "hidden",
        backgroundColor: color,
        color: readableTextOn(color),
        opacity: tally === "cancelled" ? 0.55 : 1,
        textDecoration: tally === "cancelled" ? "line-through" : "none",
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
        },
      }}
    >
      <Box component="span" sx={{ fontWeight: 700 }}>
        {formatPragueTime(appointment.startUtc)}
      </Box>{" "}
      {appointment.activityName}
      <Box
        component="span"
        sx={{ display: "block", fontSize: 11, opacity: 0.9 }}
      >
        {statusLabel}
        {late ? ` · ${t("booking.status.late")}` : ""}
        {calendar ? ` · ${calendar.name}` : ""}
      </Box>
    </Box>
  );
}
