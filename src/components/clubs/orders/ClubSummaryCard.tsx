/*
 * The club as ONE whole (Etapa 4): total players, registered, still missing; a table per service and per
 * činnost with a bar; orders by status; booked against used minutes. When the summary call fails the
 * `fallback` (the older "Místa klubu" card) is drawn instead, so the screen never goes blank.
 */
import { Box, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { clubOrdersApi, ORDER_STATUSES, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClubSummary } from '../../../api/clubOrders';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { minutesText, normalizeSummary, seatPercent, STATUS_TONE } from './orderLogic';

export function useClubSummary(clubId: string) {
  return useQuery<ClubSummary>({
    queryKey: ['club-summary', clubId],
    queryFn: async () => normalizeSummary(await clubOrdersApi.clubSummary(clubId)),
    staleTime: 30 * 1000,
    retry: false,
  });
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function SeatTable({ label, rows }: { label: string; rows: { key: string; name: string; seats: number; registered: number; remaining: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell>{label}</TableCell>
            <TableCell align="right">Míst</TableCell>
            <TableCell align="right">Zapsáno</TableCell>
            <TableCell align="right">Zbývá</TableCell>
            <TableCell sx={{ minWidth: 90 }}>Obsazenost</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} data-testid="summary-row">
              <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
              <TableCell align="right">{r.seats}</TableCell>
              <TableCell align="right">{r.registered}</TableCell>
              <TableCell align="right">{r.remaining}</TableCell>
              <TableCell><LinearProgress variant="determinate" value={seatPercent(r.registered, r.seats)} aria-label={`Obsazenost: ${r.name}`} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function ClubSummaryCard({ clubId, fallback }: { clubId: string; fallback?: React.ReactNode }) {
  const query = useClubSummary(clubId);

  if (query.isLoading) {
    return fallback !== undefined && fallback !== null ? <>{fallback}</> : <Skeleton variant="rounded" height={160} data-testid="club-summary-loading" />;
  }
  if (query.isError || query.data === undefined) return <>{fallback ?? null}</>;

  const s = query.data;
  const hasData = s.totalSeats > 0 || ORDER_STATUSES.some((st) => s.ordersByStatus[st] > 0);
  if (!hasData && fallback !== undefined && fallback !== null) return <>{fallback}</>;

  return (
    <SoftCard data-testid="club-summary" role="region" aria-label="Klub jako celek">
      <SectionLabel>Klub jako celek</SectionLabel>
      <Stack direction="row" sx={{ gap: 4, flexWrap: 'wrap', mb: 1.5 }}>
        <Figure value={s.totalSeats} label="hráčů celkem" />
        <Figure value={s.registered} label="zapsáno" />
        <Figure value={s.remaining} label="ještě chybí" />
      </Stack>
      <Typography data-testid="summary-minutes" variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
        Obsazeno {minutesText(s.usedMinutes)} z {minutesText(s.bookedMinutes)}
      </Typography>
      <LinearProgress variant="determinate" value={seatPercent(s.usedMinutes, s.bookedMinutes)} aria-label="Využití rezervovaného času" sx={{ mb: 2 }} />

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }} data-testid="summary-statuses">
        {ORDER_STATUSES.map((st) => (
          <StatusChip key={st} tone={STATUS_TONE[st]}>{ORDER_STATUS_LABEL[st]}: {s.ordersByStatus[st]}</StatusChip>
        ))}
      </Stack>

      <Stack spacing={2}>
        <SeatTable label="Služba" rows={s.byService.map((x) => ({ key: x.serviceId || x.serviceName, name: x.serviceName, seats: x.seats, registered: x.registered, remaining: Math.max(0, x.seats - x.registered) }))} />
        <SeatTable label="Činnost" rows={s.byActivity.map((x) => ({ key: x.activityId || x.activityName, name: x.serviceName !== '' ? `${x.activityName} (${x.serviceName})` : x.activityName, seats: x.seats, registered: x.registered, remaining: x.remaining }))} />
      </Stack>
    </SoftCard>
  );
}

export default ClubSummaryCard;
