import client from './client';

export interface Measurement {
  id: string;
  patientId: string;
  deviceType: string;
  takenAtUtc: string;
  clinician: string;
  readings: { code: string; name: string; value: number; unit: string; flag: string }[];
}

export const measurementsApi = {
  getByPatient: async (patientId: string): Promise<Measurement[]> => {
    const res = await client.get(`/api/measurements/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  getAll: async (): Promise<Measurement[]> => {
    const res = await client.get('/api/measurements');
    return res.data?.value ?? res.data ?? [];
  },

  importInBody: async (patientId: string, file: File): Promise<Measurement> => {
    const text = await file.text();
    const res = await client.post('/api/measurements/import/inbody', {
      patientId,
      clinician: '',
      rawText: text,
    });
    return res.data?.value ?? res.data;
  },

  importForceDecks: async (patientId: string, file: File): Promise<Measurement> => {
    const text = await file.text();
    const res = await client.post('/api/measurements/import/device', {
      patientId,
      clinician: '',
      rawText: text,
      device: 'ValdForcePlate',
    });
    return res.data?.value ?? res.data;
  },

  importHumanTrak: async (patientId: string, file: File): Promise<Measurement> => {
    const text = await file.text();
    const res = await client.post('/api/measurements/import/device', {
      patientId,
      clinician: '',
      rawText: text,
      device: 'ValdForcePlate',
    });
    return res.data?.value ?? res.data;
  },

  importVO2max: async (patientId: string, file: File): Promise<Measurement> => {
    const text = await file.text();
    const res = await client.post('/api/measurements/import/device', {
      patientId,
      clinician: '',
      rawText: text,
      device: 'Vo2Max',
    });
    return res.data?.value ?? res.data;
  },
};
