/*
 * "Místa klubu": the club counted as one whole, over all its active blocks - a
 * row per činnost (places, registered, free, a bar), a total row, and one short
 * sentence of analysis per činnost.
 */
import { Box, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { SectionLabel, SoftCard } from '../../ui';
import { activityLabel, seatsFree, seatsSentence, sumSeats, totalsLine } from './seats';
import type { ActivitySeats } from './seats';

export function ClubSeatsCard({ rows }: { rows: readonly ActivitySeats[] }) {
  if (rows.length === 0) return null;
  const totals = sumSeats(rows);
  return (
    <SoftCard data-testid="club-seats-card" role="region" aria-label="Místa klubu">
      <SectionLabel>Místa klubu</SectionLabel>
      <Typography data-testid="club-seats-total" sx={{ fontSize: 17, fontWeight: 700, mb: 1.5 }}>
        {totalsLine(totals)}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Místa klubu podle činností">
          <TableHead>
            <TableRow>
              <TableCell>Činnost</TableCell>
              <TableCell align="right">Míst</TableCell>
              <TableCell align="right">Zapsáno</TableCell>
              <TableCell align="right">Volno</TableCell>
              <TableCell sx={{ minWidth: 90 }}>Obsazenost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.activityId || row.activityName} data-testid="club-seats-row">
                <TableCell sx={{ fontWeight: 600 }}>{activityLabel(row)}</TableCell>
                <TableCell align="right">{row.seats}</TableCell>
                <TableCell align="right">{row.registered}</TableCell>
                <TableCell align="right">{seatsFree(row)}</TableCell>
                <TableCell>
                  <LinearProgress
                    variant="determinate"
                    value={row.seats > 0 ? Math.min(100, (row.registered / row.seats) * 100) : 0}
                    aria-label={`Obsazenost: ${activityLabel(row)}`}
                  />
                </TableCell>
              </TableRow>
            ))}
            <TableRow data-testid="club-seats-sum">
              <TableCell sx={{ fontWeight: 700 }}>Celkem</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.seats}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.registered}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.free}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      <Stack component="ul" spacing={0.25} sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }} data-testid="club-seats-analysis">
        {rows.map((row) => (
          <Typography key={row.activityId || row.activityName} component="li" variant="body2" sx={{ color: 'text.secondary' }}>
            {seatsSentence(row)}
          </Typography>
        ))}
      </Stack>
    </SoftCard>
  );
}
