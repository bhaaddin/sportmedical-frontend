import { useState } from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import {
  WEEKDAY_SHORT,
  dayFlags,
  dayKey,
  dayLabel,
  dayOf,
  highlightOf,
  monthMatrix,
  monthOf,
  monthTitle,
  shiftMonth,
} from "./MiniCalendar.logic";
import type { CalendarView, Highlight, ShownMonth } from "./MiniCalendar.logic";

/**
 * The month panel in the calendar's left rail, drawn to the board of
 * 3. 10. 2026: the month's name with ‹ › on the right, one letter per weekday
 * (P Ú S Č P S N), the selected day a filled dark circle, today ringed when it
 * is not the selection, a public holiday a red number, a closed day muted.
 *
 * Click a day to jump to it; the arrows move the panel a month at a time
 * without moving the selection, so a date three months out is two clicks
 * away. What is selected is the caller's `value`: the week it falls in is
 * banded (a touch stronger in week view) and the day itself carries the
 * strongest mark - the same three things the main grid shows, so the two
 * never disagree about what a day is.
 *
 * It fetches nothing. Holidays and closed days arrive as `yyyy-MM-dd` sets from
 * the page, which already asked the server for them.
 */
export interface MiniCalendarProps {
  value: Date;
  view: CalendarView;
  onSelect: (date: Date) => void;
  /** `yyyy-MM-dd` of public holidays. */
  holidays?: ReadonlySet<string>;
  /** `yyyy-MM-dd` of days nobody can book (booking pause, closed day). */
  closedDays?: ReadonlySet<string>;
}

const CELL = 30;

export function MiniCalendar({
  value,
  view,
  onSelect,
  holidays,
  closedDays,
}: MiniCalendarProps) {
  const [shown, setShown] = useState<ShownMonth>(() => monthOf(value));

  /*
   * When the selection moves to another month from outside - the toolbar's
   * "next week" crossing a month end, or "today" - the panel follows it.
   * Adjusted during render rather than in an effect, so there is no frame
   * showing the old month.
   */
  const valueMonth = value.getFullYear() * 12 + value.getMonth();
  const [followed, setFollowed] = useState(valueMonth);
  if (followed !== valueMonth) {
    setFollowed(valueMonth);
    setShown(monthOf(value));
  }

  const today = dayOf(new Date());
  const weeks = monthMatrix(shown);
  const title = monthTitle(shown);
  const showsHoliday = weeks.some((w) =>
    w.some((d) => d.getMonth() === shown.month && holidays?.has(dayKey(d))),
  );
  const showsClosed = weeks.some((w) =>
    w.some((d) => d.getMonth() === shown.month && closedDays?.has(dayKey(d))),
  );

  return (
    <Box sx={{ width: "100%", userSelect: "none" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1, pl: 0.5 }}
      >
        <Typography
          component="h2"
          sx={{ fontSize: 14, fontWeight: 700 }}
          aria-live="polite"
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            aria-label="Předchozí měsíc"
            onClick={() => setShown((m) => shiftMonth(m, -1))}
            sx={{ width: 28, height: 28, color: "text.secondary" }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Další měsíc"
            onClick={() => setShown((m) => shiftMonth(m, 1))}
            sx={{ width: 28, height: 28, color: "text.secondary" }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Box
        aria-hidden
        sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}
      >
        {WEEKDAY_SHORT.map((d) => (
          <Typography
            key={d}
            sx={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "text.secondary",
            }}
          >
            {d.charAt(0).toUpperCase()}
          </Typography>
        ))}
      </Box>

      <Box role="group" aria-label={title}>
        {weeks.map((week) => (
          <Box
            key={dayKey(week[0])}
            sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {week.map((cell, i) => {
              const flags = dayFlags(cell, shown, today, holidays, closedDays);
              const mark = highlightOf(cell, value, view);
              return (
                <DayCell
                  key={dayKey(cell)}
                  cell={cell}
                  mark={mark}
                  view={view}
                  first={i === 0}
                  last={i === 6}
                  label={dayLabel(cell, flags)}
                  outside={flags.outside}
                  today={flags.today}
                  holiday={flags.holiday}
                  closed={flags.closed}
                  onSelect={() => {
                    onSelect(cell);
                    if (flags.outside) setShown(monthOf(cell));
                  }}
                />
              );
            })}
          </Box>
        ))}
      </Box>

      {showsHoliday || showsClosed ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1, px: 0.5 }}>
          {showsHoliday ? (
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
              <Box component="span" sx={{ color: "error.main", fontWeight: 700 }}>
                červené číslo
              </Box>{" "}
              svátek
            </Typography>
          ) : null}
          {showsClosed ? (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: "text.disabled",
                }}
              />
              <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                zavřeno
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}

function DayCell({
  cell,
  mark,
  view,
  first,
  last,
  label,
  outside,
  today,
  holiday,
  closed,
  onSelect,
}: {
  cell: Date;
  mark: Highlight;
  view: CalendarView;
  first: boolean;
  last: boolean;
  label: string;
  outside: boolean;
  today: boolean;
  holiday: boolean;
  closed: boolean;
  onSelect: () => void;
}) {
  const banded = mark === "week" || mark === "weekSoft" || mark === "day";
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        justifyContent: "center",
        py: "1px",
        /*
         * The week band runs under the whole row, the selected day included,
         * so the week reads as one strip with the day as its darkest point.
         */
        backgroundColor:
          mark === "week" || (mark === "day" && view === "week")
            ? alpha(theme.palette.primary.main, 0.1)
            : banded
              ? alpha(theme.palette.primary.main, 0.05)
              : "transparent",
        borderTopLeftRadius: banded && first ? 16 : 0,
        borderBottomLeftRadius: banded && first ? 16 : 0,
        borderTopRightRadius: banded && last ? 16 : 0,
        borderBottomRightRadius: banded && last ? 16 : 0,
      })}
    >
      <Box
        component="button"
        type="button"
        onClick={onSelect}
        aria-label={label}
        aria-pressed={mark === "day"}
        aria-current={today ? "date" : undefined}
        data-day={dayKey(cell)}
        data-highlight={mark}
        data-holiday={holiday ? "true" : undefined}
        data-closed={closed ? "true" : undefined}
        sx={(theme) => ({
          width: CELL,
          height: CELL,
          borderRadius: "50%",
          border: "1.5px solid",
          borderColor:
            today && mark !== "day" ? theme.palette.primary.main : "transparent",
          backgroundColor:
            mark === "day" ? theme.palette.primary.main : "transparent",
          color:
            mark === "day"
              ? theme.palette.primary.contrastText
              : holiday
                ? theme.palette.error.main
                : outside
                  ? theme.palette.text.disabled
                  : closed
                    ? theme.palette.text.disabled
                    : theme.palette.text.primary,
          font: "inherit",
          fontSize: 13,
          fontWeight: mark === "day" || holiday || today ? 700 : 400,
          textDecoration: holiday && mark === "day" ? "underline" : "none",
          textUnderlineOffset: 3,
          cursor: "pointer",
          p: 0,
          "&:hover": {
            backgroundColor:
              mark === "day"
                ? theme.palette.primary.dark
                : alpha(theme.palette.primary.main, 0.12),
          },
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 1,
          },
        })}
      >
        {cell.getDate()}
      </Box>
    </Box>
  );
}

export default MiniCalendar;
