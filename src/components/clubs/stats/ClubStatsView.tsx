/*
 * The body of Statistiky klubů: KPI cards, the per-club table, the per-service and per-činnost tables and two
 * charts. Takes the stats answer as data; fetching, range and export live in the page.
 *
 * It is one screen (the owner's rule: a page does not scroll up and down). On a desktop at least 1280 x 740 the
 * panels share a grid that uses the width - the clubs table and a chart over the services, činnosti and the other chart
 * - and every table or chart scrolls INSIDE its panel when it has more rows than room (sticky head). A tablet, a short
 * laptop window and a phone show one group at a time, chosen with a segmented control, and that group fills the screen.
 * A phone is not forced into the window's height: its panels stack and the page region scrolls.
 */
import { useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ClubOrderStats } from '../../../api/clubOrders';
import { FilterChips, SectionLabel, StatusChip } from '../../ui';
import { cardSurface } from '../../../ui/shelf/shelfStyle';
import { FIT_FILL_SX } from '../../ui/fit';
import { alpha } from '@mui/material/styles';
import { DARK, DESIGN, TONE_CSS, darkOf, toneColors } from '../../../theme';
import { ResponsiveDataList, type DataColumn } from '../../ui/ResponsiveDataList';
import { useIsPhone } from '../../../layout/useDevice';
import type { Period } from '../../../pages/statistics/aggregate';
import { FitSection as Section, SeatsBar } from '../../../pages/clubs/subpages/common';
import { priceText } from '../orders/orderMoney';
import { StatsChartPanel, type StatsChart } from './StatsChartPanel';
import {
  activityRows, clubRows, occupancyPercent, percentText, serviceRows, statsKpis,
  type ActivityRow, type ClubRevenue, type NormalSummary, type ServiceRow,
} from './statsMath';

/** A KPI that costs one short line of height (a phone keeps the board's KpiCard): label over figure, the hint in the tooltip. */
function StatKpi({ label, value, hint, tone = 'ink' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'ink' | 'red' | 'green' | 'primary' }) {
  return (
    <Box title={hint} data-card="metric" sx={(t) => ({ ...cardSurface(t, false), p: 1.5 })}>
      <SectionLabel sx={{ mb: 0.25, fontSize: 11, lineHeight: 1.3 }}>{label}</SectionLabel>
      <Typography
        sx={(t) => ({
          fontSize: 'clamp(17px, 1.5vw, 24px)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap',
          color: tone === 'red' ? toneColors(t, 'red').fg : tone === 'green' ? toneColors(t, 'green').fg : tone === 'primary' ? 'primary.main' : 'text.primary',
        })}
      >
        {value}
      </Typography>
    </Box>
  );
}

const nf = (v: number): string => v.toLocaleString('cs-CZ');

/** A desktop window with the room for the grid of panels; anything smaller shows one group at a time. */
const GRID_QUERY = '(min-width: 1280px) and (min-height: 740px)';

type Group = 'clubs' | 'charts' | 'tables';
const GROUPS: { key: Group; label: string }[] = [
  { key: 'clubs', label: 'Podle klubu' },
  { key: 'charts', label: 'Grafy' },
  { key: 'tables', label: 'Služby a činnosti' },
];

export function ClubStatsView({ stats, period, revenue = null, revenueLoading = false }: {
  stats: ClubOrderStats;
  period: Period;
  /** Etapa 12: the live orders' totals of the same period; null when the orders list did not load. */
  revenue?: ClubRevenue | null;
  revenueLoading?: boolean;
}) {
  const theme = useTheme();
  const phone = useIsPhone();
  const grid = useMediaQuery(GRID_QUERY);
  const [group, setGroup] = useState<Group>('clubs');
  const axis = { fontSize: 12, fill: theme.palette.text.secondary };
  const dark = theme.palette.mode === 'dark';
  const gridLine = dark ? theme.palette.divider : DESIGN.line;
  const missingFill = dark ? DARK.amber : TONE_CSS.beige.line;
  const tooltipStyle = dark
    ? { contentStyle: { background: theme.palette.background.paper, border: '1px solid ' + theme.palette.divider, borderRadius: 8, color: theme.palette.text.primary }, cursor: { fill: alpha(darkOf(theme).cyan, 0.08) } }
    : {};
  const kpi = statsKpis(stats);
  const clubs = clubRows(stats);
  const services = serviceRows(stats);
  const activities = activityRows(stats);
  const clubRevenueText = (c: NormalSummary): string => (revenueLoading ? '…' : revenue === null ? '—' : priceText(revenue.byClub.get(c.clubId) ?? null));

  const clubColumns: DataColumn<NormalSummary>[] = [
    { key: 'club', header: 'Klub', tablet: true, cell: (c) => <Typography sx={{ fontWeight: 600 }}>{c.clubName}</Typography> },
    { key: 'seats', header: 'Hráčů', align: 'right', cell: (c) => nf(c.totalSeats) },
    { key: 'registered', header: 'Zapsáno', tablet: true, cell: (c) => <SeatsBar registered={c.registered} seats={c.totalSeats} /> },
    { key: 'remaining', header: 'Ještě chybí', align: 'right', cell: (c) => nf(c.remaining) },
    { key: 'revenue', header: 'Objednáno', tablet: true, align: 'right', cell: (c) => <span data-testid="club-revenue">{clubRevenueText(c)}</span> },
    {
      key: 'orders', header: 'Objednávky',
      cell: (c) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(['Requested', 'Confirmed', 'Completed', 'Invited'] as const)
            .filter((k) => c.ordersByStatus[k] > 0)
            .map((k) => (
              <StatusChip key={k} size="sm" tone={k === 'Confirmed' ? 'green' : k === 'Requested' ? 'beige' : 'blue'}>
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
      <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="club-revenue">{`Objednáno ${clubRevenueText(c)}`}</Typography>
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
  const clubSeatsChart: StatsChart = {
    id: 'club-seats', title: 'Obsazení míst podle klubu',
    empty: clubChartData.length === 0 ? 'Žádné kluby v tomto období.' : null,
    columns: ['Klub', 'Zapsáno', 'Chybí'],
    rows: clubChartData.map((d) => [d.label, d.Zapsáno, d.Chybí]),
    categories: clubChartData.length,
    render: () => (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={clubChartData} layout="vertical" margin={{ left: 8, right: phone ? 8 : 24 }}>
          <CartesianGrid stroke={gridLine} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={axis} stroke={gridLine} />
          <YAxis type="category" dataKey="label" width={phone ? 96 : 140} tick={axis} stroke={gridLine} interval={0} />
          <Tooltip {...tooltipStyle} />
          <Legend formatter={(value) => <span style={{ color: theme.palette.text.primary }}>{value}</span>} />
          <Bar dataKey="Zapsáno" stackId="s" fill={theme.palette.primary.main} />
          <Bar dataKey="Chybí" stackId="s" fill={missingFill} />
        </BarChart>
      </ResponsiveContainer>
    ),
  };
  const activityChartData = activities.map((a) => ({ label: a.activityName, count: a.seats }));
  const activitySeatsChart: StatsChart = {
    id: 'activity-seats', title: 'Hráči podle činnosti',
    empty: activities.length === 0 ? 'Žádné činnosti v tomto období.' : null,
    columns: ['Činnost', 'Hráčů'],
    rows: activities.map((a) => [a.activityName, a.seats]),
    categories: activityChartData.length,
    render: () => (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={activityChartData} layout="vertical" margin={{ left: 8, right: phone ? 8 : 24 }}>
          <CartesianGrid stroke={gridLine} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={axis} stroke={gridLine} minTickGap={16} />
          <YAxis
            type="category" dataKey="label" width={phone ? 96 : 150} tick={axis} stroke={gridLine} interval={0}
            tickFormatter={(v: string) => (phone && v.length > 14 ? `${v.slice(0, 13)}…` : v)}
          />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" name="Hráčů" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ),
  };

  const fill = !phone;
  const Kpi = StatKpi;
  const kpis = (
    <Box
      data-testid="club-kpis"
      sx={{
        display: 'grid',
        gap: 1.5,
        flexShrink: 0,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' },
        /* seven cards: on a phone and a tablet the last one takes the cells that would be empty (2 + 2 + 2 + 1, 4 + 3) */
        '& > :last-child': { gridColumn: { xs: 'span 2', lg: 'auto' } },
      }}
    >
      <Kpi label="Kluby" value={nf(kpi.clubs)} />
      <Kpi label="Objednávky" value={nf(kpi.orders)} hint="bez zrušených" />
      <Kpi label="Hráči celkem" value={nf(kpi.players)} />
      <Kpi label="Zapsáno" value={nf(kpi.registered)} tone="green" />
      <Kpi label="Ještě chybí" value={nf(kpi.remaining)} tone={kpi.remaining > 0 ? 'red' : 'ink'} />
      <Kpi label="Obsazená kapacita" value={percentText(kpi.occupancy)} tone="primary" hint="hodiny oken využité hráči" />
      <Kpi
        label="Objednáno"
        value={<span data-testid="revenue-total">{revenueLoading ? '…' : revenue === null ? '—' : priceText(revenue.totalCzk)}</span>}
        hint={revenue === null && !revenueLoading ? 'objednávky se nenačetly' : 'živé objednávky, po slevě'}
      />
    </Box>
  );

  const clubsList = (
    <ResponsiveDataList fill={fill} rows={clubs} rowKey={(c) => c.clubId || c.clubName || ''} columns={clubColumns} renderCard={clubCard} ariaLabel="Statistiky podle klubu" empty="Žádné kluby v tomto období." />
  );
  const servicesList = (
    <ResponsiveDataList fill={fill} rows={services} rowKey={(s) => s.serviceName} columns={serviceColumns} ariaLabel="Statistiky podle služby" empty="Žádné služby." renderCard={(s) => (
      <SeatsBar registered={s.registered} seats={s.seats} label={`${s.serviceName} · ${s.registered} / ${s.seats}`} />
    )} />
  );
  const activitiesList = (
    <ResponsiveDataList fill={fill} rows={activities} rowKey={(a) => `${a.serviceName}|${a.activityName}`} columns={activityColumns} ariaLabel="Statistiky podle činnosti" empty="Žádné činnosti." renderCard={(a) => (
      <SeatsBar registered={a.registered} seats={a.seats} label={`${a.activityName} · ${a.registered} / ${a.seats}`} />
    )} />
  );

  const rootSx = { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, ...(phone ? {} : { ...FIT_FILL_SX }) } as const;

  if (grid) {
    return (
      <Box data-layout="grid" sx={rootSx}>
        {kpis}
        <Box
          sx={{
            ...FIT_FILL_SX,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridTemplateRows: 'minmax(0, 1.15fr) minmax(0, 1fr)',
            gridTemplateAreas: '"clubs clubs clubs clubs clubs clubs clubs clubs seats seats seats seats" "services services services services activities activities activities activities activities chart chart chart"',
            /* tight cells: the tables are panels of a screen, not pages of their own */
            '& .MuiTableCell-root': { px: 1.25, py: 0.9 },
          }}
        >
          <Section title="Podle klubu" area="clubs">{clubsList}</Section>
          <Box sx={{ gridArea: 'seats', minHeight: 0, display: 'flex', flexDirection: 'column' }}><StatsChartPanel chart={clubSeatsChart} period={period} /></Box>
          <Section title="Podle služby" area="services">{servicesList}</Section>
          <Section title="Podle činnosti" area="activities">{activitiesList}</Section>
          <Box sx={{ gridArea: 'chart', minHeight: 0, display: 'flex', flexDirection: 'column' }}><StatsChartPanel chart={activitySeatsChart} period={period} /></Box>
        </Box>
      </Box>
    );
  }

  /* One group at a time; the group fills the screen under the control (a phone's stacks and the region scrolls). */
  const paneSx = phone
    ? { display: 'flex', flexDirection: 'column', gap: 2 }
    : { ...FIT_FILL_SX, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gridAutoRows: 'minmax(0, 1fr)' };
  return (
    <Box data-layout={phone ? 'stack' : 'tabs'} sx={rootSx}>
      {kpis}
      <FilterChips<Group> ariaLabel="Část statistik" options={GROUPS} value={group} onChange={setGroup} />
      <Box sx={paneSx}>
        {group === 'clubs' ? <Section title="Podle klubu">{clubsList}</Section> : null}
        {group === 'charts' ? (
          <>
            <StatsChartPanel chart={clubSeatsChart} period={period} />
            <StatsChartPanel chart={activitySeatsChart} period={period} />
          </>
        ) : null}
        {group === 'tables' ? (
          <>
            <Section title="Podle služby">{servicesList}</Section>
            <Section title="Podle činnosti">{activitiesList}</Section>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

const STATUS_SHORT = { Invited: 'Čeká', Requested: 'Odesláno', Confirmed: 'Potvrzeno', Completed: 'Dokončeno', Cancelled: 'Zrušeno' } as const;

export default ClubStatsView;
