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
  create: async (data: Partial<WellnessEntry>): Promise<WellnessEntry> => {
    const res = await client.post('/api/wellness', data);
    return res.data?.value ?? res.data;
  },
};
