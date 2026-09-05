import client from './client';

export interface DiagnosticSession {
  id: string;
  patientId: string;
  sessionDate: string;
  practitionerName: string;
  restingHeartRateBpm: number;
  maxHeartRateBpm: number;
  vo2MaxMlMinKg: number;
  anaerobicThresholdBpm: number;
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  rawPractitionerNotes?: string;
  agentGeneratedSummary?: string;
  detectedAnomaliesJson?: string;
  requiresDoctorReview: boolean;
  createdAtUtc: string;
}

export interface CreateSessionRequest {
  patientId: string;
  practitionerName: string;
  dateOfBirth?: string;
  restingHeartRateBpm: number;
  maxHeartRateBpm: number;
  vo2MaxMlMinKg: number;
  anaerobicThresholdBpm: number;
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  rawPractitionerNotes?: string;
}

export const diagnosticsApi = {
  create: async (data: CreateSessionRequest): Promise<DiagnosticSession> => {
    const res = await client.post('/api/v1/diagnostics/sessions', data);
    return res.data?.value ?? res.data;
  },

  getById: async (id: string): Promise<DiagnosticSession> => {
    const res = await client.get(`/api/v1/diagnostics/sessions/${id}`);
    return res.data?.value ?? res.data;
  },

  getByPatient: async (patientId: string): Promise<DiagnosticSession[]> => {
    const res = await client.get(`/api/v1/diagnostics/patients/${patientId}/sessions`);
    return res.data?.value ?? res.data ?? [];
  },

  regenerate: async (id: string): Promise<DiagnosticSession> => {
    const res = await client.post(`/api/v1/diagnostics/sessions/${id}/regenerate-analysis`);
    return res.data?.value ?? res.data;
  },

  downloadPdf: async (sessionId: string): Promise<void> => {
    const res = await client.get(`/api/pdf/diagnostic-session/${sessionId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `diagnosticka-zprava_${sessionId.slice(0, 8)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadPosudekPdf: async (posudekId: string): Promise<void> => {
    const res = await client.get(`/api/pdf/posudek/${posudekId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `posudek_${posudekId.slice(0, 8)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
