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
 * Shelves (docs/ui-shelf-system.md): Nadcházející (a row of cards, each opens
 * its booking), Minulé (the table; cards on a phone, three columns on an iPad)
 * and Zrušené (only when there are any). "Objednat termín" is the card's own
 * action in its header, pinned on a phone - never drawn twice.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { activitiesApi } from '../../api/activities';
import { shownPrice } from '../../components/booking/grid/appointmentPrice';
import { StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { EntityCard, Shelf } from '../../ui/shelf';
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

/*
 * Etapa 12, "ceny všude": the clinic-wide list carries the činnost's name and
 * nothing about money, so the price is the catalogue's figure for that name -
 * the same fallback the overview's visit history uses. A name the catalogue
 * does not know reads "bez ceny" rather than a guess.
 */
type PriceOf = (appointment: PatientAppointment) => ReturnType<typeof shownPrice>;

function PriceCell({ appointment, priceOf }: { appointment: PatientAppointment; priceOf: PriceOf }) {
  return (
    <Box data-testid="row-price" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {priceOf(appointment).text}
    </Box>
  );
}

const columnsWith = (priceOf: PriceOf): DataColumn<PatientAppointment>[] => [
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
  { key: 'price', header: 'Cena', align: 'right', tablet: true, cell: (a) => <PriceCell appointment={a} priceOf={priceOf} /> },
  {
    key: 'status',
    header: 'Stav',
    align: 'right',
    tablet: true,
    cell: (a) => <StatusChip tone={statusOf(a).tone}>{statusOf(a).text}</StatusChip>,
  },
];

function AppointmentRows({
  appointments, label, priceOf,
}: { appointments: PatientAppointment[]; label: string; priceOf: PriceOf }) {
  const columns = useMemo(() => columnsWith(priceOf), [priceOf]);
  return (
    <ResponsiveDataList
      rows={appointments}
      rowKey={(a) => a.id}
      columns={columns}
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
          {/* The phone's card: the price as its own line under the činnost. */}
          <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
            <PriceCell appointment={a} priceOf={priceOf} />
          </Typography>
        </Stack>
      )}
    />
  );
}

/** "út 24. 9. 2026 · 10:00–10:30": what an upcoming card is called (no person, so nothing to hide). */
const whenLabel = (a: PatientAppointment) =>
  `${shortDay(a.startTime)} ${yearOf(a)} · ${formatPragueTime(a.startTime)}–${formatPragueTime(a.endTime)}`;

export default function PatientAppointmentsPage() {
  const { patient, upcoming: bookingWindow } = useOutletContext<PatientContext>();
  const navigate = useNavigate();
  const [all, setAll] = useState<PatientAppointment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
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
  }, [attempt]);

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
  /* The history is what happened; a cancellation or a no-show is its own, quieter shelf. */
  const history = useMemo(() => past.filter((a) => !isCancelled(a)), [past]);
  const cancelledRows = useMemo(() => past.filter(isCancelled), [past]);

  /* The card's booking window knows each upcoming booking's calendar, which is what opens its detail exactly. */
  const calendarOf = useMemo(
    () => new Map((bookingWindow ?? []).flatMap((d) => (d.calendarId === null ? [] : [[d.id, d.calendarId] as const]))),
    [bookingWindow],
  );

  /* The catalogue, for the price of each činnost by name (this route sends no money). */
  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const priceOf = useMemo<PriceOf>(() => {
    const byName = new Map((activitiesQuery.data?.activities ?? []).map((a) => [a.name, a.priceCzk]));
    return (a) => shownPrice(null, byName.get(a.eventName) ?? null);
  }, [activitiesQuery.data]);

  /* The calendar opens its booking drawer on `newAppointment`, for this patient (the card's header carries the same
     action; on a phone it is pinned there, so this page pins nothing of its own). */
  const book = () => navigate('/planovani', { state: { newAppointment: Date.now(), patientId: patient.id } });
  const loading = all === null && !failed;
  const error = failed ? 'Termíny se nepodařilo načíst. Zkuste to prosím znovu.' : false;
  const retry = () => setAttempt((n) => n + 1);

  return (
    <Stack spacing={3} data-shelf-section="terminy">
      <Shelf
        id="upcoming"
        title="Nadcházející"
        count={all === null ? undefined : upcoming.length}
        countTone="primary"
        layout="row"
        minCardWidth={260}
        cardHeight={112}
        skeletons={2}
        loading={loading}
        error={error}
        onRetry={retry}
        empty={upcoming.length === 0}
        emptyState={{ text: `${patient.firstName} nemá objednaný žádný termín.`, action: { label: 'Objednat termín', onClick: book } }}
      >
        {upcoming.map((a) => {
          const calendarId = calendarOf.get(a.id);
          return (
            <EntityCard
              key={a.id}
              entity={{ kind: 'appointment', id: a.id, label: whenLabel(a), ...(calendarId !== undefined ? { calendarId } : {}) }}
              subtitle={a.eventName === '' ? 'Termín' : a.eventName}
              detail={[priceOf(a).text, a.notes].filter((x) => x !== '').join(' · ')}
              status={{ label: statusOf(a).text, tone: statusOf(a).tone }}
            />
          );
        })}
      </Shelf>

      {!failed && (
        <Shelf
          id="past"
          title="Minulé"
          hint="Od nejnovějšího"
          count={all === null ? undefined : history.length}
          layout="free"
          stagger={false}
          loading={loading}
          empty={history.length === 0}
          emptyState={{ text: 'Zatím tu žádný proběhlý termín není.' }}
        >
          <AppointmentRows appointments={history} label="Historie termínů" priceOf={priceOf} />
        </Shelf>
      )}

      {cancelledRows.length > 0 && (
        <Shelf id="cancelled" title="Zrušené" hint="Zrušené a nedorazil" count={cancelledRows.length} countTone="grey" layout="free" stagger={false}>
          <AppointmentRows appointments={cancelledRows} label="Zrušené termíny" priceOf={priceOf} />
        </Shelf>
      )}
    </Stack>
  );
}
