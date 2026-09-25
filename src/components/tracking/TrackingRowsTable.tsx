import {
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { statusLabel, type TrackingRow } from '../../api/tracking';
import { formatPragueDate, formatPragueTime } from '../../utils/time';

/**
 * The list a tracking number was counted from — one row per appointment,
 * with the flags the counts are made of shown as chips, so a person can see
 * on the row exactly why it was counted. Every row links to the booking.
 */
export function TrackingRowsTable({
  rows,
  showDate = false,
  emptyText = 'Do tohoto políčka nespadá žádný termín.',
}: {
  rows: readonly TrackingRow[];
  /** Over more than one day the date matters; on the day screen it is noise. */
  showDate?: boolean;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <Typography sx={{ color: 'text.secondary', py: 1 }}>{emptyText}</Typography>;
  }

  return (
    <Table size="small" aria-label="Termíny">
      <TableHead>
        <TableRow>
          <TableCell>{showDate ? 'Datum a čas' : 'Čas'}</TableCell>
          <TableCell>Pacient</TableCell>
          <TableCell>Činnost</TableCell>
          <TableCell>Služba</TableCell>
          <TableCell>Zaměstnanec</TableCell>
          <TableCell>Stav</TableCell>
          <TableCell>Příznaky</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.appointmentId} hover>
            <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              {showDate ? `${formatPragueDate(row.startUtc)} ` : ''}
              {formatPragueTime(row.startUtc)}
            </TableCell>
            <TableCell>
              <RouterLink to={`/kalendar/${row.calendarId}/termin/${row.appointmentId}`}>
                {row.patientName || 'Bez jména'}
              </RouterLink>
            </TableCell>
            <TableCell>{row.activityName || '—'}</TableCell>
            <TableCell>{row.serviceName || '—'}</TableCell>
            <TableCell>{row.workerName ?? (row.workerUserId ? 'Účet už neexistuje' : 'Nikdo')}</TableCell>
            <TableCell>
              <Chip
                size="small"
                label={statusLabel(row.status)}
                color={row.status === 5 ? 'warning' : row.status === 4 ? 'default' : row.status >= 2 ? 'success' : 'primary'}
                variant={row.status === 4 ? 'outlined' : 'filled'}
              />
            </TableCell>
            <TableCell>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                {row.isRunningLate ? <Chip size="small" color="warning" variant="outlined" label="Má zpoždění" /> : null}
                {row.paid ? <Chip size="small" color="success" variant="outlined" label="Zaplaceno" /> : null}
                {row.questionnaireMissing === true ? (
                  <Chip size="small" color="error" variant="outlined" label="Chybí dotazník" />
                ) : null}
                {row.newPatient ? <Chip size="small" variant="outlined" label="Nový pacient" /> : null}
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
