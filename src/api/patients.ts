import client from './client';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  status?: string;
  fullName?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PatientRegistration {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  sex: string;
  email?: string;
  phone?: string;
  registrationBusinessDate: string;
}

function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data?.items) return data.items;
  return [];
}

export const patientsApi = {
  getAll: async (): Promise<Patient[]> => {
    const res = await client.get('/api/patients');
    return extractItems<Patient>(res.data);
  },

  getById: async (id: string): Promise<Patient> => {
    const res = await client.get(`/api/patients/${id}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: PatientRegistration): Promise<Patient> => {
    const res = await client.post('/api/patients', data);
    return res.data?.value ?? res.data;
  },

  update: async (id: string, data: Partial<PatientRegistration>): Promise<Patient> => {
    const res = await client.put(`/api/patients/${id}`, data);
    return res.data?.value ?? res.data;
  },

  search: async (query: string): Promise<Patient[]> => {
    const res = await client.get(`/api/patients/search?q=${encodeURIComponent(query)}`);
    const d = res.data;
    return extractItems<Patient>(d);
  },

  getProfile: async (id: string): Promise<any> => {
    const res = await client.get(`/api/patients/${id}/profile`);
    return res.data?.value ?? res.data;
  },

  saveProfile: async (id: string, profile: any): Promise<void> => {
    await client.put(`/api/patients/${id}/profile`, profile);
  },
};
