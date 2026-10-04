/*
 * The day-by-day list of free slots for the chosen činnost: chips grouped by date, the
 * earliest one labelled "Nejbližší volný", every other one selectable ("Jiný čas" is
 * simply another chip). A taken slot disappears when the list is refreshed.
 */
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { ClubFreeSlot } from '../../../api/publicClub';
import { BRAND, clinicDate } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE } from '../../../components/public/kit';

export type SlotsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export const SLOT_PICKER_KEYS = [
  'formulare.club-reg.slots.nearest',
  'formulare.club-reg.slots.other',
  'formulare.club-reg.slots.empty',
  'formulare.club-reg.slots.failed',
] as const;
export type SlotPickerTexts = Record<(typeof SLOT_PICKER_KEYS)[number], string>;

const hhmm = (time: string): string => time.slice(0, 5);
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Slots grouped by their local date, earliest day first. */
export function groupByDate(slots: readonly ClubFreeSlot[]): [string, ClubFreeSlot[]][] {
  const groups = new Map<string, ClubFreeSlot[]>();
  for (const slot of slots) groups.set(slot.date, [...(groups.get(slot.date) ?? []), slot]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function SlotPicker({
  status, slots, value, onPick, onRefresh, t,
}: {
  status: SlotsStatus;
  slots: readonly ClubFreeSlot[];
  value: string | null;
  onPick: (startUtc: string) => void;
  onRefresh: () => void;
  t: SlotPickerTexts;
}) {
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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groupByDate(slots).map(([day, list]) => (
        <Box key={day} role="group" aria-label={capitalise(clinicDate(day))} sx={{ display: 'flex', flexDirection: 'column', gap: 1.125 }}>
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 700 }}>{capitalise(clinicDate(day))}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
            {list.map((slot) => {
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
                    minHeight: 46, minWidth: 44, px: 2.25, borderRadius: '23px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
                    fontWeight: selected ? 700 : 600, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 1,
                    bgcolor: selected ? BRAND.accent : BRAND.paper, color: selected ? ON_ORANGE : BRAND.text,
                    border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accent : '#D8D2C9'}`,
                    '&:hover': { borderColor: BRAND.accent },
                  }}
                >
                  {selected && <span aria-hidden="true">✓</span>}
                  {hhmm(slot.startLocal)}
                  {isNearest && <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'inherit', opacity: 0.85 }}>{t['formulare.club-reg.slots.nearest']}</Typography>}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{t['formulare.club-reg.slots.other']}</Typography>
        <Button size="small" onClick={onRefresh}>Obnovit termíny</Button>
      </Box>
    </Box>
  );
}
