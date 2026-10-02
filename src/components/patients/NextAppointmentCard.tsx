/*
 * PŘÍŠTÍ TERMÍN - the right-hand card on the patient's overview (design-15):
 * "Po 26. 10. · 10:00", the činnost with its length and price, and the two
 * things the desk does with a booking from here - open it, move it.
 *
 * Read off the booking window first, because only that carries the calendar
 * id the booking's address needs. A booking further out than the window is
 * known from the clinic-wide list and is drawn without the buttons - its
 * calendar is not known, and a link that cannot resolve is worse than none.
 */
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Skeleton, Stack, Typography } from '@mui/material';
import type { DayAppointment } from '../../api/bookingContracts';
import { isTerminalStatus } from '../../api/bookingContracts';
import { SectionLabel, SoftCard } from '../ui';
import { formatCzk, minutesBetween, shortDay } from './patientActivity';
import type { PatientAppointment } from './patientActivity';
import { formatPragueTime } from '../../utils/time';

/** The soonest booking in the window that still stands, for one patient. */
export function nextInWindow(patientId: string, window: readonly DayAppointment[]): DayAppointment | null {
  const now = Date.now();
  const mine = window
    .filter((a) => a.patientId === patientId && !isTerminalStatus(a.status) && Date.parse(a.startUtc) >= now)
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  return mine[0] ?? null;
}

export function NextAppointmentCard({
  patientId,
  window,
  fallback,
  priceOf,
}: {
  patientId: string;
  /** The booking window; null while unanswered. */
  window: readonly DayAppointment[] | null;
  /** The next booking by the clinic-wide list, for one beyond the window. */
  fallback: PatientAppointment | null;
  /** The price of a činnost by id or by name, when the price list is known. */
  priceOf: (activityId: string | null, activityName: string) => number | null;
}) {
  const navigate = useNavigate();
  const inWindow = window === null ? null : nextInWindow(patientId, window);

  const book = () =>
    navigate('/planovani', { state: { newAppointment: Date.now(), patientId } });

  let body: React.ReactNode;
  if (window === null && fallback === null) {
    body = (
      <>
        <Skeleton width="60%" height={28} />
        <Skeleton width="80%" height={20} />
      </>
    );
  } else if (inWindow !== null) {
    const minutes = minutesBetween(inWindow.startUtc, inWindow.endUtc);
    const price = priceOf(inWindow.activityId, inWindow.activityName);
    const link = inWindow.calendarId === null
      ? null
      : `/kalendar/${inWindow.calendarId}/termin/${inWindow.id}`;
    body = (
      <>
        <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {shortDay(inWindow.startUtc)} · {formatPragueTime(inWindow.startUtc)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {[
            inWindow.activityName === '' ? 'Termín' : inWindow.activityName,
            minutes === null ? null : `${minutes} min`,
            price === null ? null : formatCzk(price),
          ].filter((part) => part !== null).join(' · ')}
        </Typography>
        {link !== null && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button variant="outlined" component={RouterLink} to={link}>Otevřít</Button>
            {/* The move lives on the booking's own detail, next to the
                history and the status it has to respect. */}
            <Button variant="outlined" component={RouterLink} to={link} state={{ move: true }}>
              Přesunout
            </Button>
          </Stack>
        )}
      </>
    );
  } else if (fallback !== null) {
    body = (
      <>
        <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {shortDay(fallback.startTime)} · {formatPragueTime(fallback.startTime)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {fallback.eventName === '' ? 'Termín' : fallback.eventName}
        </Typography>
      </>
    );
  } else {
    body = (
      <>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Žádný objednaný termín.
        </Typography>
        <Button variant="contained" onClick={book} sx={{ mt: 2 }}>
          Objednat termín
        </Button>
      </>
    );
  }

  return (
    <SoftCard>
      <SectionLabel>Příští termín</SectionLabel>
      {body}
    </SoftCard>
  );
}

export default NextAppointmentCard;
