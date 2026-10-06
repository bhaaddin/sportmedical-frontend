/*
 * "Co vidí klub": exactly the history entries the club reads in its portal (`visibleToClub`), newest first - so the
 * desk sees what the club sees. The full internal history stays under "Historie".
 */
import { Box, Stack, Typography } from '@mui/material';
import type { OrderHistoryItem } from '../../../api/clubOrders';
import { formatPragueDateTime } from '../../../utils/time';

export const visibleToClub = (history: readonly OrderHistoryItem[]): OrderHistoryItem[] =>
  history.filter((h) => h.visibleToClub === true).sort((a, b) => (Date.parse(b.atUtc) || 0) - (Date.parse(a.atUtc) || 0));

export function ClubVisibleHistory({ history }: { history: readonly OrderHistoryItem[] }) {
  const items = visibleToClub(history);
  return (
    <Stack spacing={1} data-testid="club-visible">
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Takto změny vidí klub ve svém portálu.</Typography>
      {items.length === 0 ? (
        <Typography variant="body2" data-testid="club-visible-empty">Klub zatím nevidí žádné změny.</Typography>
      ) : (
        <Stack component="ol" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="club-visible-list">
          {items.map((h, i) => (
            <Box component="li" key={`${h.atUtc}-${i}`} sx={{ borderLeft: '2px solid', borderColor: 'primary.main', pl: 1.5 }}>
              <Typography variant="caption" color="text.secondary">{h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : ''}</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{h.text}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default ClubVisibleHistory;
