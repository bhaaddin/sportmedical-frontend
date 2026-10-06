import { useState } from "react";
import { Box, Button, ButtonBase, Chip, FormControlLabel, Popover, Stack, Switch, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DESIGN } from "../../../theme";
import type { DateOnly } from "../../../utils/time";
import type { DayMark } from "../grid/dayMarks";
import { WEEKDAY_ABBREVIATION, shortDate } from "../grid/periodTitle";
import { useDevice } from "../../../layout/useDevice";
import { CAL_TEXT } from "./calendarText";
import { InquiryChip } from "./InquiryChip";
import type { InquiryRef } from "./inquiries";
import { formatFree } from "./pickDays";

/*
 * The month in "výběr termínů": every day shows how much free time the služba's calendars still have, a picked day
 * carries a chip with its minutes, closed / holiday / past days are greyed. A tap on a day offers the shortcut (the
 * free time of the day ONLY UP TO what the order still needs - "Celý den" when the day is not longer than that), the
 * explicit "Celý den" (exact, nothing trimmed) or "Vybrat čas…" (the day view, to pick hours); a tap on a picked day
 * edits or removes its pick. "Klepnutí = potřebný čas z dne" turns the tap into the shortcut straight away, so several
 * days in a row are one tap each. A day with a pick shows how much of it stays free ("zbývá 3 h").
 */

const WEEKDAY_HEADS = [1, 2, 3, 4, 5, 6, 0];
const OPEN: DayMark = { redNumber: false, closed: false, label: null, detail: null };
const BAR_FULL = 10 * 60;

/** "45 min", "5:30 h" - short enough for a phone cell. */
export const chipLabel = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;

export interface PickMonthViewProps {
  days: DateOnly[];
  anchorMonth: string;
  todayKey: DateOnly;
  marks: ReadonlyMap<string, DayMark>;
  holidayColor: string;
  /** Free minutes left on a day (picks already made are taken off). */
  freeMinutes: (day: DateOnly) => number;
  /** Minutes picked on a day. */
  pickedMinutes: (day: DateOnly) => number;
  /** The shortcut: the free time of the day up to what is still needed (the page trims it). */
  onWholeDay: (day: DateOnly) => void;
  /** The explicit override: the whole free time of the day, exactly. */
  onExactDay?: (day: DateOnly) => void;
  /** What the shortcut would take on a day, and whether the order is already covered. */
  takeFor?: (day: DateOnly) => { minutes: number; covered: boolean };
  onChooseTime: (day: DateOnly) => void;
  onRemoveDay: (day: DateOnly) => void;
  /** Open club orders: their days carry a dashed chip (the order being processed reads "Klub žádá"). */
  inquiriesByDay?: Map<string, InquiryRef[]>;
  onNote: (text: string | null) => void;
}

export function PickMonthView(props: PickMonthViewProps) {
  const { days, anchorMonth, todayKey, marks, freeMinutes, pickedMinutes } = props;
  const phone = useDevice() === "phone";
  const [quick, setQuick] = useState(false);
  const [menu, setMenu] = useState<{ day: DateOnly; el: HTMLElement } | null>(null);

  const tapDay = (day: DateOnly, el: HTMLElement) => {
    const free = freeMinutes(day);
    const picked = pickedMinutes(day);
    if (day < todayKey) {
      props.onNote("Termín v minulosti nelze objednat.");
      return;
    }
    const mark = marks.get(day) ?? OPEN;
    if (picked === 0 && (mark.closed || free <= 0)) {
      props.onNote(mark.closed ? "V tento den je zavřeno." : "V tento den už není volný čas.");
      return;
    }
    props.onNote(null);
    if (quick) {
      if (picked > 0) props.onRemoveDay(day);
      else props.onWholeDay(day);
      return;
    }
    setMenu({ day, el });
  };

  const menuDay = menu?.day ?? null;
  const menuFree = menuDay === null ? 0 : freeMinutes(menuDay);
  const menuPicked = menuDay === null ? 0 : pickedMinutes(menuDay);
  const menuTake = menuDay === null ? null : (props.takeFor?.(menuDay) ?? null);
  const menuTrimmed = menuTake !== null && !menuTake.covered && menuTake.minutes < menuFree;
  const close = () => setMenu(null);

  return (
    <Box data-testid="pick-month" sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {CAL_TEXT.pick.monthHint}
        </Typography>
        <FormControlLabel
          sx={{ m: 0, minHeight: 44 }}
          control={<Switch checked={quick} onChange={(_, on) => setQuick(on)} />}
          label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>{CAL_TEXT.pick.quickMode}</Typography>}
        />
      </Stack>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: `${DESIGN.radius.lg}px`, bgcolor: "background.paper", overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
          {WEEKDAY_HEADS.map((d) => (
            <Box key={d} sx={{ py: 0.75, textAlign: "center", fontWeight: 600, fontSize: 12, color: d === 0 || d === 6 ? "text.secondary" : "text.primary" }}>
              {WEEKDAY_ABBREVIATION[d]}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {days.map((day, index) => {
            const mark = marks.get(day) ?? OPEN;
            const past = day < todayKey;
            const free = freeMinutes(day);
            const picked = pickedMinutes(day);
            const outside = day.slice(0, 7) !== anchorMonth;
            const shut = past || mark.closed || (free <= 0 && picked === 0);
            const label = `${shortDate(day)}, ${past ? "minulost" : mark.closed ? "zavřeno" : free > 0 ? `volno ${formatFree(free)}` : "bez volného času"}${picked > 0 ? `, vybráno ${picked} min` : ""}${picked > 0 && free > 0 ? `, ${CAL_TEXT.pick.rest(formatFree(free))}` : ""}`;
            return (
              <ButtonBase
                key={day}
                data-testid={`pick-month-day-${day}`}
                data-free={free}
                data-picked={picked > 0 ? picked : undefined}
                data-shut={shut ? "true" : undefined}
                aria-label={label}
                onClick={(event: React.MouseEvent<HTMLElement>) => tapDay(day, event.currentTarget)}
                sx={{
                  minHeight: 64,
                  minWidth: 0,
                  px: 0.5,
                  py: 0.5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "space-between",
                  gap: 0.25,
                  textAlign: "left",
                  borderLeft: index % 7 === 0 ? "none" : "1px solid",
                  borderTop: index < 7 ? "none" : "1px solid",
                  borderColor: "divider",
                  bgcolor: picked > 0 ? DESIGN.selection.bg : shut ? alpha("#000", 0.04) : "background.paper",
                  opacity: outside && picked === 0 ? 0.55 : 1,
                  boxShadow: day === todayKey ? `inset 0 0 0 2px ${DESIGN.ink}` : "none",
                  outline: (props.inquiriesByDay?.get(day) ?? []).some((i) => i.current) ? "2px dashed" : "none",
                  outlineColor: "primary.main",
                  outlineOffset: -3,
                  cursor: shut && picked === 0 ? "default" : "pointer",
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: 13,
                    fontWeight: day === todayKey ? 800 : 600,
                    color: mark.redNumber ? props.holidayColor : shut ? "text.disabled" : "text.primary",
                    lineHeight: 1.1,
                  }}
                >
                  {Number(day.slice(8, 10))}
                </Typography>
                {(props.inquiriesByDay?.get(day) ?? []).slice(0, 1).map((inquiry) => (
                  <InquiryChip key={inquiry.orderId} inquiry={inquiry} />
                ))}
                {picked > 0 ? (
                  <Chip
                    size="small"
                    data-testid="pick-month-chip"
                    label={chipLabel(picked)}
                    title={`vybráno ${picked} min`}
                    sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: DESIGN.selection.line, color: "#fff", "& .MuiChip-label": { px: 0.5 } }}
                  />
                ) : null}
                {!shut ? (
                  <Box component="span" sx={{ display: "block" }}>
                    <Box component="span" sx={{ display: "block", height: 4, borderRadius: 2, bgcolor: alpha(DESIGN.selection.line, 0.18), overflow: "hidden" }}>
                      <Box component="span" sx={{ display: "block", height: "100%", width: `${Math.min(100, (free / BAR_FULL) * 100)}%`, bgcolor: DESIGN.selection.line }} />
                    </Box>
                    {picked > 0 && free > 0 ? (
                      <Typography
                        component="span"
                        data-testid="pick-month-rest"
                        title={CAL_TEXT.pick.rest(formatFree(free))}
                        sx={{ display: "block", fontSize: 10, lineHeight: 1.25, color: "text.secondary", whiteSpace: "normal", overflowWrap: "anywhere" }}
                      >
                        {phone ? CAL_TEXT.pick.restPhone(formatFree(free)) : CAL_TEXT.pick.rest(formatFree(free))}
                      </Typography>
                    ) : (
                      <Typography component="span" sx={{ display: "block", fontSize: 10, lineHeight: 1.3, color: "text.secondary", whiteSpace: "nowrap" }}>
                        {free > 0 ? formatFree(free) : "—"}
                      </Typography>
                    )}
                  </Box>
                ) : null}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <Popover
        open={menu !== null}
        anchorEl={menu?.el ?? null}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {menuDay !== null ? (
          <Stack spacing={1} sx={{ p: 1.5, minWidth: 220 }} data-testid="pick-month-menu">
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              {shortDate(menuDay)}
              {menuPicked > 0 ? ` · vybráno ${menuPicked} min` : ""}
            </Typography>
            {menuFree > 0 ? (
              <Button
                variant="contained"
                data-testid="pick-month-whole"
                sx={{ minHeight: 44 }}
                onClick={() => {
                  props.onWholeDay(menuDay);
                  close();
                }}
              >
                {menuTrimmed && menuTake !== null
                  ? `${CAL_TEXT.pick.needTime} (${formatFree(menuTake.minutes)})`
                  : menuTake?.covered === true
                    ? CAL_TEXT.pick.needTime
                    : CAL_TEXT.pick.wholeDayExplicit(formatFree(menuFree))}
              </Button>
            ) : null}
            {menuFree > 0 && menuTrimmed && props.onExactDay !== undefined ? (
              <Button
                variant="outlined"
                data-testid="pick-month-whole-exact"
                sx={{ minHeight: 44 }}
                onClick={() => {
                  props.onExactDay?.(menuDay);
                  close();
                }}
              >
                {CAL_TEXT.pick.wholeDayExplicit(formatFree(menuFree))}
              </Button>
            ) : null}
            <Button
              variant="outlined"
              data-testid="pick-month-time"
              sx={{ minHeight: 44 }}
              onClick={() => {
                props.onChooseTime(menuDay);
                close();
              }}
            >
              {menuPicked > 0 ? "Upravit čas…" : "Vybrat čas…"}
            </Button>
            {menuPicked > 0 ? (
              <Button
                color="error"
                variant="outlined"
                data-testid="pick-month-remove"
                sx={{ minHeight: 44 }}
                onClick={() => {
                  props.onRemoveDay(menuDay);
                  close();
                }}
              >
                Odebrat výběr dne
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Popover>
    </Box>
  );
}
