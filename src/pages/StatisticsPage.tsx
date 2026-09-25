/* ══════════════════════════════════════════════════════════════
   STATISTIKY  (route: /statistiky, settings.clinic.manage)

   The owner's period: today, this week, this month or any range up to a
   year, over the calendars, činnosti and employee chosen. Matrices per
   service × status, per employee × service, per weekday × hour; the
   no-show rate, new vs returning, questionnaire completion, the till and
   the diagnostic sessions.

   Every number is the server's (`GET /api/tracking/period`), and the server
   sends every row it counted with the answer - so a click on any cell opens
   the list behind it by filtering those rows, not by counting again.
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../api/activities';
import { calendarsApi } from '../api/calendars';
import {
  PERIOD_PRESET_LABELS,
  TRACKING_GROUPINGS,
  TRACKING_GROUP_LABELS,
  TRACKING_METRICS,
  formatCzk,
  presetRange,
  rowsForCell,
  share,
  statusCodeOfKey,
  statusLabel,
  trackingApi,
  type CellFilter,
  type PeriodPreset,
  type TrackingBreakdown,
  type TrackingGroupBy,
  type TrackingMetric,
  type TrackingRow,
} from '../api/tracking';
import { AsyncSection } from '../components/booking/AsyncSection';
import { TrackingHelpPanel } from '../components/tracking/TrackingHelpPanel';
import { TrackingRowsTable } from '../components/tracking/TrackingRowsTable';
import { formatDateOnly, toDateOnly } from '../utils/time';

const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
/** Monday first, the way the clinic's week runs. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const MATRIX_COLUMNS: ReadonlyArray<{ key: TrackingMetric; label: string }> = [
  { key: 'booked', label: 'Objednáno' },
  { key: 'arrived', label: 'Přišli' },
  { key: 'completed', label: 'Dokončeno' },
  { key: 'noShow', label: 'Nepřišli' },
  { key: 'cancelled', label: 'Zrušeno' },
  { key: 'paid', label: 'Zaplaceno' },
  { key: 'questionnaireMissing', label: 'Chybí dotazník' },
];

export default function StatisticsPage() {
  const today = toDateOnly(new Date());
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [custom, setCustom] = useState(() => presetRange('today', today));
  const [groupBy, setGroupBy] = useState<TrackingGroupBy>('service');
  const [calendarIds, setCalendarIds] = useState<string[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [workerUserId, setWorkerUserId] = useState('');
  const [opened, setOpened] = useState<{ title: string; rows: TrackingRow[] } | null>(null);

  const range = preset === 'custom' ? custom : presetRange(preset, today);

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: activitiesApi.list, staleTime: 5 * 60 * 1000 });

  const periodQuery = useQuery({
    queryKey: ['tracking', 'period', range.from, range.to, groupBy, calendarIds.join(','), activityIds.join(','), workerUserId],
    queryFn: () => trackingApi.period(range.from, range.to, groupBy, { calendarIds, activityIds, workerUserId: workerUserId || null }),
    enabled: range.from <= range.to,
  });

  const period = periodQuery.data;

  const open = (title: string, filter: CellFilter) => {
    if (!period) return;
    setOpened({ title, rows: rowsForCell(period.rows, filter) });
  };

  const groupFilter = (row: TrackingBreakdown): CellFilter => {
    switch (groupBy) {
      case 'service':
        return { serviceId: row.id };
      case 'activity':
        return { activityId: row.id };
      case 'worker':
        return { workerUserId: row.id };
      case 'day':
        return { day: row.key };
      case 'status': {
        const code = statusCodeOfKey(row.key);
        return code === null ? {} : { status: code };
      }
      default:
        return {};
    }
  };

  const groupName = (row: TrackingBreakdown) =>
    groupBy === 'status' ? statusLabel(statusCodeOfKey(row.key) ?? -1) : groupBy === 'day' ? formatDateOnly(row.key) : row.name;

  /* The employee × service matrix, as a grid: rows are people, columns services. */
  const matrix = useMemo(() => {
    if (!period) return null;
    const people = new Map<string, { id: string | null; name: string }>();
    const services = new Map<string, { id: string | null; name: string }>();
    const cells = new Map<string, number>();
    for (const cell of period.workerByService) {
      const r = cell.rowId ?? '';
      const c = cell.columnId ?? '';
      people.set(r, { id: cell.rowId, name: cell.rowName });
      services.set(c, { id: cell.columnId, name: cell.columnName });
      cells.set(`${r}|${c}`, cell.count);
    }
    return { people: [...people.entries()], services: [...services.entries()], cells };
  }, [period]);

  const heat = useMemo(() => {
    if (!period) return null;
    const hours = [...new Set(period.heat.map((c) => c.hour))].sort((a, b) => a - b);
    const max = Math.max(0, ...period.heat.map((c) => c.count));
    const at = new Map(period.heat.map((c) => [`${c.dayOfWeek}|${c.hour}`, c.count]));
    return { hours, max, at };
  }, [period]);

  const totals = period?.totals;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Statistiky
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kolik pacientů, kdo, co a kdy — spočítané ze skutečných termínů, plateb a dotazníků. Kliknutím na číslo otevřete seznam, ze kterého vzniklo.
      </Typography>

      {/* ── Period and filters ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={preset}
              onChange={(_, value: PeriodPreset | null) => {
                if (!value) return;
                if (value === 'custom') setCustom(presetRange(preset, today));
                setPreset(value);
              }}
              aria-label="Období"
            >
              {(Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[]).map((key) => (
                <ToggleButton key={key} value={key}>
                  {PERIOD_PRESET_LABELS[key]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <TextField
              size="small"
              type="date"
              label="Od"
              value={range.from}
              disabled={preset !== 'custom'}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="Do"
              value={range.to}
              disabled={preset !== 'custom'}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {formatDateOnly(range.from)} – {formatDateOnly(range.to)}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="stat-calendars-label">Kalendáře</InputLabel>
              <Select
                labelId="stat-calendars-label"
                label="Kalendáře"
                multiple
                value={calendarIds}
                onChange={(e) => setCalendarIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                displayEmpty
                renderValue={(ids) =>
                  ids.length === 0
                    ? 'Všechny, které vidíte'
                    : ids.map((id) => calendarsQuery.data?.find((c) => c.id === id)?.name ?? id).join(', ')
                }
              >
                {(calendarsQuery.data ?? []).map((calendar) => (
                  <MenuItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="stat-activities-label">Činnosti</InputLabel>
              <Select
                labelId="stat-activities-label"
                label="Činnosti"
                multiple
                value={activityIds}
                onChange={(e) => setActivityIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                displayEmpty
                renderValue={(ids) =>
                  ids.length === 0
                    ? 'Všechny'
                    : ids.map((id) => activitiesQuery.data?.activities.find((a) => a.id === id)?.name ?? id).join(', ')
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
              <InputLabel id="stat-worker-label">Zaměstnanec</InputLabel>
              <Select labelId="stat-worker-label" label="Zaměstnanec" value={workerUserId} onChange={(e) => setWorkerUserId(e.target.value)}>
                <MenuItem value="">Všichni</MenuItem>
                {(period?.workers ?? []).map((person) => (
                  <MenuItem key={person.userId} value={person.userId}>
                    {person.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="stat-group-label">Řádky tabulky</InputLabel>
              <Select labelId="stat-group-label" label="Řádky tabulky" value={groupBy} onChange={(e) => setGroupBy(e.target.value as TrackingGroupBy)}>
                {TRACKING_GROUPINGS.map((key) => (
                  <MenuItem key={key} value={key}>
                    {TRACKING_GROUP_LABELS[key]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Paper>

      {range.from > range.to ? <Alert severity="warning" sx={{ mb: 2 }}>Období musí začínat před koncem.</Alert> : null}

      <AsyncSection
        isLoading={periodQuery.isLoading}
        isSettled={periodQuery.isSuccess || periodQuery.isError || range.from > range.to}
        error={periodQuery.error}
        isEmpty={false}
        emptyText=""
        onRetry={() => void periodQuery.refetch()}
        skeletonRows={6}
      >
        {period && totals && matrix && heat ? (
          <Stack spacing={2}>
            {/* ── The nine totals ── */}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              {TRACKING_METRICS.map((metric) => (
                <Tile
                  key={metric.key}
                  label={metric.label}
                  help={metric.help}
                  value={String(totals[metric.key])}
                  onClick={() => open(metric.label, { metric: metric.key })}
                />
              ))}
            </Stack>

            {/* ── Rates, money, sessions ── */}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Tile
                label="Podíl nepříchodů"
                help="Nepřišli děleno objednáno."
                value={percent(share(totals.noShow, totals.booked))}
                onClick={() => open('Nepřišli', { metric: 'noShow' })}
              />
              <Tile
                label="Noví / vracející se"
                help="Kolik pacientů v období bylo poprvé a kolik už tu někdy bylo."
                value={`${totals.newPatients} / ${totals.returningPatients}`}
                onClick={() => open('Noví pacienti', { metric: 'newPatients' })}
              />
              <Tile
                label="Vyplněné dotazníky"
                help="Objednáno minus chybí dotazník, děleno objednáno."
                value={percent(share(totals.booked - totals.questionnaireMissing, totals.booked))}
                onClick={() => open('Chybí dotazník', { metric: 'questionnaireMissing' })}
              />
              <Tile
                label="Pokladna — přijato"
                help="Dokončené platby v období, počet a částka."
                value={`${period.payments.paidCount} · ${formatCzk(period.payments.paidAmount)}`}
              />
              <Tile
                label="Pokladna — otevřené"
                help="Platby zadané v období, které ještě nikdo nedokončil."
                value={`${period.payments.openCount} · ${formatCzk(period.payments.openAmount)}`}
              />
              <Tile
                label="Diagnostická vyšetření"
                help="Diagnostická sezení s datem v období."
                value={String(period.diagnosticSessions)}
              />
            </Stack>

            {/* ── Group × status ── */}
            <Paper variant="outlined" sx={{ p: 1.5, overflowX: 'auto' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                {TRACKING_GROUP_LABELS[groupBy]} × stav
              </Typography>
              {period.groups.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  V tomto období nejsou žádné termíny.
                </Typography>
              ) : (
                <Table size="small" aria-label={`${TRACKING_GROUP_LABELS[groupBy]} × stav`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{TRACKING_GROUP_LABELS[groupBy]}</TableCell>
                      {MATRIX_COLUMNS.map((column) => (
                        <TableCell key={column.key} align="right">
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {period.groups.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell sx={{ fontWeight: 600 }}>{groupName(row)}</TableCell>
                        {MATRIX_COLUMNS.map((column) => (
                          <TableCell key={column.key} align="right" sx={{ p: 0 }}>
                            <CellButton
                              label={`${groupName(row)} · ${column.label}`}
                              value={row.counts[column.key]}
                              onClick={() => open(`${groupName(row)} · ${column.label}`, { ...groupFilter(row), metric: column.key })}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>

            {/* ── Employee × service ── */}
            <Paper variant="outlined" sx={{ p: 1.5, overflowX: 'auto' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Zaměstnanec × služba
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                Nezrušené termíny podle toho, kdo byl ten den podle pracovní doby na kalendáři.
              </Typography>
              {matrix.people.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  V tomto období nejsou žádné termíny.
                </Typography>
              ) : (
                <Table size="small" aria-label="Zaměstnanec × služba">
                  <TableHead>
                    <TableRow>
                      <TableCell>Zaměstnanec</TableCell>
                      {matrix.services.map(([key, service]) => (
                        <TableCell key={key} align="right">
                          {service.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {matrix.people.map(([personKey, person]) => (
                      <TableRow key={personKey}>
                        <TableCell sx={{ fontWeight: 600 }}>{person.name}</TableCell>
                        {matrix.services.map(([serviceKey, service]) => (
                          <TableCell key={serviceKey} align="right" sx={{ p: 0 }}>
                            <CellButton
                              label={`${person.name} · ${service.name}`}
                              value={matrix.cells.get(`${personKey}|${serviceKey}`) ?? 0}
                              onClick={() =>
                                open(`${person.name} · ${service.name}`, { workerUserId: person.id, serviceId: service.id, metric: 'booked' })
                              }
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>

            {/* ── Weekday × hour ── */}
            <Paper variant="outlined" sx={{ p: 1.5, overflowX: 'auto' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Den v týdnu × hodina
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                Kdy nezrušené termíny začínají; tmavší políčko znamená víc termínů.
              </Typography>
              {heat.hours.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  V tomto období nejsou žádné termíny.
                </Typography>
              ) : (
                <Table size="small" aria-label="Den v týdnu × hodina">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      {heat.hours.map((hour) => (
                        <TableCell key={hour} align="center">
                          {hour}:00
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {WEEK_ORDER.map((dayOfWeek) => (
                      <TableRow key={dayOfWeek}>
                        <TableCell sx={{ fontWeight: 600 }}>{WEEKDAYS[dayOfWeek]}</TableCell>
                        {heat.hours.map((hour) => {
                          const count = heat.at.get(`${dayOfWeek}|${hour}`) ?? 0;
                          const weight = heat.max > 0 ? count / heat.max : 0;
                          return (
                            <TableCell key={hour} align="center" sx={{ p: 0 }}>
                              <ButtonBase
                                aria-label={`${WEEKDAYS[dayOfWeek]} ${hour}:00`}
                                onClick={() => open(`${WEEKDAYS[dayOfWeek]} ${hour}:00`, { weekdayHour: { dayOfWeek, hour }, metric: 'booked' })}
                                sx={{
                                  width: '100%',
                                  py: 0.75,
                                  bgcolor: count === 0 ? undefined : `rgba(13, 115, 119, ${0.15 + 0.6 * weight})`,
                                  color: weight > 0.5 ? '#fff' : undefined,
                                  fontWeight: count > 0 ? 700 : 400,
                                }}
                              >
                                {count === 0 ? '·' : count}
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

            <TrackingHelpPanel />
          </Stack>
        ) : null}
      </AsyncSection>

      <Dialog open={opened !== null} onClose={() => setOpened(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <span>{opened?.title}</span>
            <Chip size="small" label={`${opened?.rows.length ?? 0} termínů`} />
          </Stack>
        </DialogTitle>
        <DialogContent>
          {opened ? <TrackingRowsTable rows={opened.rows} showDate /> : null}
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
            <Button onClick={() => setOpened(null)}>Zavřít</Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function percent(value: number | null): string {
  return value === null ? '—' : `${value} %`;
}

function Tile({ label, help, value, onClick }: { label: string; help: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
    </>
  );
  const sx = {
    minWidth: 128,
    px: 1.5,
    py: 1,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  } as const;
  return (
    <Tooltip title={help} arrow describeChild>
      {onClick ? (
        <ButtonBase onClick={onClick} aria-label={label} sx={sx}>
          {body}
        </ButtonBase>
      ) : (
        <Box aria-label={label} sx={sx}>
          {body}
        </Box>
      )}
    </Tooltip>
  );
}

function CellButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <ButtonBase onClick={onClick} aria-label={label} sx={{ width: '100%', justifyContent: 'flex-end', px: 1, py: 0.75, fontWeight: value > 0 ? 700 : 400 }}>
      {value}
    </ButtonBase>
  );
}
