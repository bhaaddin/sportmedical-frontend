import client from './client';

export interface PublicBookingEventType {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  room: string;
  providerName: string;
  color: string;
  customQuestionsJson: string;
}

export interface BookingSlot {
  start: string;
  end: string;
  durationMinutes: number;
  timeZone: string;
  providerName?: string;
}

export interface PublicBooking {
  bookingId: string;
  status: string;
  startUtc: string;
  endUtc: string;
  eventName: string;
  room: string;
  providerName: string;
  inviteeName: string;
  inviteeEmail: string;
}

export interface BookingAvailabilitySchedule {
  id: string;
  providerName: string;
  timeZone: string;
  intervals: {
    id: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }[];
}

export const publicBookingApi = {
  // ── Public (no auth) ──────────────────────────────────────────
  getEventTypes: async (): Promise<PublicBookingEventType[]> => {
    const res = await client.get('/api/public/booking/events');
    return res.data?.value ?? res.data ?? [];
  },

  getEventBySlug: async (slug: string): Promise<PublicBookingEventType> => {
    const res = await client.get(`/api/public/booking/events/${slug}`);
    return res.data?.value ?? res.data;
  },

  getSlots: async (slug: string, from: string, to: string, timeZone = 'Europe/Prague'): Promise<BookingSlot[]> => {
    const params = new URLSearchParams({ slug, from, to, timeZone });
    const res = await client.get(`/api/public/booking/slots?${params}`);
    return res.data?.value ?? res.data ?? [];
  },

  createBooking: async (data: {
    slug: string;
    inviteeName: string;
    inviteeEmail: string;
    inviteePhone?: string;
    inviteeTimeZone?: string;
    startAt: string;
    notes?: string;
    consentsJson?: string;
    providerName?: string;
    idempotencyKey?: string;
  }): Promise<PublicBooking> => {
    const res = await client.post('/api/public/booking/bookings', data);
    return res.data?.value ?? res.data;
  },

  getBooking: async (id: string): Promise<PublicBooking> => {
    const res = await client.get(`/api/public/booking/bookings/${id}`);
    return res.data?.value ?? res.data;
  },

  cancelBooking: async (id: string, reason?: string): Promise<void> => {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await client.delete(`/api/public/booking/bookings/${id}${params}`);
  },

  checkPatient: async (email: string): Promise<{ isFirstVisit: boolean }> => {
    const res = await client.get(`/api/public/booking/check-patient?email=${encodeURIComponent(email)}`);
    return res.data?.value ?? res.data;
  },

  // ── Admin (auth required) ────────────────────────────────────
  adminGetAll: async (): Promise<PublicBookingEventType[]> => {
    const res = await client.get('/api/booking/event-types');
    return res.data?.value ?? res.data ?? [];
  },

  adminGetBookings: async (params?: { from?: string; to?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.status) search.set('status', params.status);
    const res = await client.get(`/api/booking/admin/bookings?${search}`);
    return res.data?.value ?? res.data ?? [];
  },

  adminGetStats: async () => {
    const res = await client.get('/api/booking/admin/stats');
    return res.data?.value ?? res.data;
  },

  adminGetPatientDocuments: async (params: { email?: string; firstName?: string; lastName?: string; birthDate?: string }) => {
    const search = new URLSearchParams();
    if (params.email) search.set('email', params.email);
    if (params.firstName) search.set('firstName', params.firstName);
    if (params.lastName) search.set('lastName', params.lastName);
    if (params.birthDate) search.set('birthDate', params.birthDate);
    const res = await client.get(`/api/booking/admin/patient-documents?${search}`);
    return res.data?.value ?? res.data;
  },

  adminSeed: async () => {
    const res = await client.post('/api/booking/event-types/seed');
    return res.data?.value ?? res.data;
  },

  // ── Availability ──────────────────────────────────────────────
  getAvailabilitySchedules: async (): Promise<BookingAvailabilitySchedule[]> => {
    const res = await client.get('/api/booking/availability');
    return res.data?.value ?? res.data ?? [];
  },

  saveAvailabilitySchedule: async (schedule: Partial<BookingAvailabilitySchedule>): Promise<BookingAvailabilitySchedule> => {
    if (schedule.id) {
      const res = await client.put(`/api/booking/availability/${schedule.id}`, schedule);
      return res.data?.value ?? res.data;
    }
    const res = await client.post('/api/booking/availability', schedule);
    return res.data?.value ?? res.data;
  },
};
