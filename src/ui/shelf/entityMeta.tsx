/*
 * How each kind of entity looks: one icon and one tone, the same everywhere a patient, a club, an invoice ... appears
 * (a chip, a card, a palette row, a "Související" group). Kept out of `entities.ts` so the model stays free of React.
 */
import { Box } from '@mui/material';
import {
  Description, Event, Groups, ListAlt, MedicalServices, Person, ReceiptLong, Tune,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { EntityKind } from './entities';
import { toneOf, type ShelfTone } from './shelfStyle';

export const ENTITY_ICON: Record<EntityKind, SvgIconComponent> = {
  patient: Person,
  club: Groups,
  order: ListAlt,
  appointment: Event,
  invoice: ReceiptLong,
  document: Description,
  service: MedicalServices,
  activity: Tune,
};

/** Tones follow the board's: people green, money beige, clubs blue, the calendar the accent, the rest quiet. */
export const ENTITY_TONE: Record<EntityKind, ShelfTone> = {
  patient: 'green',
  club: 'blue',
  order: 'blue',
  appointment: 'primary',
  invoice: 'beige',
  document: 'grey',
  service: 'grey',
  activity: 'grey',
};

/** The round icon that says what kind a thing is. Decorative: the kind is always also in the text or the label. */
export function EntityBadge({ kind, size = 32 }: { kind: EntityKind; size?: number }) {
  const Icon = ENTITY_ICON[kind];
  return (
    <Box
      aria-hidden
      sx={(t) => {
        const c = toneOf(t, ENTITY_TONE[kind]);
        return {
          flexShrink: 0, width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
          color: c.fg, bgcolor: c.bg, boxShadow: `inset 0 0 0 1px ${c.line}`,
        };
      }}
    >
      <Icon sx={{ fontSize: Math.round(size * 0.56) }} />
    </Box>
  );
}
