/*
 * The month calendar of the club's portal: read-only. Days that hold a window the clinic gave the club are
 * highlighted and can be tapped (the parent shows that day's windows and players below / beside it); every other day
 * is plain. Arrows reach only months that hold a window. Same month grid as the term calendar of /klub/:token.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { BRAND, clinicDate } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE } from '../../../components/public/kit';
import { monthCells, monthTitle } from '../club/TermCalendar';
import { openingMonth } from './portalModel';

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

export function PortalCalendar({ dates, counts, day, onDay, today }: {
  /** yyyy-MM-dd of every day with a window. */
  dates: readonly string[];
  /** Windows per day, for the screen-reader label. */
  counts: ReadonlyMap<string, number>;
  day: string | null;
  onDay: (date: string) => void;
  today: string;
}) {
  const days = useMemo(() => new Set(dates), [dates]);
  const months = useMemo(() => [...new Set(dates.map(monthOf))].sort(), [dates]);
  /* A month the person paged to counts only for the day that was chosen at that moment: choosing another day follows that day. */
  const [paged, setPaged] = useState<{ month: string; day: string | null } | null>(null);
  const setMonth = (month: string) => setPaged({ month, day });

  /* The month shown: the one paged to (while it still holds a window), else the one of the chosen day, else the next upcoming. */
  const fallback = openingMonth(dates, today) ?? monthOf(today);
  const month = paged !== null && paged.day === day ? paged.month : null;
  const shown = month !== null && months.includes(month) ? month : (day !== null ? monthOf(day) : fallback);
  const index = months.indexOf(shown);
  const prevMonth = index > 0 ? months[index - 1] : null;
  const nextMonth = index >= 0 && index < months.length - 1 ? months[index + 1] : null;

  const arrow = (label: string, target: string | null, icon: ReactNode) => (
    <Box
      component="button"
      type="button"
      aria-label={label}
      disabled={target === null}
      onClick={() => { if (target !== null) setMonth(target); }}
      sx={{
        width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '50%', border: `1px solid ${BRAND.line}`, bgcolor: BRAND.paper,
        color: BRAND.text, cursor: 'pointer', '&:disabled': { opacity: 0.3, cursor: 'default' },
      }}
    >
      {icon}
    </Box>
  );

  return (
    <Box data-testid="portal-calendar" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        {arrow('Předchozí měsíc', prevMonth, <ChevronLeft />)}
        <Typography component="h3" aria-live="polite" data-testid="portal-month" sx={{ m: 0, fontSize: 17, fontWeight: 700 }}>{capitalise(monthTitle(shown))}</Typography>
        {arrow('Další měsíc', nextMonth, <ChevronRight />)}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' }}>
        {WEEKDAYS.map((w) => (
          <Typography key={w} component="span" aria-hidden="true" sx={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: LABEL_COLOR }}>{w}</Typography>
        ))}
        {monthCells(shown).map((date, i) => {
          if (date === null) return <Box key={`blank-${i}`} aria-hidden="true" />;
          const dayNo = Number(date.slice(8));
          const isToday = date === today;
          const base = {
            minHeight: 48, minWidth: 0, p: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit', fontSize: 15, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
            outline: isToday ? `2px dotted ${BRAND.text}` : 'none', outlineOffset: -3,
          } as const;
          if (!days.has(date)) {
            return <Box key={date} aria-hidden="true" sx={{ ...base, color: '#B9B4AA', fontSize: 14 }}>{dayNo}</Box>;
          }
          const selected = date === day;
          const count = counts.get(date) ?? 1;
          return (
            <Box
              key={date}
              component="button"
              type="button"
              data-testid="portal-day"
              data-date={date}
              data-state={selected ? 'selected' : 'window'}
              aria-pressed={selected}
              aria-label={`${clinicDate(date)}, ${count === 1 ? 'termín' : `termíny: ${count}`}`}
              onClick={() => onDay(date)}
              sx={{
                ...base, cursor: 'pointer', fontWeight: 700,
                bgcolor: selected ? BRAND.accent : BRAND.accentWash, color: selected ? ON_ORANGE : BRAND.text,
                border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accentDark : BRAND.accentEdge}`,
                '&:hover': { borderColor: BRAND.accent },
              }}
            >
              {dayNo}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
