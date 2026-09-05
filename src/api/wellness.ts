import { client } from './client';

export interface WellnessEntry {
  id: string;
  patientId: string;
  reportDate: string;
  sleepQuality: number;
  sleepHours: number;
  mood: number;
  stress: number;
  soreness: number;
  fatigue: number;
  readiness: number;
  restingHR?: number;
  bodyWeight?: number;
  hydration: number;
  notes: string;
  compositeScore: number;
  flaggedForReview: boolean;
  flagReason?: string;
}

export const wellnessApi = {
  getByPatient: async (patientId: string, days = 30): Promise<WellnessEntry[]> => {
    const res = await client.get(`/api/wellness/patient/${patientId}?days=${days}`);
    return res.data?.value ?? res.data ?? [];
  },

  getSummary: async (patientId: string, days = 7): Promise<any> => {
    const res = await client.get(`/api/wellness/patient/${patientId}/summary?days=${days}`);
    return res.data?.value ?? res.data;
  },

  create: async (data: Partial<WellnessEntry>): Promise<WellnessEntry> => {
    const res = await client.post('/api/wellness', data);
    return res.data?.value ?? res.data;
  },
};
