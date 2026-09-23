import client from './client';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  status?: string;
  fullName?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/**
 * A correction to a patient's name, date of birth or sex.
 *
 * Those identify the patient, so the server refuses the change without a
 * reason; the author is whoever is signed in. Both go to the audit trail with
 * the change.
 */
export interface PatientIdentityCorrection {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string;
  sex: string;
  changeReason: string;
}

/** One page of the register, and how many patients match in all. */
export interface PatientPage {
  items: Patient[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** The most `GET /api/patients` answers in one page. */
export const PATIENT_PAGE_SIZE_MAX = 100;

function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data?.items) return data.items;
  return [];
}

export const patientsApi = {
  /**
   * One page of the register, searched on the server.
   *
   * The route pages - twenty rows unless asked for more, at most a hundred -
   * so the answer is a page plus `totalCount`, never "every patient".
   */
  list: async (
    params: { query?: string; page?: number; pageSize?: number } = {},
  ): Promise<PatientPage> => {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, PATIENT_PAGE_SIZE_MAX);
    const res = await client.get('/api/patients', {
      params: { query: params.query?.trim() || undefined, page, pageSize },
    });
    const items = extractItems<Patient>(res.data);
    const totalCount =
      typeof res.data?.totalCount === 'number' ? res.data.totalCount : items.length;
    return { items, totalCount, page, pageSize };
  },

  getById: async (id: string): Promise<Patient> => {
    const res = await client.get(`/api/patients/${id}`);
    return res.data?.value ?? res.data;
  },

  update: async (id: string, data: PatientIdentityCorrection): Promise<Patient> => {
    const res = await client.put(`/api/patients/${id}`, data);
    return res.data?.value ?? res.data;
  },

  search: async (query: string): Promise<Patient[]> => {
    const res = await client.get(`/api/patients/search?q=${encodeURIComponent(query)}`);
    const d = res.data;
    return extractItems<Patient>(d);
  },

  getProfile: async (id: string): Promise<any> => {
    const res = await client.get(`/api/patients/${id}/profile`);
    return res.data?.value ?? res.data;
  },
};
