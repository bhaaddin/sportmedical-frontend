import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  ButtonBase,
  IconButton,
  MenuItem,
  MenuList,
  Popover,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useTranslation } from "react-i18next";
import { statusTally } from "../../../api/bookingContracts";
import type {
  Calendar,
  DayAppointment,
  PreviewDay,
  TimeBlock,
} from "../../../api/bookingContracts";
import { pragueDateKey, type DateOnly } from "../../../utils/time";
import { CALENDAR_DISPLAY_OFFLINE } from "../../../api/displaySettings";
import { DESIGN } from "../../../theme";
import { StatusChip } from "../../ui/StatusChip";
import { AppointmentButton } from "./AppointmentButton";
import { BlockDetailDialog, BlockReasonDialog, type BlockTarget } from "./BlockDialogs";
import { calendarDayOpen, subColumnClosedLabel, type DayMark } from "./dayMarks";
import { dayBelongsTo, emphasis } from "./filters";
import { GRID_TEXT } from "./gridText";
import { nowLinePlacement } from "./nowLine";
import { longDate, minutesFree, reservationsCount, shortDate, weekdayShort } from "./periodTitle";
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

/*
 * The day and week grid - contract 5.1, drawn to the board of 3. 10. 2026 -
 * with every calendar on screen side by side inside each day.
 *
 *   - **Dragging.** Press on a free part of a calendar's day, drag across the
 *     slots, and the board's popover offers "Objednat pacienta"
 *     (bookings.create), "Zablokovat čas" (bookings.edit) and "Rezervovat pro
 *     klub". Without either permission nothing reacts to a drag at all. A shut
 *     day, a calendar that does not work that day, and a day belonging to
 *     another worker while one is filtered for do not react either. The drag
 *     only picks the time; whether it can be booked is still the server's
 *     answer (6.1), given in the booking dialog.
 *   - **The now-line**, per the owner's rules in `nowLine.ts`: one red line
 *     across the grid with the time in a pill in the gutter, and in the week
 *     the edges of today's column as well.
 *   - **Blocks**, hatched with their reason, removable by who may block.
 *   - **Closed days** are one hatched block down the whole column saying why;
 *     a holiday in the owner's holiday colour, anything else in grey.
 */

const SLOT_MINUTES = 30;
/**
 * Pixels per 30-minute slot at zoom 1. A booking shows three lines - time,
 * name, status in words (7.1) - so the shortest slot has to fit at least the
 * first two.
 */
const ROW_HEIGHT = 46;
const GUTTER = 64;

/** The board's hatch, in whatever colour the thing is: the owner's holiday or lunch colour. */
const hatchOf = (color: string) =>
  `repeating-linear-gradient(135deg, ${alpha(color, 0.22)} 0px, ${alpha(color, 0.22)} 7px, ${alpha(color, 0.07)} 7px, ${alpha(color, 0.07)} 14px)`;

export interface GridBookingRequest {
  calendarId: string;
  dayKey: DateOnly;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. */
  start: string;
  end: string;
  /** The same range as instants, for whoever needs UTC (the club reservation). */
  startUtc: string;
  endUtc: string;
}

interface Selection {
  calendarId: string;
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
  /** "Rezervovat pro klub" - hands the range to the clubs screen. Not offered when absent. */
  onClub?: (request: GridBookingRequest) => void;
  onPickDay: (day: DateOnly) => void;
  /** Vertical zoom multiplier for row height; 1 is the default density. */
  zoom?: number;
  /** Zoom by a step (±0.1), from ctrl/⌘+wheel over the grid. */
  onZoom?: (delta: number) => void;
  /** Minutes between grid lines - the "ROZLIŠENÍ" level. Defaults to a half hour. */
  resolutionStep?: number;
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

function toRequest(calendarId: string, dayKey: DateOnly, range: MinuteRange): GridBookingRequest {
  const { startUtc, endUtc } = rangeToInstants(dayKey, range);
  return {
    calendarId,
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
    onZoom,
    onClub,
    resolutionStep = SLOT_MINUTES,
  } = props;
  const light = theme.palette.mode === "light";

  /* Zoom with the mouse: ctrl/⌘ + wheel over the grid, the way maps and editors
     do it. A native non-passive listener so preventDefault actually stops the
     page from zooming the browser; a plain wheel still scrolls the day. */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null || onZoom === undefined) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      onZoom(event.deltaY < 0 ? 0.1 : -0.1);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  /* Zoom scales the whole vertical scale: the row height and, with it, every
     minute→pixel placement below. Horizontal layout is untouched. */
  const pxPerMinute = (ROW_HEIGHT * zoom) / SLOT_MINUTES;

  const [pending, setPending] = useState<Selection | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [openBlock, setOpenBlock] = useState<{ calendar: Calendar; block: TimeBlock } | null>(
    null,
  );

  const topMinute = openSpan.start * 60;
  const bottomMinute = openSpan.end * 60;
  const height = (bottomMinute - topMinute) * pxPerMinute;
  const hours = Array.from({ length: openSpan.end - openSpan.start }, (_, i) => openSpan.start + i);
  const columnMin = Math.max(150, calendars.length * 120);
  const dragEnabled = mayBook || mayBlock;
  const pendingCalendar = pending
    ? calendars.find((c) => c.id === pending.calendarId)
    : undefined;
  const todayKey = pragueDateKey(now);
  const template = `${GUTTER}px repeat(${days.length}, minmax(${columnMin}px, 1fr))`;
  const minWidth = view === "day" ? undefined : GUTTER + days.length * columnMin;

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

  /* Thin ‹ › arrows hug the grid only while there is more of it to the side. */
  const [overflow, setOverflow] = useState(false);
  const measure = useCallback(() => {
    const node = scrollRef.current;
    if (node === null) return;
    setOverflow(node.scrollWidth > node.clientWidth + 1);
  }, []);
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
  }, [measure, days.length, calendars.length, zoom]);
  const scrollByColumn = (direction: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: direction * columnMin, behavior: "smooth" });

  const choose = (action: "book" | "block" | "club") => {
    if (!pending) return;
    const request = toRequest(pending.calendarId, pending.dayKey, pending.range);
    if (action === "book") props.onBook(request);
    if (action === "club") onClub?.(request);
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

  const countOn = (dayKey: string, calendarId: string) =>
    (props.appointmentsByDay.get(dayKey) ?? []).filter(
      (a) => a.calendarId === calendarId && statusTally(a.status) !== "cancelled",
    ).length;

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

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5 }}>
        {overflow ? (
          <ScrollArrow direction={-1} onClick={() => scrollByColumn(-1)} />
        ) : null}

        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: `${DESIGN.radius.xl}px`,
            bgcolor: "background.paper",
          }}
        >
          {/* Header row: one cell per day, the calendars within. */}
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
              return (
                <Box
                  key={dayKey}
                  sx={{
                    minWidth: 0,
                    borderLeft: "1px solid",
                    borderColor: "divider",
                    bgcolor: holiday
                      ? alpha(holidayColor, 0.1)
                      : today
                        ? alpha(theme.palette.text.primary, 0.05)
                        : undefined,
                  }}
                >
                  {dateRow ? (
                    <ButtonBase
                      onClick={() => props.onPickDay(dayKey)}
                      aria-current={emphasised ? "date" : undefined}
                      sx={{
                        display: "block",
                        width: "100%",
                        px: 1.5,
                        pt: 1,
                        pb: calendars.length > 1 || view === "day" ? 0.5 : 1,
                        textAlign: "left",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>
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

                  {view === "day" ? (
                    <Box sx={{ display: "flex" }}>
                      {calendars.map((calendar, i) => (
                        <Box
                          key={calendar.id}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            px: 1.5,
                            py: 1.25,
                            borderLeft: i === 0 ? "none" : "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography
                            component="h3"
                            sx={{
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: 1.3,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {calendar.name}
                          </Typography>
                          <Typography
                            sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.3, whiteSpace: "nowrap" }}
                          >
                            {reservationsCount(countOn(dayKey, calendar.id))}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : calendars.length > 1 ? (
                    <Box sx={{ display: "flex", px: 0.5, pb: 0.5, gap: 0.5 }}>
                      {calendars.map((calendar) => (
                        <Box
                          key={calendar.id}
                          title={`${calendar.name} · ${reservationsCount(countOn(dayKey, calendar.id))}`}
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
                      fontSize: 12,
                      lineHeight: 1,
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </Typography>
                ))}
                {resolutionStep <= 10
                  ? hours.map((hour) => (
                      <Typography
                        key={`${hour}-half`}
                        aria-hidden
                        sx={{
                          position: "absolute",
                          right: 8,
                          top: yOf(hour * 60 + 30) - 6,
                          fontSize: 11,
                          lineHeight: 1,
                          color: "text.disabled",
                          whiteSpace: "nowrap",
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
                      right: 6,
                      top: yOf(todayPlacement.minute) - 9,
                      px: 0.75,
                      py: "3px",
                      borderRadius: `${DESIGN.radius.sm}px`,
                      bgcolor: nowLineColor,
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1.2,
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
                const appointments = props.appointmentsByDay.get(dayKey) ?? [];

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
                      bgcolor: today
                        ? light
                          ? DESIGN.page
                          : "action.selected"
                        : undefined,
                    }}
                  >
                    {calendars.map((calendar) => {
                      const row = previewByCalendar.get(calendar.id)?.get(dayKey);
                      const belongs = dayBelongsTo(row, props.employeeId);
                      return (
                        <SubColumn
                          key={calendar.id}
                          calendar={calendar}
                          dayKey={dayKey}
                          row={row}
                          dayClosed={mark.closed}
                          open={calendarDayOpen(mark, row) && belongs}
                          dragEnabled={dragEnabled}
                          appointments={appointments.filter((a) => a.calendarId === calendar.id)}
                          blocks={(props.blocksByCalendar.get(calendar.id) ?? []).filter((b) =>
                            touchesDay(b.startUtc, b.endUtc, dayKey),
                          )}
                          topMinute={topMinute}
                          bottomMinute={bottomMinute}
                          pxPerMinute={pxPerMinute}
                          gridStep={resolutionStep}
                          lunchColor={lunchColor}
                          now={now}
                          pending={
                            pending?.calendarId === calendar.id && pending.dayKey === dayKey
                              ? pending.range
                              : null
                          }
                          onSelect={setPending}
                          onOpen={props.onOpen}
                          onOpenBlock={(block) => setOpenBlock({ calendar, block })}
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
                          inset: 3,
                          zIndex: 4,
                          pointerEvents: "none",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          px: 1,
                          borderRadius: `${DESIGN.radius.sm}px`,
                          border: `1px solid ${holiday ? alpha(holidayColor, 0.45) : DESIGN.hatch.closedLine}`,
                          backgroundImage: holiday ? hatchOf(holidayColor) : DESIGN.hatch.closed,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            color: holiday ? holidayColor : DESIGN.muted,
                          }}
                        >
                          {holiday ? GRID_TEXT.holidayClosed : mark.label}
                        </Typography>
                        {mark.detail ? (
                          <Typography
                            sx={{ fontSize: 11, color: holiday ? holidayColor : DESIGN.muted, opacity: 0.85 }}
                          >
                            {mark.detail}
                          </Typography>
                        ) : null}
                      </Box>
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

        {overflow ? (
          <ScrollArrow direction={1} onClick={() => scrollByColumn(1)} />
        ) : null}
      </Box>

      <Legend holidayColor={holidayColor} nowLineColor={nowLineColor} />

      {/* The board's popover (design-07): what to do with the time just dragged. */}
      <Popover
        open={pending !== null}
        onClose={() => setPending(null)}
        anchorReference="anchorPosition"
        anchorPosition={pending ? { top: pending.y, left: pending.x } : undefined}
        slotProps={{
          paper: {
            sx: {
              width: 300,
              borderRadius: `${DESIGN.radius.xl}px`,
              boxShadow: DESIGN.shadow.dialog,
            },
          },
        }}
      >
        {pending ? (
          <Box>
            <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
                {spanLabel(pending.range)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>
                {longDate(pending.dayKey, false)} · {minutesFree(pending.range.end - pending.range.start)}
              </Typography>
              {pendingCalendar ? (
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                  {pendingCalendar.name}
                </Typography>
              ) : null}
            </Box>
            <MenuList sx={{ py: 0.75 }}>
              {mayBook ? (
                <SelectionAction
                  icon={<AddIcon fontSize="small" />}
                  filled
                  primary={GRID_TEXT.bookPatient}
                  secondary={GRID_TEXT.bookPatientHint}
                  onClick={() => choose("book")}
                />
              ) : null}
              {mayBlock ? (
                <SelectionAction
                  icon={<LockOutlinedIcon fontSize="small" />}
                  primary={GRID_TEXT.blockTime}
                  secondary={GRID_TEXT.blockTimeHint}
                  onClick={() => choose("block")}
                />
              ) : null}
              {mayBook && onClub ? (
                <SelectionAction
                  icon={<GroupsOutlinedIcon fontSize="small" />}
                  primary={GRID_TEXT.bookClub}
                  secondary={GRID_TEXT.bookClubHint}
                  onClick={() => choose("club")}
                />
              ) : null}
            </MenuList>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1.25,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <ButtonBase
                onClick={() => setPending(null)}
                sx={{ fontSize: 13, color: "text.secondary", borderRadius: 1, px: 0.5 }}
              >
                {GRID_TEXT.cancelSelection}
              </ButtonBase>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{GRID_TEXT.escape}</Typography>
            </Box>
          </Box>
        ) : null}
      </Popover>

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
    </Box>
  );
}

function SelectionAction({
  icon,
  filled = false,
  primary,
  secondary,
  onClick,
}: {
  icon: React.ReactNode;
  filled?: boolean;
  primary: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <MenuItem onClick={onClick} sx={{ alignItems: "center", gap: 1.5, px: 2, py: 1, mx: 0.75 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${DESIGN.radius.lg}px`,
          bgcolor: filled ? "primary.main" : "action.hover",
          color: filled ? "primary.contrastText" : "text.primary",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{primary}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.3, whiteSpace: "normal" }}>
          {secondary}
        </Typography>
      </Box>
    </MenuItem>
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
        borderRadius: `${DESIGN.radius.xl}px`,
        bgcolor: "action.hover",
      }}
    >
      <IconButton size="small" aria-label={label} title={label} onClick={onClick} sx={{ width: 28, height: 56 }}>
        {direction < 0 ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}

/** The key under the grid: Právě vybíráte · Obsazeno · Zablokováno · Svátek · Aktuální čas. */
function Legend({ holidayColor, nowLineColor }: { holidayColor: string; nowLineColor: string }) {
  const theme = useTheme();
  const swatch = { width: 14, height: 14, borderRadius: "3px", flexShrink: 0 } as const;
  const items: { label: string; box: React.ReactNode }[] = [
    {
      label: GRID_TEXT.legendSelecting,
      box: (
        <Box
          sx={{
            ...swatch,
            border: `2px solid ${theme.palette.primary.main}`,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
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
            borderLeft: `3px solid ${DESIGN.appointment.edge}`,
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
            border: `1px solid ${DESIGN.hatch.closedLine}`,
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
            border: `1px solid ${alpha(holidayColor, 0.45)}`,
          }}
        />
      ),
    },
    {
      label: GRID_TEXT.legendNow,
      box: <Box sx={{ width: 14, height: 0, borderTop: `2px solid ${nowLineColor}`, flexShrink: 0 }} />,
    },
  ];
  return (
    <Box
      aria-hidden
      sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mt: 1.5, px: 0.5 }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {item.box}
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function SubColumn({
  calendar,
  dayKey,
  row,
  dayClosed,
  open,
  dragEnabled,
  appointments,
  blocks,
  topMinute,
  bottomMinute,
  pxPerMinute,
  gridStep,
  now,
  pending,
  onSelect,
  onOpen,
  onOpenBlock,
  lunchColor,
}: {
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
  blocks: TimeBlock[];
  topMinute: number;
  bottomMinute: number;
  pxPerMinute: number;
  /** Minutes between the grid lines drawn. */
  gridStep: number;
  now: Date;
  pending: MinuteRange | null;
  onSelect: (selection: Selection) => void;
  onOpen: (id: string) => void;
  onOpenBlock: (block: TimeBlock) => void;
}) {
  const theme = useTheme();
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);

  /* A drag snaps to the calendar's own step, or to the finer grid when the
     grid has been zoomed below it - what is drawn is what can be aimed at. */
  const calendarStep = calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : SLOT_MINUTES;
  const step = Math.min(calendarStep, gridStep > 0 ? gridStep : calendarStep);
  const bounds = { start: topMinute, end: bottomMinute };
  const canDrag = dragEnabled && open;
  const live = drag ? dragRange(drag.anchor, drag.current, step, bounds) : pending;

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

  return (
    <Box
      data-testid={`sub-column-${calendar.id}-${dayKey}`}
      onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
        if (!canDrag || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("[data-grid-item]")) return;
        const element = event.currentTarget;
        if (typeof element.setPointerCapture === "function") {
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            /* A pointer the browser no longer tracks; the drag still works inside the column. */
          }
        }
        const minute = minuteOf(event);
        setDrag({ anchor: minute, current: minute });
        event.preventDefault();
      }}
      onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
        if (!drag) return;
        const minute = minuteOf(event);
        setDrag((current) => (current ? { ...current, current: minute } : current));
      }}
      onPointerUp={(event: React.PointerEvent<HTMLDivElement>) => {
        if (!drag) return;
        const range = dragRange(drag.anchor, minuteOf(event), step, bounds);
        setDrag(null);
        onSelect({ calendarId: calendar.id, dayKey, range, x: event.clientX, y: event.clientY });
      }}
      onPointerCancel={() => setDrag(null)}
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
            border: `1px solid ${alpha(lunchColor, 0.4)}`,
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
              color: lunchColor,
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.08em",
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
            border: `1px solid ${DESIGN.hatch.closedLine}`,
            backgroundImage: DESIGN.hatch.closed,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: DESIGN.muted }}>
            {subColumnClosedLabel(row)}
          </Typography>
        </Box>
      ) : null}

      {blocks.map((block) => (
        <Box
          key={block.id}
          component="button"
          type="button"
          data-grid-item="block"
          onClick={() => onOpenBlock(block)}
          aria-haspopup="dialog"
          sx={{
            position: "absolute",
            left: 3,
            right: 3,
            ...place(spanOnDay(block.startUtc, block.endUtc, dayKey)),
            zIndex: 2,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            font: "inherit",
            fontSize: 11,
            fontWeight: 600,
            px: 0.75,
            cursor: "pointer",
            color: DESIGN.muted,
            border: `1px solid ${DESIGN.hatch.closedLine}`,
            borderRadius: `${DESIGN.radius.sm}px`,
            backgroundImage: DESIGN.hatch.closed,
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
          }}
        >
          <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {block.reason || GRID_TEXT.blocked}
          </Box>
        </Box>
      ))}

      {appointments.map((appointment) => {
        const placed = place(spanOnDay(appointment.startUtc, appointment.endUtc, dayKey));
        return (
          <Box
            key={appointment.id}
            sx={{
              position: "absolute",
              left: 3,
              right: 3,
              top: placed.top + 1,
              height: Math.max(18, placed.height - 2),
              zIndex: 2,
            }}
          >
            <AppointmentButton
              appointment={appointment}
              calendar={calendar}
              now={now}
              onOpen={onOpen}
              layout="block"
            />
          </Box>
        );
      })}

      {live ? (
        <Box
          data-testid="drag-selection"
          sx={{
            position: "absolute",
            left: 2,
            right: 2,
            ...place(live),
            zIndex: 4,
            pointerEvents: "none",
            border: "2px solid",
            borderColor: "primary.main",
            borderRadius: `${DESIGN.radius.md}px`,
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
          }}
        >
          <Typography
            sx={{
              position: "absolute",
              top: -1,
              left: -1,
              px: 0.75,
              py: "2px",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.3,
              borderRadius: `${DESIGN.radius.sm}px`,
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              whiteSpace: "nowrap",
            }}
          >
            {selectionLabel(live)}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
