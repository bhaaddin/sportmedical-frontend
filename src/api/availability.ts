import { client } from './client';

export interface Availability {
  id: string;
  patientId: string;
  patientName?: string;
  date: string;
  status: string;
  reason: string;
  relatedInjuryId?: string;
  expectedReturnDate?: string;
  updatedBy: string;
}

export const availabilityApi = {
  getAll: async (): Promise<Availability[]> => {
    const res = await client.get('/api/availability');
    return res.data?.value ?? res.data ?? [];
  },

  getByPatient: async (patientId: string): Promise<Availability[]> => {
    const res = await client.get(`/api/availability/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: Partial<Availability>): Promise<Availability> => {
    const res = await client.post('/api/availability', data);
    return res.data?.value ?? res.data;
  },
};
