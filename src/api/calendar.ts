import client from './client';

/* ── Backend AppointmentType enum values ── */
export type BackendAppointmentType = 'Consultation' | 'Examination' | 'FollowUp' | 'Therapy' | 'Test';

/* ── Backend DTO shapes ── */
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  serviceType: string;
  eventName: string;
  room: string;
  device?: string;
  practitionerName: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
}

/** What the backend actually returns */
export interface AppointmentDto {
  id: string;
  patientId: string;
  patientName: string;
  serviceType: string;
  eventName: string;
  room: string;
  practitionerName: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string;
}

/** What the backend expects to CREATE an appointment */
export interface CreateAppointmentRequest {
  patientId: string;
  startUtc: string;
  durationMinutes: number;    // Integer minutes, e.g. 60
  serviceType: string;        // Maps to AppointmentType enum
  clinic: string;
  room: string;
  practitionerName: string;
  notes?: string;
}

/* ── Map backend DTO → frontend Appointment (for display) ── */
function mapDtoToAppointment(dto: AppointmentDto): Appointment {
  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName,
    serviceType: dto.serviceType,
    eventName: (dto as any).eventName ?? '',
    room: dto.room,
    practitionerName: dto.practitionerName,
    startTime: dto.startTime,
    endTime: dto.endTime,
    status: dto.status,
    notes: dto.notes,
  };
}

function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data?.items) return data.items;
  if (data?.value && Array.isArray(data.value)) return data.value;
  return [];
}

/** Convert frontend form data to backend request format */
/*
 * `toBackendRequest` stood here and mapped a screen appointment into the
 * shape `POST /api/scheduling/appointments` wanted. Its only two callers
 * were `create` and `update`, which are gone with the route that closed, so
 * it went with them.
 *
 * It is worth saying what it held, because that part should not come back:
 * a hardcoded table turning Czech activity names - "Spiroergometrie",
 * "VO2max", "InBody770" - into three backend types, with "Consultation" as
 * the fallback for anything unrecognised. Rename an activity in the
 * settings and it would silently become a consultation. Activities are
 * server-side rows with ids; nothing on this side should be deciding what
 * one is by reading its Czech name.
 */

export const calendarApi = {
  getAppointments: async (from?: string, to?: string): Promise<Appointment[]> => {
    const params = new URLSearchParams();
    if (from) params.set('fromUtc', new Date(from).toISOString());
    if (to) params.set('toUtc', new Date(to).toISOString());
    const res = await client.get(`/api/scheduling/appointments?${params}`);
    const raw = res.data?.value ?? res.data;
    const items = extractItems<AppointmentDto>(raw);
    return items.map(mapDtoToAppointment);
  },

  /*
   * `getById`, `create`, `cancel` and `update` stood here and nothing called
   * any of them - measured across the whole of `src`, not assumed.
   *
   * They are gone rather than kept, because a dead function in a live file is
   * worse than a dead file: it compiles, it reads as available, and the next
   * person to want "book an appointment" finds it and wires it up. What they
   * would get is the booking lane's `410` for creating and `409` for changing
   * an appointment that belongs to a calendar - a failure that looks like a
   * bug in their own new code rather than a route that was closed on purpose.
   *
   * Booking on this system goes through the calendar:
   * `POST /api/calendars/{calendarId}/appointments` in `api/appointments.ts`,
   * which is what every screen actually uses.
   *
   * Reading stays. `GET /api/scheduling/appointments` is untouched by that
   * change and has two live callers - `PatientDrawer` and `UniversalSearch`.
   */
};
