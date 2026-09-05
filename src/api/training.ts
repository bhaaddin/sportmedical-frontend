import { client } from './client';

export interface TrainingSession {
  id: string;
  patientId: string;
  sessionDate: string;
  type: string;
  description: string;
  durationMinutes: number;
  rpe: number;
  sessionRPE: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  coach: string;
  notes: string;
}

export interface AcwrData {
  acwrValue: number;
  riskLevel: string;
  riskDescription: string;
  acuteLoad: number;
  chronicLoad: number;
  acuteSessions: number;
  chronicSessions: number;
}

export const trainingApi = {
  getByPatient: async (patientId: string, days = 30): Promise<TrainingSession[]> => {
    const res = await client.get(`/api/training/patient/${patientId}?days=${days}`);
    return res.data?.value ?? res.data ?? [];
  },

  getAcwr: async (patientId: string): Promise<AcwrData> => {
    const res = await client.get(`/api/training/patient/${patientId}/acwr`);
    return res.data?.value ?? res.data;
  },

  getLoadTrend: async (patientId: string, weeks = 8): Promise<any[]> => {
    const res = await client.get(`/api/training/patient/${patientId}/load-trend?weeks=${weeks}`);
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: Partial<TrainingSession>): Promise<TrainingSession> => {
    const res = await client.post('/api/training', data);
    return res.data?.value ?? res.data;
  },
};
