import { client } from './client';

export interface PreParticipationExam {
  id: string;
  patientId: string;
  patientName?: string;
  examDate: string;
  practitioner: string;
  hasCardiacHistory: boolean;
  hasConcussionHistory: boolean;
  hasMusculoskeletalHistory: boolean;
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  heightCm: number;
  weightKg: number;
  isCleared: boolean;
  clearanceNotes: string;
}

export const ppeApi = {
  getByPatient: async (patientId: string): Promise<PreParticipationExam[]> => {
    const res = await client.get(`/api/ppe/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: {
    patientId: string;
    practitioner: string;
    hasCardiacHistory: boolean;
    hasConcussionHistory: boolean;
    hasMusculoskeletalHistory: boolean;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    heartRate: number;
    heightCm: number;
    weightKg: number;
  }): Promise<PreParticipationExam> => {
    const res = await client.post('/api/ppe', data);
    return res.data?.value ?? res.data;
  },
};
