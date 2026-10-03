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
 *
 * Three layouts: a card per appointment on a phone (with "Objednat" pinned at
 * the bottom), three columns on an iPad, the full table on a desktop.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Stack, Typography,
} from '@mui/material';
import { SectionLabel, StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../../components/ui/PinnedActionBar';
import { useIsPhone } from '../../layout/useDevice';
import { fetchAllAppointments } from '../../components/patients/appointmentsSource';
import { isCancelled as cancelledOrNoShow, shortDay } from '../../components/patients/patientActivity';
import type { PatientAppointment } from '../../components/patients/patientActivity';
import { formatPragueTime, formatPragueDate } from '../../utils/time';
import type { PatientContext } from './PatientLayout';

export type { PatientAppointment };

/** An appointment that no longer stands. Kept visible, never counted as upcoming. */
export function isCancelled(appointment: PatientAppointment): boolean {
  return cancelledOrNoShow(appointment);
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

const STATUS_TONE: Record<string, ChipTone> = {
  Scheduled: 'blue',
  Confirmed: 'green',
  CheckedIn: 'green',
  Completed: 'green',
  Cancelled: 'grey',
  NoShow: 'red',
};

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

const statusOf = (appointment: PatientAppointment) => ({
  text: APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status,
  tone: STATUS_TONE[appointment.status] ?? ('grey' as ChipTone),
});

const yearOf = (appointment: PatientAppointment) =>
  formatPragueDate(appointment.startTime).replace(/^.*?(\d{4})$/, '$1');

function WhatCell({ appointment }: { appointment: PatientAppointment }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {appointment.eventName === '' ? 'Termín' : appointment.eventName}
      </Typography>
      {appointment.notes !== '' && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {appointment.notes}
        </Typography>
      )}
    </>
  );
}

const COLUMNS: DataColumn<PatientAppointment>[] = [
  {
    key: 'date',
    header: 'Datum',
    tablet: true,
    cell: (a) => (
      <Box sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
        {shortDay(a.startTime)}
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
          {yearOf(a)}
        </Typography>
      </Box>
    ),
  },
  {
    key: 'time',
    header: 'Čas',
    cell: (a) => (
      <Box sx={{ whiteSpace: 'nowrap' }}>
        {formatPragueTime(a.startTime)} – {formatPragueTime(a.endTime)}
      </Box>
    ),
  },
  { key: 'what', header: 'Činnost', tablet: true, cell: (a) => <WhatCell appointment={a} /> },
  {
    key: 'status',
    header: 'Stav',
    align: 'right',
    tablet: true,
    cell: (a) => <StatusChip tone={statusOf(a).tone}>{statusOf(a).text}</StatusChip>,
  },
];

function AppointmentRows({ appointments, label }: { appointments: PatientAppointment[]; label: string }) {
  return (
    <ResponsiveDataList
      rows={appointments}
      rowKey={(a) => a.id}
      columns={COLUMNS}
      ariaLabel={label}
      renderCard={(a) => (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
              {shortDay(a.startTime)} {yearOf(a)}
            </Typography>
            <StatusChip tone={statusOf(a).tone}>{statusOf(a).text}</StatusChip>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {formatPragueTime(a.startTime)} – {formatPragueTime(a.endTime)}
          </Typography>
          <WhatCell appointment={a} />
        </Stack>
      )}
    />
  );
}

export default function PatientAppointmentsPage() {
  const { patient } = useOutletContext<PatientContext>();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const [all, setAll] = useState<PatientAppointment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAllAppointments()
      .then((rows) => {
        if (cancelled) return;
        setAll(rows);
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

  /* The calendar opens its booking drawer on `newAppointment`, for this
     patient. On a phone it is the screen's main action and is pinned. */
  const book = (
    <Button
      variant="contained"
      onClick={() => navigate('/planovani', { state: { newAppointment: Date.now(), patientId: patient.id } })}
      sx={{ minHeight: 44 }}
    >
      Objednat
    </Button>
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <SectionLabel sx={{ mb: 0 }}>Nadcházející termíny</SectionLabel>
          <Box sx={{ flex: 1 }} />
          {!phone && book}
        </Stack>

        {upcoming.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {patient.firstName} nemá objednaný žádný termín.
          </Typography>
        ) : (
          <AppointmentRows appointments={upcoming} label="Nadcházející termíny" />
        )}
      </Box>

      <Box>
        <SectionLabel sx={{ mb: 0.25 }}>Historie</SectionLabel>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Proběhlé a zrušené termíny, od nejnovějšího.
        </Typography>

        {past.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Zatím tu žádný termín není.
          </Typography>
        ) : (
          <AppointmentRows appointments={past} label="Historie termínů" />
        )}
      </Box>

      {phone && <PinnedActionBar label="Objednat termín">{book}</PinnedActionBar>}
    </Stack>
  );
}
