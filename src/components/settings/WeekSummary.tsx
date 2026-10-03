import { Box, Typography } from '@mui/material';
import type { Timetable } from '../../pages/booking/timetable';
import { TYPE, settingsLine } from './settingsStyle';

const DAY_NAMES: Record<number, string> = {
  1: 'Po', 2: 'Út', 3: 'St', 4: 'Čt', 5: 'Pá', 6: 'So', 0: 'Ne',
};

/**
 * "Přehled týdne" - the saved week at a glance, for the right-hand card of the
 * opening-hours screen: which days are open, from when to when, and the break.
 * Reads the same timetable the editor starts from, so it shows what is
 * stored, not what is half-typed.
 */
export function WeekSummary({ timetable }: { timetable: Timetable }) {
  const open = timetable.days.filter((d) => d.a.working || (timetable.alternating && d.b.working)).length;
  return (
    <Box>
      <Typography sx={[TYPE.caption, { mb: 1.5 }]}>
        {open === 0 ? 'Zatím není nastavený žádný pracovní den.' : `Otevřeno ${open} ${open === 1 ? 'den' : open < 5 ? 'dny' : 'dní'} v týdnu.`}
      </Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0 }}>
        {timetable.days.map((day) => {
          const weeks = timetable.alternating ? (['a', 'b'] as const) : (['a'] as const);
          return (
            <Box key={day.dayOfWeek} sx={{ display: 'contents' }}>
              <Box component="dt" sx={[TYPE.itemName, { py: 0.75, borderTop: '1px solid', borderColor: settingsLine }]}>
                {DAY_NAMES[day.dayOfWeek]}
              </Box>
              <Box component="dd" sx={{ m: 0, py: 0.75, borderTop: '1px solid', borderColor: settingsLine, textAlign: 'right' }}>
                {weeks.map((week) => {
                  const shift = day[week];
                  return (
                    <Typography key={week} sx={{ fontSize: 14, color: shift.working ? 'text.primary' : undefined, ...(shift.working ? {} : TYPE.caption) }}>
                      {timetable.alternating ? `${week.toUpperCase()}: ` : ''}
                      {shift.working
                        ? `${shift.start}–${shift.end}${shift.breakStart && shift.breakEnd ? ` (pauza ${shift.breakStart}–${shift.breakEnd})` : ''}`
                        : 'zavřeno'}
                    </Typography>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
