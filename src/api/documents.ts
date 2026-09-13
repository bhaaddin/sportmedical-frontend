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

/*
 * Staff means the person was standing there holding the paper; Patient means
 * it arrived from outside and somebody has to look at it before it counts.
 */
export type DocumentSource = 'Staff' | 'Patient';

/*
 * Why a document was struck out. A fixed list, and the server refuses anything
 * else with a 400.
 *
 * "Belongs to another patient" is deliberately absent. It is the first thing
 * anybody would reach for, and the one case where invalidating is the wrong
 * answer: the document is fine, it is filed in the wrong place, and the fix is
 * to move it. Leaving it off the list pushes people to the move.
 */
export const INVALIDATION_REASONS = [
  'unreadable',
  'wrong_document',
  'outdated',
  'duplicate',
  'other',
] as const;

export type InvalidationReason = (typeof INVALIDATION_REASONS)[number];

/** Said the way somebody at a desk would say it. */
export const INVALIDATION_REASON_LABEL: Record<InvalidationReason, string> = {
  unreadable: 'Nečitelné',
  wrong_document: 'Špatný dokument',
  outdated: 'Zastaralé',
  duplicate: 'Duplicitní',
  other: 'Jiný důvod',
};

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
  /*
   * Null for a medical report from another doctor - those belong to no
   * template, which is exactly what keeps them out of the required-document
   * rules: the readiness check pairs `d.templateId === template.id`, and a
   * document with no template has nothing to pair with.
   *
   * Typed nullable on 12. 9. 2026, the day the server made it so. Left as
   * `string` it would have compiled and thrown at runtime the first time a
   * cardiology report reached a screen - which is the kind of break nobody
   * sees until a patient is standing at the desk.
   */
  templateId: string | null;
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
  /*
   * Who put this here. Taken by the server from the session, never from the
   * form - it decides whether the document counts immediately, and anything a
   * caller can set is something a caller can grant themselves.
   */
  source: DocumentSource;
  uploadedByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAtUtc: string | null;
  /** Set only on a medical report from another doctor. */
  specialtyCode: string | null;
  /*
   * The name for that code, resolved by the server.
   *
   * Null when there is no code, and also when the register no longer has one -
   * entries are retired, and a report filed under a retired code still has to
   * be readable. So this is a convenience, never the thing to branch on.
   */
  specialtyName: string | null;
  /** What the person typed when no code fitted. */
  specialtyOther: string | null;
  /** What the patient said it was - a hint for the reviewer, never the answer. */
  specialtySuggestedByPatient: string | null;
  /** The date on the report, not the date it was uploaded. Date only, no zone. */
  reportDate: string | null;

  /*
   * Where this document came from, if it was filed under the wrong patient
   * and moved. Kept for the history, deliberately not drawn on the old
   * patient's card - a row there would still be one patient's card talking
   * about somebody else.
   */
  movedFromPatientId: string | null;
  movedByUserId: string | null;
  movedAtUtc: string | null;

  /*
   * Why this document no longer counts. `Invalidated` is not a separate
   * status: an invalidated document stops being `SignedOff`, which is what
   * the readiness rules count, so it falls out of them without any further
   * arrangement.
   */
  invalidationReasonCode: InvalidationReason | null;
  invalidationNote: string | null;
  invalidatedByUserId: string | null;
  invalidatedAtUtc: string | null;
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
    /* Null for a report from another doctor - it belongs to no template, and
       that absence is what keeps it out of the required-document rules. */
    templateId: string | null,
    file: File,
    onProgress?: (fraction: number) => void,
    report?: { specialtyCode: string | null; specialtyOther: string | null; reportDate: string | null },
  ): Promise<PatientDocument> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('patientId', patientId);
    if (templateId !== null) form.append('templateId', templateId);
    if (report?.specialtyCode != null) form.append('specialtyCode', report.specialtyCode);
    if (report?.specialtyOther != null) form.append('specialtyOther', report.specialtyOther);
    if (report?.reportDate != null) form.append('reportDate', report.reportDate);

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

  /**
   * Accept or turn away a document the patient sent in.
   *
   * The server records who did it. That is the point of the step: for a
   * document somebody carried to the desk there is nothing to decide, but for
   * one that arrived from a phone there is - and in a year the question will
   * be "who said this was the výpis", which needs an answer.
   */
  review: async (documentId: string, accepted: boolean): Promise<PatientDocument> => {
    const res = await client.post(
      `/api/documents/${documentId}/review?accepted=${accepted ? 'true' : 'false'}`,
    );
    return res.data?.value ?? res.data;
  },

  /** Put a medical report under a different specialty. */
  reclassify: async (
    documentId: string,
    specialty: { specialtyCode: string | null; specialtyOther: string | null },
  ): Promise<PatientDocument> => {
    const res = await client.post(`/api/documents/${documentId}/reclassify`, specialty);
    return res.data?.value ?? res.data;
  },

  /**
   * The specialty suggester.
   *
   * Searching, ordering and the synonyms all live on the server on purpose.
   * Keeping a copy of the list here would let the two drift, and a suggester
   * that offers a specialty the server will not accept is worse than no
   * suggester. An empty query returns what a clinic actually uses.
   */
  specialties: async (q: string, take = 10): Promise<Specialty[]> => {
    const res = await client.get('/api/documents/specialties', { params: { q, take } });
    return res.data?.value ?? res.data ?? [];
  },

  /**
   * The file itself, as a blob URL the browser can show.
   *
   * Fetched rather than linked: the endpoint needs the bearer token, and an
   * `<a href>` or an `<iframe src>` carries no headers. The server sends
   * `Content-Disposition: inline`, so a PDF or a photograph opens instead of
   * downloading.
   *
   * The caller owns the URL it gets back and must revoke it - an object URL
   * pins its blob in memory until it does, and these are scans.
   */
  content: async (documentId: string): Promise<string> => {
    const res = await client.get(`/api/documents/${documentId}/content`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(res.data as Blob);
  },

  /**
   * File this document under a different patient.
   *
   * The readiness rules follow it: a výpis moved away stops counting for the
   * patient it left, which is correct and is why the screen warns first.
   */
  move: async (documentId: string, toPatientId: string): Promise<PatientDocument> => {
    const res = await client.post(
      `/api/documents/${documentId}/move?toPatientId=${toPatientId}`,
    );
    return res.data?.value ?? res.data;
  },

  /** Strike a document out, with a reason from the fixed list. */
  invalidate: async (
    documentId: string,
    reasonCode: InvalidationReason,
    note: string,
  ): Promise<PatientDocument> => {
    const res = await client.post(`/api/documents/${documentId}/invalidate`, {
      reasonCode,
      note,
    });
    return res.data?.value ?? res.data;
  },
};

export interface Specialty {
  code: string;
  name: string;
  /** Offered before anybody types. */
  isCommon: boolean;
}
