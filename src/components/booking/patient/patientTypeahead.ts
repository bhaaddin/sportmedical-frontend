import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../../api/patients';
import { toBookingError } from '../../../api/apiError';

/**
 * Finding an existing patient while the caller is still on the line - the
 * owner's "Vyhledávání z databáze": start typing, the database offers who it
 * knows, click the right one.
 *
 * It asks `GET /api/patients?query=` (the server-side, paged search over every
 * patient row, diacritics-insensitive since 10. 9. 2026). That route matches the
 * query against the first name OR the surname as a whole, so "Filip Fehér"
 * typed in full would match neither field and find nobody. The longest word
 * typed goes to the server, and the page that comes back is narrowed to rows
 * where every typed word is part of the first name or the surname - the same
 * "contains" the server applies to one word, applied to the others.
 */

/** One row of the search, the fields this dialog uses. */
export interface PatientHit {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** `yyyy-MM-dd`, or null when the row carries none. */
  dateOfBirth: string | null;
}

/** Enough to ask the server; fewer letters would page through half the register. */
export const MIN_QUERY_LENGTH = 2;

/** How long typing must pause before the server is asked. */
export const DEBOUNCE_MS = 300;

/** One page, big enough that a common surname plus a first name still finds its row. */
export const PAGE_SIZE = 50;

/** Lower case, no diacritics, single spaces: "  Fehér  Filip" -> "feher filip". */
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchTerms {
  /** The single word sent to the server - the longest, as typed. */
  serverQuery: string;
  /** Every typed word, folded, that a row must contain. */
  tokens: string[];
}

/** What to ask for, or null while there is too little typed to ask. */
export function searchTerms(input: string): SearchTerms | null {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  /* Longest word; on a tie the later one, which is usually the surname. */
  const serverQuery = words.reduce((a, b) => (b.length >= a.length ? b : a));
  if (serverQuery.length < MIN_QUERY_LENGTH) return null;
  return { serverQuery, tokens: words.map(foldName) };
}

/** Every token is part of the first name or of the surname. */
export function matchesAllTokens(
  hit: Pick<PatientHit, 'firstName' | 'lastName'>,
  tokens: readonly string[],
): boolean {
  const fields = [foldName(hit.firstName), foldName(hit.lastName)];
  return tokens.every((t) => fields.some((f) => f.includes(t)));
}

/**
 * The rows whose name appears more than once in the list - three "Filip Fehér"
 * need a way to be told apart before one of them is booked. Compared folded, so
 * "Fehér" and "Feher" count as the same name: to the person reading the list
 * they are.
 */
export function duplicateNameIds(hits: readonly PatientHit[]): Set<string> {
  const byName = new Map<string, string[]>();
  for (const h of hits) {
    const key = foldName(`${h.firstName} ${h.lastName}`);
    byName.set(key, [...(byName.get(key) ?? []), h.id]);
  }
  const out = new Set<string>();
  for (const ids of byName.values()) {
    if (ids.length > 1) ids.forEach((id) => out.add(id));
  }
  return out;
}

export function displayName(hit: PatientHit): string {
  return hit.fullName || `${hit.firstName} ${hit.lastName}`.trim() || hit.id;
}

/** A row of `GET /api/patients`, read field by field so a missing one cannot throw. */
export function toHit(row: unknown): PatientHit | null {
  const r = (row ?? {}) as Record<string, unknown>;
  const str = (key: string): string => (typeof r[key] === 'string' ? (r[key] as string) : '');
  const id = str('id') || str('patientId');
  if (!id) return null;
  return {
    id,
    firstName: str('firstName'),
    lastName: str('lastName'),
    fullName: str('fullName'),
    dateOfBirth: str('dateOfBirth') ? str('dateOfBirth').slice(0, 10) : null,
  };
}

/** The value, once it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export interface PatientTypeahead {
  /** Null while too little is typed to search. */
  terms: SearchTerms | null;
  hits: PatientHit[];
  /** The server had more rows for the word than one page carries. */
  truncated: boolean;
  isFetching: boolean;
  isSettled: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePatientTypeahead(input: string, enabled: boolean): PatientTypeahead {
  const debounced = useDebounced(input, DEBOUNCE_MS);
  const terms = searchTerms(debounced);

  const query = useQuery({
    queryKey: ['patient-typeahead', terms?.serverQuery ?? ''],
    queryFn: async () => {
      try {
        return await patientsApi.list({ query: terms?.serverQuery, page: 1, pageSize: PAGE_SIZE });
      } catch (error) {
        throw toBookingError(error);
      }
    },
    enabled: enabled && terms !== null,
    staleTime: 30_000,
  });

  const rows = (query.data?.items ?? [])
    .map(toHit)
    .filter((h): h is PatientHit => h !== null);
  const hits = terms ? rows.filter((h) => matchesAllTokens(h, terms.tokens)) : [];

  return {
    terms,
    hits,
    truncated: (query.data?.totalCount ?? 0) > rows.length,
    isFetching: query.isFetching || debounced !== input,
    isSettled: query.isSuccess || query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
