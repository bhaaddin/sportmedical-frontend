/*
 * R15c (c) - "the patient already has another booking that day": a notice (never a block) with the time and the činnost and a link
 * to the patient's card. Pure rules over the day's rows the calendar has already read; the dialog asks the same cached range.
 */
import { statusTally, type DayAppointment } from '../../../api/bookingContracts';
import { pragueClock } from '../NewAppointmentDialog.logic';
import { pragueDateKey } from '../../../utils/time';

export interface SameDayBooking {
  id: string;
  calendarId: string | null;
  /** `HH:mm` clinic time. */
  time: string;
  activityName: string;
}

/** The patient's other live bookings on `dayKey`, in time order. `excludeId` is the booking being moved / edited. */
export function otherBookingsThatDay(rows: readonly DayAppointment[], patientId: string, dayKey: string, excludeId?: string): SameDayBooking[] {
  if (patientId === '') return [];
  return rows
    .filter((a) => a.patientId === patientId && a.id !== excludeId && statusTally(a.status) !== 'cancelled' &&pragueDateKey(a.startUtc) === dayKey)
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))
    .map((a) => ({ id: a.id, calendarId: a.calendarId, time: pragueClock(a.startUtc), activityName: a.activityName || 'Činnost' }));
}

/** "Pacient už má ten den: 09:00 Spiroergometrie" / "... a 1 další". */
export function sameDayText(list: readonly SameDayBooking[]): string {
  if (list.length === 0) return '';
  const first = list[0]!;
  const more = list.length - 1;
  return `Pacient už má ten den rezervaci: ${first.time} ${first.activityName}${more > 0 ? ` a ${more} ${more === 1 ? 'další' : more < 5 ? 'další' : 'dalších'}` : ''}.`;
}
