import { useState } from "react";
import {
  Box,
  ButtonBase,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type {
  Calendar,
  DayAppointment,
  PreviewDay,
  TimeBlock,
} from "../../../api/bookingContracts";
import { dayOfWeekOf, type DateOnly } from "../../../utils/time";
import { AppointmentButton } from "./AppointmentButton";
import { BlockDetailDialog, BlockReasonDialog, type BlockTarget } from "./BlockDialogs";
import { calendarDayOpen, type DayMark } from "./dayMarks";
import { dayBelongsTo, emphasis } from "./filters";
import { GRID_TEXT } from "./gridText";
import { isWorkingToday, nowLinePlacement } from "./nowLine";
import {
  dragRange,
  localDateTime,
  minuteAt,
  parseTimeOfDay,
  rangeLabel,
  spanOnDay,
  touchesDay,
  type MinuteRange,
} from "./timeRange";

/*
 * The day and week grid - contract 5.1 - with every calendar on screen side by
 * side inside each day.
 *
 * Three things happen here that the old grid did not do:
 *
 *   - **Dragging.** Press on a free part of a calendar's day, drag across the
 *     slots, and a small menu offers "Objednat" (bookings.create) and
 *     "Zablokovat" (bookings.edit). Without either permission nothing reacts to
 *     a drag at all. A shut day, a calendar that does not work that day, and a
 *     day belonging to another worker while one is filtered for do not react
 *     either. The drag only picks the time; whether it can be booked is still
 *     the server's answer (6.1), given in the booking dialog.
 *   - **The now-line**, per the owner's rules in `nowLine.ts`.
 *   - **Blocks**, drawn with their reason, and removable by who may block.
 */

const SLOT_MINUTES = 30;
/**
 * Pixels per slot. A booking shows two lines - time with activity, and the
 * status in words, which 7.1 requires because colour may not carry it alone -
 * so the shortest slot has to be tall enough for both.
 */
const ROW_HEIGHT = 46;
const PX_PER_MINUTE = ROW_HEIGHT / SLOT_MINUTES;

export interface GridBookingRequest {
  calendarId: string;
  dayKey: DateOnly;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. */
  start: string;
  end: string;
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
  mayBook: boolean;
  mayBlock: boolean;
  onOpen: (id: string) => void;
  onBook: (request: GridBookingRequest) => void;
  onPickDay: (day: DateOnly) => void;
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

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
    mayBook,
    mayBlock,
  } = props;

  const [pending, setPending] = useState<Selection | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [openBlock, setOpenBlock] = useState<{ calendar: Calendar; block: TimeBlock } | null>(
    null,
  );

  const topMinute = openSpan.start * 60;
  const bottomMinute = openSpan.end * 60;
  const height = (bottomMinute - topMinute) * PX_PER_MINUTE;
  const hours = Array.from({ length: openSpan.end - openSpan.start }, (_, i) => openSpan.start + i);
  const columnMin = Math.max(140, calendars.length * 110);
  const dragEnabled = mayBook || mayBlock;
  const pendingCalendar = pending
    ? calendars.find((c) => c.id === pending.calendarId)
    : undefined;

  const rowsOf = (dayKey: string) =>
    calendars
      .map((c) => previewByCalendar.get(c.id)?.get(dayKey))
      .filter((row): row is PreviewDay => row !== undefined);

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `64px repeat(${days.length}, minmax(${columnMin}px, 1fr))`,
          minWidth: view === "day" ? undefined : 64 + days.length * columnMin,
        }}
      >
        <Box />
        {days.map((dayKey) => {
          const mark = marks.get(dayKey) ?? OPEN_MARK;
          const emphasised = emphasis(dayKey, props.selectedDay, view) === "day";
          const workingToday = isWorkingToday({
            now,
            dayKey,
            rows: rowsOf(dayKey),
            closed: mark.closed,
          });
          return (
            <Box
              key={dayKey}
              sx={{
                borderBottom: "2px solid",
                borderColor: emphasised ? "primary.main" : "divider",
                backgroundColor: emphasised
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "transparent",
                boxShadow: workingToday
                  ? `inset 0 3px 0 ${alpha(nowLineColor, 0.45)}`
                  : "none",
              }}
            >
              <ButtonBase
                onClick={() => props.onPickDay(dayKey)}
                aria-current={emphasised ? "date" : undefined}
                sx={{ display: "block", width: "100%", px: 1, py: 0.5, textAlign: "center" }}
              >
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>
                  {t(`booking.workingHours.weekday.${dayOfWeekOf(dayKey)}`)}
                </Typography>{" "}
                <Typography
                  component="span"
                  data-testid={`day-number-${dayKey}`}
                  sx={{
                    fontSize: 13,
                    fontWeight: mark.redNumber || emphasised ? 700 : 400,
                    color: mark.redNumber ? "error.main" : "text.secondary",
                  }}
                >
                  {Number(dayKey.slice(8, 10))}. {Number(dayKey.slice(5, 7))}.
                </Typography>
                {mark.label ? (
                  <Tooltip title={mark.detail ?? ""}>
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: mark.redNumber ? "error.main" : "text.secondary",
                      }}
                    >
                      {mark.label}
                    </Typography>
                  </Tooltip>
                ) : null}
              </ButtonBase>
              {calendars.length > 1 ? (
                <Box sx={{ display: "flex" }}>
                  {calendars.map((calendar) => (
                    <Box
                      key={calendar.id}
                      title={calendar.name}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        px: 0.5,
                        fontSize: 10,
                        borderTop: `3px solid ${calendar.color}`,
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

        <Box>
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

        {days.map((dayKey) => {
          const mark = marks.get(dayKey) ?? OPEN_MARK;
          const rows = rowsOf(dayKey);
          const placement = nowLinePlacement({ now, dayKey, view, rows, closed: mark.closed });
          const workingToday = isWorkingToday({ now, dayKey, rows, closed: mark.closed });
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
                    open={calendarDayOpen(mark, row) && belongs}
                    dragEnabled={dragEnabled}
                    appointments={appointments.filter((a) => a.calendarId === calendar.id)}
                    blocks={(props.blocksByCalendar.get(calendar.id) ?? []).filter((b) =>
                      touchesDay(b.startUtc, b.endUtc, dayKey),
                    )}
                    topMinute={topMinute}
                    bottomMinute={bottomMinute}
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

              {workingToday ? (
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    inset: 0,
                    border: `2px solid ${alpha(nowLineColor, 0.35)}`,
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              ) : null}

              {placement ? (
                <>
                  <Box
                    role="img"
                    aria-label={t("booking.grid.now")}
                    data-testid="now-line"
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: (placement.minute - topMinute) * PX_PER_MINUTE,
                      height: 0,
                      borderTop: `2px solid ${nowLineColor}`,
                      pointerEvents: "none",
                      zIndex: 5,
                    }}
                  />
                  {placement.verticalLines
                    ? (["left", "right"] as const).map((edge) => (
                        <Box
                          key={edge}
                          aria-hidden
                          data-testid={`now-edge-${edge}`}
                          sx={{
                            position: "absolute",
                            [edge]: 0,
                            width: 2,
                            top: (Math.max(placement.span.start, topMinute) - topMinute) * PX_PER_MINUTE,
                            height:
                              (Math.min(placement.span.end, bottomMinute) -
                                Math.max(placement.span.start, topMinute)) *
                              PX_PER_MINUTE,
                            backgroundColor: nowLineColor,
                            pointerEvents: "none",
                            zIndex: 5,
                          }}
                        />
                      ))
                    : null}
                </>
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Menu
        open={pending !== null}
        onClose={() => setPending(null)}
        anchorReference="anchorPosition"
        anchorPosition={pending ? { top: pending.y, left: pending.x } : undefined}
      >
        {pending ? (
          <ListSubheader sx={{ lineHeight: 2.2 }}>
            {pendingCalendar ? `${pendingCalendar.name} · ` : ""}
            {rangeLabel(pending.range)}
          </ListSubheader>
        ) : null}
        {mayBook ? (
          <MenuItem
            onClick={() => {
              if (!pending) return;
              props.onBook({
                calendarId: pending.calendarId,
                dayKey: pending.dayKey,
                start: localDateTime(pending.dayKey, pending.range.start),
                end: localDateTime(pending.dayKey, pending.range.end),
              });
              setPending(null);
            }}
          >
            {GRID_TEXT.book}
          </MenuItem>
        ) : null}
        {mayBlock ? (
          <MenuItem
            onClick={() => {
              if (!pending) return;
              setBlockTarget({
                calendarId: pending.calendarId,
                calendarName: pendingCalendar?.name ?? "",
                dayKey: pending.dayKey,
                range: pending.range,
              });
              setPending(null);
            }}
          >
            {GRID_TEXT.block}
          </MenuItem>
        ) : null}
      </Menu>

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

function SubColumn({
  calendar,
  dayKey,
  row,
  open,
  dragEnabled,
  appointments,
  blocks,
  topMinute,
  bottomMinute,
  now,
  pending,
  onSelect,
  onOpen,
  onOpenBlock,
}: {
  calendar: Calendar;
  dayKey: DateOnly;
  row: PreviewDay | undefined;
  open: boolean;
  dragEnabled: boolean;
  appointments: DayAppointment[];
  blocks: TimeBlock[];
  topMinute: number;
  bottomMinute: number;
  now: Date;
  pending: MinuteRange | null;
  onSelect: (selection: Selection) => void;
  onOpen: (id: string) => void;
  onOpenBlock: (block: TimeBlock) => void;
}) {
  const theme = useTheme();
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);

  const step = calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : SLOT_MINUTES;
  const bounds = { start: topMinute, end: bottomMinute };
  const canDrag = dragEnabled && open;
  const live = drag ? dragRange(drag.anchor, drag.current, step, bounds) : pending;

  const place = (range: MinuteRange) => {
    const start = Math.max(range.start, topMinute);
    const end = Math.min(range.end, bottomMinute);
    return {
      top: (start - topMinute) * PX_PER_MINUTE,
      height: Math.max(0, (end - start) * PX_PER_MINUTE),
    };
  };

  const workStart = row?.isOpen ? parseTimeOfDay(row.startTime) : null;
  const workEnd = row?.isOpen ? parseTimeOfDay(row.endTime) : null;
  const breakStart = row?.isOpen ? parseTimeOfDay(row.breakStart) : null;
  const breakEnd = row?.isOpen ? parseTimeOfDay(row.breakEnd) : null;
  /* Without a preview row nothing is known about the hours, so nothing is shaded. */
  const shaded = row !== undefined || !open;

  const minuteOf = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return minuteAt(event.clientY - rect.top, PX_PER_MINUTE, topMinute);
  };

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
        backgroundColor: shaded ? "action.hover" : "transparent",
        cursor: canDrag ? "cell" : "default",
        userSelect: "none",
      }}
    >
      {/* Working hours are drawn open, the rest of the day stays shaded: the
          owner has to see where the day ends (5.1). */}
      {workStart !== null && workEnd !== null && open ? (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            ...place({ start: workStart, end: workEnd }),
            background: `linear-gradient(${alpha(calendar.color, 0.07)}, ${alpha(calendar.color, 0.07)}), ${theme.palette.background.paper}`,
            zIndex: 0,
          }}
        />
      ) : null}
      {breakStart !== null && breakEnd !== null && open ? (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            ...place({ start: breakStart, end: breakEnd }),
            backgroundColor: "action.hover",
            zIndex: 0,
          }}
        />
      ) : null}

      {/* Hour and half-hour lines, so a drag has something to aim at. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT - 1}px, ${theme.palette.divider} ${ROW_HEIGHT - 1}px, ${theme.palette.divider} ${ROW_HEIGHT}px)`,
        }}
      />

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
            left: 2,
            right: 2,
            ...place(spanOnDay(block.startUtc, block.endUtc, dayKey)),
            zIndex: 2,
            overflow: "hidden",
            textAlign: "left",
            font: "inherit",
            fontSize: 11,
            px: 0.5,
            cursor: "pointer",
            color: "text.primary",
            border: "1px dashed",
            borderColor: "text.secondary",
            borderRadius: 1,
            backgroundColor: "background.paper",
            backgroundImage: `repeating-linear-gradient(45deg, ${alpha(theme.palette.text.secondary, 0.18)} 0 6px, transparent 6px 12px)`,
          }}
        >
          <Box component="span" sx={{ fontWeight: 700 }}>
            {GRID_TEXT.blocked}
          </Box>
          {block.reason ? ` · ${block.reason}` : ""}
        </Box>
      ))}

      {appointments.map((appointment) => {
        const placed = place(spanOnDay(appointment.startUtc, appointment.endUtc, dayKey));
        return (
          <Box
            key={appointment.id}
            sx={{
              position: "absolute",
              left: 2,
              right: 2,
              top: placed.top,
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
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <Typography
            sx={{
              mt: 0.25,
              px: 0.5,
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 0.5,
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              whiteSpace: "nowrap",
            }}
          >
            {rangeLabel(live)}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
