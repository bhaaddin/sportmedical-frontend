import { client } from './client';

export interface Injury {
  id: string;
  patientId: string;
  injuryDate: string;
  bodyRegion: string;
  specificLocation: string;
  side: string;
  type: string;
  severity: number;
  status: string;
  mechanism: string;
  diagnosis: string;
  practitioner: string;
  estimatedDaysOut?: number;
  actualDaysOut?: number;
  isRecurrence: boolean;
  clearedAt?: string;
  clearedBy?: string;
  notes: string;
}

export const injuriesApi = {
  getAll: async (): Promise<Injury[]> => {
    const res = await client.get('/api/injuries');
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: Partial<Injury>): Promise<Injury> => {
    const res = await client.post('/api/injuries', data);
    return res.data?.value ?? res.data;
  },
};
