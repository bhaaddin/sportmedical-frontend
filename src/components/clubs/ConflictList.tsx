import { Alert, Box, Typography } from '@mui/material';
import type { ClubBlockConflict } from '../../api/clubBlocks';
import { formatSlotTime } from '../../pages/clubs/clubOrders';
import { conflictLine } from './blockLogic';

/**
 * The athletes a change to a block would hit - what a `409` answers with. The
 * operator reads who is affected before confirming, so the list is the whole
 * point; it is never collapsed behind a count.
 */
export function ConflictList({ conflicts, message }: { conflicts: ClubBlockConflict[]; message: string }) {
  return (
    <Alert severity="warning" role="alert" data-testid="block-conflicts" sx={{ alignItems: 'flex-start' }}>
      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{message}</Typography>
      {conflicts.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Dotčení sportovci ({conflicts.length}):
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
            {conflicts.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <Typography variant="body2">{conflictLine(c, formatSlotTime)}</Typography>
              </li>
            ))}
          </Box>
        </>
      ) : null}
    </Alert>
  );
}

export default ConflictList;
