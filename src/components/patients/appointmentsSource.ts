/*
 * Where the patient screens get appointments from.
 *
 * Two sources, because no single route answers everything the register and
 * the card want:
 *
 *   GET /api/scheduling/appointments   every appointment on the calendars this
 *                                       account may see, any date; statuses as
 *                                       words; no paperwork, no calendar id
 *   GET /api/day?from&to               the booking grid's window, at most 62
 *                                       days; carries `paperwork` and
 *                                       `calendarId`, so the card can say
 *                                       "dotazník chybí" and open the booking
 *
 * Neither takes a patient id - both are filtered here, which is the wrong
 * shape and is reported in the integrator notes rather than worked around
 * with a third request per row.
 */
import client from '../../api/client';
import { appointmentsApi } from '../../api/appointments';
import type { DayAppointment } from '../../api/bookingContracts';
import { addDaysToDateOnly, pragueDateKey } from '../../utils/time';
import type { PatientAppointment } from './patientActivity';

/** The clinic-wide list, as `PatientAppointmentsPage` has always read it. */
export async function fetchAllAppointments(): Promise<PatientAppointment[]> {
  const res = await client.get('/api/scheduling/appointments');
  const data = res.data?.data ?? res.data?.value ?? res.data ?? [];
  return Array.isArray(data) ? (data as PatientAppointment[]) : [];
}

/** How far ahead the card looks for the next booking and its paperwork. */
export const UPCOMING_WINDOW_DAYS = 61;

/** The booking grid's window from today, every calendar this account may see. */
export function fetchUpcomingWindow(now: Date = new Date()): Promise<DayAppointment[]> {
  const from = pragueDateKey(now);
  return appointmentsApi.range(from, addDaysToDateOnly(from, UPCOMING_WINDOW_DAYS));
}

export const ALL_APPOINTMENTS_KEY = ['scheduling', 'appointments', 'all'] as const;
export const UPCOMING_WINDOW_KEY = ['day', 'upcoming-window'] as const;
