/*
 * A month calendar (Po–Ne) in which single days are tapped on and off. Used by the desk (offer days to a club) and
 * by the club's form (choose among the offered days). Cells are at least 44 px. It owns only the shown month;
 * the selection lives with the caller.
 *
 *  - `isDisabled(date)`: inert (past days on the desk; every day that was not offered on the club form)
 *  - `isMuted(date)`:    shown greyed but still tappable (weekends, holidays on the desk)
 *  - `marked`:           days drawn as "on offer" (club form), selected ones are drawn solid
 */
import { useState } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { ChevronLeftRounded, ChevronRightRounded } from '@mui/icons-material';
import { addMonths, monthGrid, monthStart, monthTitle, splitIso, WEEKDAYS_CS, dayText } from './dayOffer';

export interface DayCalendarColors {
  accent: string;
  onAccent: string;
  wash: string;
  edge: string;
  text: string;
  muted: string;
  line: string;
}

const STAFF: DayCalendarColors = {
  accent: '#2E5E4E', onAccent: '#FFFFFF', wash: 'rgba(46, 94, 78, 0.10)', edge: 'rgba(46, 94, 78, 0.45)',
  text: '#1B1F1D', muted: 'rgba(27, 31, 29, 0.38)', line: 'rgba(27, 31, 29, 0.14)',
};

export function DayCalendar({
  selected, onToggle, isDisabled, isMuted, marked, initialMonth, colors = STAFF, testId = 'day-calendar', label = 'Kalendář dní',
}: {
  selected: string[];
  onToggle: (date: string) => void;
  isDisabled?: (date: string) => boolean;
  isMuted?: (date: string) => boolean;
  marked?: ReadonlySet<string>;
  /** Any yyyy-MM-dd inside the month to open on. */
  initialMonth: string;
  colors?: DayCalendarColors;
  testId?: string;
  label?: string;
}) {
  const [month, setMonth] = useState(monthStart(initialMonth));
  const chosen = new Set(selected);
  const weeks = monthGrid(month);
  const nav = { width: 44, height: 44, color: colors.text } as const;

  return (
    <Box data-testid={testId} role="group" aria-label={label} sx={{ width: '100%', maxWidth: 420, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <IconButton aria-label="Předchozí měsíc" onClick={() => setMonth(addMonths(month, -1))} sx={nav}><ChevronLeftRounded /></IconButton>
        <Typography component="div" aria-live="polite" sx={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize', color: colors.text }}>{monthTitle(month)}</Typography>
        <IconButton aria-label="Další měsíc" onClick={() => setMonth(addMonths(month, 1))} sx={nav}><ChevronRightRounded /></IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
        {WEEKDAYS_CS.map((w) => (
          <Typography key={w} component="div" sx={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: colors.muted, py: 0.5 }}>{w}</Typography>
        ))}
        {weeks.flat().map((date, i) => {
          if (date === null) return <Box key={`e${i}`} aria-hidden />;
          const on = chosen.has(date);
          const disabled = isDisabled?.(date) === true;
          const muted = isMuted?.(date) === true;
          const offered = marked?.has(date) === true;
          const [, , d] = splitIso(date);
          return (
            <ButtonBase
              key={date}
              disabled={disabled}
              aria-pressed={on}
              aria-label={dayText(date, 0)}
              data-date={date}
              data-state={on ? 'on' : offered ? 'offered' : disabled ? 'off' : 'free'}
              onClick={() => onToggle(date)}
              sx={{
                minHeight: 44, minWidth: 0, borderRadius: '10px', fontSize: 15, fontWeight: on || offered ? 700 : 500,
                color: on ? colors.onAccent : disabled ? colors.muted : muted ? colors.muted : colors.text,
                bgcolor: on ? colors.accent : offered ? colors.wash : muted && !disabled ? 'rgba(127,127,127,0.10)' : 'transparent',
                border: `1px solid ${on ? colors.accent : offered ? colors.edge : colors.line}`,
                opacity: disabled && !offered ? 0.55 : 1,
                '&:focus-visible': { outline: `3px solid ${colors.edge}`, outlineOffset: 1 },
              }}
            >
              {d}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export default DayCalendar;
