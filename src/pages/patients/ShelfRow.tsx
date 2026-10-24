/*
 * One row of a `list` shelf on the patient's sections (Dokumenty, Termíny, Výsledky, Historie).
 *
 * A row is a `listitem` inside the shelf's glass board: an optional tone edge (red = something to do, beige = soon, none = a
 * fact), a title, one or two quiet lines, and what can be done with it on the right. One component so the four sections read
 * as one card, the way the overview does.
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { MUTED_SX, toneOf, type ShelfTone } from '../../ui/shelf';

export interface ShelfRowProps {
  title: ReactNode;
  /** Quiet lines under the title. */
  detail?: ReactNode;
  /** A thin coloured edge on the left: only for a row that asks for something. */
  tone?: ShelfTone;
  /** Controls and statuses on the right (wrap under the text on a phone). */
  trailing?: ReactNode;
  /** Anything under the row (a review prompt, an expanded detail). */
  below?: ReactNode;
  testId?: string;
  onClick?: () => void;
}

export function ShelfRow({ title, detail, tone, trailing, below, testId, onClick }: ShelfRowProps) {
  return (
    <Box
      role="listitem"
      data-testid={testId}
      data-tone={tone}
      sx={(t) => ({
        position: 'relative',
        px: 1.75,
        py: 1.25,
        borderRadius: 1.5,
        '& + &': { borderTop: '1px solid', borderColor: 'divider', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
        ...(tone !== undefined
          ? { '&::before': { content: '""', position: 'absolute', left: 4, top: 10, bottom: 10, width: 3, borderRadius: 2, bgcolor: toneOf(t, tone).line } }
          : {}),
      })}
    >
      <Box
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5,
          flexDirection: { xs: 'column', sm: 'row' },
          ...(onClick !== undefined ? { cursor: 'pointer' } : {}),
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="div" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{title}</Typography>
          {detail !== undefined && (
            <Typography component="div" sx={{ ...MUTED_SX, fontSize: 13, mt: 0.25, overflowWrap: 'anywhere' }}>{detail}</Typography>
          )}
        </Box>
        {trailing !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>{trailing}</Box>
        )}
      </Box>
      {below}
    </Box>
  );
}

export default ShelfRow;
