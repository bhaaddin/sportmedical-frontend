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
import { patientClubsKey, readPatientClubs, type PatientClubMembership } from './patientClubs';
import { withContacts, type Patient } from './patients';
import type { DocumentTemplate, PatientDocument } from './documents';
import { attempt, dataOf, makeMemo, sectionsOf } from './screenCore';
import { overviewMemo } from './overviewScreen';

export { OVERVIEW_PERMISSION, overviewScreenBlocked, seedOverviewScreen } from './overviewScreen';

const patientMemo = makeMemo('patient');

/** Test hook: forget what was learned about the server. */
export function resetScreensForTests(): void {
  patientMemo.reset();
  overviewMemo.reset();
}

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

