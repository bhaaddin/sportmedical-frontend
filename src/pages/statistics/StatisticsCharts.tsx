/*
 * The pieces of the Statistiky screen that draw: the chart card (chart, its
 * table behind a toggle, its own CSV, and the loading / empty / error states),
 * the ranked horizontal bars, and the grid the cards sit in.
 *
 * Every state of a card has the same height (CHART_HEIGHT), so a placeholder
 * turning into a chart, or into "nothing for this period", moves nothing.
 */
import { useState } from 'react';
import {
  Box, Button, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DESIGN, SectionLabel, SoftCard } from '../../components/ui';
import { useIsPhone } from '../../layout/useDevice';
import { csvFileName, formatCzk, toCsv } from './aggregate';
import type { CsvCell, Period } from './aggregate';
import { downloadCsv } from './csv';

export const CHART_HEIGHT = 260;

export type StatisticsGroup = 'appointments' | 'patients' | 'finance';

/** One chart, described once: what the card shows, what the CSV exports. */
export interface ChartDef {
  id: string;
  group: StatisticsGroup;
  title: string;
  subtitle?: string;
  loading: boolean;
  /** The data behind it could not be loaded. */
  failed?: boolean;
  retry?: () => void;
  /** Why there is nothing to draw, or null when there is. */
  empty: string | null;
  columns: string[];
  rows: CsvCell[][];
  chart: React.ReactNode;
}

/** A chart is exportable when it is drawn from real, loaded data. */
export const isExportable = (c: ChartDef): boolean =>
  !c.loading && c.failed !== true && c.empty === null && c.rows.length > 0;

/** The section's grid: one chart per row on a phone, two across (or as many as fit) elsewhere. */
export function ChartGrid({ title, children }: { title: string; children: React.ReactNode }) {
  const phone = useIsPhone();
  return (
    <Box component="section" aria-label={title} sx={{ mb: 3 }}>
      <SectionLabel component="h2" sx={{ mb: 1.5 }}>{title}</SectionLabel>
      <Box
        data-layout={phone ? 'stack' : 'grid'}
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function ChartCard({ def, period }: { def: ChartDef; period: Period }) {
  const phone = useIsPhone();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const { title, subtitle, loading, failed, retry, empty, columns, rows } = def;
  const numeric = (i: number) => rows.some((r) => typeof r[i] === 'number');
  const target = phone ? { minHeight: 44 } : {};
  const state = loading ? 'loading' : failed === true ? 'error' : empty !== null ? 'empty' : 'ready';

  return (
    <SoftCard sx={{ p: 2.25, minWidth: 0 }} component="article" aria-label={title} data-state={state}>
      <Stack
        direction={phone ? 'column' : 'row'}
        sx={{ alignItems: phone ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
          {subtitle ? (
            <Typography sx={{ fontSize: 14, color: 'text.secondary', display: 'block' }}>{subtitle}</Typography>
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
            <ToggleButton value="chart" sx={{ px: 1.5, py: 0.25, fontSize: 12, ...target }}>Graf</ToggleButton>
            <ToggleButton value="table" sx={{ px: 1.5, py: 0.25, fontSize: 12, ...target }}>Tabulka</ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            variant="outlined"
            sx={target}
            disabled={!isExportable(def)}
            onClick={() => downloadCsv(csvFileName(title, period), toCsv(columns, rows))}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ minHeight: CHART_HEIGHT }}>
        {loading ? (
          <Skeleton variant="rounded" height={CHART_HEIGHT} />
        ) : failed === true ? (
          <Stack spacing={1.5} sx={{ height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>Tato data se nepodařilo načíst.</Typography>
            {retry ? <Button variant="outlined" sx={{ minHeight: 44 }} onClick={retry}>Zkusit znovu</Button> : null}
          </Stack>
        ) : empty !== null ? (
          <Box sx={{ height: CHART_HEIGHT, display: 'grid', placeItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', textAlign: 'center' }}>{empty}</Typography>
          </Box>
        ) : view === 'table' ? (
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', maxHeight: 320, overflowX: 'auto' }}>
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
          def.chart
        )}
      </Box>
    </SoftCard>
  );
}

/** Horizontal bars for a ranked list: the činnosti, the calendars, the revenue. */
export function HorizontalBars({
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
  const phone = useIsPhone();
  /* On a phone the labels get 96px and are clipped with an ellipsis, so the bars keep most of the card. */
  const labelWidth = phone ? 96 : 160;
  const clip = (v: string) => (phone && v.length > 14 ? `${v.slice(0, 13)}…` : v);
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(CHART_HEIGHT - 40, 36 * data.length + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: phone ? 8 : 24 }}>
        <CartesianGrid stroke={DESIGN.line} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axis} stroke={DESIGN.line} minTickGap={16}
          tickFormatter={money ? (v: number) => v.toLocaleString('cs-CZ') : undefined} />
        <YAxis type="category" dataKey="label" width={labelWidth} tick={axis} stroke={DESIGN.line} tickFormatter={clip} />
        <Tooltip formatter={money ? (v) => formatCzk(Number(v)) : undefined} />
        <Bar dataKey={dataKey} name={name} fill={fill} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
