/*
 * Etapa 8: "Nabídnout klubu dny k výběru". The desk taps days on a month calendar to offer them; tapping again removes
 * one. Past days are inert; weekends and the clinic's days off are greyed but still selectable. Quick helpers add a
 * whole week or the working days of a from–to span. Leaving it empty means the club chooses freely.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { holidaysApi } from '../../../api/holidays';
import { DayCalendar } from './DayCalendar';
import {
  MAX_OFFERED_DAYS, addDates, daysBetween, dayText, isWeekend, sortedUnique, todayIso, toggleDate, weekOf,
} from './dayOffer';

export function OfferedDaysEditor({ value, onChange }: { value: string[]; onChange: (dates: string[]) => void }) {
  const today = useMemo(todayIso, []);
  const year = Number(today.slice(0, 4));
  const thisYear = useQuery({ queryKey: ['holidays', year], queryFn: () => holidaysApi.year(year), retry: false, staleTime: 3_600_000 });
  const nextYear = useQuery({ queryKey: ['holidays', year + 1], queryFn: () => holidaysApi.year(year + 1), retry: false, staleTime: 3_600_000 });
  const daysOff = useMemo(() => {
    const set = new Set<string>();
    for (const h of [...(thisYear.data ?? []), ...(nextYear.data ?? [])]) if (h.isHoliday) set.add(h.date.slice(0, 10));
    return set;
  }, [thisYear.data, nextYear.data]);

  const [last, setLast] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const selected = sortedUnique(value);
  const capped = selected.length >= MAX_OFFERED_DAYS;
  const tap = (date: string) => {
    if (!selected.includes(date) && capped) return;
    setLast(date);
    onChange(toggleDate(selected, date));
  };
  const addWeek = () => {
    const anchor = last !== null && last >= today ? last : today;
    onChange(addDates(selected, weekOf(anchor), today));
  };
  const rangeValid = from !== '' && to !== '' && from <= to;
  const addWorkdays = () => {
    if (!rangeValid) return;
    onChange(addDates(selected, daysBetween(from, to).filter((d) => !isWeekend(d) && !daysOff.has(d)), today));
  };

  return (
    <Stack spacing={1.5} data-testid="offered-days-editor">
      <DayCalendar
        selected={selected}
        onToggle={tap}
        isDisabled={(d) => d < today}
        isMuted={(d) => isWeekend(d) || daysOff.has(d)}
        initialMonth={today}
        testId="offer-calendar"
        label="Kalendář nabízených dní"
      />
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outlined" size="small" onClick={addWeek} sx={{ minHeight: 40 }}>Přidat celý týden</Button>
      </Stack>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="date" size="small" label="Od" value={from} onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, 'aria-label': 'Pracovní dny od' } }} sx={{ flex: '1 1 140px' }}
        />
        <TextField
          type="date" size="small" label="Do" value={to} onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || today, 'aria-label': 'Pracovní dny do' } }} sx={{ flex: '1 1 140px' }}
        />
        <Button variant="outlined" size="small" disabled={!rangeValid} onClick={addWorkdays} sx={{ minHeight: 40 }}>Přidat pracovní dny od–do</Button>
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 700 }} data-testid="offered-count" aria-live="polite">
        Nabídnuto: {selected.length} {selected.length === 1 ? 'den' : selected.length >= 2 && selected.length <= 4 ? 'dny' : 'dní'}
      </Typography>
      {capped ? <Typography variant="caption" color="text.secondary">Nejvýše {MAX_OFFERED_DAYS} dní.</Typography> : null}
      {selected.length > 0 ? (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="offered-list">
          {selected.map((d) => (
            <li key={d}>
              <Chip label={dayText(d, new Date().getFullYear())} onDelete={() => onChange(selected.filter((x) => x !== d))} deleteIcon={<span aria-label={`Odebrat ${dayText(d, 0)}`} role="button">×</span>} size="small" />
            </li>
          ))}
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">Nic nenabízíte — klub si termín zvolí sám.</Typography>
      )}
    </Stack>
  );
}

export default OfferedDaysEditor;
