/*
 * DayRow - one booking of a day as a quiet line in a `list` shelf (Dnešní přehled: Čekárna, Mají zpoždění, a calendar's
 * column, Podklady; Přehled podle služeb: a činnost's terms).
 *
 *   13:30   Jana Marková                       1 600 Kč   [Přišel]
 *           Základní prohlídka · Ordinace 1
 *
 * The time is the anchor (tabular, bold); the name is the patient's link (EntityLink - plain text without the permission),
 * the second line says what and where (the činnost is the appointment's link, with its peek); on the right an amount and
 * the ONE next step (or a status word). On a phone the right side drops under the name, so nothing is squeezed.
 *
 * Presentational only: the page decides every word and which step is offered.
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { MUTED_SX } from './shelfStyle';

/** A booking's patient id names a register entry: not empty and not the empty GUID some answers carry for "nobody". */
export const isRealPatientId = (id: string | null | undefined): id is string =>
  typeof id === 'string' && id !== '' && id !== '00000000-0000-0000-0000-000000000000';

export interface DayRowProps {
  /** "13:30" (or "13:30–14:00"). */
  time: string;
  /** The first line: who. */
  who: ReactNode;
  /** The second line: what and where. */
  what?: ReactNode;
  /** An amount or a small fact, right of the text. */
  aside?: ReactNode;
  /** The one action (or a status chip), at the end. */
  trailing?: ReactNode;
  /** A row that no longer stands (cancelled): drawn struck through, never dropped. */
  gone?: boolean;
  /** `data-row` (tests and the browser check find rows by it). */
  kind?: string;
}

export function DayRow({ time, who, what, aside, trailing, gone = false, kind = 'appointment' }: DayRowProps) {
  const hasEnd = aside !== undefined || trailing !== undefined;
  return (
    <Box
      role="listitem"
      data-row={kind}
      data-gone={gone ? '' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        columnGap: 1.5,
        rowGap: 0.5,
        px: 1.25,
        py: 0.75,
        minHeight: 56,
        borderRadius: 1.5,
        '&:hover': { bgcolor: 'action.hover' },
        '& + &': { borderTop: '1px solid', borderColor: 'divider', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
        ...(gone ? { color: 'text.disabled', textDecoration: 'line-through' } : {}),
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 700, minWidth: 46, fontVariantNumeric: 'tabular-nums', alignSelf: 'flex-start', pt: '2px' }}>
        {time}
      </Typography>
      <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
        <Typography component="div" sx={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.35 }}>{who}</Typography>
        {what !== undefined && (
          <Typography component="div" sx={{ ...MUTED_SX, fontSize: 13.5, overflowWrap: 'anywhere', lineHeight: 1.35 }}>{what}</Typography>
        )}
      </Box>
      {hasEnd && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            flexWrap: 'wrap',
            flexShrink: 0,
            /* Phone: under the text, right-aligned, after the time's width. */
            flexBasis: { xs: '100%', sm: 'auto' },
            pl: { xs: '58px', sm: 0 },
          }}
        >
          {aside !== undefined && <Box sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right', mr: 'auto', '@media (min-width: 600px)': { mr: 0 } }}>{aside}</Box>}
          {trailing}
        </Box>
      )}
    </Box>
  );
}

export default DayRow;
