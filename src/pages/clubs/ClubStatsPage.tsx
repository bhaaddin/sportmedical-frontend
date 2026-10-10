/*
 * Kluby > Statistiky (Etapa 4): the clubs' capacity as one analysis - players total, per service, per činnost,
 * how many places are still missing and how much of the booked window time is used.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { clubOrdersApi } from '../../api/clubOrders';
import { ClubStatsView } from '../../components/clubs/stats/ClubStatsView';
import { activityRows, clubRevenue, clubRows, isEmptyStats, occupancyPercent, normalizeSummary, serviceRows } from '../../components/clubs/stats/statsMath';
import { PageHeader, SoftCard } from '../../components/ui';
import { pragueDateKey } from '../../utils/time';
import { buildStatisticsCsv, downloadCsv, statisticsCsvFileName } from '../statistics/csv';
import { LoadError, RangeFilter } from './subpages/common';
import { rangeFor, type DateRange, type RangeKey } from './subpages/range';

export default function ClubStatsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });
  const today = pragueDateKey(new Date());
  const range = rangeFor(rangeKey, today, custom);

  const periodFilter = { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) };
  const query = useQuery({
    queryKey: ['club-stats', range.from, range.to],
    queryFn: () => clubOrdersApi.stats(periodFilter),
  });
  /* Etapa 12: the money next to the counts comes from the orders of the same period; the counts stand without it. */
  const ordersQuery = useQuery({
    queryKey: ['club-orders', '', range.from ?? '', range.to ?? ''],
    queryFn: () => clubOrdersApi.list(periodFilter),
    retry: false,
  });

  const period = useMemo(() => ({ from: range.from ?? 'od-začátku', to: range.to ?? today }), [range.from, range.to, today]);
  const stats = query.data;
  const revenue = useMemo(() => clubRevenue(ordersQuery.data), [ordersQuery.data]);

  const exportCsv = () => {
    if (!stats) return;
    const csv = buildStatisticsCsv(
      [
        {
          title: 'Podle klubu',
          columns: ['Klub', 'Hráčů', 'Zapsáno', 'Chybí', 'Kapacita %', 'Objednáno Kč'],
          rows: clubRows(stats).map((c) => [c.clubName ?? '', c.totalSeats, c.registered, c.remaining, occupancyPercent(c) ?? '', revenue?.byClub.get(c.clubId) ?? '']),
        },
        { title: 'Podle služby', columns: ['Služba', 'Hráčů', 'Zapsáno', 'Chybí'], rows: serviceRows(stats).map((s) => [s.serviceName, s.seats, s.registered, s.remaining]) },
        {
          title: 'Podle činnosti',
          columns: ['Činnost', 'Služba', 'Hráčů', 'Zapsáno', 'Chybí'],
          rows: activityRows(stats).map((a) => [a.activityName, a.serviceName, a.seats, a.registered, a.remaining]),
        },
        { title: 'Celkem', columns: ['Hráčů', 'Zapsáno', 'Chybí', 'Objednáno Kč'], rows: [[normalizeSummary(stats.totals).totalSeats, normalizeSummary(stats.totals).registered, normalizeSummary(stats.totals).remaining, revenue?.totalCzk ?? '']] },
      ],
      period,
    );
    downloadCsv(statisticsCsvFileName('kluby', period), csv);
  };

  return (
    <Box>
      <PageHeader
        title="Statistiky klubů"
        subtitle="Kapacita, zapsaní hráči a chybějící místa"
        actions={<Button variant="outlined" disabled={!stats || isEmptyStats(stats)} onClick={exportCsv}>Export CSV</Button>}
      />
      <SoftCard sx={{ mb: 2 }}>
        <RangeFilter value={rangeKey} custom={custom} onChange={setRangeKey} onCustom={setCustom} />
      </SoftCard>

      {query.isPending ? (
        <Skeleton variant="rounded" height={220} />
      ) : query.isError ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : stats && isEmptyStats(stats) ? (
        <SoftCard sx={{ py: 5, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>V tomto období nejsou žádná data klubů.</Typography>
        </SoftCard>
      ) : stats ? (
        <ClubStatsView stats={stats} period={period} revenue={revenue} revenueLoading={ordersQuery.isLoading} />
      ) : null}
    </Box>
  );
}
