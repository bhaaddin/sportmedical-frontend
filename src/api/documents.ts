import client from './client';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  version: number;
  fileUrl: string;
  requiredForVisit: boolean;
  firstVisitOnly: boolean;
  ageGated: boolean;
  minimumAge: number;
  description: string;
  isActive: boolean;
}

export interface PatientDocument {
  id: string;
  patientId: string;
  templateId: string;
  templateName?: string;
  uploadedAt: string;
  signedAt?: string;
  expiryAt?: string;
  filePath: string;
  status: string;
  appointmentId?: string;
  notes: string;
}

export const documentsApi = {
  getTemplates: async (): Promise<DocumentTemplate[]> => {
    const res = await client.get('/api/documents/templates');
    return res.data?.value ?? res.data ?? [];
  },

  getPatientDocuments: async (patientId: string): Promise<PatientDocument[]> => {
    const res = await client.get(`/api/documents/patient/${patientId}`);
    return res.data?.value ?? res.data ?? [];
  },

  checkRequired: async (patientId: string, isFirstVisit: boolean, patientAge: number) => {
    const res = await client.get(`/api/documents/patient/${patientId}/check?isFirstVisit=${isFirstVisit}&patientAge=${patientAge}`);
    return res.data?.value ?? res.data;
  },

  getSummary: async (patientId: string) => {
    const res = await client.get(`/api/documents/patient/${patientId}/summary`);
    return res.data?.value ?? res.data;
  },

  upload: async (patientId: string, templateId: string, filePath: string): Promise<PatientDocument> => {
    const res = await client.post('/api/documents/upload', { patientId, templateId, filePath });
    return res.data?.value ?? res.data;
  },

  sign: async (documentId: string): Promise<PatientDocument> => {
    const res = await client.post(`/api/documents/${documentId}/sign`);
    return res.data?.value ?? res.data;
  },
};
