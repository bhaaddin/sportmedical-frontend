/*
 * The calendar for choosing the term: a month grid (Po–Ne) where every day with free slots for
 * the chosen činnost is highlighted and shows how many are left; reserved days that are full are
 * greyed and cannot be tapped. Tapping a day shows that day's free times as large chips — beside
 * the calendar where there is room, under it on a phone. Arrows only reach months that hold a
 * reserved day.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import type { ClubFreeSlot } from '../../../api/publicClub';
import type { Device } from '../../../layout/useDevice';
import { BRAND, clinicDate } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE } from '../../../components/public/kit';
import type { SlotsStatus } from './SlotPicker';
import { freeText } from './texts';
import type { CalTexts } from './texts';

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
const hhmm = (time: string): string => time.slice(0, 5);
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const pad = (n: number): string => String(n).padStart(2, '0');
const monthOf = (isoDate: string): string => isoDate.slice(0, 7);
const todayPrague = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

/** "říjen 2026" for "2026-10". */
export const monthTitle = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
};

/** The cells of a month: leading blanks (null) so day 1 lands on its weekday, then every date. */
export function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
}

/** Free slots per date, earliest slot first inside a day. */
export function slotsByDate(slots: readonly ClubFreeSlot[]): Map<string, ClubFreeSlot[]> {
  const map = new Map<string, ClubFreeSlot[]>();
  for (const slot of [...slots].sort((a, b) => a.startUtc.localeCompare(b.startUtc))) map.set(slot.date, [...(map.get(slot.date) ?? []), slot]);
  return map;
}

export function TermCalendar({
  status, slots, reservedDays, day, value, onDay, onPick, onRefresh, device, t, texts,
}: {
  status: SlotsStatus;
  slots: readonly ClubFreeSlot[];
  /** yyyy-MM-dd of every day the club reserved (greyed when nothing is free in it). */
  reservedDays: readonly string[];
  day: string | null;
  value: string | null;
  onDay: (date: string) => void;
  onPick: (startUtc: string) => void;
  onRefresh: () => void;
  device: Device;
  t: Record<string, string>;
  texts: CalTexts;
}) {
  const byDate = useMemo(() => slotsByDate(slots), [slots]);
  const reserved = useMemo(() => new Set([...reservedDays, ...byDate.keys()]), [reservedDays, byDate]);
  const months = useMemo(() => [...new Set([...reserved].map(monthOf))].sort(), [reserved]);

  const [month, setMonth] = useState<string | null>(null);
  useEffect(() => {
    if (day !== null) setMonth(monthOf(day));
  }, [day]);

  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <Box role="status" sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} sx={{ color: BRAND.accent }} aria-label="Načítáme termíny" />
      </Box>
    );
  }
  if (status === 'failed') {
    return (
      <Box role="alert" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 15 }}>{t['formulare.club-reg.slots.failed']}</Typography>
        <Button variant="outlined" onClick={onRefresh}>Zkusit znovu</Button>
      </Box>
    );
  }
  if (slots.length === 0) {
    return <Typography role="status" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-reg.slots.empty']}</Typography>;
  }

  const nearest = slots[0].startUtc;
  // The month of the chosen day, else the one the person paged to, else the first month with a free day.
  const firstFree = [...byDate.keys()].sort()[0];
  const shown = month !== null && months.includes(month) ? month : monthOf(day ?? firstFree ?? months[0] ?? todayPrague());
  const index = months.indexOf(shown);
  const prevMonth = index > 0 ? months[index - 1] : null;
  const nextMonth = index >= 0 && index < months.length - 1 ? months[index + 1] : null;
  const today = todayPrague();
  const dayTimes = day !== null ? byDate.get(day) ?? [] : [];
  const side = device !== 'phone';

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
    <Box
      data-testid="club-term"
      data-layout={device}
      sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: side ? 'minmax(300px, 380px) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start' }}
    >
      <Box data-testid="club-calendar" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{texts['formulare.club-reg.cal.hint']}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          {arrow('Předchozí měsíc', prevMonth, <ChevronLeft />)}
          <Typography component="h3" aria-live="polite" data-testid="club-month" sx={{ m: 0, fontSize: 17, fontWeight: 700 }}>{capitalise(monthTitle(shown))}</Typography>
          {arrow('Další měsíc', nextMonth, <ChevronRight />)}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' }}>
          {WEEKDAYS.map((w) => (
            <Typography key={w} component="span" aria-hidden="true" sx={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: LABEL_COLOR }}>{w}</Typography>
          ))}
          {monthCells(shown).map((date, i) => {
            if (date === null) return <Box key={`blank-${i}`} aria-hidden="true" />;
            const dayNo = Number(date.slice(8));
            const free = byDate.get(date)?.length ?? 0;
            const isToday = date === today;
            const selected = date === day;
            const long = clinicDate(date);
            const base = {
              minHeight: 48, minWidth: 0, p: 0, borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', fontSize: 15, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
              outline: isToday ? `2px dotted ${BRAND.text}` : 'none', outlineOffset: -3,
            } as const;
            if (free > 0) {
              return (
                <Box
                  key={date}
                  component="button"
                  type="button"
                  data-testid="club-day"
                  data-state={selected ? 'selected' : 'free'}
                  aria-pressed={selected}
                  aria-label={`${long}, ${freeText(free, texts)}${isToday ? `, ${texts['formulare.club-reg.cal.today']}` : ''}`}
                  onClick={() => onDay(date)}
                  sx={{
                    ...base, cursor: 'pointer', fontWeight: 700,
                    bgcolor: selected ? BRAND.accent : BRAND.accentWash, color: selected ? ON_ORANGE : BRAND.text,
                    border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accentDark : BRAND.accentEdge}`,
                    '&:hover': { borderColor: BRAND.accent },
                  }}
                >
                  <span>{dayNo}</span>
                  <Box component="span" aria-hidden="true" sx={{ fontSize: 11, fontWeight: 600, mt: '2px' }}>{free}×</Box>
                </Box>
              );
            }
            if (reserved.has(date)) {
              return (
                <Box
                  key={date}
                  component="button"
                  type="button"
                  disabled
                  data-testid="club-day-busy"
                  aria-label={`${long}, ${texts['formulare.club-reg.cal.busy']}`}
                  sx={{ ...base, bgcolor: '#EFECE6', color: '#9A958D', border: '1px solid transparent', textDecoration: 'line-through' }}
                >
                  {dayNo}
                </Box>
              );
            }
            return <Box key={date} aria-hidden="true" sx={{ ...base, color: '#B9B4AA', fontSize: 14 }}>{dayNo}</Box>;
          })}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {day === null ? (
          <Typography role="status" sx={{ fontSize: 15, color: LABEL_COLOR }}>{texts['formulare.club-reg.cal.pickday']}</Typography>
        ) : (
          <Box role="group" aria-label={capitalise(clinicDate(day))} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 700 }}>
              {texts['formulare.club-reg.cal.times'].replace('{day}', clinicDate(day))}
            </Typography>
            <Box sx={{ display: 'grid', gap: '9px', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
              {dayTimes.map((slot) => {
                const selected = value === slot.startUtc;
                const isNearest = slot.startUtc === nearest;
                return (
                  <Box
                    key={slot.startUtc}
                    component="button"
                    type="button"
                    data-testid="club-slot"
                    aria-pressed={selected}
                    aria-label={`${hhmm(slot.startLocal)}${isNearest ? ` — ${t['formulare.club-reg.slots.nearest']}` : ''}`}
                    onClick={() => onPick(slot.startUtc)}
                    sx={{
                      minHeight: 48, minWidth: 44, px: 1.5, borderRadius: '24px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 16,
                      fontWeight: selected ? 700 : 600, fontVariantNumeric: 'tabular-nums', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      bgcolor: selected ? BRAND.accent : BRAND.paper, color: selected ? ON_ORANGE : BRAND.text,
                      border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accentDark : '#D8D2C9'}`,
                      '&:hover': { borderColor: BRAND.accent },
                    }}
                  >
                    <span>{selected && <span aria-hidden="true">✓ </span>}{hhmm(slot.startLocal)}</span>
                    {isNearest && <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, color: 'inherit', opacity: 0.85, lineHeight: 1 }}>{t['formulare.club-reg.slots.nearest']}</Typography>}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{t['formulare.club-reg.slots.other']}</Typography>
          <Button size="small" onClick={onRefresh}>Obnovit termíny</Button>
        </Box>
      </Box>
    </Box>
  );
}
