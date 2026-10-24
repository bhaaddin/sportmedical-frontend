/*
 * Kluby > Statistiky (Etapa 4): the clubs' capacity as one analysis - players total, per service, per činnost,
 * how many places are still missing and how much of the booked window time is used.
 */
import { useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { clubOrdersApi } from '../../api/clubOrders';
import { ClubStatsView } from '../../components/clubs/stats/ClubStatsView';
import { activityRows, clubRevenue, clubRows, isEmptyStats, occupancyPercent, normalizeSummary, serviceRows } from '../../components/clubs/stats/statsMath';
import { PageFrame, Shelf, TARGET_SX } from '../../ui/shelf';
import { pragueDateKey } from '../../utils/time';
import { buildStatisticsCsv, downloadCsv, statisticsCsvFileName } from '../statistics/csv';
import { ExportGate } from '../../components/ui/ExportGate';
import { RangeFilter } from './subpages/common';
import { rangeFor, type DateRange, type RangeKey } from './subpages/range';

export default function ClubStatsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });
  const today = pragueDateKey(new Date());
  const range = rangeFor(rangeKey, today, custom);

  const periodFilter = { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) };
  const query = useQuery({
    queryKey: ['club-stats', range.from, range.to],
    queryFn: ({ signal }) => clubOrdersApi.stats(periodFilter, { signal }),
  });
  /* Etapa 12: the money next to the counts comes from the orders of the same period; the counts stand without it. */
  const ordersQuery = useQuery({
    queryKey: ['club-orders', '', range.from ?? '', range.to ?? ''],
    queryFn: ({ signal }) => clubOrdersApi.list(periodFilter, { signal }),
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
    void downloadCsv(statisticsCsvFileName('kluby', period), csv, 'club-statistics-csv');
  };

  const empty = stats !== undefined && isEmptyStats(stats);
  return (
    <PageFrame
      fit
      title="Statistiky klubů"
      purpose="Kapacita, zapsaní hráči a chybějící místa"
      actions={(
        <>
          <RangeFilter value={rangeKey} custom={custom} onChange={setRangeKey} onCustom={setCustom} />
          <ExportGate>{(blocked) => <Button variant="outlined" disabled={blocked || !stats || empty} onClick={exportCsv} sx={TARGET_SX}>Export CSV</Button>}</ExportGate>
        </>
      )}
    >
      <Shelf
        id="club-stats"
        title="Kapacita klubů"
        layout="free"
        grow
        loading={query.isPending}
        error={query.isError ? 'Statistiky klubů se nepodařilo načíst.' : false}
        onRetry={() => void query.refetch()}
        empty={empty}
        emptyState={{ text: 'V tomto období nejsou žádná data klubů.' }}
      >
        {stats ? <ClubStatsView stats={stats} period={period} revenue={revenue} revenueLoading={ordersQuery.isLoading} /> : null}
      </Shelf>
    </PageFrame>
  );
}
