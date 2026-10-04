/*
 * The body of Statistiky klubů: KPI cards, the per-club table, the per-service and per-činnost tables and two
 * charts. Takes the stats answer as data; fetching, range and export live in the page.
 */
import { Box, Typography, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ClubOrderStats } from '../../../api/clubOrders';
import { KpiCard, SectionLabel, StatusChip, DESIGN } from '../../ui';
import { ResponsiveDataList, type DataColumn } from '../../ui/ResponsiveDataList';
import { useIsPhone } from '../../../layout/useDevice';
import { ChartCard, ChartGrid, HorizontalBars, CHART_HEIGHT, type ChartDef } from '../../../pages/statistics/StatisticsCharts';
import type { Period } from '../../../pages/statistics/aggregate';
import { SeatsBar } from '../../../pages/clubs/subpages/common';
import {
  activityRows, clubRows, occupancyPercent, percentText, serviceRows, statsKpis,
  type ActivityRow, type NormalSummary, type ServiceRow,
} from './statsMath';

const nf = (v: number): string => v.toLocaleString('cs-CZ');

export function ClubStatsView({ stats, period }: { stats: ClubOrderStats; period: Period }) {
  const theme = useTheme();
  const phone = useIsPhone();
  const axis = { fontSize: 12, fill: theme.palette.text.secondary };
  const kpi = statsKpis(stats);
  const clubs = clubRows(stats);
  const services = serviceRows(stats);
  const activities = activityRows(stats);

  const clubColumns: DataColumn<NormalSummary>[] = [
    { key: 'club', header: 'Klub', tablet: true, cell: (c) => <Typography sx={{ fontWeight: 600 }}>{c.clubName}</Typography> },
    { key: 'seats', header: 'Hráčů', tablet: true, align: 'right', cell: (c) => nf(c.totalSeats) },
    { key: 'registered', header: 'Zapsáno', tablet: true, cell: (c) => <SeatsBar registered={c.registered} seats={c.totalSeats} /> },
    { key: 'remaining', header: 'Ještě chybí', align: 'right', cell: (c) => nf(c.remaining) },
    {
      key: 'orders', header: 'Objednávky',
      cell: (c) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(['Requested', 'Confirmed', 'Completed', 'Cancelled', 'Invited'] as const)
            .filter((k) => c.ordersByStatus[k] > 0)
            .map((k) => (
              <StatusChip key={k} size="sm" tone={k === 'Confirmed' ? 'green' : k === 'Cancelled' ? 'grey' : k === 'Requested' ? 'beige' : 'blue'}>
                {STATUS_SHORT[k]} {c.ordersByStatus[k]}
              </StatusChip>
            ))}
        </Box>
      ),
    },
    { key: 'occupancy', header: 'Kapacita', align: 'right', cell: (c) => percentText(occupancyPercent(c)) },
  ];

  const clubCard = (c: NormalSummary) => (
    <Box>
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{c.clubName}</Typography>
      <SeatsBar registered={c.registered} seats={c.totalSeats} label={`Zapsáno ${c.registered} z ${c.totalSeats} · chybí ${c.remaining}`} />
    </Box>
  );

  const serviceColumns: DataColumn<ServiceRow>[] = [
    { key: 'name', header: 'Služba', tablet: true, cell: (s) => <Typography sx={{ fontWeight: 600 }}>{s.serviceName}</Typography> },
    { key: 'seats', header: 'Hráčů', tablet: true, align: 'right', cell: (s) => nf(s.seats) },
    { key: 'registered', header: 'Zapsáno', tablet: true, align: 'right', cell: (s) => nf(s.registered) },
    { key: 'remaining', header: 'Chybí', align: 'right', cell: (s) => nf(s.remaining) },
  ];
  const activityColumns: DataColumn<ActivityRow>[] = [
    { key: 'name', header: 'Činnost', tablet: true, cell: (a) => <Typography sx={{ fontWeight: 600 }}>{a.activityName}</Typography> },
    { key: 'service', header: 'Služba', cell: (a) => a.serviceName },
    { key: 'seats', header: 'Hráčů', tablet: true, align: 'right', cell: (a) => nf(a.seats) },
    { key: 'registered', header: 'Zapsáno', tablet: true, align: 'right', cell: (a) => nf(a.registered) },
    { key: 'remaining', header: 'Chybí', align: 'right', cell: (a) => nf(a.remaining) },
  ];

  const clubChartData = clubs.map((c) => ({ label: c.clubName ?? '', Zapsáno: c.registered, Chybí: c.remaining }));
  const charts: ChartDef[] = [
    {
      id: 'club-seats', group: 'patients', title: 'Obsazení míst podle klubu', loading: false,
      empty: clubChartData.length === 0 ? 'Žádné kluby v tomto období.' : null,
      columns: ['Klub', 'Zapsáno', 'Chybí'],
      rows: clubChartData.map((d) => [d.label, d.Zapsáno, d.Chybí]),
      chart: (
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT - 20, 44 * clubChartData.length + 60)}>
          <BarChart data={clubChartData} layout="vertical" margin={{ left: 8, right: phone ? 8 : 24 }}>
            <CartesianGrid stroke={DESIGN.line} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={axis} stroke={DESIGN.line} />
            <YAxis type="category" dataKey="label" width={phone ? 96 : 140} tick={axis} stroke={DESIGN.line} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Zapsáno" stackId="s" fill={theme.palette.primary.main} />
            <Bar dataKey="Chybí" stackId="s" fill={DESIGN.tone.beige.line} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      id: 'activity-seats', group: 'patients', title: 'Hráči podle činnosti', loading: false,
      empty: activities.length === 0 ? 'Žádné činnosti v tomto období.' : null,
      columns: ['Činnost', 'Hráčů'],
      rows: activities.map((a) => [a.activityName, a.seats]),
      chart: (
        <HorizontalBars
          data={activities.map((a) => ({ label: a.activityName, count: a.seats }))}
          dataKey="count" name="Hráčů" fill={theme.palette.primary.main} axis={axis}
        />
      ),
    },
  ];

  return (
    <Box>
      <Box
        data-testid="club-kpis"
        sx={{ display: 'grid', gap: 1.5, mb: 3, gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        <KpiCard label="Kluby" value={nf(kpi.clubs)} />
        <KpiCard label="Objednávky" value={nf(kpi.orders)} hint="bez zrušených" />
        <KpiCard label="Hráči celkem" value={nf(kpi.players)} />
        <KpiCard label="Zapsáno" value={nf(kpi.registered)} tone="green" />
        <KpiCard label="Ještě chybí" value={nf(kpi.remaining)} tone={kpi.remaining > 0 ? 'red' : 'ink'} />
        <KpiCard label="Obsazená kapacita" value={percentText(kpi.occupancy)} tone="primary" hint="hodiny oken využité hráči" />
      </Box>

      <SectionLabel component="h2" sx={{ mb: 1.5 }}>Podle klubu</SectionLabel>
      <Box sx={{ mb: 3 }}>
        <ResponsiveDataList rows={clubs} rowKey={(c) => c.clubId || c.clubName || ''} columns={clubColumns} renderCard={clubCard} ariaLabel="Statistiky podle klubu" empty="Žádné kluby v tomto období." />
      </Box>

      <ChartGrid title="Grafy">
        {charts.map((def) => <ChartCard key={def.id} def={def} period={period} />)}
      </ChartGrid>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
        <Box>
          <SectionLabel component="h2" sx={{ mb: 1.5 }}>Podle služby</SectionLabel>
          <ResponsiveDataList rows={services} rowKey={(s) => s.serviceName} columns={serviceColumns} ariaLabel="Statistiky podle služby" empty="Žádné služby." renderCard={(s) => (
            <SeatsBar registered={s.registered} seats={s.seats} label={`${s.serviceName} · ${s.registered} / ${s.seats}`} />
          )} />
        </Box>
        <Box>
          <SectionLabel component="h2" sx={{ mb: 1.5 }}>Podle činnosti</SectionLabel>
          <ResponsiveDataList rows={activities} rowKey={(a) => `${a.serviceName}|${a.activityName}`} columns={activityColumns} ariaLabel="Statistiky podle činnosti" empty="Žádné činnosti." renderCard={(a) => (
            <SeatsBar registered={a.registered} seats={a.seats} label={`${a.activityName} · ${a.registered} / ${a.seats}`} />
          )} />
        </Box>
      </Box>
    </Box>
  );
}

const STATUS_SHORT = { Invited: 'Čeká', Requested: 'Odesláno', Confirmed: 'Potvrzeno', Completed: 'Dokončeno', Cancelled: 'Zrušeno' } as const;

export default ClubStatsView;
