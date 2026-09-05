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
export function toBackendRequest(data: {
  patientId: string;
  serviceType?: string;
  startTime?: string;
  endTime?: string;
  practitionerName?: string;
  room?: string;
  notes?: string;
  id?: string;
}): CreateAppointmentRequest {
  // Map frontend serviceType names to backend AppointmentType enum
  const typeMap: Record<string, BackendAppointmentType> = {
    'Základní prohlídka': 'Examination',
    'Komplexní prohlídka': 'Examination',
    'Spiroergometrie': 'Test',
    'Základní diagnostika': 'Test',
    'Komplexní diagnostika': 'Test',
    'VO2max': 'Test',
    'InBody770': 'Test',
    'Video kompenzační plány': 'Therapy',
  };

  const serviceType = data.serviceType || '';
  const type: BackendAppointmentType = typeMap[serviceType] || 'Consultation';

  // Calculate duration from startTime and endTime
  let durationMinutes = 60; // default 1 hour
  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime).getTime();
    const end = new Date(data.endTime).getTime();
    durationMinutes = Math.max(15, Math.round((end - start) / 60000));
  }

  return {
    patientId: data.patientId,
    startUtc: data.startTime ? new Date(data.startTime).toISOString() : new Date().toISOString(),
    durationMinutes: durationMinutes,
    serviceType: serviceType,
    clinic: 'SportMedical',
    room: data.room || 'GreenLine 5.patro',
    practitionerName: data.practitionerName || '',
    notes: data.notes,
  };
}

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

  getById: async (id: string): Promise<Appointment> => {
    const res = await client.get(`/api/scheduling/appointments/${id}`);
    const dto: AppointmentDto = res.data?.value ?? res.data;
    return mapDtoToAppointment(dto);
  },

  create: async (data: Partial<Appointment>): Promise<Appointment> => {
    const request = toBackendRequest(data as any);
    const res = await client.post('/api/scheduling/appointments', request);
    const dto: AppointmentDto = res.data?.value ?? res.data;
    return mapDtoToAppointment(dto);
  },

  cancel: async (id: string): Promise<void> => {
    // Backend uses POST /api/appointments/{id}/cancel, not DELETE
    await client.post(`/api/scheduling/appointments/${id}/cancel`);
  },

  cancelByToken: async (token: string): Promise<void> => {
    await client.post(`/api/public/booking/cancel/${token}`);
  },

  update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const request = toBackendRequest(data as any);
    const res = await client.put(`/api/scheduling/appointments/${id}`, request);
    const dto: AppointmentDto = res.data?.value ?? res.data;
    return mapDtoToAppointment(dto);
  },
};
