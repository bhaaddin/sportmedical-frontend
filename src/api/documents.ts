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

  /*
   * Sends the file itself.
   *
   * This used to post `{ patientId, templateId, filePath }` as JSON - a path
   * to a file supposedly already sitting on the server. Nothing ever put a
   * file there, so nothing could be uploaded, and the screen grew a notice
   * saying the endpoint did not exist.
   *
   * It does exist and it takes multipart. Measured against the running API on
   * 12. 9. 2026: `file + patientId + templateId` returns 200 with the stored
   * document, and omitting `templateId` returns
   * "Template 00000000-0000-0000-0000-000000000000 not found" - which is how
   * the real contract was found, by asking the server rather than the code.
   *
   * `onProgress` reports 0-1 while the bytes go out. A scan of a few pages is
   * megabytes, and a button that only says "Ukládám…" for thirty seconds is
   * indistinguishable from one that has hung.
   */
  upload: async (
    patientId: string,
    templateId: string,
    file: File,
    onProgress?: (fraction: number) => void,
  ): Promise<PatientDocument> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('patientId', patientId);
    form.append('templateId', templateId);

    const res = await client.post('/api/documents/upload', form, {
      /*
       * The header must be cleared, not set.
       *
       * `api/client.ts` puts `Content-Type: application/json` on every request
       * as a default. Axios would normally replace that for a FormData body
       * with `multipart/form-data` plus the boundary it generates - but an
       * explicit default wins, so the file went out labelled as JSON and the
       * server answered 410. Measured both ways against the running API on
       * 12. 9. 2026: without the forced header 200, with it 410.
       *
       * Setting it to undefined lets axios compute it. Writing
       * `multipart/form-data` by hand would be worse than leaving it alone -
       * the boundary is generated per request and a fixed value makes the body
       * unparseable.
       */
      headers: { 'Content-Type': undefined },
      onUploadProgress: (event) => {
        if (onProgress === undefined) return;
        /* `total` is absent on some browsers for streamed bodies; then the bar
           stays indeterminate rather than reporting a made-up number. */
        if (typeof event.total === 'number' && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      },
    });
    return res.data?.value ?? res.data;
  },

  sign: async (documentId: string): Promise<PatientDocument> => {
    const res = await client.post(`/api/documents/${documentId}/sign`);
    return res.data?.value ?? res.data;
  },
};
