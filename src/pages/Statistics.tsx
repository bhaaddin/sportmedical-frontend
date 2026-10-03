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
 * much, exactly", and the účetní wants the second one in Excel.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
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
import {
  GROUPING_OPTIONS, PERIOD_OPTIONS, STATUS_GROUPS,
  appointmentsPerBucket, averagePerInvoice, bucketsFor, byActivity, byCalendar, csvFileName,
  cumulativeRegister, dayOfAppointment, deltaLabel, deltaPercent, financePerBucket, formatCount,
  formatCzk, formatPeriod, inPeriod, invoicedTotal, invoicesIn, isCancelled, monthChunks,
  newPatientsPerBucket, newVsReturning, paidTotal, periodFor, previousPeriod, revenueByItem,
  toCsv, unpaidTotal,
} from './statistics/aggregate';
import type { CsvCell, Grouping, Period, PeriodKey } from './statistics/aggregate';

type Area = 'all' | 'appointments' | 'patients' | 'finance';

const AREAS: { key: Area; label: string }[] = [
  { key: 'appointments', label: 'Objednávky' },
  { key: 'patients', label: 'Pacienti' },
  { key: 'finance', label: 'Finance' },
  { key: 'all', label: 'Vše' },
];

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
  const today = toDateOnly(new Date());

  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth');
  const [customFrom, setCustomFrom] = useState<DateOnly>(periodFor('thisMonth', today).from);
  const [customTo, setCustomTo] = useState<DateOnly>(today);
  const [grouping, setGrouping] = useState<Grouping>('day');
  const [area, setArea] = useState<Area>('all');

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

  const failures: { what: string; retry: () => void }[] = [];
  if (appointmentsFailed) {
    failures.push({
      what: 'objednávky',
      retry: () => appointmentQueries.forEach((q) => { if (q.isError) void q.refetch(); }),
    });
  }
  if (registerQuery.isError) failures.push({ what: 'kartotéku', retry: () => void registerQuery.refetch() });
  if (invoicesQuery.isError) failures.push({ what: 'doklady', retry: () => void invoicesQuery.refetch() });

  return (
    <Box>
      <PageHeader title="Statistiky" subtitle="Objednávky, pacienti a peníze v čase" />

      {/* ── Period · grouping · area ── */}
      <SoftCard sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { lg: 'center' }, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Období"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
            sx={{ minWidth: 200 }}
          >
            {PERIOD_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
            ))}
          </TextField>
          {periodKey === 'custom' ? (
            <>
              <TextField
                size="small"
                type="date"
                label="Od"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="date"
                label="Do"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          ) : null}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={grouping}
            onChange={(_e, next: Grouping | null) => { if (next) setGrouping(next); }}
            aria-label="Seskupení"
          >
            {GROUPING_OPTIONS.map((o) => (
              <ToggleButton key={o.key} value={o.key} sx={{ px: 2 }}>{o.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <FilterChips ariaLabel="Oblast" options={AREAS} value={area} onChange={setArea} />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          {formatPeriod(period)} · srovnání s {formatPeriod(previous)}
        </Typography>
      </SoftCard>

      {failures.length > 0 ? (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={<Button color="inherit" size="small" onClick={() => failures.forEach((f) => f.retry())}>Zkusit znovu</Button>}
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
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

      {/* ── Objednávky ── */}
      {showAppointments ? (
        <Section title="Objednávky">
          <ChartCard
            title="Objednávky v čase"
            subtitle="Všechny termíny v období, včetně zrušených"
            loading={appointmentsLoading}
            empty={statusRows.every((r) => r.total === 0) ? 'Zatím žádné objednávky v tomto období.' : null}
            columns={['Období', 'Objednávky']}
            rows={statusRows.map((r) => [r.label, r.total])}
            period={period}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={statusRows}>
                <CartesianGrid stroke={DESIGN.line} vertical={false} />
                <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} />
                <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="Objednávky" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Podle stavu"
            subtitle="Objednáno · Potvrzeno · Dokončeno · Zrušeno · Nepřišel"
            loading={appointmentsLoading}
            empty={statusRows.every((r) => r.total === 0) ? 'Zatím žádné objednávky v tomto období.' : null}
            columns={['Období', ...STATUS_GROUPS.map((g) => g.label)]}
            rows={statusRows.map((r) => [r.label, ...STATUS_GROUPS.map((g) => r[g.key])])}
            period={period}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusRows}>
                <CartesianGrid stroke={DESIGN.line} vertical={false} />
                <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} />
                <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
                <Tooltip />
                <Legend />
                {STATUS_GROUPS.map((g) => (
                  <Bar key={g.key} dataKey={g.key} name={g.label} stackId="s" fill={STATUS_COLOURS[g.key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Podle činnosti"
            subtitle="Osm nejčastějších, bez zrušených"
            loading={appointmentsLoading}
            empty={activityRows.length === 0 ? 'Zatím žádné objednávky v tomto období.' : null}
            columns={['Činnost', 'Objednávky']}
            rows={activityRows.map((r) => [r.label, r.count])}
            period={period}
          >
            <HorizontalBars data={activityRows} dataKey="count" name="Objednávky" fill={accent} axis={axis} />
          </ChartCard>

          <ChartCard
            title="Podle kalendáře"
            subtitle="Bez zrušených"
            loading={appointmentsLoading || calendarsQuery.isPending}
            empty={calendarRows.length === 0 ? 'Zatím žádné objednávky v tomto období.' : null}
            columns={['Kalendář', 'Objednávky']}
            rows={calendarRows.map((r) => [r.label, r.count])}
            period={period}
          >
            <HorizontalBars data={calendarRows} dataKey="count" name="Objednávky" fill={accent} axis={axis} />
          </ChartCard>
        </Section>
      ) : null}

      {/* ── Pacienti ── */}
      {showPatients ? (
        <Section title="Pacienti">
          <ChartCard
            title="Nové registrace"
            subtitle="Podle data založení karty"
            loading={registerQuery.isPending}
            empty={newNowTotal === 0 ? 'Zatím žádná nová registrace v tomto období.' : null}
            columns={['Období', 'Noví pacienti']}
            rows={buckets.map((b, i) => [b.label, newNow[i]])}
            period={period}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={buckets.map((b, i) => ({ label: b.label, count: newNow[i] }))}>
                <CartesianGrid stroke={DESIGN.line} vertical={false} />
                <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} />
                <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={32} />
                <Tooltip />
                <Bar dataKey="count" name="Noví pacienti" fill={accent} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Velikost kartotéky"
            subtitle="Počet karet ke konci každého období"
            loading={registerQuery.isPending}
            empty={patients.length === 0 ? 'Kartotéka je zatím prázdná.' : null}
            columns={['Období', 'Karet celkem']}
            rows={buckets.map((b, i) => [b.label, register[i]])}
            period={period}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={buckets.map((b, i) => ({ label: b.label, count: register[i] }))}>
                <CartesianGrid stroke={DESIGN.line} vertical={false} />
                <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} />
                <YAxis allowDecimals={false} tick={axis} stroke={DESIGN.line} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Karet celkem" stroke={accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Noví a vracející se"
            subtitle={
              mix.unknown > 0
                ? `Pacienti s návštěvou v období · ${formatCount(mix.unknown)} bez karty v načtené kartotéce`
                : 'Pacienti s návštěvou v období, každý jednou'
            }
            loading={registerQuery.isPending || appointmentsLoading}
            empty={mix.newPatients + mix.returning === 0 ? 'Zatím žádná návštěva pacienta v tomto období.' : null}
            columns={['Skupina', 'Pacienti']}
            rows={[['Noví', mix.newPatients], ['Vracející se', mix.returning]]}
            period={period}
          >
            <HorizontalBars
              data={[{ label: 'Noví', count: mix.newPatients }, { label: 'Vracející se', count: mix.returning }]}
              dataKey="count"
              name="Pacienti"
              fill={accent}
              axis={axis}
              height={140}
            />
          </ChartCard>
        </Section>
      ) : null}

      {/* ── Finance ── */}
      {showFinance ? (
        <Section title="Finance">
          <ChartCard
            title="Vyfakturováno a zaplaceno"
            subtitle="Podle data vystavení dokladu, bez zrušených a vrácených"
            loading={invoicesQuery.isPending}
            empty={financeRows.every((r) => r.invoiced === 0 && r.paid === 0) ? 'Zatím žádné doklady v tomto období.' : null}
            columns={['Období', 'Vyfakturováno (Kč)', 'Zaplaceno (Kč)']}
            rows={financeRows.map((r) => [r.label, r.invoiced, r.paid])}
            period={period}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={financeRows}>
                <CartesianGrid stroke={DESIGN.line} vertical={false} />
                <XAxis dataKey="label" tick={axis} stroke={DESIGN.line} />
                <YAxis tick={axis} stroke={DESIGN.line} width={64} tickFormatter={(v: number) => v.toLocaleString('cs-CZ')} />
                <Tooltip formatter={(v) => formatCzk(Number(v))} />
                <Legend />
                <Bar dataKey="invoiced" name="Vyfakturováno" fill={accent} />
                <Bar dataKey="paid" name="Zaplaceno" fill={DESIGN.tone.green.fg} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Tržby podle činnosti"
            subtitle="Osm největších položek dokladů"
            loading={invoicesQuery.isPending}
            empty={revenueRows.length === 0 ? 'Zatím žádné doklady v tomto období.' : null}
            columns={['Činnost', 'Tržba (Kč)']}
            rows={revenueRows.map((r) => [r.label, r.amount])}
            period={period}
          >
            <HorizontalBars data={revenueRows} dataKey="amount" name="Tržba" fill={accent} axis={axis} money />
          </ChartCard>
        </Section>
      ) : null}
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
        <SoftCard sx={{ p: 2.25 }} aria-busy="true">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ mb: 3 }}>
      <SectionLabel component="h2" sx={{ mb: 1.5 }}>{title}</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>{children}</Box>
    </Box>
  );
}

/** Downloads a CSV through a one-off link; nothing is sent anywhere. */
function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * One chart with its numbers behind a "Tabulka" toggle and an "Export CSV"
 * for the period. The empty state says what will appear, not just that
 * nothing did.
 */
function ChartCard({
  title, subtitle, loading, empty, columns, rows, period, children,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  empty: string | null;
  columns: string[];
  rows: CsvCell[][];
  period: Period;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const numeric = (i: number) => rows.some((r) => typeof r[i] === 'number');
  return (
    <SoftCard sx={{ p: 2.25 }} component="article" aria-label={title}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
          {subtitle ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{subtitle}</Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_e, next: 'chart' | 'table' | null) => { if (next) setView(next); }}
            aria-label={`Zobrazení: ${title}`}
          >
            <ToggleButton value="chart" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>Graf</ToggleButton>
            <ToggleButton value="table" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>Tabulka</ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            variant="outlined"
            disabled={loading || rows.length === 0}
            onClick={() => downloadCsv(csvFileName(title, period), toCsv(columns, rows))}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Skeleton variant="rounded" height={220} />
      ) : empty !== null ? (
        <Box sx={{ height: 220, display: 'grid', placeItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>{empty}</Typography>
        </Box>
      ) : view === 'table' ? (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', maxHeight: 320 }}>
          <Table size="small" stickyHeader aria-label={`Tabulka: ${title}`}>
            <TableHead>
              <TableRow>
                {columns.map((c, i) => (
                  <TableCell key={c} align={numeric(i) ? 'right' : 'left'}>{c}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>
                  {r.map((cell, ci) => (
                    <TableCell key={ci} align={typeof cell === 'number' ? 'right' : 'left'}>
                      {typeof cell === 'number' ? cell.toLocaleString('cs-CZ') : cell ?? ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        children
      )}
    </SoftCard>
  );
}

/** Horizontal bars for a ranked list: the činnosti, the calendars, the revenue. */
function HorizontalBars({
  data, dataKey, name, fill, axis, money = false, height,
}: {
  data: readonly { label: string; count?: number; amount?: number }[];
  dataKey: 'count' | 'amount';
  name: string;
  fill: string;
  axis: { fontSize: number; fill: string };
  money?: boolean;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(140, 36 * data.length + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid stroke={DESIGN.line} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axis} stroke={DESIGN.line}
          tickFormatter={money ? (v: number) => v.toLocaleString('cs-CZ') : undefined} />
        <YAxis type="category" dataKey="label" width={160} tick={axis} stroke={DESIGN.line} />
        <Tooltip formatter={money ? (v) => formatCzk(Number(v)) : undefined} />
        <Bar dataKey={dataKey} name={name} fill={fill} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
