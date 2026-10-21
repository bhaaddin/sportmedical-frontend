/*
 * RelatedShelf - "Související": one card per kind of thing a page's subject is connected to, each naming the first few as
 * connected chips (a click opens them, a rest shows a peek), saying how many there are in all, and - when there are none -
 * offering the next action instead of a blank.
 *
 *   <RelatedShelf groups={patientRelatedGroups({...})}>{extra cards}</RelatedShelf>
 *
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';
import { EntityChip } from './EntityLink';
import { Shelf } from './Shelf';
import type { RelatedGroup } from './related';
import { MUTED_SX, TARGET_SX, cardSurface } from './shelfStyle';

export function RelatedCard({ group }: { group: RelatedGroup }) {
  return (
    <Box role="listitem" data-card="related" data-related={group.id} data-state={group.status} sx={(t) => ({ ...cardSurface(t, false), p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 })}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{group.title}</Typography>
        {group.status === 'ready' && (
          <Typography component="span" aria-label={`Počet: ${group.total}`} sx={{ ...MUTED_SX, fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{group.total}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {group.status === 'ready' && group.viewAll !== undefined && group.total > group.entities.length && (
          <Button component={RouterLink} to={group.viewAll.to} state={group.viewAll.state} size="small" aria-label={`Zobrazit vše: ${group.title}`} sx={{ ...TARGET_SX, fontSize: 12.5, px: 0.75 }}>
            Zobrazit vše
          </Button>
        )}
      </Box>

      {group.status === 'loading' && (
        <Box aria-busy="true" aria-label={`${group.title}: načítám`}><Skeleton height={28} width="80%" /><Skeleton height={28} width="60%" /></Box>
      )}
      {group.status === 'error' && <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>Nepodařilo se načíst.</Typography>}

      {group.status === 'ready' && (
        group.total === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
            <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>{group.empty}</Typography>
            {group.emptyAction !== undefined && (
              <Button component={RouterLink} to={group.emptyAction.to} state={group.emptyAction.state} size="small" variant="outlined" sx={TARGET_SX}>
                {group.emptyAction.label}
              </Button>
            )}
          </Box>
        ) : (
          <Box role="list" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
            {group.entities.map((e) => (
              <Box component="span" role="listitem" key={`${e.kind}:${e.id}`} sx={{ display: 'inline-flex', maxWidth: '100%' }}><EntityChip entity={e} /></Box>
            ))}
            {group.notes.map((n) => (
              <Typography key={n} component="span" role="listitem" sx={{ ...MUTED_SX, fontSize: 13, alignSelf: 'center' }}>{n}</Typography>
            ))}
          </Box>
        )
      )}
    </Box>
  );
}

export function RelatedShelf({ groups, title = 'Související', hint, children }: { groups: RelatedGroup[]; title?: string; hint?: string; children?: ReactNode }) {
  /* A phone swipes through the relations (one card of the next peeking in); wider screens see them all at once. */
  const phone = useIsPhone();
  return (
    <Shelf id="related" title={title} hint={hint} layout={phone ? 'row' : 'grid'} minCardWidth={252} phoneWidth="min(78vw, 280px)" stagger={false}>
      {groups.map((g) => <RelatedCard key={g.id} group={g} />)}
      {children}
    </Shelf>
  );
}
