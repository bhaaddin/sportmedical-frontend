import { useRef } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { statusTally } from "../../../api/bookingContracts";
import type { Calendar, DayAppointment } from "../../../api/bookingContracts";
import { DESIGN } from "../../../theme";
import { StatusChip } from "../../ui/StatusChip";
import { dayOfWeekOf, formatDateOnly, type DateOnly } from "../../../utils/time";
import { AppointmentButton } from "../grid/AppointmentButton";
import type { DayMark } from "../grid/dayMarks";
import { GRID_TEXT } from "../grid/gridText";
import { WEEKDAY_ABBREVIATION, weekdayLong } from "../grid/periodTitle";
import { CAL_TEXT } from "./calendarText";
import { colourOfActivity, countByService, peopleWord, type Catalogue } from "./model";

/*
 * The calendar on a phone (≤767 px): no grid, lists.
 *
 *   DEN     one column of the day's bookings - time, patient, činnost, status;
 *   TÝDEN   one day at a time, a strip of the seven days on top, swipe or the
 *           top bar's ‹ › to move a day;
 *   MĚSÍC   the days of the month with their head counts and the split by
 *           služba written out (there is no hover on a phone); a tap opens
 *           that day's list.
 *
 * Every tappable thing is at least 44 px tall.
 */

interface PhoneCalendarProps {
  view: "day" | "week" | "month";
  anchor: DateOnly;
  days: DateOnly[];
  byDay: Map<string, DayAppointment[]>;
  marks: Map<string, DayMark>;
  calendarById: Map<string, Calendar>;
  catalogue: Catalogue;
  now: Date;
  todayKey: string;
  holidayColor: string;
  onOpen: (id: string) => void;
  /** Open this day's list (month list row, week strip). */
  onPickDay: (day: DateOnly) => void;
  /** Move the selected day without changing the view (week strip, swipe). */
  onAnchor: (day: DateOnly) => void;
  /** Swipe one day on. */
  onStep: (direction: -1 | 1) => void;
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

export function PhoneCalendar(props: PhoneCalendarProps) {
  const { view } = props;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const swipeable = view !== "month";
  return (
    <Box
      data-testid="phone-calendar"
      onTouchStart={(event) => {
        if (!swipeable) return;
        const t = event.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || !swipeable) return;
        const t = event.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 64 && Math.abs(dy) < 40) props.onStep(dx < 0 ? 1 : -1);
      }}
    >
      {view === "month" ? <MonthList {...props} /> : null}
      {view === "week" ? <WeekStrip {...props} /> : null}
      {view !== "month" ? <DayList {...props} day={props.anchor} /> : null}
    </Box>
  );
}

function WeekStrip({ days, anchor, byDay, marks, todayKey, holidayColor, onAnchor }: PhoneCalendarProps) {
  return (
    <Box
      role="group"
      aria-label={CAL_TEXT.weekStrip}
      sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5, mb: 1.5 }}
    >
      {days.map((dayKey) => {
        const mark = marks.get(dayKey) ?? OPEN_MARK;
        const count = (byDay.get(dayKey) ?? []).filter((a) => statusTally(a.status) !== "cancelled").length;
        const selected = dayKey === anchor;
        const today = dayKey === todayKey;
        const holiday = mark.label === GRID_TEXT.publicHoliday;
        return (
          <ButtonBase
            key={dayKey}
            onClick={() => onAnchor(dayKey)}
            aria-label={`${weekdayLong(dayKey)} ${formatDateOnly(dayKey)}${count > 0 ? `, ${count}` : ""}`}
            aria-pressed={selected}
            data-testid={`week-strip-${dayKey}`}
            sx={{
              flexDirection: "column",
              minHeight: 64,
              minWidth: 44,
              borderRadius: `${DESIGN.radius.lg}px`,
              border: "1px solid",
              borderColor: selected ? "text.primary" : "divider",
              bgcolor: selected ? DESIGN.ink : holiday ? alpha(holidayColor, 0.2) : "background.paper",
              color: selected ? "#FFFFFF" : mark.closed ? "text.secondary" : "text.primary",
              gap: 0.25,
            }}
          >
            <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, color: "inherit" }}>
              {WEEKDAY_ABBREVIATION[dayOfWeekOf(dayKey)]}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: 16,
                fontWeight: today ? 800 : 600,
                color: !selected && mark.redNumber ? "error.main" : "inherit",
              }}
            >
              {Number(dayKey.slice(8, 10))}
            </Typography>
            <Typography component="span" sx={{ fontSize: 10, fontWeight: 600, color: "inherit", opacity: count > 0 ? 1 : 0.4 }}>
              {count > 0 ? count : "·"}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function DayList({
  day,
  byDay,
  marks,
  calendarById,
  catalogue,
  now,
  onOpen,
}: PhoneCalendarProps & { day: DateOnly }) {
  const mark = marks.get(day) ?? OPEN_MARK;
  const appointments = [...(byDay.get(day) ?? [])].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return (
    <Box data-testid="phone-day-list" aria-label={CAL_TEXT.dayList} role="region">
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
        {weekdayLong(day)} {formatDateOnly(day)}
        {mark.label ? (
          <Box component="span" sx={{ ml: 1, fontWeight: 400, color: "text.secondary", fontSize: 13 }}>
            {mark.label}
          </Box>
        ) : null}
      </Typography>
      {appointments.length === 0 ? (
        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{CAL_TEXT.noBookings}</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {appointments.map((appointment) => {
            const calendar = calendarById.get(appointment.calendarId ?? "");
            return (
              <Box key={appointment.id} sx={{ minHeight: 56 }}>
                <AppointmentButton
                  appointment={appointment}
                  calendar={calendar}
                  now={now}
                  onOpen={onOpen}
                  layout="row"
                  accent={colourOfActivity(catalogue, appointment.activityId, calendar?.color ?? DESIGN.faint)}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function MonthList({
  days,
  anchor,
  byDay,
  marks,
  calendarById,
  catalogue,
  todayKey,
  holidayColor,
  onPickDay,
}: PhoneCalendarProps) {
  const month = anchor.slice(0, 7);
  const inMonth = days.filter((d) => d.slice(0, 7) === month);
  return (
    <Box component="ul" aria-label={CAL_TEXT.monthList} data-testid="phone-month-list" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {inMonth.map((dayKey) => {
        const mark = marks.get(dayKey) ?? OPEN_MARK;
        const counts = countByService({
          appointments: byDay.get(dayKey) ?? [],
          calendarById,
          catalogue,
          otherLabel: CAL_TEXT.otherService,
        });
        const holiday = mark.label === GRID_TEXT.publicHoliday;
        const today = dayKey === todayKey;
        return (
          <Box component="li" key={dayKey}>
            <ButtonBase
              onClick={() => onPickDay(dayKey)}
              data-testid={`phone-month-day-${dayKey}`}
              aria-label={`${weekdayLong(dayKey)} ${formatDateOnly(dayKey)}, ${counts.total === 0 ? CAL_TEXT.noBookings : peopleWord(counts.total)}`}
              sx={{
                width: "100%",
                minHeight: 56,
                px: 1.5,
                py: 1,
                gap: 1.5,
                justifyContent: "flex-start",
                textAlign: "left",
                borderRadius: `${DESIGN.radius.lg}px`,
                border: "1px solid",
                borderColor: today ? "text.primary" : "divider",
                bgcolor: holiday ? alpha(holidayColor, 0.2) : mark.closed ? "action.hover" : "background.paper",
              }}
            >
              <Box sx={{ width: 40, flexShrink: 0, textAlign: "center" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", lineHeight: 1.2 }}>
                  {WEEKDAY_ABBREVIATION[dayOfWeekOf(dayKey)]}
                </Typography>
                <Typography sx={{ fontSize: 17, fontWeight: today ? 800 : 600, lineHeight: 1.2, color: mark.redNumber ? "error.main" : "text.primary" }}>
                  {Number(dayKey.slice(8, 10))}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {holiday ? (
                  <StatusChip size="sm" sx={{ bgcolor: alpha(holidayColor, 0.3), color: DESIGN.hatch.holidayInk, letterSpacing: "0.06em" }}>
                    {GRID_TEXT.holidayPill}
                  </StatusChip>
                ) : mark.closed ? (
                  <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}>
                    {mark.label ?? GRID_TEXT.closedCaps}
                  </Typography>
                ) : null}
                {counts.services.length > 0 ? (
                  <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
                    {counts.services.map((s) => `${s.name} ${s.total}`).join(" · ")}
                  </Typography>
                ) : !mark.closed ? (
                  <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{CAL_TEXT.noBookings}</Typography>
                ) : null}
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {counts.total > 0 ? counts.total : ""}
              </Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
