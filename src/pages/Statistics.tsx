/*
 * Statistiky - "statistics for everything, in one place; I choose which -
 * financial, bookings, patients - and see charts that show growth or decline"
 * (Matko, 3. 10. 2026).
 *
 * One screen, three areas, one period. Every figure is worked out on the
 * client in `statistics/aggregate.ts` from the lists the API already answers -
 * there is no aggregate endpoint yet - and every request is bounded: the
 * appointments come a calendar month at a time (the range call allows 62
 * days), the register a page of a hundred at a time up to a stated ceiling,
 * and the invoices as the one list Fakturace reads.
 *
 * Each chart has a table of its numbers behind a toggle and a CSV of the
 * period, because a chart answers "is it growing" and a table answers "by how
 * much, exactly", and the účetní wants the second one in Excel. The page
 * itself exports everything on screen in one file (`statistics/csv.ts`).
 *
 * Three layouts (Etapa 2, rule 3):
 *   phone    charts stacked one per row, the three areas are scrollable tabs,
 *            the filters are 44px controls, the export is pinned at the bottom
 *   tablet   chart cards in a grid that fits (one column portrait, two landscape)
 *   desktop  two-column grid of chart cards, the areas as chips with "Vše"
 */
import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Skeleton, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { appointmentsApi } from '../api/appointments';
import { billingApi } from '../api/billing';
import { calendarsApi } from '../api/calendars';
import { patientsApi, PATIENT_PAGE_SIZE_MAX, type Patient } from '../api/patients';
import type { DayAppointment } from '../api/bookingContracts';
import { toDateOnly, type DateOnly } from '../utils/time';
import { DESIGN, FilterChips, KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip } from '../components/ui';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';
import {
  GROUPING_OPTIONS, PERIOD_OPTIONS, STATUS_GROUPS,
  appointmentsPerBucket, averagePerInvoice, bucketsFor, byActivity, byCalendar,
  cumulativeRegister, dayOfAppointment, deltaLabel, deltaPercent, financePerBucket, formatCount,
  formatCzk, formatPeriod, inPeriod, invoicedTotal, invoicesIn, isCancelled, monthChunks,
  newPatientsPerBucket, newVsReturning, paidTotal, periodFor, previousPeriod, revenueByItem,
  unpaidTotal,
} from './statistics/aggregate';
import type { Grouping, PeriodKey } from './statistics/aggregate';
import { buildStatisticsCsv, downloadCsv, statisticsCsvFileName } from './statistics/csv';
import {
  CHART_HEIGHT, ChartCard, ChartGrid, HorizontalBars, isExportable,
  type ChartDef, type StatisticsGroup,
} from './statistics/StatisticsCharts';

type Area = 'all' | StatisticsGroup;

const GROUPS: { key: StatisticsGroup; label: string }[] = [
  { key: 'appointments', label: 'Objednávky' },
  { key: 'patients', label: 'Pacienti' },
  { key: 'finance', label: 'Finance' },
];
const AREAS: { key: Area; label: string }[] = [...GROUPS, { key: 'all', label: 'Vše' }];

/**
 * How much of the register the patient statistics read: a hundred a page,
 * thirty pages. A clinic past three thousand records sees a note saying the
 * patient numbers stop there, rather than a silent undercount.
 */
export const MAX_PATIENT_PAGES = 30;

async function fetchRegister(): Promise<{ patients: Patient[]; totalCount: number; truncated: boolean }> {
  const first = await patientsApi.list({ page: 1, pageSize: PATIENT_PAGE_SIZE_MAX });
  const pages = Math.ceil(first.totalCount / PATIENT_PAGE_SIZE_MAX);
  const wanted = Math.min(pages, MAX_PATIENT_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, wanted - 1) }, (_, i) =>
      patientsApi.list({ page: i + 2, pageSize: PATIENT_PAGE_SIZE_MAX }),
    ),
  );
  return {
    patients: [...first.items, ...rest.flatMap((p) => p.items)],
    totalCount: first.totalCount,
    truncated: pages > MAX_PATIENT_PAGES,
  };
}

/** The status series' colours - the board's tones, one per column, no gradients. */
const STATUS_COLOURS: Record<(typeof STATUS_GROUPS)[number]['key'], string> = {
  booked: DESIGN.tone.grey.fg,
  confirmed: DESIGN.tone.blue.fg,
  done: DESIGN.tone.green.fg,
  cancelled: DESIGN.tone.red.fg,
  noShow: DESIGN.tone.beige.fg,
};

export default function StatisticsPage() {
  const theme = useTheme();
  const device = useDevice();
  const phone = device === 'phone';
  const today = toDateOnly(new Date());

  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth');
  const [customFrom, setCustomFrom] = useState<DateOnly>(periodFor('thisMonth', today).from);
  const [customTo, setCustomTo] = useState<DateOnly>(today);
  const [grouping, setGrouping] = useState<Grouping>('day');
  const [areaChoice, setArea] = useState<Area>('all');
  /* A phone has no "Vše": three tabs, one area at a time (the first until one is picked). */
  const area: Area = phone && areaChoice === 'all' ? 'appointments' : areaChoice;

  const period = useMemo(
    () => periodFor(periodKey, today, { from: customFrom, to: customTo }),
    [periodKey, today, customFrom, customTo],
  );
  const previous = useMemo(() => previousPeriod(period), [period]);
  const buckets = useMemo(() => bucketsFor(period, grouping), [period, grouping]);

  /* ── The data, each source bounded and failing on its own ── */

  const chunks = useMemo(() => monthChunks(previous.from, period.to), [previous.from, period.to]);
  const appointmentQueries = useQueries({
    queries: chunks.map((c) => ({
      queryKey: ['stats-appointments', c.from, c.to],
      queryFn: () => appointmentsApi.range(c.from, c.to),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const appointmentsLoading = appointmentQueries.some((q) => q.isPending);
  const appointmentsFailed = appointmentQueries.some((q) => q.isError);
  const appointments: DayAppointment[] = appointmentQueries.flatMap((q) => q.data ?? []);

  const registerQuery = useQuery({ queryKey: ['stats-register'], queryFn: fetchRegister, staleTime: 5 * 60 * 1000 });
  const invoicesQuery = useQuery({ queryKey: ['stats-invoices'], queryFn: () => billingApi.getInvoices(), staleTime: 5 * 60 * 1000 });
  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });

  const patients = registerQuery.data?.patients ?? [];
  const invoices = invoicesQuery.data ?? [];
  const calendars = calendarsQuery.data ?? [];

  /* ── The arithmetic ── */

  const inThis = (a: DayAppointment) => inPeriod(dayOfAppointment(a), period);
  const inPrev = (a: DayAppointment) => inPeriod(dayOfAppointment(a), previous);
  const visitsNow = appointments.filter((a) => inThis(a) && !isCancelled(a));
  const visitsBefore = appointments.filter((a) => inPrev(a) && !isCancelled(a));
  const doneNow = visitsNow.filter((a) => a.status === 2 || a.status === 3).length;
  const doneBefore = visitsBefore.filter((a) => a.status === 2 || a.status === 3).length;
  const lostNow = appointments.filter((a) => inThis(a) && (a.status === 4 || a.status === 5)).length;
  const lostBefore = appointments.filter((a) => inPrev(a) && (a.status === 4 || a.status === 5)).length;

  const statusRows = appointmentsPerBucket(appointments.filter(inThis), buckets);
  const activityRows = byActivity(appointments.filter(inThis));
  const calendarRows = byCalendar(appointments.filter(inThis), calendars);

  const newNow = newPatientsPerBucket(patients, buckets);
  const newNowTotal = newNow.reduce((n, x) => n + x, 0);
  const newBeforeTotal = newPatientsPerBucket(patients, bucketsFor(previous, 'month')).reduce((n, x) => n + x, 0);
  const register = cumulativeRegister(patients, buckets);
  const mix = newVsReturning(appointments, patients, period);

  const invoicesNow = invoicesIn(invoices, period);
  const invoicesBefore = invoicesIn(invoices, previous);
  const financeRows = financePerBucket(invoicesNow, buckets);
  const revenueRows = revenueByItem(invoicesNow);
  const average = averagePerInvoice(invoicesNow);

  const showAppointments = area === 'all' || area === 'appointments';
  const showPatients = area === 'all' || area === 'patients';
  const showFinance = area === 'all' || area === 'finance';

  const accent = theme.palette.primary.main;
  const axis = { fontSize: 12, fill: theme.palette.text.secondary };
  const tickGap = 16;

  const retryAppointments = () => appointmentQueries.forEach((q) => { if (q.isError) void q.refetch(); });
  const retryRegister = () => void registerQuery.refetch();
  const retryInvoices = () => void invoicesQuery.refetch();

  const failures: { what: string; retry: () => void }[] = [];
  if (appointmentsFailed) failures.push({ what: 'objednávky', retry: retryAppointments });
  if (registerQuery.isError) failures.push({ what: 'kartotéku', retry: retryRegister });
  if (invoicesQuery.isError) failures.push({ what: 'doklady', retry: retryInvoices });

  /* ── The charts, each described once: what the card draws and what the CSV exports ── */

  const noBookings = 'Za zvolené období zatím nic. Objednávky se tu objeví, jakmile nějaké budou.';
  const noPatients = 'Za zvolené období zatím nic. Nové registrace se tu objeví, jakmile nějaké budou.';
  const noInvoices = 'Zatím žádné doklady v tomto období.';

  const appointmentsBase = { group: 'appointments' as const, loading: appointmentsLoading, failed: appointmentsFailed, retry: retryAppointments };
  const patientsBase = { group: 'patients' as const, loading: registerQuery.isPending, failed: registerQuery.isError, retry: retryRegister };
  const financeBase = { group: 'finance' as const, loading: invoicesQuery.isPending, failed: invoicesQuery.isError, retry: retryInvoices };

  const charts: ChartDef[] = [
    {
      ...appointmentsBase,
      id: 'appointments-over-time',
      title: 'Objednávky v čase',
      subtitle: 'Všechny termíny v období, včetně zrušených',
      empty: statusRows.every((r) => r.total === 0) ? noBookings : null,
      columns: ['Období', 'Objednávky'],
      rows: statusRows.map((r) => [r.label, r.total]),
      chart: (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={statusRows}>
            <CartesianGrid stroke={DESIGN.line} vertical={false} />
            <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} minTickGap={tickGap} />
            <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
            <Tooltip />
            <Line type="monotone" dataKey="total" name="Objednávky" stroke={accent} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      ...appointmentsBase,
      id: 'appointments-by-status',
      title: 'Podle stavu',
      subtitle: 'Objednáno · Potvrzeno · Dokončeno · Zrušeno · Nepřišel',
      empty: statusRows.every((r) => r.total === 0) ? noBookings : null,
      columns: ['Období', ...STATUS_GROUPS.map((g) => g.label)],
      rows: statusRows.map((r) => [r.label, ...STATUS_GROUPS.map((g) => r[g.key])]),
      chart: (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={statusRows}>
            <CartesianGrid stroke={DESIGN.line} vertical={false} />
            <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} minTickGap={tickGap} />
            <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
            <Tooltip />
            <Legend />
            {STATUS_GROUPS.map((g) => (
              <Bar key={g.key} dataKey={g.key} name={g.label} stackId="s" fill={STATUS_COLOURS[g.key]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      ...appointmentsBase,
      id: 'appointments-by-activity',
      title: 'Podle činnosti',
      subtitle: 'Osm nejčastějších, bez zrušených',
      empty: activityRows.length === 0 ? noBookings : null,
      columns: ['Činnost', 'Objednávky'],
      rows: activityRows.map((r) => [r.label, r.count]),
      chart: <HorizontalBars data={activityRows} dataKey="count" name="Objednávky" fill={accent} axis={axis} />,
    },
    {
      ...appointmentsBase,
      id: 'appointments-by-calendar',
      title: 'Podle kalendáře',
      subtitle: 'Bez zrušených',
      loading: appointmentsLoading || calendarsQuery.isPending,
      empty: calendarRows.length === 0 ? noBookings : null,
      columns: ['Kalendář', 'Objednávky'],
      rows: calendarRows.map((r) => [r.label, r.count]),
      chart: <HorizontalBars data={calendarRows} dataKey="count" name="Objednávky" fill={accent} axis={axis} />,
    },
    {
      ...patientsBase,
      id: 'patients-new',
      title: 'Nové registrace',
      subtitle: 'Podle data založení karty',
      empty: newNowTotal === 0 ? noPatients : null,
      columns: ['Období', 'Noví pacienti'],
      rows: buckets.map((b, i) => [b.label, newNow[i]]),
      chart: (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={buckets.map((b, i) => ({ label: b.label, count: newNow[i] }))}>
            <CartesianGrid stroke={DESIGN.line} vertical={false} />
            <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} minTickGap={tickGap} />
            <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
            <Tooltip />
            <Bar dataKey="count" name="Noví pacienti" fill={accent} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      ...patientsBase,
      id: 'patients-register-size',
      title: 'Velikost kartotéky',
      subtitle: 'Počet karet ke konci každého období',
      empty: patients.length === 0 ? 'Kartotéka je zatím prázdná.' : null,
      columns: ['Období', 'Karet celkem'],
      rows: buckets.map((b, i) => [b.label, register[i]]),
      chart: (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={buckets.map((b, i) => ({ label: b.label, count: register[i] }))}>
            <CartesianGrid stroke={DESIGN.line} vertical={false} />
            <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} minTickGap={tickGap} />
            <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={40} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Karet celkem" stroke={accent} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      ...patientsBase,
      id: 'patients-new-vs-returning',
      title: 'Noví a vracející se',
      subtitle:
        mix.unknown > 0
          ? `Pacienti s návštěvou v období · ${formatCount(mix.unknown)} bez karty v načtené kartotéce`
          : 'Pacienti s návštěvou v období, každý jednou',
      loading: registerQuery.isPending || appointmentsLoading,
      failed: registerQuery.isError || appointmentsFailed,
      retry: () => { retryRegister(); retryAppointments(); },
      empty: mix.newPatients + mix.returning === 0 ? 'Za zvolené období zatím nic. Návštěvy pacientů se tu objeví, jakmile nějaké budou.' : null,
      columns: ['Skupina', 'Pacienti'],
      rows: [['Noví', mix.newPatients], ['Vracející se', mix.returning]],
      chart: (
        <HorizontalBars
          data={[{ label: 'Noví', count: mix.newPatients }, { label: 'Vracející se', count: mix.returning }]}
          dataKey="count"
          name="Pacienti"
          fill={accent}
          axis={axis}
          height={140}
        />
      ),
    },
    {
      ...financeBase,
      id: 'finance-invoiced-paid',
      title: 'Vyfakturováno a zaplaceno',
      subtitle: 'Podle data vystavení dokladu, bez zrušených a vrácených',
      empty: financeRows.every((r) => r.invoiced === 0 && r.paid === 0) ? noInvoices : null,
      columns: ['Období', 'Vyfakturováno (Kč)', 'Zaplaceno (Kč)'],
      rows: financeRows.map((r) => [r.label, r.invoiced, r.paid]),
      chart: (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={financeRows}>
            <CartesianGrid stroke={DESIGN.line} vertical={false} />
            <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} minTickGap={tickGap} />
            <YAxis tick={axis} stroke={DESIGN.line} width={phone ? 52 : 64} tickFormatter={(v: number) => v.toLocaleString('cs-CZ')} />
            <Tooltip formatter={(v) => formatCzk(Number(v))} />
            <Legend />
            <Bar dataKey="invoiced" name="Vyfakturováno" fill={accent} />
            <Bar dataKey="paid" name="Zaplaceno" fill={DESIGN.tone.green.fg} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      ...financeBase,
      id: 'finance-revenue-by-item',
      title: 'Tržby podle činnosti',
      subtitle: 'Osm největších položek dokladů',
      empty: revenueRows.length === 0 ? noInvoices : null,
      columns: ['Činnost', 'Tržba (Kč)'],
      rows: revenueRows.map((r) => [r.label, r.amount]),
      chart: <HorizontalBars data={revenueRows} dataKey="amount" name="Tržba" fill={accent} axis={axis} money />,
    },
  ];


  const visibleGroups = GROUPS.filter((g) => area === 'all' || area === g.key);
  const shown = charts.filter((c) => area === 'all' || c.group === area);
  const exportable = shown.filter(isExportable);

  const exportShown = () => {
    const csv = buildStatisticsCsv(
      exportable.map((c) => ({ title: c.title, columns: c.columns, rows: c.rows })),
      period,
    );
    const label = area === 'all' ? 'Vše' : (GROUPS.find((g) => g.key === area)?.label ?? 'Vše');
    downloadCsv(statisticsCsvFileName(label, period), csv);
  };

  const exportButton = (
    <Button
      variant="contained"
      startIcon={<Download />}
      disabled={exportable.length === 0}
      onClick={exportShown}
      sx={{ minHeight: phone ? 44 : undefined }}
    >
      Exportovat zobrazené (CSV)
    </Button>
  );

  const target = phone ? { minHeight: 44 } : {};

  return (
    <Box data-device={device}>
      <PageHeader
        title="Statistiky"
        subtitle="Objednávky, pacienti a peníze v čase"
        actions={phone ? undefined : exportButton}
      />

      {/* ── Period · grouping · area ── */}
      <SoftCard sx={{ p: 2, mb: 2.5 }} data-region="filters">
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { lg: 'center' }, flexWrap: 'wrap', minWidth: 0 }}
        >
          <TextField
            select
            size={phone ? 'medium' : 'small'}
            label="Období"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
            sx={{ minWidth: phone ? 0 : 200 }}
            fullWidth={phone}
          >
            {PERIOD_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key} sx={target}>{o.label}</MenuItem>
            ))}
          </TextField>
          {periodKey === 'custom' ? (
            <Stack direction={phone ? 'column' : 'row'} spacing={1.5}>
              <TextField
                size={phone ? 'medium' : 'small'}
                type="date"
                label="Od"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size={phone ? 'medium' : 'small'}
                type="date"
                label="Do"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          ) : null}
          {/* A wide row scrolls inside its own box on a phone rather than pushing the page sideways. */}
          <Box sx={{ overflowX: 'auto', maxWidth: '100%', flexShrink: 0 }} data-scroll={phone ? 'x' : undefined}>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth={phone}
              value={grouping}
              onChange={(_e, next: Grouping | null) => { if (next) setGrouping(next); }}
              aria-label="Seskupení"
              sx={{ flexWrap: 'nowrap' }}
            >
              {GROUPING_OPTIONS.map((o) => (
                <ToggleButton key={o.key} value={o.key} sx={{ px: 2, whiteSpace: 'nowrap', ...target }}>{o.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ flex: 1 }} />
          {phone ? null : <FilterChips ariaLabel="Oblast" options={AREAS} value={area} onChange={setArea} />}
        </Stack>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1.5 }}>
          {formatPeriod(period)} · srovnání s {formatPeriod(previous)}
        </Typography>
      </SoftCard>

      {/* ── Phone: the three areas as tabs ── */}
      {phone ? (
        <Tabs
          value={area}
          onChange={(_e, next: StatisticsGroup) => setArea(next)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Oblast"
          sx={{ minHeight: 44, mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {GROUPS.map((g) => (
            <Tab key={g.key} value={g.key} label={g.label} sx={{ minHeight: 44, minWidth: 96, fontWeight: 600 }} />
          ))}
        </Tabs>
      ) : null}

      {failures.length > 0 ? (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={<Button color="inherit" size="small" sx={target} onClick={() => failures.forEach((f) => f.retry())}>Zkusit znovu</Button>}
        >
          Nepodařilo se načíst {failures.map((f) => f.what).join(', ')}. Ostatní čísla platí.
        </Alert>
      ) : null}
      {registerQuery.data?.truncated ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Kartotéka má {formatCount(registerQuery.data.totalCount)} záznamů; statistiky pacientů počítají prvních{' '}
          {formatCount(MAX_PATIENT_PAGES * PATIENT_PAGE_SIZE_MAX)}.
        </Alert>
      ) : null}

      {/* ── KPI row ── */}
      <Box
        data-layout={phone ? 'kpi-1up' : 'kpi'}
        sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}
      >
        {showAppointments ? (
          <Kpi label="Objednávky" value={formatCount(visitsNow.length)} loading={appointmentsLoading}
            delta={deltaPercent(visitsNow.length, visitsBefore.length)} />
        ) : null}
        {area === 'appointments' ? (
          <>
            <Kpi label="Dokončené návštěvy" value={formatCount(doneNow)} loading={appointmentsLoading}
              delta={deltaPercent(doneNow, doneBefore)} />
            <Kpi label="Zrušeno a nepřišel" value={formatCount(lostNow)} loading={appointmentsLoading}
              delta={deltaPercent(lostNow, lostBefore)} lowerIsBetter tone={lostNow > 0 ? 'red' : 'ink'} />
          </>
        ) : null}
        {showPatients ? (
          <Kpi label="Noví pacienti" value={formatCount(newNowTotal)} loading={registerQuery.isPending}
            delta={deltaPercent(newNowTotal, newBeforeTotal)} />
        ) : null}
        {area === 'patients' ? (
          <Kpi label="Velikost kartotéky" value={formatCount(register[register.length - 1] ?? 0)}
            loading={registerQuery.isPending} hint={`k ${formatPeriod({ from: period.to, to: period.to })}`} />
        ) : null}
        {showFinance ? (
          <Kpi label="Vyfakturováno" value={formatCzk(invoicedTotal(invoicesNow))} loading={invoicesQuery.isPending}
            delta={deltaPercent(invoicedTotal(invoicesNow), invoicedTotal(invoicesBefore))} />
        ) : null}
        {area === 'finance' ? (
          <Kpi label="Zaplaceno" value={formatCzk(paidTotal(invoicesNow))} loading={invoicesQuery.isPending}
            delta={deltaPercent(paidTotal(invoicesNow), paidTotal(invoicesBefore))} tone="green" />
        ) : null}
        {showFinance ? (
          <Kpi label="Nezaplaceno" value={formatCzk(unpaidTotal(invoicesNow))} loading={invoicesQuery.isPending}
            delta={deltaPercent(unpaidTotal(invoicesNow), unpaidTotal(invoicesBefore))} lowerIsBetter
            tone={unpaidTotal(invoicesNow) > 0 ? 'red' : 'ink'} />
        ) : null}
        {area === 'finance' ? (
          <Kpi label="Průměr na návštěvu" value={average === null ? '—' : formatCzk(average)}
            loading={invoicesQuery.isPending} hint="vyfakturováno / počet dokladů" />
        ) : null}
      </Box>

      {/* ── The charts, grouped: Objednávky · Pacienti · Finance ── */}
      {visibleGroups.map((g) => (
        <ChartGrid key={g.key} title={g.label}>
          {charts.filter((c) => c.group === g.key).map((c) => (
            <ChartCard key={c.id} def={c} period={period} />
          ))}
        </ChartGrid>
      ))}

      {/* ── The main action of a phone screen is pinned at the bottom ── */}
      {phone ? <PinnedActionBar label="Hlavní akce">{exportButton}</PinnedActionBar> : null}
    </Box>
  );
}

/* ── Pieces ── */

function Kpi({
  label, value, delta, loading, lowerIsBetter = false, tone = 'ink', hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  loading: boolean;
  lowerIsBetter?: boolean;
  tone?: 'ink' | 'red' | 'green' | 'primary';
  hint?: string;
}) {
  const change = delta === undefined ? null : deltaLabel(delta, lowerIsBetter);
  /* One named group per figure, so "the Objednávky number" can be pointed at. */
  return (
    <Box role="group" aria-label={label} sx={{ display: 'contents' }}>
      {loading ? (
        /* Same height as the real card, so the row does not jump when the number arrives. */
        <SoftCard sx={{ p: 2.25, minHeight: 112 }} aria-busy="true">
          <SectionLabel sx={{ mb: 0.75 }}>{label}</SectionLabel>
          <Skeleton width={96} height={32} />
        </SoftCard>
      ) : (
        <KpiCard
          label={label}
          value={value}
          tone={tone}
          hint={change ? <StatusChip tone={change.tone} size="sm">{change.text}</StatusChip> : hint}
        />
      )}
    </Box>
  );
}
