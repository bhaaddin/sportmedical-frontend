/*
 * The patient screen and the overview screen (network plan NET-11): `GET /api/v1/screens/patient/{id}` and
 * `GET /api/v1/screens/overview?from&to&today` answer in ONE request what the patient card and the owner's Přehled read one
 * by one. Like `clubScreen.ts` they change nothing about what a page reads:
 *
 *   - a section arrives as `{ data }` or `{ error }`; a section that is missing, failed or does not parse is simply not used,
 *     and the page reads it the way it always did;
 *   - a server without the route (404 / 405 with no code) is not asked again by this tab for 10 minutes (sessionStorage);
 *     any other failure (offline, 5xx) is left alone for a minute; a refusal of the whole screen (401 / 403 / a 404 that
 *     carries a code) is never remembered - the page's own reads then give the proper message;
 *   - the functions never reject.
 */
import type { QueryClient } from '@tanstack/react-query';
import client from './client';
import { dayAppointmentListSchema } from './bookingContracts';
import { toOrder } from './clubOrders';
import { patientClubsKey, readPatientClubs, type PatientClubMembership } from './patientClubs';
import { withContacts, type Patient } from './patients';
import type { DocumentTemplate, PatientDocument } from './documents';

const BACKOFF_MS = 60_000;
const UNSUPPORTED_MS = 10 * 60_000;

type Section = { data?: unknown; error?: unknown } | null | undefined;

const dataOf = (section: Section): unknown =>
  section === null || section === undefined || typeof section !== 'object' || section.data === null ? undefined : section.data;

/** What a screen route taught us about the server, remembered for this tab. */
function makeMemo(name: string) {
  const key = `sm.screen.${name}.unsupportedUntil`;
  const read = (): number => {
    try {
      const at = Number(window.sessionStorage.getItem(key));
      return Number.isFinite(at) ? at : 0;
    } catch {
      return 0;
    }
  };
  let blockedUntil = read();
  return {
    blocked: (): boolean => Date.now() < blockedUntil,
    reset: (): void => {
      blockedUntil = 0;
      try { window.sessionStorage.removeItem(key); } catch { /* nothing stored */ }
    },
    learn: (error: unknown): void => {
      const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | undefined)?.response;
      const status = response?.status;
      if (status === 401 || status === 403) return;
      if (status === 404 && typeof response?.data?.code === 'string') return;
      const unsupported = status === 404 || status === 405;
      blockedUntil = Date.now() + (unsupported ? UNSUPPORTED_MS : BACKOFF_MS);
      if (unsupported) {
        try { window.sessionStorage.setItem(key, String(blockedUntil)); } catch { /* this load asks once more */ }
      }
    },
  };
}

const patientMemo = makeMemo('patient');
const overviewMemo = makeMemo('overview');

/** Test hook: forget what was learned about the server. */
export function resetScreensForTests(): void {
  patientMemo.reset();
  overviewMemo.reset();
}

const sectionsOf = (body: unknown): Record<string, Section> | null => {
  const sections = (body as { sections?: unknown } | null)?.sections;
  return sections !== null && typeof sections === 'object' ? (sections as Record<string, Section>) : null;
};

const attempt = <T,>(run: () => T | undefined): T | undefined => {
  try {
    return run();
  } catch {
    return undefined;
  }
};

/* ── The patient screen ── */

/** Every field is present only when its section arrived and parsed; the card reads the rest itself. */
export interface PatientScreenData {
  patient?: Patient;
  profile?: Record<string, unknown>;
  documents?: PatientDocument[];
  documentCheck?: { allRequiredPresent: boolean; requirements: unknown[] };
  documentTemplates?: DocumentTemplate[];
  clubs?: PatientClubMembership[];
}

export async function fetchPatientScreen(patientId: string): Promise<PatientScreenData> {
  if (patientId === '' || patientMemo.blocked()) return {};
  try {
    const res = await client.get(`/api/v1/screens/patient/${encodeURIComponent(patientId)}`);
    const sections = sectionsOf(res.data);
    if (sections === null) return {};
    const out: PatientScreenData = {};
    const patient = attempt(() => {
      const raw = dataOf(sections.patient);
      return raw !== undefined && typeof raw === 'object' && (raw as { id?: unknown }).id === patientId ? withContacts(raw as Patient) : undefined;
    });
    if (patient !== undefined) out.patient = patient;
    const profile = attempt(() => {
      const raw = dataOf(sections.profile);
      return raw !== undefined && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined;
    });
    if (profile !== undefined) out.profile = profile;
    const documents = attempt(() => {
      const raw = dataOf(sections.documents);
      return Array.isArray(raw) ? (raw as PatientDocument[]) : undefined;
    });
    if (documents !== undefined) out.documents = documents;
    const check = attempt(() => {
      const raw = dataOf(sections.documentCheck) as { allRequiredPresent?: unknown; requirements?: unknown } | undefined;
      if (raw === undefined || typeof raw !== 'object') return undefined;
      return { allRequiredPresent: raw.allRequiredPresent === true, requirements: Array.isArray(raw.requirements) ? raw.requirements : [] };
    });
    if (check !== undefined) out.documentCheck = check;
    const templates = attempt(() => {
      const raw = dataOf(sections.documentTemplates);
      return Array.isArray(raw) ? (raw as DocumentTemplate[]) : undefined;
    });
    if (templates !== undefined) out.documentTemplates = templates;
    const clubs = attempt(() => {
      const raw = dataOf(sections.clubs);
      return Array.isArray(raw) ? readPatientClubs(raw) : undefined;
    });
    if (clubs !== undefined) out.clubs = clubs;
    return out;
  } catch (error) {
    patientMemo.learn(error);
    return {};
  }
}

/** The clubs section goes where the card's own read would have put it. */
export function seedPatientClubs(queryClient: QueryClient, patientId: string, clubs: PatientClubMembership[] | undefined): void {
  if (clubs !== undefined) queryClient.setQueryData(patientClubsKey(patientId), clubs);
}

/* ── The overview screen ── */

export const OVERVIEW_PERMISSION = 'patients.view';

export function overviewScreenBlocked(): boolean {
  return overviewMemo.blocked();
}

/**
 * Seeds the owner's Přehled keys (the week, the club orders asked for, the names of today's registered patients) from one
 * request. Resolves with whether anything was seeded; never rejects. The account and the notifications keep their own readers.
 */
export async function seedOverviewScreen(
  queryClient: QueryClient,
  range: { from: string; to: string; today: string },
  options: { weekKey: readonly unknown[]; mayViewPatients: boolean },
): Promise<boolean> {
  if (overviewMemo.blocked()) return false;
  try {
    const res = await client.get('/api/v1/screens/overview', { params: { from: range.from, to: range.to, today: range.today } });
    const sections = sectionsOf(res.data);
    if (sections === null) return false;
    let seeded = false;
    const week = attempt(() => {
      const raw = dataOf(sections.week);
      return raw === undefined ? undefined : dayAppointmentListSchema.parse(raw);
    });
    if (week !== undefined) {
      queryClient.setQueryData(options.weekKey, week);
      seeded = true;
    }
    if (options.mayViewPatients) {
      const orders = attempt(() => {
        const raw = dataOf(sections.clubOrders);
        return Array.isArray(raw) ? raw.map(toOrder) : undefined;
      });
      if (orders !== undefined) {
        queryClient.setQueryData(['shelf', 'club-orders', 'Requested'], orders);
        seeded = true;
      }
      const patients = attempt(() => {
        const raw = dataOf(sections.patients);
        return raw !== undefined && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
      });
      if (patients !== undefined) {
        for (const [id, dto] of Object.entries(patients)) {
          if (dto !== null && typeof dto === 'object' && (dto as { id?: unknown }).id === id) {
            queryClient.setQueryData(['patient', id], withContacts(dto as Patient));
          }
        }
      }
    }
    return seeded;
  } catch (error) {
    overviewMemo.learn(error);
    return false;
  }
}
