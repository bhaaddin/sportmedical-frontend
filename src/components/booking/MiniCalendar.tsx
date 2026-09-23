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
 * The month panel on the left of the calendar - the owner's plan, "Mini
 * calendar (left)".
 *
 * Click a day to jump to it; the arrows move the panel a month at a time
 * without moving the selection, so a date three months out is two clicks
 * away. What is selected is the caller's `value`: the week it falls in is
 * banded (strongly in week view, softly otherwise) and the day itself carries
 * the strongest mark. Today is ringed, a public holiday has a red number and a
 * closed day is hatched - the same three things the main grid shows, so the
 * two never disagree about what a day is.
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

const CELL = 34;

const HATCH =
  "repeating-linear-gradient(135deg, transparent 0 4px, rgba(127,127,127,0.22) 4px 5px)";

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
    <Box sx={{ width: "100%", maxWidth: CELL * 7 + 16, userSelect: "none" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
      >
        <IconButton
          size="small"
          aria-label="Předchozí měsíc"
          onClick={() => setShown((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft fontSize="small" />
        </IconButton>
        <Typography
          variant="subtitle2"
          component="h2"
          sx={{ fontWeight: 700 }}
          aria-live="polite"
        >
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label="Další měsíc"
          onClick={() => setShown((m) => shiftMonth(m, 1))}
        >
          <ChevronRight fontSize="small" />
        </IconButton>
      </Stack>

      <Box
        aria-hidden
        sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.25 }}
      >
        {WEEKDAY_SHORT.map((d, i) => (
          <Typography
            key={d}
            variant="caption"
            sx={{
              textAlign: "center",
              fontWeight: 600,
              color: i >= 5 ? "text.disabled" : "text.secondary",
            }}
          >
            {d}
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
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.75, px: 0.5 }}>
          {showsHoliday ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  backgroundImage: HATCH,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
            ? alpha(theme.palette.primary.main, 0.2)
            : banded
              ? alpha(theme.palette.primary.main, 0.08)
              : "transparent",
        borderTopLeftRadius: banded && first ? 18 : 0,
        borderBottomLeftRadius: banded && first ? 18 : 0,
        borderTopRightRadius: banded && last ? 18 : 0,
        borderBottomRightRadius: banded && last ? 18 : 0,
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
          border: "2px solid",
          borderColor:
            today && mark !== "day" ? theme.palette.primary.main : "transparent",
          backgroundColor:
            mark === "day" ? theme.palette.primary.main : "transparent",
          backgroundImage: closed && mark !== "day" ? HATCH : "none",
          color:
            mark === "day"
              ? theme.palette.primary.contrastText
              : holiday
                ? theme.palette.error.main
                : outside
                  ? theme.palette.text.disabled
                  : closed
                    ? theme.palette.text.secondary
                    : theme.palette.text.primary,
          font: "inherit",
          fontSize: "0.8125rem",
          fontWeight: mark === "day" || holiday || today ? 700 : 400,
          textDecoration: holiday && mark === "day" ? "underline" : "none",
          textDecorationColor: theme.palette.error.light,
          textUnderlineOffset: 3,
          opacity: outside && mark === "none" ? 0.7 : 1,
          cursor: "pointer",
          p: 0,
          "&:hover": {
            backgroundColor:
              mark === "day"
                ? theme.palette.primary.dark
                : alpha(theme.palette.primary.main, 0.14),
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
