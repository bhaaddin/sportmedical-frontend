import { useRef, useState } from "react";
import { Box, Button, ButtonBase, Popover, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { statusTally } from "../../../api/bookingContracts";
import type { Calendar, DayAppointment } from "../../../api/bookingContracts";
import { DESIGN } from "../../../theme";
import { formatDateOnly, type DateOnly } from "../../../utils/time";
import { StatusChip } from "../../ui/StatusChip";
import { AppointmentButton } from "../grid/AppointmentButton";
import type { DayMark } from "../grid/dayMarks";
import { emphasis } from "../grid/filters";
import { GRID_TEXT } from "../grid/gridText";
import { WEEKDAY_ABBREVIATION, shortDate } from "../grid/periodTitle";
import { CAL_TEXT } from "./calendarText";
import type { ClubBlockRef } from "./ClubBlockPopover";
import { mixOver } from "./colors";
import { DayCountsPanel } from "./DayCountsPanel";
import {
  cleanHex,
  colourOfActivity,
  countByService,
  headsOf,
  inRange,
  rangePill,
  type Catalogue,
} from "./model";
import { useDayRangeSurface, type DayRangeApi } from "./useDayRange";

/*
 * The month - contract 5.1, drawn to L01-Mesic: seven columns, the day number
 * (today a filled dark circle), the count of people on the right, up to three
 * rows "08:00 Jan Novák" (a club row carries its head count), "+ 3 další";
 * a closed day says ZAVŘENO, a holiday is tinted with a SVÁTEK chip.
 *
 * Added for Etapa 2:
 *  - the DAY PANEL: people on the day split by služba. On a mouse it opens when
 *    the pointer rests on a day; on touch it opens on a tap (there is no hover
 *    on a tablet) with the way into the day beside it;
 *  - RANGE SELECTION: drag across days - or press and hold, or in "Vybrat dny"
 *    mode tap the first day and then the last - to mark a run of days; the page
 *    opens the board's popover for it;
 *  - the CLUB BLOCKS of the month as tinted rows, opening the club's popover.
 *
 * Deliberately not virtualised: a month is six rows; what can grow is one
 * day's list, which is capped and the rest named as a count.
 */

const MAX_PER_DAY = 3;
const MAX_CLUB_ROWS = 2;
const WEEKDAY_HEADS = [1, 2, 3, 4, 5, 6, 0];

export interface MonthViewProps {
  days: DateOnly[];
  byDay: Map<string, DayAppointment[]>;
  calendarById: Map<string, Calendar>;
  catalogue: Catalogue;
  marks: Map<string, DayMark>;
  anchor: DateOnly;
  anchorMonth: string;
  now: Date;
  todayKey: string;
  holidayColor: string;
  device: "tablet" | "desktop";
  rangeSelect: DayRangeApi;
  canSelectRange: boolean;
  /** Club blocks per day (deduplicated by block), from the calendars' block lists. */
  clubBlocksByDay: Map<string, ClubBlockRef[]>;
  onOpenClubBlock: (block: ClubBlockRef, point: { x: number; y: number }) => void;
  onOpen: (id: string) => void;
  onPickDay: (day: DateOnly) => void;
}

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

export function MonthView(props: MonthViewProps) {
  const {
    days,
    byDay,
    calendarById,
    catalogue,
    marks,
    anchor,
    anchorMonth,
    todayKey,
    holidayColor,
    device,
    rangeSelect,
    canSelectRange,
  } = props;
  const theme = useTheme();
  const paper = theme.palette.background.paper;
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef<string>("mouse");
  const [hoverDay, setHoverDay] = useState<DateOnly | null>(null);
  const [tap, setTap] = useState<{ day: DateOnly; el: HTMLElement } | null>(null);
  const tablet = device === "tablet";
  const { highlight } = rangeSelect;
  useDayRangeSurface(rootRef, canSelectRange ? rangeSelect : undefined);

  const countsOf = (dayKey: string) =>
    countByService({
      appointments: byDay.get(dayKey) ?? [],
      calendarById,
      catalogue,
      otherLabel: CAL_TEXT.otherService,
    });

  const firstPicked = highlight ? days.find((d) => inRange(d, highlight)) : undefined;

  return (
    <Box
      ref={rootRef}
      data-testid="month-grid"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: `${DESIGN.radius.lg}px`,
        bgcolor: "background.paper",
        position: "relative",
        /* A press that turns into a drag must not select text on the way. */
        userSelect: rangeSelect.dragging ? "none" : "auto",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          bgcolor: "action.hover",
          borderBottom: "1px solid",
          borderColor: "divider",
          borderRadius: `${DESIGN.radius.lg}px ${DESIGN.radius.lg}px 0 0`,
        }}
      >
        {WEEKDAY_HEADS.map((d, i) => (
          <Box
            key={"h" + d}
            sx={{
              px: 1.25,
              py: 1.1,
              fontWeight: 600,
              fontSize: 13,
              color: d === 0 || d === 6 ? "text.secondary" : "text.primary",
              borderLeft: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
            }}
          >
            {WEEKDAY_ABBREVIATION[d]}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {days.map((dayKey, index) => {
          const appointments = byDay.get(dayKey) ?? [];
          const counts = countsOf(dayKey);
          const mark = marks.get(dayKey) ?? OPEN_MARK;
          const holiday = mark.label === GRID_TEXT.publicHoliday;
          const outsideMonth = dayKey.slice(0, 7) !== anchorMonth;
          const live = appointments.filter((a) => statusTally(a.status) !== "cancelled");
          const shownHere = appointments.slice(0, MAX_PER_DAY);
          const hidden = appointments.length - shownHere.length;
          const lit = emphasis(dayKey, anchor, "month");
          const today = dayKey === todayKey;
          const firstOfMonth = dayKey.slice(8, 10) === "01";
          const lastRow = index >= days.length - 7;
          const pickedNow = rangeSelect.pickedState(dayKey);
          const picked = inRange(dayKey, highlight) || pickedNow === "active";
          const pickedPast = !picked && pickedNow === "past";
          const clubBlocks = props.clubBlocksByDay.get(dayKey) ?? [];
          const column = index % 7;
          const showPanel = hoverDay === dayKey && !rangeSelect.dragging && (counts.total > 0 || holiday);
          return (
            <Box
              key={dayKey}
              data-testid={`month-day-${dayKey}`}
              data-range-day={dayKey}
              data-picked={picked ? "true" : pickedPast ? "past" : undefined}
              tabIndex={0}
              onPointerDown={(event: React.PointerEvent<HTMLElement>) => {
                pointerType.current = event.pointerType || "mouse";
                if (!canSelectRange || event.button !== 0 || rangeSelect.tapMode) return;
                if ((event.target as HTMLElement).closest("[data-grid-item]")) return;
                rangeSelect.begin(dayKey, event);
              }}
              onPointerUp={() => rangeSelect.cancelPress()}
              onPointerCancel={() => rangeSelect.cancelPress()}
              onPointerEnter={(event: React.PointerEvent<HTMLElement>) => {
                rangeSelect.enter(dayKey);
                if (event.pointerType !== "touch") setHoverDay(dayKey);
              }}
              onPointerLeave={() => setHoverDay((current) => (current === dayKey ? null : current))}
              onFocus={() => setHoverDay(dayKey)}
              onBlur={(event: React.FocusEvent<HTMLElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setHoverDay((current) => (current === dayKey ? null : current));
                }
              }}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === "Escape") setHoverDay(null);
              }}
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                const target = event.target as HTMLElement;
                if (target.closest("[data-grid-item], a")) return;
                if (canSelectRange && rangeSelect.tapsSelect) {
                  rangeSelect.tap(dayKey, { x: event.clientX, y: event.clientY });
                  return;
                }
                if (pointerType.current === "touch" && !target.closest("button")) {
                  setTap({ day: dayKey, el: event.currentTarget });
                }
              }}
              sx={{
                position: "relative",
                minHeight: tablet ? 96 : 92,
                px: tablet ? 0.75 : 0.875,
                py: 0.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.375,
                borderLeft: column === 0 ? "none" : "1px solid",
                borderTop: "1px solid",
                borderColor: "divider",
                borderBottomLeftRadius: lastRow && column === 0 ? `${DESIGN.radius.lg}px` : 0,
                borderBottomRightRadius: lastRow && column === 6 ? `${DESIGN.radius.lg}px` : 0,
                outline: "none",
                WebkitTouchCallout: "none",
                bgcolor: picked
                  ? DESIGN.selection.bg
                  : pickedPast
                    ? alpha(DESIGN.selection.bg, 0.4)
                    : holiday
                    ? mixOver(holidayColor, paper, 0.28)
                    : mark.closed
                      ? alpha(theme.palette.text.primary, 0.035)
                      : outsideMonth
                        ? alpha(theme.palette.text.primary, 0.015)
                        : lit === "week"
                          ? alpha(theme.palette.primary.main, 0.04)
                          : "background.paper",
                boxShadow:
                  picked
                    ? `inset 0 0 0 1px ${DESIGN.selection.line}`
                    : pickedPast
                      ? `inset 0 0 0 1px ${alpha(DESIGN.selection.line, 0.4)}`
                      : lit === "day"
                      ? `inset 0 0 0 2px ${theme.palette.primary.main}`
                      : "none",
                zIndex: showPanel ? 30 : picked ? 2 : 0,
                "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${DESIGN.ink}` },
              }}
            >
              {picked && highlight && dayKey === firstPicked ? (
                <Box
                  data-testid="range-pill"
                  sx={{
                    position: "absolute",
                    left: 4,
                    top: -11,
                    zIndex: 9,
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

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75 }}>
                <ButtonBase
                  onClick={(event) => {
                    event.stopPropagation();
                    if (canSelectRange && rangeSelect.tapsSelect) {
                      rangeSelect.tap(dayKey, { x: event.clientX, y: event.clientY });
                      return;
                    }
                    if (rangeSelect.chosen) return;
                    /* Ctrl/⌘/Shift adds the day to the places marked; it does not open it. */
                    if (canSelectRange && rangeSelect.isAdditive(event)) return;
                    props.onPickDay(dayKey);
                  }}
                  aria-label={formatDateOnly(dayKey)}
                  sx={{
                    minWidth: 26,
                    height: 26,
                    px: today ? 0 : 0.25,
                    borderRadius: today ? "50%" : 1,
                    fontSize: 12,
                    fontWeight: today || mark.redNumber || lit === "day" ? 700 : 500,
                    bgcolor: today ? DESIGN.ink : "transparent",
                    color: today
                      ? "#FFFFFF"
                      : mark.redNumber
                        ? "error.main"
                        : outsideMonth
                          ? "text.disabled"
                          : "text.primary",
                    "@media (pointer: coarse)": { minWidth: 32, height: 32 },
                  }}
                >
                  {firstOfMonth && !today ? shortDate(dayKey) : Number(dayKey.slice(8, 10))}
                </ButtonBase>
                {holiday ? (
                  <Tooltip title={mark.detail ?? ""}>
                    <span>
                      <StatusChip
                        size="sm"
                        sx={{ bgcolor: alpha(holidayColor, 0.3), color: DESIGN.hatch.holidayInk, letterSpacing: "0.06em" }}
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
                      {live.length > 0 ? ` · ${counts.total}` : ""}
                    </Typography>
                  </Tooltip>
                ) : mark.label ? (
                  <Tooltip title={mark.detail ?? ""}>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", textAlign: "right" }}>{mark.label}</Typography>
                  </Tooltip>
                ) : counts.total > 0 ? (
                  <Typography
                    data-testid={`month-count-${dayKey}`}
                    sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
                  >
                    {counts.total}
                  </Typography>
                ) : null}
              </Box>

              {holiday && mark.detail ? (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: DESIGN.hatch.holidayInk }}>{mark.detail}</Typography>
              ) : null}

              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.375 }}>
                {shownHere.map((appointment) => {
                  const calendar = calendarById.get(appointment.calendarId ?? "");
                  const heads = headsOf(appointment);
                  return (
                    <Box key={appointment.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <AppointmentButton
                          appointment={appointment}
                          calendar={calendar}
                          now={props.now}
                          onOpen={props.onOpen}
                          layout="compact"
                          accent={colourOfActivity(catalogue, appointment.activityId, calendar?.color ?? DESIGN.faint)}
                          shortLabel={tablet}
                        />
                      </Box>
                      {heads > 1 ? (
                        <Box
                          component="span"
                          title={`${heads} osob`}
                          sx={{
                            flex: "0 0 auto",
                            fontSize: 10,
                            fontWeight: 700,
                            px: 0.625,
                            borderRadius: "8px",
                            bgcolor: DESIGN.lineStrong,
                            color: DESIGN.ink,
                          }}
                        >
                          {heads}
                        </Box>
                      ) : null}
                    </Box>
                  );
                })}
                {hidden > 0 ? (
                  <Typography sx={{ fontSize: 11, color: "text.secondary", pl: 0.5 }}>{GRID_TEXT.more(hidden)}</Typography>
                ) : null}
                {clubBlocks.slice(0, MAX_CLUB_ROWS).map((block) => {
                  const colour = cleanHex(block.colorHex) ?? DESIGN.faint;
                  return (
                    <Box
                      key={block.clubBlockId}
                      component="button"
                      type="button"
                      data-grid-item="club-block"
                      data-testid={`month-club-block-${block.clubBlockId}-${dayKey}`}
                      onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        props.onOpenClubBlock(block, { x: event.clientX, y: event.clientY });
                      }}
                      sx={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        font: "inherit",
                        fontSize: 11,
                        fontWeight: 600,
                        px: 0.75,
                        py: "2px",
                        minHeight: 20,
                        cursor: "pointer",
                        color: "text.primary",
                        border: "none",
                        borderLeft: `2px solid ${colour}`,
                        borderRadius: "3px",
                        bgcolor: alpha(colour, 0.2),
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {CAL_TEXT.clubBlockLabel(block.clubName)}
                    </Box>
                  );
                })}
              </Box>

              {showPanel ? (
                <Box
                  role="note"
                  data-testid="month-hover-panel"
                  sx={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    ...(column >= 5 ? { right: 0 } : { left: 0 }),
                    zIndex: 40,
                    width: 252,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "10px",
                    boxShadow: DESIGN.shadow.menu,
                    px: 1.75,
                    py: 1.625,
                    pointerEvents: "none",
                  }}
                >
                  <DayCountsPanel dayKey={dayKey} counts={counts} note={holiday ? (mark.detail ?? CAL_TEXT.holiday) : null} />
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {/* A tap on a touch screen: the same panel, with the way into the day. */}
      <Popover
        open={tap !== null}
        anchorEl={tap?.el}
        onClose={() => setTap(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { width: 280, maxWidth: "calc(100vw - 24px)", borderRadius: "10px", boxShadow: DESIGN.shadow.menu },
          },
        }}
      >
        {tap ? (
          <Box role="dialog" aria-label={formatDateOnly(tap.day)} data-testid="month-tap-panel" sx={{ p: 1.75 }}>
            <DayCountsPanel
              dayKey={tap.day}
              counts={countsOf(tap.day)}
              note={(marks.get(tap.day) ?? OPEN_MARK).label === GRID_TEXT.publicHoliday ? (marks.get(tap.day)?.detail ?? CAL_TEXT.holiday) : null}
            />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1.5 }}>
              <Button
                variant="contained"
                onClick={() => {
                  const day = tap.day;
                  setTap(null);
                  props.onPickDay(day);
                }}
                sx={{ minHeight: 44 }}
              >
                {CAL_TEXT.openDay}
              </Button>
              {canSelectRange ? (
                <Button
                  variant="outlined"
                  onClick={(event) => {
                    const day = tap.day;
                    setTap(null);
                    rangeSelect.setTapMode(true);
                    rangeSelect.tap(day, { x: event.clientX, y: event.clientY });
                  }}
                  sx={{ minHeight: 44 }}
                >
                  {CAL_TEXT.startRange}
                </Button>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Popover>
    </Box>
  );
}
