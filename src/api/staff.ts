import client from './client';

export interface StaffMember {
  id: string;
  fullName: string;
  role: string;
  department: string;
  email: string;
  schedule?: string;
  phone?: string;
  isActive: boolean;
}

export interface StaffPerformance {
  staffId: string;
  period: string;
  clientsServed: number;
  totalMinutesWorked: number;
  avgMinutesPerClient: number;
  shiftStart: string;
  shiftEnd: string;
  bonusEligible: boolean;
}

export interface CreateStaffRequest {
  fullName: string;
  role: string;
  department: string;
  email: string;
  schedule?: string;
  phone: string;
}

export const staffApi = {
  getAll: async (): Promise<StaffMember[]> => {
    const res = await client.get('/api/staff');
    return res.data?.value ?? res.data ?? [];
  },

  getById: async (id: string): Promise<StaffMember> => {
    const res = await client.get(`/api/staff/${id}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: CreateStaffRequest): Promise<StaffMember> => {
    const res = await client.post('/api/staff', data);
    return res.data?.value ?? res.data;
  },

  update: async (id: string, data: Partial<CreateStaffRequest>): Promise<StaffMember> => {
    const res = await client.put(`/api/staff/${id}`, { ...data, isActive: true });
    return res.data?.value ?? res.data;
  },

  deactivate: async (id: string): Promise<void> => {
    await client.delete(`/api/staff/${id}`);
  },

  getPerformance: async (staffId: string, period?: string): Promise<StaffPerformance> => {
    const params = period ? `?period=${period}` : '';
    const res = await client.get(`/api/staff/${staffId}/performance${params}`);
    return res.data?.value ?? res.data ?? {
      staffId, period: period || 'current', clientsServed: 0,
      totalMinutesWorked: 0, avgMinutesPerClient: 0, shiftStart: '', shiftEnd: '', bonusEligible: false,
    };
  },

  getWorkdays: async (staffId: string): Promise<string[]> => {
    const res = await client.get(`/api/staff/${staffId}/workdays`);
    return res.data?.value ?? res.data ?? [];
  },

  setWorkdays: async (staffId: string, days: string[]): Promise<void> => {
    await client.put(`/api/staff/${staffId}/workdays`, { days });
  },
};
