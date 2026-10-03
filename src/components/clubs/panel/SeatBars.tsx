/* A block's places per činnost: one `registered / seats` bar each. */
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { activityLabel, seatsFree } from './seats';
import type { ActivitySeats } from './seats';

export function SeatBars({ rows, label }: { rows: readonly ActivitySeats[]; label: string }) {
  return (
    <Stack spacing={1.25} role="list" aria-label={label} data-testid="seat-bars">
      {rows.map((row) => {
        const pct = row.seats > 0 ? Math.min(100, (row.registered / row.seats) * 100) : 0;
        const name = activityLabel(row);
        return (
          <Box key={row.activityId || row.activityName} role="listitem" data-testid="seat-bar">
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }}>{name}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {row.registered} / {row.seats}
                <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>{` · ${seatsFree(row)} volných`}</Box>
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} aria-label={`Obsazenost: ${name}`} />
          </Box>
        );
      })}
    </Stack>
  );
}
