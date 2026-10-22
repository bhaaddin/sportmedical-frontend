import { useQuery } from '@tanstack/react-query';
import { toBookingError } from '../../../api/apiError';
import { patientsApi } from '../../../api/patients';
import { DEBOUNCE_MS, toHit, useDebounced, type PatientHit } from '../patient/patientTypeahead';
import { looksLikePhone, phoneMatches } from './phoneMatch';

/**
 * R15c (f): the patient picker finds a patient by telephone number. The register's search takes names only, and a query travels in
 * the URL - a number must never be put there. So a phone query reads the register page by page WITHOUT any query parameter and
 * matches the number here (`phoneMatch.ts`). At most `MAX_PAGES` pages of 100 are read (one cached scan, reused by every
 * keystroke); a larger register says so ("prohledáno prvních N pacientů") instead of pretending to be complete.
 */
export const SCAN_PAGE_SIZE = 100;
export const MAX_PAGES = 10;

export interface RegisterScan {
  rows: PatientHit[];
  /** The whole register was read. */
  complete: boolean;
}

export async function scanRegister(): Promise<RegisterScan> {
  const rows: PatientHit[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await patientsApi.list({ page, pageSize: SCAN_PAGE_SIZE });
    for (const item of result.items) {
      const hit = toHit(item);
      if (hit) rows.push(hit);
    }
    if (rows.length >= result.totalCount || result.items.length < SCAN_PAGE_SIZE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

export interface PhoneSearch {
  /** The typed text is a phone number, so this search (not the name search) answers. */
  active: boolean;
  hits: PatientHit[];
  /** Only the first `scanned` patients were read. */
  scanned: number | null;
  isFetching: boolean;
  isSettled: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePhoneSearch(input: string, enabled: boolean): PhoneSearch {
  const debounced = useDebounced(input, DEBOUNCE_MS);
  const active = looksLikePhone(input);
  const ready = looksLikePhone(debounced);
  const scan = useQuery({
    /* the key carries no part of the typed number */
    queryKey: ['patient-register-scan'],
    queryFn: async () => {
      try {
        return await scanRegister();
      } catch (error) {
        throw toBookingError(error);
      }
    },
    enabled: enabled && active,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
  const hits = ready && scan.data ? scan.data.rows.filter((h) => phoneMatches(h.phone, debounced)) : [];
  return {
    active,
    hits,
    scanned: scan.data && !scan.data.complete ? scan.data.rows.length : null,
    isFetching: scan.isFetching || debounced !== input,
    isSettled: scan.isSuccess || scan.isError,
    error: scan.error,
    refetch: () => void scan.refetch(),
  };
}
