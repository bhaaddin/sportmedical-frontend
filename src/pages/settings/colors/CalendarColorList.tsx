/*
 * The kalendáře with their colour (R15d): the colour of a calendar's column head, chip and pill on the board. One swatch button per
 * calendar opens the same colour editor as a služba or a činnost (the page owns the popover). A calendar's default colour is the
 * next colour of the clinic's palette by its order, so "Použít výchozí barvu" is always a colour the clinic chose.
 */
import { Box, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../../components/ui';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import type { Calendar } from '../../../api/bookingContracts';
import { cleanHex } from '../../../colors/activityColor';

/** A calendar's default colour: the palette colour at its position among the calendars (wrapping). */
export function defaultCalendarColor(calendars: readonly Calendar[], calendar: Calendar, palette: readonly string[], fallback: string): string {
  const order = [...calendars].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
  const index = Math.max(0, order.findIndex((c) => c.id === calendar.id));
  const usable = palette.map(cleanHex).filter((c): c is string => c !== null);
  return usable.length === 0 ? fallback : usable[index % usable.length]!;
}

export function CalendarColorList({
  calendars,
  palette,
  fallback,
  onPick,
}: {
  calendars: readonly Calendar[];
  palette: readonly string[];
  fallback: string;
  onPick: (anchor: HTMLElement, calendar: Calendar) => void;
}) {
  const sorted = [...calendars].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
  if (sorted.length === 0) return <Typography sx={TYPE.caption}>Zatím žádný kalendář.</Typography>;
  return (
    <Box component="ul" aria-label="Kalendáře a jejich barvy" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {sorted.map((calendar) => {
        const colour = cleanHex(calendar.color) ?? fallback;
        const isDefault = colour.toUpperCase() === defaultCalendarColor(sorted, calendar, palette, fallback).toUpperCase();
        return (
          <Box component="li" key={calendar.id}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                component="button"
                type="button"
                aria-label={`Změnit barvu kalendáře ${calendar.name}`}
                onClick={(e: React.MouseEvent<HTMLElement>) => onPick(e.currentTarget, calendar)}
                sx={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 2, cursor: 'pointer', bgcolor: colour, border: '1px solid', borderColor: settingsLine,
                  '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={TYPE.itemName}>{calendar.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography sx={[TYPE.caption, { fontVariantNumeric: 'tabular-nums' }]}>{colour.toUpperCase()}</Typography>
                  {!isDefault ? <StatusChip size="sm">vlastní</StatusChip> : null}
                  {!calendar.isActive ? <StatusChip size="sm">Vypnuto</StatusChip> : null}
                </Stack>
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

export default CalendarColorList;
