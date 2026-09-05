import { client } from './client';

export interface Posudek {
  id: string;
  patientId: string;
  patientName?: string;
  type: string;
  reportDate: string;
  practitioner: string;
  patientSport: string;
  isCleared: boolean;
  validUntil: string;
  isGenerated: boolean;
  generatedAt?: string;
}

export const posudekApi = {
  getByPatient: async (patientId: string): Promise<Posudek[]> => {
    const res = await client.get(`/api/posudek/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  create: async (data: {
    patientId: string;
    type: string;
    practitioner: string;
    practitionerTitle: string;
    patientName: string;
    patientBirthNumber: string;
    patientSport: string;
    patientClub: string;
    clinicalFindings: string;
    investigationResults: string;
    diagnosis: string;
    isCleared: boolean;
    clearanceConditions: string;
    validUntil: string;
  }): Promise<Posudek> => {
    const res = await client.post('/api/posudek', data);
    return res.data?.value ?? res.data;
  },
};
