/*
 * A chart of Statistiky klubů as a panel of the fitted page: a head (title, Graf / Tabulka, Export CSV) and a body that
 * takes the height the panel was given and scrolls by itself when the data needs more (200 clubs are 200 bars, not a
 * squeezed chart). The chart reads its height from the panel (a phone's panel has none, so it keeps a floor).
 *
 * It replaces the statistics page's ChartCard here only because that card is a fixed 260 px high; the behaviour -
 * the table behind the chart and the CSV of what is drawn - is the same.
 */
import { useState } from 'react';
import {
  Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { SoftCard } from '../../ui';
import { FIT_FILL_SX, FIT_SCROLL_SX } from '../../ui/fit';
import { useIsPhone } from '../../../layout/useDevice';
import { csvFileName, toCsv, type CsvCell, type Period } from '../../../pages/statistics/aggregate';
import { downloadCsv } from '../../../pages/statistics/csv';

/** What a bar needs on the page: the least height one category row gets, and the room for the axis and legend. */
export const BAR_ROW = 34;
const CHROME = 72;

export interface StatsChart {
  id: string;
  title: string;
  /** Why there is nothing to draw, or null when there is. */
  empty: string | null;
  columns: string[];
  rows: CsvCell[][];
  /** The chart; it fills its parent (`height="100%"`). */
  render: () => React.ReactNode;
  /** How many category rows it draws, so the body can keep each bar readable. */
  categories: number;
}

export function StatsChartPanel({ chart, period }: { chart: StatsChart; period: Period }) {
  const phone = useIsPhone();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const target = phone ? { minHeight: 44 } : {};
  const numeric = (i: number) => chart.rows.some((r) => typeof r[i] === 'number');
  const needed = Math.max(phone ? 240 : 160, chart.categories * BAR_ROW + CHROME);
  const exportable = chart.empty === null && chart.rows.length > 0;

  return (
    <SoftCard
      component="article"
      aria-label={chart.title}
      data-state={chart.empty !== null ? 'empty' : 'ready'}
      sx={{ p: 2, minWidth: 0, display: 'flex', flexDirection: 'column', ...(phone ? {} : { minHeight: 0, height: '100%' }) }}
    >
      <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexShrink: 0 }}>
        <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, minWidth: 0 }}>{chart.title}</Typography>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_e, next: 'chart' | 'table' | null) => { if (next) setView(next); }}
            aria-label={`Zobrazení: ${chart.title}`}
          >
            <ToggleButton value="chart" sx={{ px: 1.5, py: 0.25, fontSize: 12, ...target }}>Graf</ToggleButton>
            <ToggleButton value="table" sx={{ px: 1.5, py: 0.25, fontSize: 12, ...target }}>Tabulka</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" variant="outlined" sx={target} disabled={!exportable} onClick={() => downloadCsv(csvFileName(chart.title, period), toCsv(chart.columns, chart.rows))}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Box sx={phone ? {} : { ...FIT_FILL_SX, ...FIT_SCROLL_SX }}>
        {chart.empty !== null ? (
          <Box sx={{ minHeight: 120, height: '100%', display: 'grid', placeItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', textAlign: 'center' }}>{chart.empty}</Typography>
          </Box>
        ) : view === 'table' ? (
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
            <Table size="small" stickyHeader aria-label={`Tabulka: ${chart.title}`}>
              <TableHead>
                <TableRow>{chart.columns.map((c, i) => <TableCell key={c} align={numeric(i) ? 'right' : 'left'}>{c}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {chart.rows.map((r, ri) => (
                  <TableRow key={ri} hover>
                    {r.map((cell, ci) => (
                      <TableCell key={ci} align={typeof cell === 'number' ? 'right' : 'left'}>{typeof cell === 'number' ? cell.toLocaleString('cs-CZ') : cell ?? ''}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          /* As tall as the panel's body, or as tall as its bars need, whichever is more: more bars scroll, they are not squeezed. */
          <Box data-testid="chart-area" sx={{ position: 'relative', width: '100%', height: phone ? needed : `max(100%, ${needed}px)` }}>
            {chart.render()}
          </Box>
        )}
      </Box>
    </SoftCard>
  );
}
