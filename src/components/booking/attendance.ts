/* ══════════════════════════════════════════════════════════════
   SMART CONFIRMATIONS — the rules, with nothing drawn

   Two facts about a booking that the screen derives from the clock and the
   clinic's settings rather than storing:

     - "asi nepřišel": still "Objednán" (or "Potvrzen") this many minutes
       after the start. A FLAG, never a change of status. The status moves
       only when a person clicks "Nepřišel" or "Přišel"; a system that marked
       somebody absent at half past nine when they walked in at a quarter
       past ten would leave a lie in the statistics.

     - "pacient může měnit do …": the last moment the patient may reschedule
       or cancel through their own link, `start − deadline hours`.

   Both numbers come from `GET /api/v1/settings/attendance`
   (`attendance.noShowAfterMinutes`, `booking.patientChangeDeadlineHours`);
   nothing here has a number of its own.
   ══════════════════════════════════════════════════════════════ */
import { isLateStatus } from '../../api/bookingContracts';

/**
 * Whether a booking should carry the amber "asi nepřišel" flag right now.
 *
 * Only while the patient is still expected (Objednán / Potvrzen). Somebody
 * marked as arrived, done, absent or cancelled has an answer already.
 */
export function probablyAbsent(
  startUtc: string,
  status: number,
  noShowAfterMinutes: number,
  now: Date,
): boolean {
  if (!isLateStatus(status)) return false;
  const start = new Date(startUtc).getTime();
  if (Number.isNaN(start)) return false;
  return now.getTime() >= start + noShowAfterMinutes * 60_000;
}

/**
 * "čt 24. 9. 09:00" - the wave-3 contract's own wording for an instant on a
 * booking: weekday, day, month and clinic time, no year (it is this week or
 * next, never a different year that matters).
 */
export function formatDeadline(instant: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  })
    .format(instant)
    .replace(/\s+/g, ' ');
}

/** The instant until which the patient may still change the booking themselves. */
export function patientChangeDeadline(startUtc: string, deadlineHours: number): Date {
  return new Date(new Date(startUtc).getTime() - deadlineHours * 3_600_000);
}

/**
 * The sentence under a booking about the patient's own window, in Czech.
 * `null` when there is nothing to say - the booking is over one way or another.
 */
export function patientChangeSentence(
  startUtc: string,
  status: number,
  deadlineHours: number,
  now: Date,
  formatDateTime: (instant: Date) => string,
): string | null {
  if (!isLateStatus(status)) return null;
  const deadline = patientChangeDeadline(startUtc, deadlineHours);
  if (Number.isNaN(deadline.getTime())) return null;
  return now.getTime() < deadline.getTime()
    ? `Pacient může termín sám změnit nebo zrušit do ${formatDateTime(deadline)}.`
    : `Lhůta, do kdy mohl pacient termín sám změnit (${formatDateTime(deadline)}), už uplynula; změny teď dělá recepce.`;
}
