import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../../api/activities';
import {
  TRACKING_METRICS,
  TRACKING_STATUS_LABELS,
  rowsForCell,
  trackingApi,
  type CellFilter,
  type TrackingBreakdown,
  type TrackingMetric,
} from '../../api/tracking';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { AsyncSection } from '../booking/AsyncSection';
import { TrackingHelpPanel } from './TrackingHelpPanel';
import { TrackingRowsTable } from './TrackingRowsTable';
import type { DateOnly } from '../../utils/time';

/**
 * Sledování dne on /dnes: how many patients today, by service, činnost and
 * employee, with filters — and the list every number was counted from.
 *
 * Every figure is the server's (`GET /api/tracking/day`); this component
 * filters the server's own rows when a cell is clicked and computes nothing
 * of its own. It asks again every minute, whenever the hub says something
 * changed (new, moved or cancelled bookings) and whenever a screen that
 * changes a booking's status invalidates TRACKING_DAY_QUERY_KEY, because the
 * server rings no bell on a status change.
 */
export const TRACKING_DAY_QUERY_KEY = ['tracking', 'day'] as const;

export function DayTracking({ date, calendarIds }: { date: DateOnly; calendarIds: string[] }) {
  const queryClient = useQueryClient();
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [workerUserId, setWorkerUserId] = useState<string>('');
  const [statusCode, setStatusCode] = useState<number | ''>('');
  const [cell, setCell] = useState<{ filter: CellFilter; label: string } | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: TRACKING_DAY_QUERY_KEY });
  useRealtimeSync({ onNotificationsChanged: invalidate, onReconnected: invalidate });

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const dayQuery = useQuery({
    queryKey: [...TRACKING_DAY_QUERY_KEY, date, calendarIds.join(','), activityIds.join(','), workerUserId],
    queryFn: () =>
      trackingApi.day(date, { calendarIds, activityIds, workerUserId: workerUserId || null }),
    enabled: calendarIds.length > 0,
    refetchInterval: 60_000,
  });

  const day = dayQuery.data;

  /* The status filter narrows the list only; the tallies stay the server's
     answer for the whole filtered day, or they would stop adding up. */
  const listed = useMemo(() => {
    if (!day) return [];
    const base = cell ? rowsForCell(day.rows, cell.filter) : [...day.rows];
    return statusCode === '' ? base : base.filter((row) => row.status === statusCode);
  }, [day, cell, statusCode]);

  const pick = (filter: CellFilter, label: string) =>
    setCell((current) => (current?.label === label ? null : { filter, label }));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sledování dne
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Aktualizuje se každou minutu, po každé nové, přesunuté nebo zrušené rezervaci a po změně stavu provedené v tomto okně.
        </Typography>
      </Stack>

      {/* ── Filters ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="tracking-activity-label">Činnost</InputLabel>
          <Select
            labelId="tracking-activity-label"
            label="Činnost"
            multiple
            value={activityIds}
            onChange={(e) => setActivityIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            renderValue={(ids) =>
              ids
                .map((id) => activitiesQuery.data?.activities.find((a) => a.id === id)?.name ?? id)
                .join(', ')
            }
          >
            {(activitiesQuery.data?.activities ?? []).map((activity) => (
              <MenuItem key={activity.id} value={activity.id}>
                {activity.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="tracking-worker-label">Zaměstnanec</InputLabel>
          <Select
            labelId="tracking-worker-label"
            label="Zaměstnanec"
            value={workerUserId}
            onChange={(e) => setWorkerUserId(e.target.value)}
          >
            <MenuItem value="">Všichni</MenuItem>
            {(day?.workers ?? []).map((person) => (
              <MenuItem key={person.userId} value={person.userId}>
                {person.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="tracking-status-label">Stav</InputLabel>
          <Select
            labelId="tracking-status-label"
            label="Stav"
            value={statusCode}
            onChange={(e) => {
              const picked = e.target.value as number | '';
              setStatusCode(picked === '' ? '' : Number(picked));
            }}
          >
            <MenuItem value="">Všechny</MenuItem>
            {TRACKING_STATUS_LABELS.map((s) => (
              <MenuItem key={s.code} value={s.code}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <AsyncSection
        isLoading={dayQuery.isLoading}
        isSettled={calendarIds.length === 0 || dayQuery.isSuccess || dayQuery.isError}
        error={dayQuery.error}
        isEmpty={calendarIds.length === 0}
        emptyText="Vyberte alespoň jeden kalendář."
        onRetry={() => void dayQuery.refetch()}
        skeletonRows={4}
      >
        {day ? (
          <Stack spacing={2}>
            {/* ── The nine numbers ── */}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              {TRACKING_METRICS.map((metric) => (
                <MetricTile
                  key={metric.key}
                  label={metric.label}
                  help={metric.help}
                  value={day.counts[metric.key]}
                  selected={cell?.label === metric.label}
                  onClick={() => pick({ metric: metric.key }, metric.label)}
                />
              ))}
            </Stack>

            {/* ── By service, činnost and employee ── */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
              <BreakdownTable
                title="Podle služby"
                rows={day.byService}
                selectedLabel={cell?.label ?? null}
                onPick={(row, metric) => pick({ serviceId: row.id, metric }, `Podle služby: ${row.name} · ${labelOf(metric)}`)}
              />
              <BreakdownTable
                title="Podle činnosti"
                rows={day.byActivity}
                selectedLabel={cell?.label ?? null}
                onPick={(row, metric) => pick({ activityId: row.id, metric }, `Podle činnosti: ${row.name} · ${labelOf(metric)}`)}
              />
              <BreakdownTable
                title="Podle zaměstnance"
                rows={day.byWorker}
                selectedLabel={cell?.label ?? null}
                onPick={(row, metric) => pick({ workerUserId: row.id, metric }, `Podle zaměstnance: ${row.name} · ${labelOf(metric)}`)}
              />
            </Stack>

            {/* ── The list ── */}
            <Box>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Termíny dne
                </Typography>
                {cell ? (
                  <Chip size="small" label={cell.label} onDelete={() => setCell(null)} />
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Kliknutím na číslo výše zobrazíte jen termíny, které do něj spadají.
                  </Typography>
                )}
              </Stack>
              <TrackingRowsTable rows={listed} emptyText="V tomto dni nejsou žádné takové termíny." />
            </Box>

            <Divider />
            <TrackingHelpPanel />
          </Stack>
        ) : null}
      </AsyncSection>
    </Paper>
  );
}

function labelOf(metric: TrackingMetric): string {
  return TRACKING_METRICS.find((m) => m.key === metric)?.label ?? metric;
}

function MetricTile({
  label,
  help,
  value,
  selected,
  onClick,
}: {
  label: string;
  help: string;
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={help} arrow describeChild>
      <ButtonBase
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
        sx={{
          minWidth: 112,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected ? 'action.selected' : 'background.paper',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

const BREAKDOWN_COLUMNS: ReadonlyArray<{ key: TrackingMetric; label: string }> = [
  { key: 'booked', label: 'Objednáno' },
  { key: 'arrived', label: 'Přišli' },
  { key: 'noShow', label: 'Nepřišli' },
  { key: 'cancelled', label: 'Zrušeno' },
];

function BreakdownTable({
  title,
  rows,
  selectedLabel,
  onPick,
}: {
  title: string;
  rows: TrackingBreakdown[];
  selectedLabel: string | null;
  onPick: (row: TrackingBreakdown, metric: TrackingMetric) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nic není objednáno.
        </Typography>
      ) : (
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell />
              {BREAKDOWN_COLUMNS.map((column) => (
                <TableCell key={column.key} align="right">
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                {BREAKDOWN_COLUMNS.map((column) => {
                  const label = `${title}: ${row.name} · ${column.label}`;
                  return (
                    <TableCell key={column.key} align="right" sx={{ p: 0 }}>
                      <ButtonBase
                        onClick={() => onPick(row, column.key)}
                        aria-label={label}
                        aria-pressed={selectedLabel === label}
                        sx={{
                          width: '100%',
                          justifyContent: 'flex-end',
                          px: 1,
                          py: 0.75,
                          fontWeight: selectedLabel === label ? 800 : 400,
                          bgcolor: selectedLabel === label ? 'action.selected' : undefined,
                        }}
                      >
                        {row.counts[column.key]}
                      </ButtonBase>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
