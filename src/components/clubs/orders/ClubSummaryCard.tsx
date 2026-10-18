/*
 * The club as ONE whole (Etapa 4): total players, registered, still missing; a table per service and per
 * činnost with a bar; orders by status; booked against used minutes. When the summary call fails the
 * `fallback` (the older "Místa klubu" card) is drawn instead, so the screen never goes blank.
 */
import { Box, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { clubSummariesApi, clubSummariesRouteMissing } from '../../../api/clubs';
import { clubOrdersApi, ORDER_STATUSES, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClubSummary } from '../../../api/clubOrders';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import { minutesText, normalizeSummary, seatPercent, STATUS_TONE } from './orderLogic';

/** How long a summary counts as current (the single call and the batch seeding it). */
const SUMMARY_STALE_MS = 60 * 1000;

/** The query key of one club's summary: the club screen, its overview and the club list's cards all read this one. */
export const clubSummaryKey = (clubId: string) => ['club-summary', clubId] as const;

/**
 * `enabled` is false for a club nobody works with (a deactivated one): its card draws from the block totals and no
 * request is made for it. It is also false on the club list while the batch call is on its way (or has answered):
 * the list's cards then read what the batch seeded into the cache.
 */
export function useClubSummary(clubId: string, enabled = true) {
  return useQuery<ClubSummary>({
    queryKey: clubSummaryKey(clubId),
    queryFn: async () => normalizeSummary(await clubOrdersApi.clubSummary(clubId)),
    staleTime: SUMMARY_STALE_MS,
    retry: false,
    enabled: enabled && clubId !== '',
  });
}

/**
 * Writes the batch answer into every club's own summary cache entry (same key as {@link useClubSummary}).
 * The answer is matched by the `clubId` each row carries, or by position when a row has none (the batch answers in
 * the order asked). `onlyMissing` leaves an entry that already holds data alone.
 */
function seedSummaries(client: QueryClient, ids: string[], rows: unknown[], onlyMissing: boolean): void {
  rows.forEach((raw, index) => {
    if (raw === null || typeof raw !== 'object') return;
    const named = (raw as { clubId?: unknown }).clubId;
    const id = typeof named === 'string' && named !== '' ? named : rows.length === ids.length ? ids[index] : undefined;
    if (id === undefined || !ids.includes(id)) return;
    if (onlyMissing && client.getQueryData(clubSummaryKey(id)) !== undefined) return;
    client.setQueryData<ClubSummary>(clubSummaryKey(id), normalizeSummary({ ...(raw as ClubSummary), clubId: id }));
  });
}

/**
 * The club list asks for every active club's summary ONCE (`GET /clubs/summaries`) and seeds each club's single
 * summary entry, so the cards, the club screen and `ClubSummaryCard` read it from the cache.
 *
 *   - `pending`  the batch call is on its way: nobody asks per club yet
 *   - `batch`    answered and seeded: the cards read the cache and ask nothing
 *   - `single`   the server has no batch route (404 / 405, remembered for the session) or the call failed: the
 *                cards ask per club, exactly as before
 *
 * The batch query sits under the `club-summary` key, so a club-world invalidation refreshes it (one call again)
 * while the cards, which are disabled in `batch` mode, do not each ask on their own.
 */
export function useClubSummaries(clubIds: string[]): 'pending' | 'batch' | 'single' {
  const client = useQueryClient();
  const key = clubIds.join(',');
  const known = clubSummariesRouteMissing();
  const query = useQuery<unknown[] | null>({
    queryKey: ['club-summary', 'batch', key],
    queryFn: async () => {
      const rows = await clubSummariesApi.fetch(clubIds);
      if (rows !== null) seedSummaries(client, clubIds, rows, false);
      return rows;
    },
    staleTime: SUMMARY_STALE_MS,
    retry: false,
    enabled: clubIds.length > 0 && !known,
  });

  /* A fresh batch answer that is still cached while the single entries were dropped: put them back. */
  const rows = query.data;
  useEffect(() => {
    if (rows) seedSummaries(client, clubIds, rows, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for clubIds
  }, [rows, key, client]);

  if (clubIds.length === 0) return 'batch';
  if (known || query.isError || query.data === null) return 'single';
  return query.data === undefined ? 'pending' : 'batch';
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
