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
import type { QueryClient } from '@tanstack/react-query';
import client from '../../api/client';
import { appointmentsApi } from '../../api/appointments';
import type { DayAppointment } from '../../api/bookingContracts';
import { addDaysToDateOnly, pragueDateKey } from '../../utils/time';
import type { PatientAppointment } from './patientActivity';

/**
 * The clinic-wide list, as `PatientAppointmentsPage` has always read it. With a `patientId` the server (network plan b6)
 * filters in the database and answers only that patient's rows; an older server ignores the parameter and answers the
 * whole list, so a caller that wants one patient still filters by `patientId` itself, as every caller here does.
 */
export async function fetchAllAppointments(patientId?: string): Promise<PatientAppointment[]> {
  const res = await client.get('/api/scheduling/appointments', patientId ? { params: { patientId } } : undefined);
  const data = res.data?.data ?? res.data?.value ?? res.data ?? [];
  return Array.isArray(data) ? (data as PatientAppointment[]) : [];
}

const SHARED_FRESH_MS = 60_000;

/**
 * One patient's visits. A clinic-wide list that is already held (and fresh) is cut down here and nothing is asked. Otherwise
 * the server is asked with `patientId`; an older server ignores it and answers everybody (rows of other patients show it),
 * and that answer is then kept under `ALL_APPOINTMENTS_KEY` too, so the next patient is cut from it instead of downloading
 * the whole clinic again. Only this patient's rows are returned.
 */
export async function fetchPatientAppointments(queryClient: QueryClient, patientId: string): Promise<PatientAppointment[]> {
  const mine = (rows: PatientAppointment[]) => rows.filter((a) => a.patientId === patientId);
  const state = queryClient.getQueryState<PatientAppointment[]>(ALL_APPOINTMENTS_KEY);
  if (state?.data !== undefined && !state.isInvalidated && Date.now() - state.dataUpdatedAt < SHARED_FRESH_MS) return mine(state.data);
  const rows = await fetchAllAppointments(patientId);
  if (rows.some((a) => a.patientId !== patientId)) queryClient.setQueryData(ALL_APPOINTMENTS_KEY, rows);
  return mine(rows);
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
