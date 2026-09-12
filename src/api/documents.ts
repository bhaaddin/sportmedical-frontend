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

export type DocumentStatus =
  | 'Pending'
  | 'SignedOff'
  | 'Expired'
  | 'Superseded'
  | 'Rejected';

/** Signed off is the only state that satisfies a required-document rule. */
export const DOCUMENT_SATISFIES_REQUIREMENT: DocumentStatus = 'SignedOff';

export interface PatientDocument {
  id: string;
  patientId: string;
  templateId: string;
  templateName?: string;
  uploadedAt: string;
  signedAt?: string;
  expiryAt?: string;
  filePath: string;
  /*
   * The server's `DocumentStatus`, as names on the wire - measured against the
   * running API on 12. 9. 2026, and matching the domain enum:
   *
   *     Pending  SignedOff  Expired  Superseded  Rejected
   *
   * Typed as a union rather than `string`, because this screen spent its whole
   * life comparing it to `'Signed'` and `'Active'` - two values the server has
   * never sent and the enum has never held. A union makes that a compile
   * error instead of a warning nobody can clear.
   */
  status: DocumentStatus;
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
