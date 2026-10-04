import client from './client';

/**
 * "Souhlasy podepsány na místě": the patient signed the consents on paper at
 * the desk and the receptionist records that fact.
 *
 *   GET  /api/patients/consents/on-site/options?activityId=   (patients.register)
 *   POST /api/patients/{patientId}/consents/on-site           (patients.register)
 *
 * The server decides which consents apply to a činnost; nothing here knows the
 * list. Errors keep the existing problem shape `{ code, message }`.
 */

export interface OnSiteConsentOption {
  code: string;
  label: string;
  required: boolean;
}

export interface OnSiteConsentOptions {
  activityId: string | null;
  options: OnSiteConsentOption[];
}

export interface OnSiteConsentRecorded {
  code: string;
  policyVersion?: string;
  grantedAtUtc?: string;
  source?: string;
  recordedBy?: string;
}

export interface OnSiteConsentResult {
  patientId: string;
  recorded: OnSiteConsentRecorded[];
  alreadyOnFile: string[];
  missingConsents: string[];
  paperwork: { ready: boolean; missing: string[] } | null;
}

export interface RecordOnSiteConsentsInput {
  activityId: string | null;
  consents: string[];
  note: string | null;
}

export const onSiteConsentsApi = {
  async getOptions(activityId?: string | null): Promise<OnSiteConsentOptions> {
    const res = await client.get('/api/patients/consents/on-site/options', {
      params: activityId ? { activityId } : undefined,
    });
    const data = res.data ?? {};
    return {
      activityId: typeof data.activityId === 'string' ? data.activityId : null,
      options: Array.isArray(data.options) ? (data.options as OnSiteConsentOption[]) : [],
    };
  },

  async record(patientId: string, input: RecordOnSiteConsentsInput): Promise<OnSiteConsentResult> {
    const res = await client.post(
      `/api/patients/${encodeURIComponent(patientId)}/consents/on-site`,
      { activityId: input.activityId, consents: input.consents, note: input.note },
    );
    const d = res.data ?? {};
    return {
      patientId: typeof d.patientId === 'string' ? d.patientId : patientId,
      recorded: Array.isArray(d.recorded) ? d.recorded : [],
      alreadyOnFile: Array.isArray(d.alreadyOnFile) ? d.alreadyOnFile : [],
      missingConsents: Array.isArray(d.missingConsents) ? d.missingConsents : [],
      paperwork: d.paperwork ?? null,
    };
  },
};

export default onSiteConsentsApi;
