import { useRef } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { statusTally } from "../../../api/bookingContracts";
import type { Calendar, DayAppointment } from "../../../api/bookingContracts";
import { DESIGN } from "../../../theme";
import { StatusChip } from "../../ui/StatusChip";
import { dayOfWeekOf, formatDateOnly, type DateOnly } from "../../../utils/time";
import { pragueMinuteOfDay } from "../grid/timeRange";
import { AppointmentButton } from "../grid/AppointmentButton";
import type { DayMark } from "../grid/dayMarks";
import { GRID_TEXT } from "../grid/gridText";
import { WEEKDAY_ABBREVIATION, weekdayLong } from "../grid/periodTitle";
import { CAL_TEXT } from "./calendarText";
import { clubOnlyLine, type ClubWindow } from "./clubWindows";
import { InquiryChip } from "./InquiryChip";
import type { InquiryRef } from "./inquiries";
import type { ClubBlockPick } from "./ClubBlockPopover";
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
  /** Club windows (ClubBlocks) by day: they hold time too, so the lists must show and count them. */
  clubWindowsByDay?: Map<string, ClubWindow[]>;
  /** Pending club orders (Invited / Requested): a dashed "Poptávka" chip on their days. */
  inquiriesByDay?: Map<string, InquiryRef[]>;
  onOpenInquiry?: (orderId: string) => void;
  onOpenClubWindow?: (pick: Omit<ClubBlockPick, "x" | "y">, point: { x: number; y: number }) => void;
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

function WeekStrip({ days, anchor, byDay, marks, todayKey, holidayColor, onAnchor, clubWindowsByDay, inquiriesByDay }: PhoneCalendarProps) {
  return (
    <Box
      role="group"
      aria-label={CAL_TEXT.weekStrip}
      sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5, mb: 1.5 }}
    >
      {days.map((dayKey) => {
        const mark = marks.get(dayKey) ?? OPEN_MARK;
        const windows = clubWindowsByDay?.get(dayKey) ?? [];
        const count = (byDay.get(dayKey) ?? []).filter((a) => statusTally(a.status) !== "cancelled").length + new Set(windows.map((w) => w.clubBlockId)).size;
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
            {windows.length > 0 ? <ClubDots windows={windows} /> : null}
            {(inquiriesByDay?.get(dayKey) ?? []).length > 0 ? (
              <Box component="span" data-testid="inquiry-dot" title="Poptávka" sx={{ width: 8, height: 8, borderRadius: "50%", border: "1px dashed currentColor", display: "block" }} />
            ) : null}
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
  clubWindowsByDay,
  onOpenClubWindow,
  inquiriesByDay,
  onOpenInquiry,
}: PhoneCalendarProps & { day: DateOnly }) {
  const mark = marks.get(day) ?? OPEN_MARK;
  const appointments = [...(byDay.get(day) ?? [])].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const windows = clubWindowsByDay?.get(day) ?? [];
  const inquiries = inquiriesByDay?.get(day) ?? [];
  /* Appointments and club windows together, in time order. */
  const entries: ({ at: number; kind: "appointment"; appointment: DayAppointment } | { at: number; kind: "club"; window: ClubWindow })[] = [
    ...appointments.map((appointment) => ({ at: pragueMinuteOfDay(appointment.startUtc), kind: "appointment" as const, appointment })),
    ...windows.map((window) => ({ at: window.start, kind: "club" as const, window })),
  ].sort((a, b) => a.at - b.at);
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
      {inquiries.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1 }}>
          {inquiries.map((inquiry) => (
            <InquiryChip key={inquiry.orderId} inquiry={inquiry} {...(onOpenInquiry ? { onOpen: onOpenInquiry } : {})} />
          ))}
        </Box>
      ) : null}
      {entries.length === 0 ? (
        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{CAL_TEXT.noBookings}</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {appointments.length === 0 ? (
            <Typography data-testid="club-only-line" sx={{ color: "text.secondary", fontSize: 14 }}>{clubOnlyLine(windows)}</Typography>
          ) : null}
          {entries.map((entry) => {
            if (entry.kind === "club") return <ClubWindowCard key={entry.window.key} window={entry.window} onOpen={onOpenClubWindow} />;
            const appointment = entry.appointment;
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
  clubWindowsByDay,
  inquiriesByDay,
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
        const windows = clubWindowsByDay?.get(dayKey) ?? [];
        const inquiries = inquiriesByDay?.get(dayKey) ?? [];
        const clubCount = new Set(windows.map((w) => w.clubBlockId)).size;
        const total = counts.total + clubCount;
        const holiday = mark.label === GRID_TEXT.publicHoliday;
        const today = dayKey === todayKey;
        return (
          <Box component="li" key={dayKey}>
            <ButtonBase
              onClick={() => onPickDay(dayKey)}
              data-testid={`phone-month-day-${dayKey}`}
              aria-label={`${weekdayLong(dayKey)} ${formatDateOnly(dayKey)}, ${total === 0 ? CAL_TEXT.noBookings : counts.total > 0 ? peopleWord(counts.total) : clubOnlyLine(windows)}`}
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
                ) : null}
                {windows.length > 0 ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <ClubDots windows={windows} />
                    <Typography data-testid={`phone-month-club-${dayKey}`} sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
                      {clubOnlyLine(windows)}
                    </Typography>
                  </Box>
                ) : null}
                {inquiries.length > 0 ? (
                  <Box component="span" data-testid={`phone-month-inquiry-${dayKey}`} sx={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "text.secondary", border: "1px dashed", borderColor: "text.disabled", borderRadius: "4px", px: 0.75 }}>
                    {`Poptávka · ${[...new Set(inquiries.map((i) => i.clubName))].join(", ")}`}
                  </Box>
                ) : null}
                {windows.length === 0 && inquiries.length === 0 && counts.services.length === 0 && !mark.closed ? (
                  <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{CAL_TEXT.noBookings}</Typography>
                ) : null}
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {total > 0 ? total : ""}
              </Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}

/** A coloured dot per club that holds time that day. */
function ClubDots({ windows }: { windows: readonly ClubWindow[] }) {
  const clubs = new Map<string, string>();
  for (const w of windows) if (!clubs.has(w.clubName)) clubs.set(w.clubName, w.colorHex ?? DESIGN.faint);
  return (
    <Box component="span" data-testid="club-dots" sx={{ display: "inline-flex", gap: "3px", alignItems: "center" }}>
      {[...clubs].map(([name, colour]) => (
        <Box key={name} component="span" title={name} sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: colour, display: "block" }} />
      ))}
    </Box>
  );
}

/** One club window of the day: colour bar, "Klub · 08:00–12:00", the činnost split and "3/22 zapsáno". Tap = the club block popover. */
function ClubWindowCard({ window, onOpen }: { window: ClubWindow; onOpen: PhoneCalendarProps["onOpenClubWindow"] }) {
  const colour = window.colorHex ?? DESIGN.faint;
  return (
    <ButtonBase
      data-testid="club-window-card"
      onClick={(event) =>
        onOpen?.(
          { clubBlockId: window.clubBlockId, clubId: window.clubId, clubName: window.clubName, colorHex: window.colorHex, range: window.range },
          { x: event.clientX, y: event.clientY },
        )
      }
      sx={{
        width: "100%",
        minHeight: 56,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-start",
        textAlign: "left",
        gap: 1.25,
        px: 1.25,
        py: 1,
        borderRadius: `${DESIGN.radius.md}px`,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(colour, 0.12),
      }}
    >
      <Box sx={{ width: 5, borderRadius: 3, bgcolor: colour, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{`${window.clubName} · ${window.timeLabel}`}</Typography>
        {window.wholeDay ? <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Celý den</Typography> : null}
        {window.breakdown ? <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{window.breakdown}</Typography> : null}
        {window.registered !== null && window.seats !== null ? (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{`${window.registered}/${window.seats} zapsáno`}</Typography>
        ) : null}
      </Box>
    </ButtonBase>
  );
}
