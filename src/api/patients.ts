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
  /** `-1` when the page was asked for without its count (`includeCount: false`); then `hasMore` says if another page exists. */
  totalCount: number;
  /** Only when the server answered a page without its count. */
  hasMore?: boolean;
  page: number;
  pageSize: number;
}

/** The most `GET /api/patients` answers in one page. */
export const PATIENT_PAGE_SIZE_MAX = 100;

/**
 * The server sends `phone` and `email` as `null` when the patient left none.
 * Said once here, so no screen has to tell "null" from "absent": either way
 * the field is simply not there.
 */
export function withContacts<T extends { phone?: string | null; email?: string | null }>(row: T): T {
  const out = { ...row };
  if (out.phone === null) delete out.phone;
  if (out.email === null) delete out.email;
  return out;
}

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
    params: { query?: string; page?: number; pageSize?: number; includeCount?: boolean } = {},
  ): Promise<PatientPage> => {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, PATIENT_PAGE_SIZE_MAX);
    const res = await client.get('/api/patients', {
      /* `includeCount=false` saves the server its count statement (network plan b6); an older server ignores it and counts. */
      params: { query: params.query?.trim() || undefined, page, pageSize, includeCount: params.includeCount === false ? false : undefined },
    });
    const items = extractItems<Patient>(res.data).map(withContacts);
    const totalCount =
      typeof res.data?.totalCount === 'number' ? res.data.totalCount : items.length;
    const hasMore = typeof res.data?.hasMore === 'boolean' ? res.data.hasMore : undefined;
    return { items, totalCount, ...(hasMore === undefined ? {} : { hasMore }), page, pageSize };
  },

  getById: async (id: string): Promise<Patient> => {
    const res = await client.get(`/api/patients/${id}`);
    return withContacts<Patient>(res.data?.value ?? res.data);
  },

  update: async (id: string, data: PatientIdentityCorrection): Promise<Patient> => {
    const res = await client.put(`/api/patients/${id}`, data);
    return res.data?.value ?? res.data;
  },

  /** `options.signal` cancels a search the next keystroke has made stale (the command palette). */
  search: async (query: string, options: { signal?: AbortSignal } = {}): Promise<Patient[]> => {
    const res = await client.get(`/api/patients/search?q=${encodeURIComponent(query)}`, { signal: options.signal });
    const d = res.data;
    return extractItems<Patient>(d).map(withContacts);
  },

  getProfile: async (id: string): Promise<any> => {
    const res = await client.get(`/api/patients/${id}/profile`);
    return res.data?.value ?? res.data;
  },
};
