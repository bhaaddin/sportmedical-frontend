/*
 * One patient's appointments: what is coming, and what has been.
 *
 * Split at now rather than listed in one run, because the two are different
 * questions. "When are they next in" is asked at a desk with somebody standing
 * there; "when were they last in" is asked while reading their file. A single
 * list answers whichever of the two you are not asking.
 *
 * What is shown was decided by measuring, not by the shape of the DTO. It
 * carries `practitionerName` and `room`, and both are empty on every
 * appointment the server has; `serviceType` says "Consultation" on all of
 * them, which is the fallback of a mapper this lane deleted - it decided an
 * activity's type by reading its Czech name and defaulted when it did not
 * recognise one. Drawing any of the three would be furniture, or worse, a
 * label that is quietly wrong. `eventName` holds the real activity.
 */
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Stack, Typography,
} from '@mui/material';
import { Event, EventBusy, History, Add } from '@mui/icons-material';
import client from '../../api/client';
import { formatPragueDateTime } from '../../utils/time';
import type { PatientContext } from './PatientLayout';

export interface PatientAppointment {
  id: string;
  patientId: string;
  eventName: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string;
}

/*
 * The statuses the server sends, as words. Measured on the running API:
 * `Scheduled` and `Cancelled` are what exist today; the rest are in the
 * contract and are handled so that the day one appears it is not drawn as a
 * raw English word on a Czech screen.
 */
export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  Scheduled: 'Objednáno',
  Confirmed: 'Potvrzeno',
  CheckedIn: 'Dorazil',
  Completed: 'Hotovo',
  Cancelled: 'Zrušeno',
  NoShow: 'Nedorazil',
};

const STATUS_COLOUR: Record<string, string> = {
  Scheduled: '#0D7377',
  Confirmed: '#0D7377',
  CheckedIn: '#2E7D32',
  Completed: '#2E7D32',
  Cancelled: '#9E9E9E',
  NoShow: '#D32F2F',
};

/** An appointment that no longer stands. Kept visible, never counted as upcoming. */
export function isCancelled(appointment: PatientAppointment): boolean {
  return appointment.status === 'Cancelled' || appointment.status === 'NoShow';
}

/**
 * Split into what is still coming and what has passed.
 *
 * A cancelled appointment in the future is not "coming" - nobody is expected -
 * so it goes below with the rest of the history rather than sitting at the top
 * of a list somebody reads as "who is due in".
 */
export function splitAppointments(
  appointments: PatientAppointment[],
  now: Date = new Date(),
): { upcoming: PatientAppointment[]; past: PatientAppointment[] } {
  const upcoming: PatientAppointment[] = [];
  const past: PatientAppointment[] = [];

  for (const appointment of appointments) {
    const starts = Date.parse(appointment.startTime);
    if (Number.isNaN(starts)) continue;
    if (starts >= now.getTime() && !isCancelled(appointment)) upcoming.push(appointment);
    else past.push(appointment);
  }

  upcoming.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  past.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  return { upcoming, past };
}

function AppointmentRow({ appointment }: { appointment: PatientAppointment }) {
  const label = APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status;
  const colour = STATUS_COLOUR[appointment.status] ?? '#607D8B';

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center', py: 1.5, flexWrap: 'wrap',
        borderBottom: '1px solid', borderColor: 'divider',
      }}
    >
      <Box sx={{ minWidth: 200, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {appointment.eventName === '' ? 'Termín' : appointment.eventName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatPragueDateTime(appointment.startTime)}
        </Typography>
        {appointment.notes !== '' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {appointment.notes}
          </Typography>
        )}
      </Box>
      <Chip
        size="small"
        label={label}
        sx={{ bgcolor: `${colour}14`, color: colour, fontWeight: 500 }}
      />
    </Stack>
  );
}

export default function PatientAppointmentsPage() {
  const { patient } = useOutletContext<PatientContext>();
  const [all, setAll] = useState<PatientAppointment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/scheduling/appointments')
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data?.value ?? res.data ?? [];
        setAll(Array.isArray(data) ? data : []);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Filtered here because the server has no way to ask for one patient's
   * appointments - `GET /api/scheduling/appointments` takes a date range and
   * nothing else. It works, and it is the wrong shape: to show one person's
   * appointments the browser is sent everybody's. Reported rather than worked
   * around, since a filter is a server's job.
   */
  const mine = useMemo(
    () => (all ?? []).filter((a) => a.patientId === patient.id),
    [all, patient.id],
  );

  const { upcoming, past } = useMemo(() => splitAppointments(mine), [mine]);

  if (failed) {
    return <Alert severity="warning">Termíny se nepodařilo načíst. Zkuste to prosím znovu.</Alert>;
  }

  if (all === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <Event sx={{ color: '#0D7377' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Nadcházející termíny
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<Add />}
              component={RouterLink}
              to="/planovani"
            >
              Objednat
            </Button>
          </Stack>
          <Divider sx={{ mb: 1 }} />

          {upcoming.length === 0 ? (
            <Stack spacing={1} sx={{ alignItems: 'center', py: 3 }}>
              <EventBusy sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">
                {patient.firstName} nemá objednaný žádný termín.
              </Typography>
            </Stack>
          ) : (
            upcoming.map((a) => <AppointmentRow key={a.id} appointment={a} />)
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <History sx={{ color: '#0D7377' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Historie
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Proběhlé a zrušené termíny, od nejnovějšího.
          </Typography>
          <Divider sx={{ mb: 1 }} />

          {past.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Zatím tu žádný termín není.
            </Typography>
          ) : (
            past.map((a) => <AppointmentRow key={a.id} appointment={a} />)
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
