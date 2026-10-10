/*
 * ARES lookup - `GET /api/ares/{ico}` (signed in), Etapa 12.
 *
 * The owner's rule for the club form: "It MUST be paired with ARES so that it
 * fills in everything." The server proxies the registry and answers one flat
 * subject; this module reads it tolerantly (a missing field is `null`, never a
 * crash) and turns a refusal into a typed `AresError` whose `message` is the
 * server's own Czech sentence, so the screens never write a refusal of their own.
 *
 *   200 { ico, name, dic, legalForm, street, city, postalCode, countryCode,
 *         established, dissolved, isActive, fetchedAtUtc }
 *   400 { code: "ares.ico_invalid", message }
 *   404 { code: "ares.not_found", message }
 *   502 { code: "ares.unavailable", message }
 */
import { AxiosError } from 'axios';
import client from './client';
import { isValidIco } from '../pages/clubs/payerForm';

/** One member of the statutory body, as the public register lists it. */
export interface AresManager {
  fullName: string;
  role: string;
  /** `yyyy-MM-dd` or null. */
  since: string | null;
  until: string | null;
}

export interface AresSubject {
  ico: string;
  name: string;
  dic: string | null;
  legalForm: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  /** `yyyy-MM-dd` or null. */
  established: string | null;
  /** `yyyy-MM-dd` or null; a date here means the subject no longer exists. */
  dissolved: string | null;
  isActive: boolean;
  fetchedAtUtc: string | null;
  /** The statutory body; empty when the register lists nobody or the server does not send it. */
  management: AresManager[];
}

export type AresErrorCode =
  | 'ares.ico_invalid'
  | 'ares.not_found'
  | 'ares.unavailable'
  | 'ares.offline'
  | 'ares.failed';

/** A refusal with the sentence to show. `message` is always Czech and never the raw exception. */
export class AresError extends Error {
  readonly code: AresErrorCode;
  readonly status: number | undefined;

  constructor(code: AresErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AresError';
    this.code = code;
    this.status = status;
  }
}

/** Spaces are how people write an IČO; they are never part of the value. */
export const normalizeIco = (text: string): string => text.replace(/[\s  ]/g, '');

/**
 * Whether the value is worth asking the registry about: eight digits and the
 * Czech mod-11 check digit. The rule itself lives with the payer form
 * (`isValidIco`); this is the same rule, not a second copy of it.
 */
export const isPlausibleIco = (text: string): boolean => isValidIco(normalizeIco(text));

/** Shown only when the server sent no sentence of its own. */
const FALLBACK_MESSAGE: Record<AresErrorCode, string> = {
  'ares.ico_invalid': 'IČO nemá správný tvar.',
  'ares.not_found': 'Subjekt s tímto IČO v ARES není.',
  'ares.unavailable': 'ARES teď neodpovídá. Zkuste to za chvíli.',
  'ares.offline': 'Server je nedostupný. Zkuste to za chvíli.',
  'ares.failed': 'Načtení z ARES se nepodařilo.',
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** The subject, whatever is missing. Only `ico` and `name` are required to be a subject at all. */
export function readAresSubject(data: unknown): AresSubject {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const ico = str(r.ico);
  const name = str(r.name);
  if (ico === null || name === null) {
    throw new AresError('ares.failed', FALLBACK_MESSAGE['ares.failed']);
  }
  return {
    ico,
    name,
    dic: str(r.dic),
    legalForm: str(r.legalForm),
    street: str(r.street),
    city: str(r.city),
    postalCode: str(r.postalCode),
    countryCode: str(r.countryCode),
    established: str(r.established),
    dissolved: str(r.dissolved),
    /* Absent means active: a server that does not say otherwise has found a living subject. */
    isActive: r.isActive !== false,
    fetchedAtUtc: str(r.fetchedAtUtc),
    management: readAresManagement(r.management),
  };
}

/** The statutory body, tolerant: not an array → nobody; a row without a name is skipped. */
export function readAresManagement(data: unknown): AresManager[] {
  if (!Array.isArray(data)) return [];
  const out: AresManager[] = [];
  for (const row of data) {
    const m = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const fullName = str(m.fullName);
    if (fullName === null) continue;
    out.push({ fullName, role: str(m.role) ?? '', since: str(m.since), until: str(m.until) });
  }
  return out;
}

const CODE_BY_STATUS: Record<number, AresErrorCode> = {
  400: 'ares.ico_invalid',
  404: 'ares.not_found',
  502: 'ares.unavailable',
  503: 'ares.unavailable',
  504: 'ares.unavailable',
};

const KNOWN_CODES = new Set<string>(['ares.ico_invalid', 'ares.not_found', 'ares.unavailable']);

export function toAresError(error: unknown): AresError {
  if (error instanceof AresError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === undefined) return new AresError('ares.offline', FALLBACK_MESSAGE['ares.offline']);
    const body = (error.response?.data && typeof error.response.data === 'object' ? error.response.data : {}) as Record<string, unknown>;
    const bodyCode = typeof body.code === 'string' && KNOWN_CODES.has(body.code) ? (body.code as AresErrorCode) : undefined;
    const code = bodyCode ?? CODE_BY_STATUS[status] ?? 'ares.failed';
    const message = typeof body.message === 'string' && body.message.trim() !== '' ? body.message.trim() : FALLBACK_MESSAGE[code];
    return new AresError(code, message, status);
  }
  return new AresError('ares.failed', FALLBACK_MESSAGE['ares.failed']);
}

export const aresApi = {
  /** The subject for an IČO. Rejects with `AresError`; refuses a non-plausible IČO before asking. */
  lookup: async (ico: string): Promise<AresSubject> => {
    const clean = normalizeIco(ico);
    if (!isPlausibleIco(clean)) throw new AresError('ares.ico_invalid', FALLBACK_MESSAGE['ares.ico_invalid']);
    try {
      const res = await client.get(`/api/ares/${encodeURIComponent(clean)}`);
      return readAresSubject(res.data);
    } catch (error) {
      throw toAresError(error);
    }
  },
};

export default aresApi;
