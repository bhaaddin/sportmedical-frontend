import { client } from './client';

export interface WearableData {
  id: string;
  patientId: string;
  provider: string;
  dataDate: string;
  restingHR?: number;
  maxHR?: number;
  hrv?: number;
  sleepHours?: number;
  sleepScore?: number;
  recoveryScore?: number;
  strainScore?: number;
  caloriesBurned?: number;
  steps?: number;
  activeMinutes?: number;
}

export interface WearableSummary {
  avgRestingHR: number;
  avgHRV: number;
  avgSleepHours: number;
  avgRecovery: number;
  avgStrain: number;
  avgCalories: number;
  dataPoints: number;
}

export const wearablesApi = {
  getByPatient: async (patientId: string, days = 30): Promise<WearableData[]> => {
    const res = await client.get(`/api/wearables/patient/${patientId}?days=${days}`);
    return res.data?.value ?? res.data ?? [];
  },

  getSummary: async (patientId: string, days = 7): Promise<WearableSummary> => {
    const res = await client.get(`/api/wearables/patient/${patientId}/summary?days=${days}`);
    return res.data?.value ?? res.data;
  },

  import: async (data: {
    patientId: string;
    provider: string;
    restingHR?: number;
    maxHR?: number;
    hrv?: number;
    sleepHours?: number;
    sleepScore?: number;
    recoveryScore?: number;
    strainScore?: number;
    caloriesBurned?: number;
    steps?: number;
    activeMinutes?: number;
  }): Promise<WearableData> => {
    const res = await client.post('/api/wearables', data);
    return res.data?.value ?? res.data;
  },
};
