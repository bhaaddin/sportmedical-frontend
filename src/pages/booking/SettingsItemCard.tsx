/*
 * One card on a settings shelf (Činnosti, Služby, Blokovaný čas, Nepřítomnosti, Výjimky, Svátky).
 *
 * The shape Kalendáře drew by hand: the shelf surface, a title that is the card's h3, a status chip, quiet lines and a row of
 * actions at the foot. Every control on it is at least 44 px under 1280 (TARGET_SX).
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { MUTED_SX, cardSurface } from '../../ui/shelf';

export interface SettingsItemCardProps {
  kind: string;
  id?: string;
  title: ReactNode;
  /** A StatusChip or similar, right of the title. */
  status?: ReactNode;
  /** Quiet lines under the title. */
  children?: ReactNode;
  /** Buttons at the foot. */
  actions?: ReactNode;
  /** A 4 px colour edge: decoration only, the title carries the meaning. */
  edge?: string;
  dim?: boolean;
  marked?: boolean;
}

export function SettingsItemCard({ kind, id, title, status, children, actions, edge, dim = false, marked = false }: SettingsItemCardProps) {
  return (
    <Box
      role="listitem"
      data-card={kind}
      data-item-id={id}
      aria-current={marked ? 'true' : undefined}
      sx={(th) => ({
        ...cardSurface(th, false),
        p: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        opacity: dim ? 0.72 : 1,
        ...(edge === undefined ? {} : { borderLeft: `4px solid ${edge}` }),
        ...(marked ? { boxShadow: `0 0 0 2px ${th.palette.primary.main}` } : {}),
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Typography component="h3" sx={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {status}
      </Box>
      {children === undefined || children === null ? null : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, ...MUTED_SX, fontSize: 14 }}>{children}</Box>
      )}
      {actions === undefined ? null : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mt: 'auto', pt: 0.5 }}>{actions}</Box>
      )}
    </Box>
  );
}

/** An inline link inside a sentence: 44 px tall under 1280 (a thumb), a plain link above. */
export const INLINE_LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  '@media (max-width: 1279.95px)': { minHeight: 44 },
} as const;
