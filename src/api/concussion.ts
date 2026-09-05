import { client } from './client';

export interface ConcussionRecord {
  id: string;
  patientId: string;
  patientName?: string;
  injuryDate: string;
  mechanism: string;
  severityGrade: number;
  practitioner: string;
  symptomScore: number;
  lossOfConsciousness: boolean;
  status: string;
  clearedDate?: string;
  clearedBy?: string;
}

export const concussionApi = {
  getByPatient: async (patientId: string): Promise<ConcussionRecord[]> => {
    const res = await client.get(`/api/concussion/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: {
    patientId: string;
    mechanism: string;
    severityGrade: number;
    practitioner: string;
    lossOfConsciousness: boolean;
    symptomScore: number;
  }): Promise<ConcussionRecord> => {
    const res = await client.post('/api/concussion', data);
    return res.data?.value ?? res.data;
  },

  updateStatus: async (id: string, status: string, clearedBy?: string): Promise<ConcussionRecord> => {
    const res = await client.put(`/api/concussion/${id}/status`, { status, clearedBy });
    return res.data?.value ?? res.data;
  },
};
