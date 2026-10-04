import { useState } from "react";
import { Box, Button, ButtonBase, Chip, FormControlLabel, Popover, Stack, Switch, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DESIGN } from "../../../theme";
import type { DateOnly } from "../../../utils/time";
import type { DayMark } from "../grid/dayMarks";
import { WEEKDAY_ABBREVIATION, shortDate } from "../grid/periodTitle";
import { formatFree } from "./pickDays";

/*
 * The month in "výběr termínů": every day shows how much free time the služba's calendars still have, a picked day
 * carries a chip with its minutes, closed / holiday / past days are greyed. A tap on a day offers "Celý den" (all of
 * its free time, up to what is still needed) or "Vybrat čas…" (the day view, to pick hours); a tap on a picked day
 * edits or removes its pick. "Klepnutí = celý den" turns the tap into the whole-day pick straight away, so several
 * days in a row are one tap each.
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
  /** Everybody is covered: no more can be picked unless the reserve is switched on. */
  covered: boolean;
  onWholeDay: (day: DateOnly) => void;
  onChooseTime: (day: DateOnly) => void;
  onRemoveDay: (day: DateOnly) => void;
  onNote: (text: string | null) => void;
}

export function PickMonthView(props: PickMonthViewProps) {
  const { days, anchorMonth, todayKey, marks, freeMinutes, pickedMinutes, covered } = props;
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
  const close = () => setMenu(null);

  return (
    <Box data-testid="pick-month" sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Číslo dole = volný čas · zelený štítek = vybráno. Klepněte na den.
        </Typography>
        <FormControlLabel
          sx={{ m: 0, minHeight: 44 }}
          control={<Switch checked={quick} onChange={(_, on) => setQuick(on)} />}
          label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Klepnutí = celý den</Typography>}
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
            const label = `${shortDate(day)}, ${past ? "minulost" : mark.closed ? "zavřeno" : free > 0 ? `volno ${formatFree(free)}` : "bez volného času"}${picked > 0 ? `, vybráno ${picked} min` : ""}`;
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
                    <Typography component="span" sx={{ display: "block", fontSize: 10, lineHeight: 1.3, color: "text.secondary", whiteSpace: "nowrap" }}>
                      {free > 0 ? formatFree(free) : "—"}
                    </Typography>
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
            {menuFree > 0 && !covered ? (
              <Button
                variant="contained"
                data-testid="pick-month-whole"
                sx={{ minHeight: 44 }}
                onClick={() => {
                  props.onWholeDay(menuDay);
                  close();
                }}
              >
                {`Celý den (${formatFree(menuFree)})`}
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
