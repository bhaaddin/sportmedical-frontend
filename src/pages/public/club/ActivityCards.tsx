/*
 * The athlete's first choice on /klub/:token: which činnost. One card each with
 * its duration and how many places are left ("volno 7 z 10"); a činnost with no
 * place left is disabled and says "Obsazeno".
 */
import { Box, Typography } from '@mui/material';
import type { ClubActivity } from '../../../api/publicClub';
import { BRAND } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE } from '../../../components/public/kit';
import { priceLabel, withCalDefaults, type CalTexts } from './texts';

/** Places left on one činnost: its own count, else the block's overall one when the server sends no per-činnost numbers. */
export function activityRemaining(activity: ClubActivity, blockRemaining: number): number {
  if (typeof activity.remaining === 'number') return Math.max(0, activity.remaining);
  if (typeof activity.seats === 'number') return Math.max(0, activity.seats - (activity.registered ?? 0));
  return Math.max(0, blockRemaining);
}

export function ActivityCards({
  activities,
  blockRemaining,
  value,
  full,
  onPick,
  paysClub = false,
  t,
}: {
  activities: readonly ClubActivity[];
  blockRemaining: number;
  value: string;
  /** Ids the server just refused as full, before a reload says so. */
  full: ReadonlySet<string>;
  onPick: (id: string) => void;
  /** The order is invoiced to the club: each price reads "· hradí klub" (Etapa 12). */
  paysClub?: boolean;
  /** The price wording; absent = the Czech defaults. */
  t?: CalTexts;
}) {
  const texts = t ?? withCalDefaults({});
  const priceOf = (a: ClubActivity): string => priceLabel(a.unitPriceCzk, paysClub, texts);
  return (
    <Box role="group" aria-label="Činnost" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {activities.map((a) => {
        const left = full.has(a.activityId) ? 0 : activityRemaining(a, blockRemaining);
        const isFull = left <= 0;
        const selected = value === a.activityId && !isFull;
        const places = typeof a.seats === 'number' && a.seats > 0 ? `volno ${left} z ${a.seats}` : `volno ${left}`;
        return (
          <Box
            key={a.activityId}
            component="button"
            type="button"
            data-testid="club-activity-card"
            data-full={isFull}
            disabled={isFull}
            aria-pressed={selected}
            onClick={() => onPick(a.activityId)}
            sx={{
              minHeight: 76, p: 2, textAlign: 'left', fontFamily: 'inherit', borderRadius: '14px', cursor: isFull ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', gap: 0.5,
              bgcolor: selected ? BRAND.accent : isFull ? '#F4F2EE' : BRAND.paper,
              color: selected ? ON_ORANGE : isFull ? '#9A958D' : BRAND.text,
              border: `${selected ? 2 : 1}px solid ${selected ? BRAND.accent : '#D8D2C9'}`,
              '&:hover:not(:disabled)': { borderColor: BRAND.accent },
            }}
          >
            <Typography component="span" sx={{ fontSize: 16, fontWeight: 700, color: 'inherit' }}>
              {selected ? '✓ ' : ''}{a.activityName}
            </Typography>
            <Typography component="span" sx={{ fontSize: 14, color: selected ? ON_ORANGE : LABEL_COLOR }}>
              {a.durationMinutes > 0 ? `${a.durationMinutes} min na sportovce · ` : ''}
              <Box component="span" data-testid="club-activity-price">{priceOf(a)}</Box>
              {' · '}
              {isFull ? 'Obsazeno' : places}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
