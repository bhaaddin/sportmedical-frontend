/* ══════════════════════════════════════════════════════════════
   SLOT PICKER  (artboard V-Rezervace: "Říjen 2026" ‹ ›, a column per day)

   The week the patient is looking at: the month and two 44 px arrows, then the
   free times of each day. Desktop draws the artboard's seven columns; an iPad
   and a phone draw the same week as a list, a day per row, so a time is never
   a target smaller than 44 px and nothing is cut off at the edge.

   Which days and times are free is the server's answer, passed in; this
   component invents nothing — a day without a free time says "Bez volna", it
   never claims a holiday it does not know about.
   ══════════════════════════════════════════════════════════════ */

import { Box, Typography } from '@mui/material';
import { ARCHIVO, BRAND, clinicDate, clinicTime } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE, PanelTitle } from '../../../components/public/kit';
import type { BookableSlot } from '../../../api/publicBooking';
import { dayMonth, weekOf, weekTitle, weekdayName } from './weekGrid';

export type DaySlots = BookableSlot[] | 'error';

export interface SlotPickerProps {
  /** Monday of the week shown. */
  monday: string;
  /** Days of the horizon that have at least one free time. */
  free: ReadonlySet<string>;
  slotsByDay: Readonly<Record<string, DaySlots | undefined>>;
  selectedUtc: string | null;
  /** While a hold is being placed nothing else may be picked. */
  disabled?: boolean;
  layout: 'columns' | 'list';
  canPrev: boolean;
  canNext: boolean;
  onWeek: (delta: -1 | 1) => void;
  onPick: (slot: BookableSlot, day: string) => void;
}

const arrow = (direction: 'prev' | 'next') => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5C6067" strokeWidth="2" aria-hidden="true">
    <path d={direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

function ArrowButton({ direction, disabled, onClick }: { direction: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={direction === 'prev' ? 'Předchozí týden' : 'Následující týden'}
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: 44, height: 44, border: `1px solid ${BRAND.line}`, borderRadius: '10px', bgcolor: BRAND.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
      }}
    >
      {arrow(direction)}
    </Box>
  );
}

function TimeButton({
  slot, selected, disabled, onPick, day,
}: { slot: BookableSlot; selected: boolean; disabled: boolean; onPick: () => void; day: string }) {
  const time = clinicTime(slot.startUtc);
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={`${clinicDate(day)}, ${time}`}
      disabled={disabled}
      onClick={onPick}
      sx={{
        height: 44, minWidth: 0, px: 1, borderRadius: '10px', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', fontSize: 15, fontWeight: selected ? 700 : 600, fontVariantNumeric: 'tabular-nums',
        bgcolor: selected ? BRAND.accent : BRAND.paper,
        color: selected ? ON_ORANGE : BRAND.text,
        border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accent : BRAND.line}`,
        '&:hover': { borderColor: disabled ? undefined : BRAND.accent, bgcolor: selected ? BRAND.accent : '#FFF6EB' },
        '&:disabled': { opacity: selected ? 1 : 0.5 },
      }}
    >
      {time}
    </Box>
  );
}

function DayTimes({
  day, slots, props, row,
}: { day: string; slots: DaySlots | undefined; props: SlotPickerProps; row: boolean }) {
  if (slots === undefined) {
    return <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>Hledám časy…</Typography>;
  }
  if (slots === 'error') {
    return <Typography sx={{ fontSize: 13, color: '#9B3B1B' }}>Časy se nenačetly.</Typography>;
  }
  if (slots.length === 0) {
    return <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>Bez volna</Typography>;
  }
  return (
    <Box sx={row ? { display: 'flex', flexWrap: 'wrap', gap: '9px' } : { display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {slots.map((slot) => (
        <Box key={slot.startUtc} sx={row ? { minWidth: 84 } : undefined}>
          <TimeButton
            slot={slot}
            day={day}
            selected={props.selectedUtc === slot.startUtc}
            disabled={props.disabled === true}
            onPick={() => props.onPick(slot, day)}
          />
        </Box>
      ))}
    </Box>
  );
}

export default function SlotPicker(props: SlotPickerProps) {
  const days = weekOf(props.monday);
  const freeDays = days.filter((d) => props.free.has(d));

  return (
    <Box data-layout={props.layout} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <PanelTitle>{weekTitle(props.monday)}</PanelTitle>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ArrowButton direction="prev" disabled={!props.canPrev} onClick={() => props.onWeek(-1)} />
          <ArrowButton direction="next" disabled={!props.canNext} onClick={() => props.onWeek(1)} />
        </Box>
      </Box>

      {props.layout === 'columns' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', alignItems: 'start' }}>
          {days.map((day) => {
            const isFree = props.free.has(day);
            return (
              <Box key={day} sx={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
                <Box sx={{ textAlign: 'center', pb: 1, borderBottom: `${isFree ? 2 : 1}px solid ${isFree ? BRAND.ink : BRAND.line}` }}>
                  <Box sx={{ fontSize: 13, color: LABEL_COLOR }}>{weekdayName(day)}</Box>
                  <Box sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 17, color: isFree ? BRAND.text : LABEL_COLOR }}>{dayMonth(day)}</Box>
                </Box>
                {isFree
                  ? <DayTimes day={day} slots={props.slotsByDay[day]} props={props} row={false} />
                  : <Typography sx={{ fontSize: 13, color: '#9A9185', textAlign: 'center' }}>—</Typography>}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {freeDays.length === 0 && (
            <Box component="li" sx={{ fontSize: 14, color: LABEL_COLOR }}>
              Tento týden už volno nemáme. Zkuste následující.
            </Box>
          )}
          {freeDays.map((day) => (
            <Box component="li" key={day} sx={{ display: 'flex', flexDirection: 'column', gap: 1.125 }}>
              <Typography component="span" sx={{ fontSize: 14, fontWeight: 700 }}>
                {weekdayName(day)} {dayMonth(day)}
              </Typography>
              <DayTimes day={day} slots={props.slotsByDay[day]} props={props} row />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
